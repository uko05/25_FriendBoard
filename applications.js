// applications.js
// 「申請」機能：さがす画面で非公開/承認制の項目を直接載せず、気になったらサイト内で
// 申請→相手が申請者の情報を見て承認/却下→承認されたら承認制の項目が見られる、という流れ。
// 通知トーストは 14_GenshinOmikuji/feed.js の いいね通知(showLikeToast) と同じ仕組み。

import { db } from './firebaseConfig.js';
import { store } from './userData.js';
import { avatarUrl, getMyAvatar } from './avatar.js';
import {
  VISIBILITY_FIELDS, FIELD_GROUPS, PLAYSTYLE_OFFER_VALUES, PLAYSTYLE_REQUEST_VALUES, GENSHIN_ICON_BASE,
  fieldLabel, formatFieldValue, buildPostFieldBuckets,
  fieldMatchKind, playStyleValueMatchKind,
} from './fields.js';
import {
  collection, addDoc, updateDoc, doc, getDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const STR = {
  ja: {
    noName: '名無しの旅人',
    newApplicationToast: (name) => `${name}さんから申請が届きました`,
    acceptedToast: '申請が承認されました！詳細を確認しましょう',
    rejectedToast: '申請が見送られました',
    emptyReceived: 'まだ届いた申請はありません',
    emptySent: 'まだ申請を送っていません',
    acceptBtn: '承認する',
    rejectBtn: '見送る',
    statusPending: '返答待ち',
    statusAccepted: '承認済み',
    statusRejected: '見送り',
    revealedTitle: '公開された情報',
    profileIncomplete: '先に「マイプロフィール」タブで原神UID・サーバーを入力・保存してください。',
    applyFail: '申請に失敗しました。時間をおいて再度お試しください。',
    respondFail: '処理に失敗しました。',
    secretFieldsNote: (labels) => `🔒 ${labels} は承認後に確認できます`,
    groupTitles: { basic: '基本情報', style: 'あなたについて', contact: '連絡・時間帯', voice: 'ボイスチャット', sns: 'つながれるSNS' },
    playStyleOfferTitle: '手伝います！',
    playStyleRequestTitle: '手伝ってください！',
    uidLabel: 'UID',
    originalPostTitle: '元の投稿',
    originalPostGone: 'この投稿は取り下げられたか見つかりませんでした。',
    chatComposerPlaceholder: 'メッセージを入力...',
    chatSendBtn: '送信',
    chatWaitingNote: '相手の返信をお待ちください',
    chatEndedNote: 'やり取りは終了しました（最大10往復まで）',
    chatRemainingNote: (n) => `あと${n}通やり取りできます`,
  },
  en: {
    noName: 'Nameless Traveler',
    newApplicationToast: (name) => `${name} sent you a request!`,
    acceptedToast: 'Your request was accepted! Check the details',
    rejectedToast: 'Your request was passed on',
    emptyReceived: 'No requests received yet',
    emptySent: "You haven't sent any requests yet",
    acceptBtn: 'Accept',
    rejectBtn: 'Pass',
    statusPending: 'Pending',
    statusAccepted: 'Accepted',
    statusRejected: 'Passed',
    revealedTitle: 'Revealed info',
    profileIncomplete: 'Please fill in and save your Genshin UID and server on the "My Profile" tab first.',
    applyFail: 'Failed to apply. Please try again later.',
    respondFail: 'Failed to process.',
    secretFieldsNote: (labels) => `🔒 ${labels} available after approval`,
    groupTitles: { basic: 'Basic Info', style: 'About You', contact: 'Contact & Availability', voice: 'Voice Chat', sns: 'SNS' },
    playStyleOfferTitle: 'I can help with...',
    playStyleRequestTitle: 'Please help me with...',
    uidLabel: 'UID',
    originalPostTitle: 'Original post',
    originalPostGone: 'This post was withdrawn or could not be found.',
    chatComposerPlaceholder: 'Type a message...',
    chatSendBtn: 'Send',
    chatWaitingNote: "Waiting for their reply",
    chatEndedNote: 'This conversation has ended (up to 10 exchanges).',
    chatRemainingNote: (n) => `${n} message${n === 1 ? '' : 's'} left in this exchange`,
  },
};

function currentLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'ja';
}
function s() { return STR[currentLang()]; }

