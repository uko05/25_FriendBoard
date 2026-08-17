// board.js
// フレンド募集掲示板：タブ切替・プロフィール自動反映・投稿(募集する)・一覧購読(さがす)

import { db } from './firebaseConfig.js';
import { getUserId, getAuthUid, store, loadProfileFromFirestore, scheduleSync, waitForAccountLink } from './userData.js';
import { initAvatarUI, getMyAvatar, avatarUrl } from './avatar.js';
import { initApplications, applyToPost, hasAppliedTo } from './applications.js';
import { VISIBILITY_FIELDS, fieldLabel, formatFieldValue, buildPostFieldBuckets } from './fields.js';
import { genshinChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_data/genshin_chars.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot,
  query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const GENSHIN_ICON_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_icon/';
const OSHI_ELEMS = ['hi', 'mizu', 'koori', 'kaminari', 'kusa', 'kaze', 'iwa'];
const OSHI_ELEM_LABELS = {
  ja: { hi: '炎', mizu: '水', koori: '氷', kaminari: '雷', kusa: '草', kaze: '風', iwa: '岩' },
  en: { hi: 'Fire', mizu: 'Hydro', koori: 'Ice', kaminari: 'Lightning', kusa: 'Dendro', kaze: 'Wind', iwa: 'Geo' },
};
const OSHI_MAX = 3;

const STR = {
  ja: {
    serverLabels: { asia: 'アジア', america: '北米', europe: '欧州', sar: '香港・マカオ・台湾' },
    justNow: 'たった今',
    minAgo: (n) => `${n}分前`,
    hourAgo: (n) => `${n}時間前`,
    dayAgo: (n) => `${n}日前`,
    emptyMy: 'まだ募集を投稿していません',
    emptySearch: '該当する募集がありません',
    deleteBtn: '削除する',
    deleteConfirm: 'この募集を削除しますか？',
    postOk: '募集を投稿しました！',
    postFail: '投稿に失敗しました。時間をおいて再度お試しください。',
    deleteFail: '削除に失敗しました。',
    fillAll: 'UID・サーバー・コメントを入力してください。',
    uidLabel: 'UID',
    applyBtn: '申請する',
    appliedBtn: '申請済み',
    applyOk: '申請しました！相手が承認するとUIDが確認できます。',
    applyFail: '申請に失敗しました。時間をおいて再度お試しください。',
    applyProfileIncomplete: '先に原神UID・サーバーを入力・保存してください（「募集する」タブから一度投稿するか、フォームに入力してください）。',
    approvalBadge: '承認制',
    approvalNoticeOn: 'ログイン中：各項目の公開設定で「承認制」が選べます。選んだ項目は、申請を承認した相手にのみ公開されます。',
    approvalNoticeOffPrefix: '未登録の場合、公開設定は「公開」「非公開」のみ選べます（承認制は使えません）。',
    approvalNoticeOffLink: '登録すると項目ごとに承認制を選べるようになります',
    visPublic: '公開',
    visHidden: '非公開',
    visApproval: '承認制',
    oshiPickerFull: '推しキャラは3人まで選べます',
    secretFieldsNote: (labels) => `🔒 ${labels} は承認後に確認できます`,
  },
  en: {
    serverLabels: { asia: 'Asia', america: 'America', europe: 'Europe', sar: 'HK/MO/TW' },
    justNow: 'just now',
    minAgo: (n) => `${n}m ago`,
    hourAgo: (n) => `${n}h ago`,
    dayAgo: (n) => `${n}d ago`,
    emptyMy: "You haven't posted any recruitments yet",
    emptySearch: 'No matching posts found',
    deleteBtn: 'Delete',
    deleteConfirm: 'Delete this post?',
    postOk: 'Your post has been submitted!',
    postFail: 'Failed to submit. Please try again later.',
    deleteFail: 'Failed to delete.',
    fillAll: 'Please fill in UID, server, and comment.',
    uidLabel: 'UID',
    applyBtn: 'Apply',
    appliedBtn: 'Applied',
    applyOk: 'Request sent! You can see their UID once they accept.',
    applyFail: 'Failed to apply. Please try again later.',
    applyProfileIncomplete: 'Please fill in and save your Genshin UID and server first (post once on the "Post" tab, or fill in the form).',
    approvalBadge: 'Vetted',
    approvalNoticeOn: "Logged in: you can set any field's visibility to \"Vetted\". Those fields are only revealed to applicants you accept.",
    approvalNoticeOffPrefix: "Since you're not registered, visibility can only be set to \"Public\" or \"Hidden\" (Vetted mode isn't available).",
    approvalNoticeOffLink: 'Register to unlock per-field Vetted mode',
    visPublic: 'Public',
    visHidden: 'Hidden',
    visApproval: 'Vetted',
    oshiPickerFull: 'You can select up to 3 favorite characters',
    secretFieldsNote: (labels) => `🔒 ${labels} available after approval`,
  },
};

function currentLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'ja';
}
function s() { return STR[currentLang()]; }

