// applications.js
// 「申請」機能：さがす画面で非公開/承認制の項目を直接載せず、気になったらサイト内で
// 申請→相手が申請者の情報を見て承認/却下→承認されたら承認制の項目が見られる、という流れ。
// 通知トーストは 14_GenshinOmikuji/feed.js の いいね通知(showLikeToast) と同じ仕組み。

import { db } from './firebaseConfig.js';
import { store } from './userData.js';
import { avatarUrl, getMyAvatar } from './avatar.js';
import { VISIBILITY_FIELDS, fieldLabel, formatFieldValue, buildPostFieldBuckets } from './fields.js';
import {
  collection, addDoc, updateDoc, doc, onSnapshot,
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
    acceptWithReplyBtn: 'メッセージを添えて承認',
    rejectBtn: '見送る',
    statusPending: '返答待ち',
    statusAccepted: '承認済み',
    statusRejected: '見送り',
    revealedTitle: '公開された情報',
    profileIncomplete: '先に「マイプロフィール」タブで原神UID・サーバーを入力・保存してください。',
    applyFail: '申請に失敗しました。時間をおいて再度お試しください。',
    respondFail: '処理に失敗しました。',
    forPost: (comment) => `募集: 「${comment}」`,
    secretFieldsNote: (labels) => `🔒 ${labels} は承認後に確認できます`,
    acceptReplyModalTitle: 'メッセージを添えて承認',
    acceptReplyPlaceholder: '「こちらこそよろしくお願いします」など、返信を添えてみましょう（未入力でも承認できます）',
    acceptReplySendBtn: 'この内容で承認する',
    ownerReplyTitle: '相手からの返信',
  },
  en: {
    noName: 'Nameless Traveler',
    newApplicationToast: (name) => `${name} sent you a request!`,
    acceptedToast: 'Your request was accepted! Check the details',
    rejectedToast: 'Your request was passed on',
    emptyReceived: 'No requests received yet',
    emptySent: "You haven't sent any requests yet",
    acceptBtn: 'Accept',
    acceptWithReplyBtn: 'Accept with a message',
    rejectBtn: 'Pass',
    statusPending: 'Pending',
    statusAccepted: 'Accepted',
    statusRejected: 'Passed',
    revealedTitle: 'Revealed info',
    profileIncomplete: 'Please fill in and save your Genshin UID and server on the "My Profile" tab first.',
    applyFail: 'Failed to apply. Please try again later.',
    respondFail: 'Failed to process.',
    forPost: (comment) => `For: "${comment}"`,
    secretFieldsNote: (labels) => `🔒 ${labels} available after approval`,
    acceptReplyModalTitle: 'Accept with a message',
    acceptReplyPlaceholder: 'Add a short reply, e.g. "Nice to meet you too!" (optional — you can accept without one)',
    acceptReplySendBtn: 'Accept with this message',
    ownerReplyTitle: "Their reply",
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

// {key: value} のオブジェクトを "ラベル: 値" の文字列配列に整形する(oshiCharsは除く、画像なので個別描画)
function formatFieldDict(dict, lang) {
  if (!dict) return [];
  return VISIBILITY_FIELDS
    .filter((key) => key !== 'oshiChars' && key !== 'friendPreference'
      && key !== 'showGenshinRanking' && key !== 'showGenshinCheck'
      && dict[key] != null && dict[key] !== '')
    .map((key) => {
      const text = formatFieldValue(key, dict[key], lang);
      return text ? `${fieldLabel(key, lang)}: ${text}` : null;
    })
    .filter(Boolean);
}

let _getUserId = null;
let _onSentChange = null;
let latestReceived = [];
let latestSent = [];

const MESSAGE_MAXLEN = 150;

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
    ownerReply: '',

    createdAt: serverTimestamp(),
    respondedAt: null,
  });
}

export function hasAppliedTo(postId) {
  return latestSent.some((a) => a.postId === postId);
}

// reply: 承認と同時に任意で添えられる一言(見送り時は使わない)
async function respondToApplication(app, accept, reply = '') {
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
    updates.ownerReply = (reply || '').trim().slice(0, MESSAGE_MAXLEN);
  }
  try {
    await updateDoc(doc(db, 'friendBoardApplications', app.id), updates);
  } catch (e) {
    console.error('[applications] respond failed', e);
    alert(s().respondFail);
  }
}

// ===== 返信を添えて承認するモーダル =====
let pendingAcceptApp = null;
const acceptReplyModal = document.getElementById('accept-reply-modal');
const acceptReplyInput = document.getElementById('accept-reply-input');
const acceptReplySendBtn = document.getElementById('accept-reply-send');