function relTime(ts) {
  if (!ts || typeof ts.toMillis !== 'function') return '';
  const min = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (min < 1) return currentLang() === 'en' ? 'just now' : 'たった今';
  if (min < 60) return currentLang() === 'en' ? `${min}m ago` : `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return currentLang() === 'en' ? `${hour}h ago` : `${hour}時間前`;
  return currentLang() === 'en' ? `${Math.floor(hour / 24)}d ago` : `${Math.floor(hour / 24)}日前`;
}

// genshinUid/displayNameはさがす一覧と同じくヘッダー側で個別描画するため、枠内のチップには出さない
const HEAD_FIELDS = new Set(['genshinUid', 'displayName']);

// {key: value} のオブジェクトを、枠(FIELD_GROUPS)描画用の行データ配列に整形する。
// さがす一覧と同じ「一致/相性◎」の色分けができるよう、自分のプロフィール(myValues)との
// 比較結果もここで一緒に計算しておく。oshiCharsはアイコン行、playStylesは値ごとに
// 個別の行へ分ける(1チップにまとめると、どの値が一致/相性なのか色分けできなくなるため)。
// revealed: trueなら、承認によって今まさに見えるようになった項目として黄色チップにする
function buildFieldRows(dict, lang, myValues, revealed) {
  if (!dict) return [];
  const rows = [];
  VISIBILITY_FIELDS.forEach((key) => {
    if (key === 'friendPreference' || key === 'showGenshinRanking' || key === 'showGenshinCheck' || HEAD_FIELDS.has(key)) return;
    const value = dict[key];
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return;
    if (key === 'oshiChars' || key === 'sameOshiChars') { rows.push({ key, oshiIcons: value }); return; }
    if (key === 'playStyles') {
      value.forEach((v) => {
        const text = formatFieldValue('playStyles', [v], lang);
        if (text) rows.push({ key, value: v, text, matchKind: playStyleValueMatchKind(myValues.playStyles, v), revealed });
      });
      return;
    }
    const text = formatFieldValue(key, value, lang);
    if (text) rows.push({ key, text: `${fieldLabel(key, lang)}: ${text}`, matchKind: fieldMatchKind(myValues[key], value, key), revealed });
  });
  return rows;
}

// 申請メッセージ/承認時の返信を、LINEのようなチャット吹き出し形式で描画する。
// messages: [{ text, mine, avatarSrc }, ...] を時系列順(申請メッセージ→返信)に渡す。
// mine=trueは自分の発言として右寄せ、falseは相手の発言として左寄せにする。
// どちらの側もアイコンを吹き出しのしっぽ側(自分=右端、相手=左端)に表示する。
function renderChatThread(container, messages) {
  const list = messages.filter((m) => m.text);
  if (!list.length) return;
  const chat = document.createElement('div');
  chat.className = 'board-chat';
  list.forEach(({ text, mine, avatarSrc }) => {
    const row = document.createElement('div');
    row.className = mine ? 'board-chat-row board-chat-row-me' : 'board-chat-row board-chat-row-them';

    const av = document.createElement('img');
    av.className = 'board-chat-avatar';
    av.src = avatarSrc;
    av.alt = '';

    const bubble = document.createElement('div');
    bubble.className = mine ? 'board-chat-bubble board-chat-bubble-me' : 'board-chat-bubble board-chat-bubble-them';
    bubble.textContent = text;

    if (mine) {
      row.appendChild(bubble);
      row.appendChild(av);
    } else {
      row.appendChild(av);
      row.appendChild(bubble);
    }
    chat.appendChild(row);
  });
  container.appendChild(chat);
}

// 承認後のチャットは最大10往復(=20通)まで。申請時のメッセージ(app.message)と
// 「承認する」という行為自体はこのカウントに含めない(=chatMessagesとは別枠)。
// そのため、承認直後でchatMessagesが空の状態に限っては、募集主・申請者どちらから
// 送ってもよい(「無言で承認」した場合に誰も送れず詰むのを防ぐため)。それ以降は
// 直前の送信者と同じ人は連続して送れない。
const CHAT_MAX_MESSAGES = 20;
function canSendChat(app, sender) {
  if (app.status !== 'accepted') return false;
  const msgs = app.chatMessages || [];
  if (msgs.length >= CHAT_MAX_MESSAGES) return false;
  if (!msgs.length) return true;
  return msgs[msgs.length - 1].sender !== sender;
}

// sender: 'owner'|'applicant'。承認後、自分の番であれば入力欄を、そうでなければ
// 「相手の返信を待って」等の案内だけを表示する。残り送信可能数(お互い共通のプール)は
// 何回でも送れるように見えて誤解されないよう、常に案内しておく。
function renderChatComposer(container, app, sender) {
  if (app.status !== 'accepted') return;
  const msgs = app.chatMessages || [];
  const remaining = CHAT_MAX_MESSAGES - msgs.length;

  if (remaining <= 0) {
    const note = document.createElement('p');
    note.className = 'board-chat-note';
    note.textContent = s().chatEndedNote;
    container.appendChild(note);
    return;
  }

  const countNote = document.createElement('p');
  countNote.className = 'board-chat-note';
  countNote.textContent = s().chatRemainingNote(remaining);
  container.appendChild(countNote);

  if (!canSendChat(app, sender)) {
    const note = document.createElement('p');
    note.className = 'board-chat-note';
    note.textContent = s().chatWaitingNote;
    container.appendChild(note);
    return;
  }

  const composer = document.createElement('div');
  composer.className = 'board-chat-composer';

  const input = document.createElement('textarea');
  input.className = 'board-chat-composer-input';
  input.rows = 2;
  input.maxLength = MESSAGE_MAXLEN;
  input.placeholder = s().chatComposerPlaceholder;
  composer.appendChild(input);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'board-chat-composer-send';
  sendBtn.textContent = s().chatSendBtn;
  sendBtn.addEventListener('click', async () => {
    const text = input.value.trim().slice(0, MESSAGE_MAXLEN);
    if (!text) return;
    sendBtn.disabled = true;
    input.disabled = true;
    try {
      await sendChatMessage(app, sender, text);
    } catch (e) {
      console.error('[applications] send chat message failed', e);
      alert(s().respondFail);
      sendBtn.disabled = false;
      input.disabled = false;
    }
  });
  composer.appendChild(sendBtn);

  container.appendChild(composer);
}

function appendChip(parent, { text, matchKind, revealed }) {
  const chip = document.createElement('span');
  chip.className = revealed ? 'board-card-chip board-request-revealed-chip' : 'board-card-chip';
  if (matchKind === 'exact') chip.classList.add('board-card-chip-matched');
  else if (matchKind === 'complementary') chip.classList.add('board-card-chip-complementary');
  chip.textContent = text;
  parent.appendChild(chip);
}

// rowsを、さがす一覧と同じカテゴリー別の枠(FIELD_GROUPS)に区切って描画する。
// oshiChars(推しキャラ)は呼び出し側でextractOshiRowにより抜き出し、アバター下へ
// 縦並びの別表示にするため、ここには含まれない想定(sameOshiCharsは通常通りここで
// 小さいアイコンとして表示する)。
function renderGroupedFields(container, rows, lang) {
  FIELD_GROUPS.forEach((group) => {
    const groupRows = rows.filter((row) => group.fields.includes(row.key));
    if (!groupRows.length) return;

    const box = document.createElement('div');
    box.className = 'board-card-group';
    const title = document.createElement('p');
    title.className = 'board-card-group-title';
    title.textContent = s().groupTitles[group.key] || group.key;
    box.appendChild(title);

    const playStyleRows = groupRows.filter((row) => row.key === 'playStyles');
    const otherRows = groupRows.filter((row) => row.key !== 'playStyles');
    const generalPs = playStyleRows.filter((row) => !PLAYSTYLE_OFFER_VALUES.includes(row.value) && !PLAYSTYLE_REQUEST_VALUES.includes(row.value));
    const offerPs = playStyleRows.filter((row) => PLAYSTYLE_OFFER_VALUES.includes(row.value));
    const requestPs = playStyleRows.filter((row) => PLAYSTYLE_REQUEST_VALUES.includes(row.value));

    const chips = document.createElement('div');
    chips.className = 'board-card-chips';
    [...otherRows, ...generalPs].forEach((row) => {
      if (row.oshiIcons) {
        row.oshiIcons.forEach((icon) => {
          const img = document.createElement('img');
          img.className = 'board-card-oshi-icon';
          img.src = GENSHIN_ICON_BASE + icon;
          img.alt = '';
          img.loading = 'lazy';
          chips.appendChild(img);
        });
        return;
      }
      appendChip(chips, row);
    });
    box.appendChild(chips);

    if (offerPs.length) {
      const offerBox = document.createElement('div');
      offerBox.className = 'board-card-group board-card-group-nested board-card-group-offer';
      const offerTitle = document.createElement('p');
      offerTitle.className = 'board-card-group-title board-card-group-title-offer';
      offerTitle.textContent = s().playStyleOfferTitle;
      offerBox.appendChild(offerTitle);
      const offerChips = document.createElement('div');
      offerChips.className = 'board-card-chips';
      offerPs.forEach((row) => appendChip(offerChips, row));
      offerBox.appendChild(offerChips);
      box.appendChild(offerBox);
    }
    if (requestPs.length) {
      const requestBox = document.createElement('div');
      requestBox.className = 'board-card-group board-card-group-nested board-card-group-request';
      const requestTitle = document.createElement('p');
      requestTitle.className = 'board-card-group-title board-card-group-title-request';
      requestTitle.textContent = s().playStyleRequestTitle;
      requestBox.appendChild(requestTitle);
      const requestChips = document.createElement('div');
      requestChips.className = 'board-card-chips';
      requestPs.forEach((row) => appendChip(requestChips, row));
      requestBox.appendChild(requestChips);
      box.appendChild(requestBox);
    }

    container.appendChild(box);
  });
}

// rowsから推しキャラ(oshiChars)の行を1つ抜き出す。項目数が多いカードだと枠内の
// 文字と被って見づらいため、呼び出し側でアバターの下に縦並び表示するのに使う。
function extractOshiRow(rows) {
  const idx = rows.findIndex((row) => row.key === 'oshiChars');
  if (idx === -1) return { rest: rows, oshiIcons: null };
  return { rest: rows.filter((_, i) => i !== idx), oshiIcons: rows[idx].oshiIcons };
}

// アバターの下に推しキャラアイコンを縦並びで表示する(さがす一覧のカードと同じ体裁)。
function appendOshiIcons(avatarCol, icons, lang) {
  const wrap = document.createElement('div');
  wrap.className = 'board-card-oshi-col';
  const label = document.createElement('span');
  label.className = 'board-card-oshi-col-label';
  label.textContent = fieldLabel('oshiChars', lang);
  wrap.appendChild(label);
  icons.forEach((icon) => {
    const img = document.createElement('img');
    img.className = 'board-card-oshi-icon-lg';
    img.src = GENSHIN_ICON_BASE + icon;
    img.alt = '';
    img.loading = 'lazy';
    wrap.appendChild(img);
  });
  avatarCol.appendChild(wrap);
}

// 送った申請一覧に常時表示する「元の投稿」は、一覧が再描画されるたび(チャットで
// メッセージが届くたびに再描画される)に呼ばれるため、同じpostIdは一度取得したら
// メモリにキャッシュし、Firestoreへの無駄な読み取りを避ける。
const originalPostCache = new Map();

async function fetchPostCached(postId) {
  if (originalPostCache.has(postId)) return originalPostCache.get(postId);
  let post = null;
  try {
    const snap = await getDoc(doc(db, 'friendBoardPosts', postId));
    post = snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('[applications] fetch original post failed', e);
  }
  originalPostCache.set(postId, post);
  return post;
}

// 送った申請一覧の「元の投稿」用: 対象の投稿を(キャッシュ経由で)取得し、さがす一覧と
// 同じ形式(名前/UIDヘッダー＋カテゴリー別の枠)で描画する。承認済みなら、既にrevealedFields
// に入っている情報(=募集主が承認時に公開した項目)もあわせて表示する。
// avatarCol: この投稿の主(募集主)のアバターは、カード上部のavatarColと同一人物なので、
// 推しキャラもさがす一覧と同じくそこへ縦並びで追加する(横並びのboard-card-oshi-rowは使わない)。
async function renderOriginalPostInto(container, avatarCol, app, lang) {
  const post = await fetchPostCached(app.postId);
  container.innerHTML = '';
  if (!post) {
    const msg = document.createElement('p');
    msg.className = 'board-list-empty';
    msg.textContent = s().originalPostGone;
    container.appendChild(msg);
    return;
  }

  const accepted = app.status === 'accepted';
  const displayName = (accepted && app.revealedFields?.displayName) || post.publicFields?.displayName;
  const uidValue = (accepted && app.revealedFields?.genshinUid) || post.publicFields?.genshinUid;

  if (displayName) {
    const nameEl = document.createElement('div');
    nameEl.className = 'board-card-name';
    nameEl.textContent = displayName;
    container.appendChild(nameEl);
  }
  if (uidValue || (!accepted && app.postSecretFieldKeys?.length)) {
    const head = document.createElement('div');
    head.className = 'board-card-head';
    if (uidValue) {
      const uid = document.createElement('span');
      uid.className = 'board-card-uid';
      uid.textContent = `${s().uidLabel}: ${uidValue}`;
      head.appendChild(uid);
    }
    if (!accepted && app.postSecretFieldKeys?.length) {
      const note = document.createElement('span');
      note.className = 'board-card-secret-note';
      const labels = app.postSecretFieldKeys.map((key) => fieldLabel(key, lang));
      note.textContent = s().secretFieldsNote(labels.join(lang === 'en' ? ', ' : '、'));
      head.appendChild(note);
    }
    container.appendChild(head);
  }

  const allRows = [
    ...buildFieldRows(post.publicFields, lang, store, false),
    ...(accepted ? buildFieldRows(app.revealedFields, lang, store, true) : []),
  ];
  const { rest: rows, oshiIcons } = extractOshiRow(allRows);
  if (oshiIcons) appendOshiIcons(avatarCol, oshiIcons, lang);
  renderGroupedFields(container, rows, lang);
}

let _getUserId = null;
let _onSentChange = null;
let latestReceived = [];
let latestSent = [];

// 自分のチャット吹き出しにも自分のアイコンを出すため、初回に一度だけ取得しておく
// (毎回の再描画でFirestoreへ読みに行かないよう、シンプルにモジュール内へ保持する)。
let myAvatarSrc = avatarUrl(null, null);
async function loadMyAvatar(userId) {
  const avatar = await getMyAvatar(userId);
  myAvatarSrc = avatarUrl(avatar.game, avatar.icon);
  renderReceivedList();
  renderSentList();
}

const MESSAGE_MAXLEN = 150;

// 見送られた申請は、この期間が経つと同じ投稿へ再申請できるようになる(hasAppliedTo参照)。
const REAPPLY_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

// ===== 申請する =====
// message: 申請時に任意で添えられる一言(未指定なら'')
export async function applyToPost(post, message = '') {
  if (!store.genshinUid || !store.server) {
    const err = new Error('PROFILE_INCOMPLETE');
    err.code = 'PROFILE_INCOMPLETE';
    throw err;
  }
  const userId = _getUserId();
  const applicantAvatar = await getMyAvatar(userId);

  // 申請者自身の項目も、募集の投稿時と全く同じルールで公開/承認後公開に仕分ける。
  // 承認後公開の項目("承認するまでは全部お互いに隠す"の対象)は値ごとapplicantSecretFieldsに
  // 保持しておくが、募集主の画面には承認されるまで一切描画しない(buildReceivedCard参照)。
  const { publicFields, secretFieldKeys } = buildPostFieldBuckets(store, store.visibility);
  const secretFields = {};
  secretFieldKeys.forEach((key) => {
    const value = store[key];
    if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      secretFields[key] = value;
    }
  });

  await addDoc(collection(db, 'friendBoardApplications'), {
    postId: post.id,
    postComment: post.comment || '',
    postOwnerUserId: post.userId,
    postOwnerAvatarGame: post.avatarGame || null,
    postOwnerAvatarIcon: post.avatarIcon || null,
    postSecretFieldKeys: post.secretFieldKeys || [], // 承認時にどの項目を公開するか(=post作成時点の設定)
    revealedFields: {}, // 承認時にのみ書き込む(承認前に見えないようにするため)

    applicantUserId: userId,
    applicantFields: publicFields,
    applicantSecretFieldKeys: secretFieldKeys,
    applicantSecretFields: secretFields, // 承認されるまで画面には出さない(buildReceivedCard参照)
    applicantAvatarGame: applicantAvatar.game,
    applicantAvatarIcon: applicantAvatar.icon,
    message: (message || '').trim().slice(0, MESSAGE_MAXLEN),

    status: 'pending',
    ownerSeen: false,
    applicantSeen: true,
    chatMessages: [], // 承認後のチャット(最大10往復)。申請時のこのmessageとは別枠でカウントする

    createdAt: serverTimestamp(),
    respondedAt: null,
  });

  // 他の人に申請した = アクティブに探している、とみなして自分の投稿も自動更新する
  // (board.jsのPOST_STALE_MS参照)。自分の投稿がまだ無い場合はupdateDocが失敗するが、
  // 申請自体の成否には関係ないため無視する。
  updateDoc(doc(db, 'friendBoardPosts', userId), { lastActiveAt: serverTimestamp() }).catch(() => {});
}

export function hasAppliedTo(postId) {
  // latestSentはcreatedAt降順のため、最初に見つかったものがその投稿への最新の申請
  const latest = latestSent.find((a) => a.postId === postId);
  if (!latest) return false;
  if (latest.status === 'rejected' && typeof latest.respondedAt?.toMillis === 'function') {
    if (Date.now() - latest.respondedAt.toMillis() >= REAPPLY_AFTER_MS) return false;
  }
  return true;
}

async function respondToApplication(app, accept) {
  const updates = {
    status: accept ? 'accepted' : 'rejected',
    applicantSeen: false,
    respondedAt: serverTimestamp(),
  };
  if (accept) {
    const revealed = {};
    (app.postSecretFieldKeys || []).forEach((key) => {
      const value = store[key];
      if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
        revealed[key] = value;
      }
    });
    updates.revealedFields = revealed;
  }
  try {
    await updateDoc(doc(db, 'friendBoardApplications', app.id), updates);
  } catch (e) {
    console.error('[applications] respond failed', e);
    alert(s().respondFail);
  }
}

// sender: 'owner'|'applicant'。承認後のチャット欄から送信された1通をchatMessagesへ追記する。
async function sendChatMessage(app, sender, text) {
  const messages = [...(app.chatMessages || []), { sender, text }];
  await updateDoc(doc(db, 'friendBoardApplications', app.id), { chatMessages: messages });
}

// ===== 届いた申請一覧（自分が募集主） =====
// 届いた申請のうち、まだ返答していない件数をメインタブ・サブタブの両方のバッジに出す
function updateReceivedBadges() {
  const count = latestReceived.filter((a) => a.status === 'pending').length;
  ['requests-tab-badge', 'received-subtab-badge'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count > 0 ? String(count) : '';
    el.classList.toggle('hidden', count === 0);
  });
}

function renderReceivedList() {
  updateReceivedBadges();
  const list = document.getElementById('received-list');
  if (!list) return;
  list.innerHTML = '';
  if (!latestReceived.length) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptyReceived;
    list.appendChild(p);
    return;
  }
  latestReceived.forEach((app) => list.appendChild(buildReceivedCard(app)));
}

function buildReceivedCard(app) {
  const lang = currentLang();
  const card = document.createElement('div');
  card.className = 'board-card';

  const avatarCol = document.createElement('div');
  avatarCol.className = 'board-card-avatar-col';
  card.appendChild(avatarCol);

  const avatarImg = document.createElement('img');
  avatarImg.className = 'board-card-avatar';
  avatarImg.src = avatarUrl(app.applicantAvatarGame, app.applicantAvatarIcon);
  avatarImg.alt = '';
  avatarCol.appendChild(avatarImg);

  const body = document.createElement('div');
  body.className = 'board-card-body';
  card.appendChild(body);

  // 承認済みになった時点で、申請者側の「承認後に公開」項目も初めてこちらに見せる
  // (=募集主の項目が承認時に見えるようになるのと対称のルール)。さがす一覧と同じく
  // 名前・UIDはヘッダー側に個別描画し、それ以外はカテゴリー別の枠(FIELD_GROUPS)に分けて描画する。
  const revealedNow = app.status === 'accepted';
  const displayName = revealedNow ? app.applicantSecretFields?.displayName : null;
  const uidValue = revealedNow ? app.applicantSecretFields?.genshinUid : null;

  if (displayName) {
    const nameEl = document.createElement('div');
    nameEl.className = 'board-card-name';
    nameEl.textContent = displayName;
    body.appendChild(nameEl);
  }

  if (uidValue || (!revealedNow && app.applicantSecretFieldKeys?.length)) {
    const head = document.createElement('div');
    head.className = 'board-card-head';
    if (uidValue) {
      const uid = document.createElement('span');
      uid.className = 'board-card-uid';
      uid.textContent = `${s().uidLabel}: ${uidValue}`;
      head.appendChild(uid);
    }
    if (!revealedNow && app.applicantSecretFieldKeys?.length) {
      const note = document.createElement('span');
      note.className = 'board-card-secret-note';
      const labels = app.applicantSecretFieldKeys.map((key) => fieldLabel(key, lang));
      note.textContent = s().secretFieldsNote(labels.join(lang === 'en' ? ', ' : '、'));
      head.appendChild(note);
    }
    body.appendChild(head);
  }

  const allRows = [
    ...buildFieldRows(app.applicantFields, lang, store, false),
    ...(revealedNow ? buildFieldRows(app.applicantSecretFields, lang, store, true) : []),
  ];
  const { rest: rows, oshiIcons } = extractOshiRow(allRows);
  if (oshiIcons) appendOshiIcons(avatarCol, oshiIcons, lang);
  renderGroupedFields(body, rows, lang);

  renderChatThread(body, [
    { text: app.message, mine: false, avatarSrc: avatarImg.src },
    ...(app.chatMessages || []).map((m) => ({
      text: m.text,
      mine: m.sender === 'owner',
      avatarSrc: m.sender === 'owner' ? myAvatarSrc : avatarImg.src,
    })),
  ]);
  renderChatComposer(body, app, 'owner');

  const foot = document.createElement('div');
  foot.className = 'board-card-foot';

  const time = document.createElement('span');
  time.className = 'board-card-time';
  time.textContent = relTime(app.createdAt);
  foot.appendChild(time);

  if (app.status === 'pending') {
    const btnRow = document.createElement('div');
    btnRow.className = 'board-request-btn-row';

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'board-request-accept-btn';
    acceptBtn.textContent = s().acceptBtn;
    acceptBtn.addEventListener('click', () => respondToApplication(app, true));
    btnRow.appendChild(acceptBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'board-request-reject-btn';
    rejectBtn.textContent = s().rejectBtn;
    rejectBtn.addEventListener('click', () => respondToApplication(app, false));
    btnRow.appendChild(rejectBtn);

    foot.appendChild(btnRow);
  } else {
    const badge = document.createElement('span');
    badge.className = `board-request-status board-request-status-${app.status}`;
    badge.textContent = app.status === 'accepted' ? s().statusAccepted : s().statusRejected;
    foot.appendChild(badge);
  }

  body.appendChild(foot);
  return card;
}

// ===== 送った申請一覧（自分が申請者） =====
function renderSentList() {
  const list = document.getElementById('sent-list');
  if (!list) return;
  list.innerHTML = '';
  if (!latestSent.length) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptySent;
    list.appendChild(p);
    return;
  }
  latestSent.forEach((app) => list.appendChild(buildSentCard(app)));
}

function buildSentCard(app) {
  const lang = currentLang();
  const card = document.createElement('div');
  card.className = 'board-card';

  const avatarCol = document.createElement('div');
  avatarCol.className = 'board-card-avatar-col';
  card.appendChild(avatarCol);

  const avatarImg = document.createElement('img');
  avatarImg.className = 'board-card-avatar';
  avatarImg.src = avatarUrl(app.postOwnerAvatarGame, app.postOwnerAvatarIcon);
  avatarImg.alt = '';
  avatarCol.appendChild(avatarImg);

  const body = document.createElement('div');
  body.className = 'board-card-body';
  card.appendChild(body);

  if (app.status === 'accepted') {
    // さがす一覧と同じく、名前・UIDはヘッダー側に個別描画し、それ以外は
    // カテゴリー別の枠(FIELD_GROUPS)に分けて描画する。
    const { rest: revealedRows, oshiIcons } = extractOshiRow(buildFieldRows(app.revealedFields, lang, store, true));
    const revealedName = app.revealedFields?.displayName;
    const revealedUid = app.revealedFields?.genshinUid;
    if (revealedRows.length || revealedName || revealedUid || oshiIcons) {
      const title = document.createElement('p');
      title.className = 'board-request-revealed-title';
      title.textContent = s().revealedTitle;
      body.appendChild(title);

      if (revealedName) {
        const nameEl = document.createElement('div');
        nameEl.className = 'board-card-name';
        nameEl.textContent = revealedName;
        body.appendChild(nameEl);
      }
      if (revealedUid) {
        const head = document.createElement('div');
        head.className = 'board-card-head';
        const uid = document.createElement('span');
        uid.className = 'board-card-uid';
        uid.textContent = `${s().uidLabel}: ${revealedUid}`;
        head.appendChild(uid);
        body.appendChild(head);
      }
      if (oshiIcons) appendOshiIcons(avatarCol, oshiIcons, lang);
      renderGroupedFields(body, revealedRows, lang);
    }
  }

  // 元の投稿は常に表示する(取得結果はfetchPostCachedでキャッシュされるため、
  // 一覧がチャット更新の度に再描画されても無駄なFirestore読み取りにはならない)。
  const originalTitle = document.createElement('p');
  originalTitle.className = 'board-request-revealed-title';
  originalTitle.textContent = s().originalPostTitle;
  body.appendChild(originalTitle);

  const originalContainer = document.createElement('div');
  originalContainer.className = 'board-request-original-post';
  body.appendChild(originalContainer);
  renderOriginalPostInto(originalContainer, avatarCol, app, lang);

  // 届いた申請と同じく、メッセージのやり取りはカードの一番下(footの直前)に表示する
  renderChatThread(body, [
    { text: app.message, mine: true, avatarSrc: myAvatarSrc },
    ...(app.chatMessages || []).map((m) => ({
      text: m.text,
      mine: m.sender === 'applicant',
      avatarSrc: m.sender === 'applicant' ? myAvatarSrc : avatarImg.src,
    })),
  ]);
  renderChatComposer(body, app, 'applicant');

  const foot = document.createElement('div');
  foot.className = 'board-card-foot';

  const time = document.createElement('span');
  time.className = 'board-card-time';
  time.textContent = relTime(app.createdAt);
  foot.appendChild(time);

  const badge = document.createElement('span');
  badge.className = `board-request-status board-request-status-${app.status}`;
  badge.textContent = app.status === 'accepted' ? s().statusAccepted
    : app.status === 'rejected' ? s().statusRejected
    : s().statusPending;
  foot.appendChild(badge);

  body.appendChild(foot);
  return card;
}

// ===== 通知トースト =====
let toastQueue = [];
let toastBusy = false;

function showToast({ avatarGame, avatarIcon, text }) {
  toastQueue.push({ avatarGame, avatarIcon, text });
  if (!toastBusy) processToastQueue();
}

function processToastQueue() {
  if (!toastQueue.length) { toastBusy = false; return; }
  toastBusy = true;

  const { avatarGame, avatarIcon, text } = toastQueue.shift();
  const toast = document.getElementById('app-toast');
  if (!toast) { toastBusy = false; return; }

  const avatarImg = document.getElementById('app-toast-avatar');
  const textEl = document.getElementById('app-toast-text');
  if (avatarImg) avatarImg.src = avatarUrl(avatarGame, avatarIcon);
  if (textEl) textEl.textContent = text;

  toast.style.display = 'flex';
  void toast.offsetWidth;
  toast.classList.remove('app-toast-hide');
  toast.classList.add('app-toast-show');

  setTimeout(() => {
    toast.classList.remove('app-toast-show');
    toast.classList.add('app-toast-hide');
    setTimeout(() => {
      toast.style.display = 'none';
      toast.classList.remove('app-toast-hide');
      processToastQueue();
    }, 320);
  }, 3200);
}

// ===== 購読開始 =====
function startReceivedListener(userId) {
  const q = query(
    collection(db, 'friendBoardApplications'),
    where('postOwnerUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  onSnapshot(q, (snap) => {
    latestReceived = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderReceivedList();

    snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
      const app = { id: c.doc.id, ...c.doc.data() };
      if (app.status === 'pending' && !app.ownerSeen) {
        // 表示名は承認後に公開の項目なので、この時点ではまだ名乗れない
        showToast({
          avatarGame: app.applicantAvatarGame,
          avatarIcon: app.applicantAvatarIcon,
          text: s().newApplicationToast(s().noName),
        });
        updateDoc(doc(db, 'friendBoardApplications', app.id), { ownerSeen: true }).catch(() => {});
      }
    });
  }, (err) => {
    console.error('[applications] received listen failed', err);
    latestReceived = [];
    renderReceivedList();
  });
}

function startSentListener(userId) {
  const q = query(
    collection(db, 'friendBoardApplications'),
    where('applicantUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  onSnapshot(q, (snap) => {
    latestSent = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSentList();
    if (_onSentChange) _onSentChange();

    snap.docChanges().filter((c) => c.type === 'modified').forEach((c) => {
      const app = { id: c.doc.id, ...c.doc.data() };
      if (!app.applicantSeen && (app.status === 'accepted' || app.status === 'rejected')) {
        showToast({
          avatarGame: app.postOwnerAvatarGame,
          avatarIcon: app.postOwnerAvatarIcon,
          text: app.status === 'accepted' ? s().acceptedToast : s().rejectedToast,
        });
        updateDoc(doc(db, 'friendBoardApplications', app.id), { applicantSeen: true }).catch(() => {});
      }
    });
  }, (err) => {
    console.error('[applications] sent listen failed', err);
    latestSent = [];
    renderSentList();
    if (_onSentChange) _onSentChange();
  });
}

// 言語切替時、描画済みの一覧を今の言語で再描画
document.querySelectorAll('input[name="lang"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    setTimeout(() => {
      renderReceivedList();
      renderSentList();
    }, 0);
  });
});

export function initApplications({ getUserId, onSentChange }) {
  _getUserId = getUserId;
  _onSentChange = onSentChange || null;
  const userId = getUserId();
  loadMyAvatar(userId);
  startReceivedListener(userId);
  startSentListener(userId);
}