function relTime(ts) {
  if (!ts || typeof ts.toMillis !== 'function') return '';
  const min = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (min < 1) return s().justNow;
  if (min < 60) return s().minAgo(min);
  const hour = Math.floor(min / 60);
  if (hour < 24) return s().hourAgo(hour);
  return s().dayAgo(Math.floor(hour / 24));
}

// タブ切替のクリック処理はscript.js(非モジュール)側で行う。
// board.jsはFirebaseの読み込みに依存するモジュールスクリプトのため、
// 万一その読み込みが遅れたり失敗したりしてもタブの見た目切替自体は動くようにするため。

// ===== プロフィール自動反映(募集フォーム) =====
const uidInput = document.getElementById('input-uid');
const serverInput = document.getElementById('input-server');
const commentInput = document.getElementById('input-comment');
const arInput = document.getElementById('input-ar');
const wlInput = document.getElementById('input-wl');
const twitterInput = document.getElementById('input-twitter');
const workCallOkInput = document.getElementById('input-workCallOk');
const casualOkInput = document.getElementById('input-casualOk');
const jokingOkInput = document.getElementById('input-jokingOk');
const sameOshiRejectInput = document.getElementById('input-sameOshiReject');
const weekdayStartInput = document.getElementById('weekday-start');
const weekdayEndInput = document.getElementById('weekday-end');
const weekendStartInput = document.getElementById('weekend-start');
const weekendEndInput = document.getElementById('weekend-end');

function getRadioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}
function setRadioValue(name, value) {
  if (!value) return;
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}
function getCheckboxValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
}
function setCheckboxValues(name, values) {
  if (!Array.isArray(values)) return;
  document.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
    el.checked = values.includes(el.value);
  });
}

// 冒険者ランク(1-60)/世界ランク(0-9)の<select>用の選択肢を生成する
function populateNumberSelect(sel, min, max) {
  if (!sel) return;
  sel.innerHTML = '';
  for (let n = min; n <= max; n++) {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = String(n);
    sel.appendChild(opt);
  }
}

// マルチ可能時間帯(開始/終了)用の30分刻み時刻セレクトを生成する(0:00〜24:00)
function populateTimeSelect(sel) {
  if (!sel) return;
  sel.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '--:--';
  sel.appendChild(blank);
  for (let m = 0; m <= 24 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const label = `${h}:${String(min).padStart(2, '0')}`;
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    sel.appendChild(opt);
  }
}

function populateNumberAndTimeSelects() {
  populateNumberSelect(arInput, 1, 60);
  populateNumberSelect(wlInput, 0, 9);
  [weekdayStartInput, weekdayEndInput, weekendStartInput, weekendEndInput].forEach(populateTimeSelect);
}

// VCが「可能」の場合だけVC利用アプリ・通話スタイル一式を表示する
function updateVcExtraGroupVisibility() {
  const group = document.getElementById('vc-extra-group');
  if (group) group.classList.toggle('hidden', getRadioValue('vc') !== 'yes');
}
document.getElementById('group-vc')?.addEventListener('change', updateVcExtraGroupVisibility);