function openAcceptReplyModal(app) {
  pendingAcceptApp = app;
  if (acceptReplyInput) acceptReplyInput.value = '';
  if (acceptReplyModal) acceptReplyModal.style.display = 'flex';
  acceptReplyInput?.focus();
}
function closeAcceptReplyModal() {
  if (acceptReplyModal) acceptReplyModal.style.display = 'none';
  pendingAcceptApp = null;
}
document.getElementById('accept-reply-close')?.addEventListener('click', closeAcceptReplyModal);
document.querySelector('#accept-reply-modal .col-modal-backdrop')?.addEventListener('click', closeAcceptReplyModal);
acceptReplySendBtn?.addEventListener('click', async () => {
  if (!pendingAcceptApp) return;
  acceptReplySendBtn.disabled = true;
  try {
    await respondToApplication(pendingAcceptApp, true, acceptReplyInput?.value || '');
    closeAcceptReplyModal();
  } finally {
    acceptReplySendBtn.disabled = false;
  }
});

// ===== 届いた申請一覧（自分が募集主） =====
function renderReceivedList() {
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

  const avatarImg = document.createElement('img');
  avatarImg.className = 'board-card-avatar';
  avatarImg.src = avatarUrl(app.applicantAvatarGame, app.applicantAvatarIcon);
  avatarImg.alt = '';
  card.appendChild(avatarImg);

  const body = document.createElement('div');
  body.className = 'board-card-body';
  card.appendChild(body);

  const chips = document.createElement('div');
  chips.className = 'board-card-chips';
  formatFieldDict(app.applicantFields, lang).forEach((text) => {
    const chip = document.createElement('span');
    chip.className = 'board-card-chip';
    chip.textContent = text;
    chips.appendChild(chip);
  });
  // 承認済みになった時点で、申請者側の「承認後に公開」項目も初めてこちらに見せる
  // (=募集主の項目が承認時に見えるようになるのと対称のルール)。
  if (app.status === 'accepted') {
    formatFieldDict(app.applicantSecretFields, lang).forEach((text) => {
      const chip = document.createElement('span');
      chip.className = 'board-card-chip board-request-revealed-chip';
      chip.textContent = text;
      chips.appendChild(chip);
    });
  }
  if (chips.children.length) body.appendChild(chips);

  if (app.status === 'pending' && app.applicantSecretFieldKeys?.length) {
    const note = document.createElement('p');
    note.className = 'board-card-secret-note';
    const labels = app.applicantSecretFieldKeys.map((key) => fieldLabel(key, lang));
    note.textContent = s().secretFieldsNote(labels.join(lang === 'en' ? ', ' : '、'));
    body.appendChild(note);
  }

  if (app.message) {
    const msg = document.createElement('p');
    msg.className = 'board-request-message';
    msg.textContent = `💬 ${app.message}`;
    body.appendChild(msg);
  }

  const forPost = document.createElement('p');
  forPost.className = 'board-request-for';
  forPost.textContent = s().forPost(app.postComment || '');
  body.appendChild(forPost);

  const foot = document.createElement('div');
  foot.className = 'board-card-foot';

  const time = document.createElement('span');
  time.className = 'board-card-time';
  time.textContent = relTime(app.createdAt);
  foot.appendChild(time);

  if (app.status === 'pending') {
    const btnRow = document.createElement('div');
    btnRow.className = 'board-request-btn-row';

    const acceptReplyBtn = document.createElement('button');
    acceptReplyBtn.type = 'button';
    acceptReplyBtn.className = 'board-request-accept-reply-btn';
    acceptReplyBtn.textContent = s().acceptWithReplyBtn;
    acceptReplyBtn.addEventListener('click', () => openAcceptReplyModal(app));
    btnRow.appendChild(acceptReplyBtn);

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

  const avatarImg = document.createElement('img');
  avatarImg.className = 'board-card-avatar';
  avatarImg.src = avatarUrl(app.postOwnerAvatarGame, app.postOwnerAvatarIcon);
  avatarImg.alt = '';
  card.appendChild(avatarImg);

  const body = document.createElement('div');
  body.className = 'board-card-body';
  card.appendChild(body);

  const forPost = document.createElement('p');
  forPost.className = 'board-request-for';
  forPost.textContent = s().forPost(app.postComment || '');
  body.appendChild(forPost);

  if (app.message) {
    const msg = document.createElement('p');
    msg.className = 'board-request-message';
    msg.textContent = `💬 ${app.message}`;
    body.appendChild(msg);
  }

  if (app.status === 'accepted') {
    if (app.ownerReply) {
      const replyTitle = document.createElement('p');
      replyTitle.className = 'board-request-revealed-title';
      replyTitle.textContent = s().ownerReplyTitle;
      body.appendChild(replyTitle);

      const reply = document.createElement('p');
      reply.className = 'board-request-message board-request-reply-message';
      reply.textContent = `💬 ${app.ownerReply}`;
      body.appendChild(reply);
    }

    const revealedTexts = formatFieldDict(app.revealedFields, lang);
    if (revealedTexts.length) {
      const title = document.createElement('p');
      title.className = 'board-request-revealed-title';
      title.textContent = s().revealedTitle;
      body.appendChild(title);

      const chips = document.createElement('div');
      chips.className = 'board-card-chips';
      revealedTexts.forEach((text) => {
        const chip = document.createElement('span');
        chip.className = 'board-card-chip board-request-revealed-chip';
        chip.textContent = text;
        chips.appendChild(chip);
      });
      body.appendChild(chips);
    }
  }

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
  startReceivedListener(userId);
  startSentListener(userId);
}