// 「同担拒否あり」にチェックが入っているときだけキャラ選択欄を表示する
function updateSameOshiCharsVisibility() {
  const row = document.getElementById('row-sameOshiChars');
  if (row) row.classList.toggle('hidden', !sameOshiRejectInput?.checked);
}
sameOshiRejectInput?.addEventListener('change', updateSameOshiCharsVisibility);

function fillFormFromProfile() {
  if (uidInput && store.genshinUid) uidInput.value = store.genshinUid;
  if (serverInput && store.server) serverInput.value = store.server;
  if (commentInput && store.intro) commentInput.value = store.intro;
  if (arInput) arInput.value = store.adventureRank || 60;
  if (wlInput) wlInput.value = store.worldLevel != null ? store.worldLevel : 9;
  if (twitterInput && store.twitterId) twitterInput.value = store.twitterId;
  if (workCallOkInput) workCallOkInput.checked = !!store.workCallOk;
  if (casualOkInput) casualOkInput.checked = !!store.casualOk;
  if (jokingOkInput) jokingOkInput.checked = !!store.jokingOk;
  if (sameOshiRejectInput) sameOshiRejectInput.checked = !!store.sameOshiReject;
  if (weekdayStartInput) weekdayStartInput.value = store.weekdayTimes?.start || '';
  if (weekdayEndInput) weekdayEndInput.value = store.weekdayTimes?.end || '';
  if (weekendStartInput) weekendStartInput.value = store.weekendTimes?.start || '';
  if (weekendEndInput) weekendEndInput.value = store.weekendTimes?.end || '';

  setRadioValue('gender', store.gender);
  setRadioValue('spending', store.spending);
  setRadioValue('inviteStyle', store.inviteStyle);
  setRadioValue('multiFrequency', store.multiFrequency);
  setRadioValue('vc', store.vc);
  setCheckboxValues('platforms', store.platforms);
  setCheckboxValues('playStyles', store.playStyles);
  setCheckboxValues('vcApps', store.vcApps);
  updateVcExtraGroupVisibility();
  updateSameOshiCharsVisibility();

  oshiPicker.renderSelected();
  sameOshiPicker.renderSelected();
}

// ===== 公開設定(非公開/公開/承認制)セレクト =====
function populateVisibilitySelects() {
  VISIBILITY_FIELDS.forEach((key) => {
    const sel = document.getElementById(`vis-${key}`);
    if (!sel) return;
    sel.innerHTML = '';
    [['public', s().visPublic], ['hidden', s().visHidden], ['approval', s().visApproval]].forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === 'approval' && !getAuthUid()) opt.disabled = true;
      sel.appendChild(opt);
    });
    sel.value = store.visibility[key] || 'public';
    sel.onchange = () => {
      store.visibility[key] = sel.value;
      scheduleSync();
    };
  });
}

// ===== キャラクター複数選択(推しキャラ・同担拒否キャラ共通) =====
// max: null なら人数無制限
function createCharPicker({ key, max, selectedElId, addBtnId, modalId, closeBtnId, elemTabsId, charListId, fullMessage }) {
  let pickerElem = OSHI_ELEMS[0];

  function renderSelected() {
    const box = document.getElementById(selectedElId);
    const addBtn = document.getElementById(addBtnId);
    if (!box) return;
    box.innerHTML = '';
    store[key].forEach((icon) => {
      const char = genshinChars.find((c) => c.icon === icon);
      const thumb = document.createElement('div');
      thumb.className = 'board-oshi-thumb';
      const img = document.createElement('img');
      img.src = GENSHIN_ICON_BASE + icon;
      img.alt = char?.name || '';
      thumb.appendChild(img);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'board-oshi-thumb-remove';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        store[key] = store[key].filter((i) => i !== icon);
        scheduleSync();
        renderSelected();
        renderCharList();
      });
      thumb.appendChild(remove);
      box.appendChild(thumb);
    });
    if (addBtn) addBtn.disabled = max != null && store[key].length >= max;
  }

  function renderElemTabs() {
    const bar = document.getElementById(elemTabsId);
    if (!bar) return;
    bar.innerHTML = '';
    const labels = OSHI_ELEM_LABELS[currentLang()];
    OSHI_ELEMS.forEach((elem) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar-elem-tab-btn' + (elem === pickerElem ? ' active' : '');
      btn.textContent = labels[elem];
      btn.addEventListener('click', () => {
        pickerElem = elem;
        renderElemTabs();
        renderCharList();
      });
      bar.appendChild(btn);
    });
  }

  function renderCharList() {
    const list = document.getElementById(charListId);
    if (!list) return;
    list.innerHTML = '';
    genshinChars.filter((c) => c.element === pickerElem).forEach((c) => {
      const name = c.name || c.icon.replace(/\.\w+$/, '');
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'avatar-picker-thumb';
      if (store[key].includes(c.icon)) thumb.classList.add('board-oshi-picker-thumb-selected');
      thumb.title = name;
      const img = document.createElement('img');
      img.src = GENSHIN_ICON_BASE + c.icon;
      img.alt = name;
      img.loading = 'lazy';
      thumb.appendChild(img);
      thumb.addEventListener('click', () => toggle(c.icon));
      list.appendChild(thumb);
    });
  }

  function toggle(icon) {
    if (store[key].includes(icon)) {
      store[key] = store[key].filter((i) => i !== icon);
    } else if (max == null || store[key].length < max) {
      store[key] = [...store[key], icon];
    } else {
      alert(fullMessage());
      return;
    }
    scheduleSync();
    renderSelected();
    renderCharList();
  }

  function open() {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = 'flex';
    renderElemTabs();
    renderCharList();
  }
  function close() {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  }

  document.getElementById(addBtnId)?.addEventListener('click', open);
  document.getElementById(closeBtnId)?.addEventListener('click', close);
  document.querySelector(`#${modalId} .col-modal-backdrop`)?.addEventListener('click', close);

  return { renderSelected, renderElemTabs, renderCharList };
}

const oshiPicker = createCharPicker({
  key: 'oshiChars', max: OSHI_MAX,
  selectedElId: 'oshi-selected', addBtnId: 'oshi-add-btn',
  modalId: 'oshi-picker-modal', closeBtnId: 'oshi-picker-close',
  elemTabsId: 'oshi-picker-elem-tabs', charListId: 'oshi-picker-char-list',
  fullMessage: () => s().oshiPickerFull,
});

const sameOshiPicker = createCharPicker({
  key: 'sameOshiChars', max: null,
  selectedElId: 'same-oshi-selected', addBtnId: 'same-oshi-add-btn',
  modalId: 'same-oshi-picker-modal', closeBtnId: 'same-oshi-picker-close',
  elemTabsId: 'same-oshi-picker-elem-tabs', charListId: 'same-oshi-picker-char-list',
  fullMessage: () => '',
});

// ログイン状態に応じて、これから投稿する募集が承認制になるかどうかを案内する
function updateApprovalNotice() {
  const el = document.getElementById('post-approval-notice');
  if (!el) return;
  el.innerHTML = '';
  el.classList.toggle('board-approval-notice-on', !!getAuthUid());
  el.classList.toggle('board-approval-notice-off', !getAuthUid());

  if (getAuthUid()) {
    el.textContent = s().approvalNoticeOn;
  } else {
    el.appendChild(document.createTextNode(s().approvalNoticeOffPrefix + ' '));
    const link = document.createElement('a');
    link.href = 'https://uko05.github.io/24_AccountCenter/';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = s().approvalNoticeOffLink;
    el.appendChild(link);
  }
}

// ===== 募集投稿 =====
const postForm = document.getElementById('post-form');
const postSubmitBtn = document.getElementById('post-submit-btn');
const postFormMsg = document.getElementById('post-form-msg');

function showMsg(el, text, isError) {
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.classList.toggle('ok', !isError);
}

// フォームの現在値を全項目分集めて{key: value}で返す(genshinUid/serverも含む)
function collectFormValues() {
  // VCが「可能」以外のときはVC利用アプリ・通話スタイル一式は非表示にしているため、
  // 古い入力値が残っていても投稿には含めない
  const vcOpen = getRadioValue('vc') === 'yes';
  const sameOshiReject = vcOpen && !!sameOshiRejectInput?.checked;

  return {
    genshinUid: uidInput.value.trim(),
    server: serverInput.value,
    adventureRank: arInput.value ? Number(arInput.value) : '',
    worldLevel: wlInput.value !== '' ? Number(wlInput.value) : '',
    gender: getRadioValue('gender'),
    platforms: getCheckboxValues('platforms'),
    oshiChars: store.oshiChars,
    spending: getRadioValue('spending'),
    playStyles: getCheckboxValues('playStyles'),
    inviteStyle: getRadioValue('inviteStyle'),
    multiFrequency: getRadioValue('multiFrequency'),
    workCallOk: vcOpen && !!workCallOkInput?.checked,
    vc: getRadioValue('vc'),
    vcApps: vcOpen ? getCheckboxValues('vcApps') : [],
    casualOk: vcOpen && !!casualOkInput?.checked,
    jokingOk: vcOpen && !!jokingOkInput?.checked,
    sameOshiReject,
    sameOshiChars: sameOshiReject ? store.sameOshiChars : [],
    twitterId: twitterInput.value.trim(),
    weekdayTimes: { start: weekdayStartInput?.value || '', end: weekdayEndInput?.value || '' },
    weekendTimes: { start: weekendStartInput?.value || '', end: weekendEndInput?.value || '' },
  };
}

postForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const values = collectFormValues();
  const comment = commentInput.value.trim();

  if (!values.genshinUid || !values.server || !comment) {
    showMsg(postFormMsg, s().fillAll, true);
    return;
  }

  postSubmitBtn.disabled = true;
  try {
    // プロフィールへ保存(次回のフォーム自動反映・申請時のスナップショットに使う)
    Object.assign(store, values);
    store.intro = comment;
    scheduleSync();

    const avatar = await getMyAvatar(getUserId());

    // 公開設定(visibility)に応じて、投稿ドキュメントへ含める内容を仕分ける。
    // 'approval'指定の項目は値を一切書き込まず、項目名だけをsecretFieldKeysへ記録する
    // (承認された時点で初めてfriendBoardApplicationsへ実際の値を書き込む＝applications.js参照)。
    const { publicFields, secretFieldKeys } = buildPostFieldBuckets(values, store.visibility, !!getAuthUid());

    await addDoc(collection(db, 'friendBoardPosts'), {
      userId: getUserId(),
      comment,
      avatarGame: avatar.game,
      avatarIcon: avatar.icon,
      publicFields,
      secretFieldKeys,
      requiresApproval: secretFieldKeys.length > 0,
      active: true,
      createdAt: serverTimestamp(),
    });

    showMsg(postFormMsg, s().postOk, false);
  } catch (err) {
    console.error('[board] post failed', err);
    showMsg(postFormMsg, s().postFail, true);
  } finally {
    postSubmitBtn.disabled = false;
  }
});

// 表示するフィールド一覧を組み立てる。
// mineの場合は自分の最新プロフィール(store)から値を取るため、hidden以外は全て見える。
// mineでない場合は投稿ドキュメントの publicFields のみ値を持ち、secretFieldKeys は
// 「値なし・承認後に見える」ことを示すためだけに使う。
function getDisplayFields(post, mine) {
  const lang = currentLang();
  const rows = [];
  const secretLabels = [];
  const headFields = new Set(['genshinUid', 'server']); // ヘッダー側で個別に描画する項目

  VISIBILITY_FIELDS.forEach((key) => {
    if (mine) {
      // 自分のカードは常にstoreの値をそのまま見せる(自分自身なので隠す意味がない)。
      // ただし本人が「非公開」にした項目は一覧に出さない(フォーム側で確認できるため)。
      const vis = store.visibility[key] || 'public';
      if (vis === 'hidden') return;
      if (headFields.has(key)) return;
      pushFieldRow(rows, key, store[key], lang);
    } else {
      if (post.secretFieldKeys?.includes(key)) {
        secretLabels.push(fieldLabel(key, lang));
        return;
      }
      if (headFields.has(key)) return;
      if (post.publicFields && key in post.publicFields) {
        pushFieldRow(rows, key, post.publicFields[key], lang);
      }
    }
  });
  return { rows, secretLabels };
}

function pushFieldRow(rows, key, value, lang) {
  if (key === 'oshiChars' || key === 'sameOshiChars') {
    if (Array.isArray(value) && value.length) rows.push({ key, oshiIcons: value });
    return;
  }
  const text = formatFieldValue(key, value, lang);
  if (text) rows.push({ key, text: `${fieldLabel(key, lang)}: ${text}` });
}

// ===== 募集カード描画 =====
function buildCard(post, { mine }) {
  const card = document.createElement('div');
  card.className = 'board-card';

  const avatarImg = document.createElement('img');
  avatarImg.className = 'board-card-avatar';
  avatarImg.src = avatarUrl(post.avatarGame, post.avatarIcon);
  avatarImg.alt = '';
  avatarImg.loading = 'lazy';
  card.appendChild(avatarImg);

  const body = document.createElement('div');
  body.className = 'board-card-body';
  card.appendChild(body);

  const head = document.createElement('div');
  head.className = 'board-card-head';

  const serverVisible = mine
    ? (store.visibility.server || 'public') !== 'hidden'
    : (post.publicFields && 'server' in post.publicFields);
  const serverValue = mine ? store.server : post.publicFields?.server;
  if (serverVisible && serverValue) {
    const serverTag = document.createElement('span');
    serverTag.className = 'board-card-server';
    serverTag.textContent = s().serverLabels[serverValue] || serverValue;
    head.appendChild(serverTag);
  }

  if (post.requiresApproval) {
    const badge = document.createElement('span');
    badge.className = 'board-card-approval-badge';
    badge.textContent = s().approvalBadge;
    head.appendChild(badge);
  }

  const uidVisible = mine
    ? (store.visibility.genshinUid || 'public') !== 'hidden'
    : (post.publicFields && 'genshinUid' in post.publicFields);
  const uidValue = mine ? store.genshinUid : post.publicFields?.genshinUid;
  if (uidVisible && uidValue) {
    const uid = document.createElement('span');
    uid.className = 'board-card-uid';
    uid.textContent = `${s().uidLabel}: ${uidValue}`;
    head.appendChild(uid);
  }

  body.appendChild(head);

  const { rows, secretLabels } = getDisplayFields(post, mine);
  if (rows.length) {
    const chips = document.createElement('div');
    chips.className = 'board-card-chips';
    rows.forEach((row) => {
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
      const chip = document.createElement('span');
      chip.className = 'board-card-chip';
      chip.textContent = row.text;
      chips.appendChild(chip);
    });
    body.appendChild(chips);
  }
  if (secretLabels.length) {
    const note = document.createElement('p');
    note.className = 'board-card-secret-note';
    note.textContent = s().secretFieldsNote(secretLabels.join(currentLang() === 'en' ? ', ' : '、'));
    body.appendChild(note);
  }

  const comment = document.createElement('p');
  comment.className = 'board-card-comment';
  comment.textContent = post.comment || '';
  body.appendChild(comment);

  const foot = document.createElement('div');
  foot.className = 'board-card-foot';

  const time = document.createElement('span');
  time.className = 'board-card-time';
  time.textContent = relTime(post.createdAt);
  foot.appendChild(time);

  if (mine) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'board-card-delete-btn';
    delBtn.textContent = s().deleteBtn;
    delBtn.addEventListener('click', () => deletePost(post.id));
    foot.appendChild(delBtn);
  } else if (post.requiresApproval) {
    // 承認制でない募集はUIDが既に見えているため、申請ボタンは不要
    const applied = hasAppliedTo(post.id);
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'board-card-apply-btn';
    applyBtn.textContent = applied ? s().appliedBtn : s().applyBtn;
    applyBtn.disabled = applied;
    applyBtn.addEventListener('click', () => handleApply(post));
    foot.appendChild(applyBtn);
  }

  body.appendChild(foot);
  return card;
}

async function handleApply(post) {
  try {
    await applyToPost(post);
    alert(s().applyOk);
  } catch (err) {
    if (err.code === 'PROFILE_INCOMPLETE') {
      alert(s().applyProfileIncomplete);
    } else {
      console.error('[board] apply failed', err);
      alert(s().applyFail);
    }
  }
}

async function deletePost(postId) {
  if (!confirm(s().deleteConfirm)) return;
  try {
    await deleteDoc(doc(db, 'friendBoardPosts', postId));
  } catch (err) {
    console.error('[board] delete failed', err);
    alert(s().deleteFail);
  }
}

// ===== 自分の募集一覧 =====
let latestMyPosts = [];
function renderMyPosts() {
  const list = document.getElementById('my-posts-list');
  if (!list) return;
  list.innerHTML = '';
  if (!latestMyPosts.length) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptyMy;
    list.appendChild(p);
    return;
  }
  latestMyPosts.forEach((post) => list.appendChild(buildCard(post, { mine: true })));
}

function startMyPostsListener() {
  const q = query(
    collection(db, 'friendBoardPosts'),
    where('userId', '==', getUserId()),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  onSnapshot(q, (snap) => {
    latestMyPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMyPosts();
  }, (err) => {
    console.error('[board] my posts listen failed', err);
    latestMyPosts = [];
    renderMyPosts();
  });
}

// ===== 検索一覧(さがす) =====
let latestSearchPosts = [];
const filterServerSelect = document.getElementById('filter-server');

function renderSearchList() {
  const list = document.getElementById('search-list');
  if (!list) return;
  const myUserId = getUserId();
  const filterServer = filterServerSelect ? filterServerSelect.value : '';

  const filtered = latestSearchPosts.filter((post) => !filterServer || post.publicFields?.server === filterServer);

  list.innerHTML = '';
  if (!filtered.length) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptySearch;
    list.appendChild(p);
    return;
  }
  filtered.forEach((post) => list.appendChild(buildCard(post, { mine: post.userId === myUserId })));
}

function startSearchListener() {
  const q = query(
    collection(db, 'friendBoardPosts'),
    where('active', '==', true),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  onSnapshot(q, (snap) => {
    latestSearchPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSearchList();
  }, (err) => {
    console.error('[board] search listen failed', err);
    latestSearchPosts = [];
    renderSearchList();
  });
}

filterServerSelect?.addEventListener('change', renderSearchList);

// アバター変更時、直近の自分の募集(投稿時点のアバターを非正規化済み)にも反映する。
// 14_GenshinOmikuji/feed.js の syncLatestFeedAvatar と同じ考え方：全件は更新せず、
// 直近1件だけ最新のアバターに合わせる。
async function updateLatestOwnPostAvatar({ game, icon }) {
  try {
    const q = query(
      collection(db, 'friendBoardPosts'),
      where('userId', '==', getUserId()),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    await updateDoc(snap.docs[0].ref, { avatarGame: game || null, avatarIcon: icon || null });
  } catch (e) {
    console.warn('[board] latest post avatar sync failed', e);
  }
}

// 言語切替時、描画済みの一覧を今の言語で再描画
// (script.jsのdocument.documentElement.lang更新が同じ change イベントの別リスナーで
//  行われるため、setTimeoutで1タスク遅らせて確実に新しい言語を読んでから再描画する)
document.querySelectorAll('input[name="lang"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    setTimeout(() => {
      renderMyPosts();
      renderSearchList();
      updateApprovalNotice();
      populateVisibilitySelects();
      oshiPicker.renderElemTabs();
      oshiPicker.renderCharList();
      sameOshiPicker.renderElemTabs();
      sameOshiPicker.renderCharList();
    }, 0);
  });
});

// ===== 初期化 =====
async function init() {
  // ログイン中ならaccountLinksから共有IDを解決してから(=正しいuserIdが確定してから)
  // プロフィール読み込み・一覧購読を始める
  await waitForAccountLink();
  populateNumberAndTimeSelects();
  await loadProfileFromFirestore();
  fillFormFromProfile();
  updateApprovalNotice();
  populateVisibilitySelects();
  initAvatarUI({ getUserId, getAuthUid, onChange: updateLatestOwnPostAvatar });
  initApplications({ getUserId, onSentChange: renderSearchList });
  startMyPostsListener();
  startSearchListener();
}

init();
