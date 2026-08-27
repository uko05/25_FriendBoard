// board.js
// ＃原神フレンド承認板：タブ切替・プロフィール自動反映・投稿(募集する)・一覧購読(さがす)

import { db } from './firebaseConfig.js';
import { getUserId, getAuthUid, store, loadProfileFromFirestore, scheduleSync, waitForAccountLink } from './userData.js';
import { initAvatarUI, getMyAvatar, avatarUrl } from './avatar.js';
import { initApplications, applyToPost, hasAppliedTo } from './applications.js';
import { initBlocks, isBlocked, onBlocksChange, blockUser, unblockUser, blockedByMeList } from './blocks.js';
import { reportUser } from './reports.js';
import {
  VISIBILITY_FIELDS, NO_PUBLIC_FIELDS, FIELD_GROUPS, PLAYSTYLE_OFFER_VALUES, PLAYSTYLE_REQUEST_VALUES,
  fieldLabel, formatFieldValue, buildPostFieldBuckets, computeFriendMatch, fieldOptions,
  fieldMatchKind, playStyleValueMatchKind, GENSHIN_ICON_BASE,
} from './fields.js';
import { getSavedProfileImageFor } from 'https://uko05.github.io/24_AccountCenter/saved-image.js';
import { genshinChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_data/genshin_chars.js';
import {
  collection, setDoc, updateDoc, deleteDoc, doc, getDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const OSHI_ELEMS = ['hi', 'mizu', 'koori', 'kaminari', 'kusa', 'kaze', 'iwa'];
const OSHI_ELEM_LABELS = {
  ja: { hi: '炎', mizu: '水', koori: '氷', kaminari: '雷', kusa: '草', kaze: '風', iwa: '岩' },
  en: { hi: 'Fire', mizu: 'Hydro', koori: 'Ice', kaminari: 'Lightning', kusa: 'Dendro', kaze: 'Wind', iwa: 'Geo' },
};
const OSHI_MAX = 3;

// 投稿(募集する)は、最終アクティブ日時からこの期間更新がないと探す一覧から自動的に
// 非表示になる。更新扱いになるのは「更新する」ボタンを押した時と、他の投稿へ申請した時
// (applications.jsのapplyToPost参照)。
const POST_STALE_MS = 30 * 24 * 60 * 60 * 1000;

// 管理者(私)は初回ポップの文言を何度も見直したいので、既読フラグに関わらず毎回表示する
const ADMIN_UID = 'UPInlRxp2eM8OI3p18UU1d3OzNc2';

const STR = {
  ja: {
    justNow: 'たった今',
    minAgo: (n) => `${n}分前`,
    hourAgo: (n) => `${n}時間前`,
    dayAgo: (n) => `${n}日前`,
    emptyMy: 'まだプロフィールを保存していません',
    emptySearch: '該当する募集がありません',
    deleteBtn: '取り下げる',
    deleteConfirm: 'プロフィールの公開を取り下げますか？「さがす」も使えなくなります。',
    blockBtn: 'ブロックする',
    blockConfirm: 'この人をブロックしますか？お互いに一覧やチャットから見えなくなります（ブロックしたことは相手に通知されません）。',
    blockOk: 'ブロックしました。',
    blockFail: 'ブロックに失敗しました。時間をおいて再度お試しください。',
    unblockBtn: '解除する',
    unblockConfirm: 'ブロックを解除しますか？',
    unblockFail: '解除に失敗しました。時間をおいて再度お試しください。',
    reportBtn: '通報する',
    reportReasonPrompt: '通報理由（任意）があれば入力してください。',
    reportOk: '通報しました。ご協力ありがとうございます。',
    reportFail: '通報に失敗しました。時間をおいて再度お試しください。',
    blockedListTitle: 'ブロック中のユーザー',
    emptyBlockedList: 'ブロックしているユーザーはいません',
    postOk: '保存しました！',
    postFail: '保存に失敗しました。時間をおいて再度お試しください。',
    draftSaved: '一時保存しました（この端末のみ）',
    draftSaveFail: '一時保存に失敗しました。',
    deleteFail: '取り下げに失敗しました。',
    postFreshness: (lastActive, daysLeft) => `最終更新: ${lastActive}・あと${daysLeft}日で探す一覧から自動的に非表示になります（他の人に申請すると自動的に更新されます）`,
    refreshPostOk: 'アクティブ状態を更新しました！',
    refreshPostFail: '更新に失敗しました。時間をおいて再度お試しください。',
    fillAll: '必須項目（＊）をすべて入力してください。',
    fillAllMissing: (labels) => `必須項目（＊）をすべて入力してください。\n不足している項目: ${labels}`,
    uidLabel: 'UID',
    applyBtn: 'メッセージなしで申請',
    applyWithMsgBtn: 'メッセージをつけて申請',
    appliedBtn: '申請済み',
    applyOk: '申請しました！相手が承認するとUIDが確認できます。',
    applyFail: '申請に失敗しました。時間をおいて再度お試しください。',
    applyProfileIncomplete: '先に原神UID・サーバーを入力・保存してください（「マイプロフィール」タブから保存してください）。',
    applyMessageModalTitle: 'メッセージをつけて申請',
    applyMessagePlaceholder: '「よろしくお願いします」など、一言添えてみましょう（未入力でも送信できます）',
    applyMessageSendBtn: 'この内容で申請する',
    visPublic: '公開',
    visHidden: '非公開',
    visApproval: '承認後に公開',
    visCloseFriend: '仲良くなったら',
    oshiPickerFull: '推しキャラは3人まで選べます',
    secretFieldsNote: (labels) => `🔒 ${labels} は承認後に確認できます`,
    matchLabel: (pct) => `マッチ度 ${pct}%`,
    savedImageShowLabel: { genshinRanking: '推しキャラランキングを表示', genshinCheck: '原神チェックシートを表示' },
    groupTitles: { basic: '基本情報', style: 'あなたについて', contact: '連絡・時間帯', voice: 'ボイスチャット', sns: 'つながれるSNS' },
    playStyleOfferTitle: '手伝います！',
    playStyleRequestTitle: '手伝ってください！',
    filterBarTitle: '絞り込み',
    filterResetBtn: 'リセット',
    filterGroupAttrTitle: 'あなたの追加属性',
    filterAdminTitle: '管理者用フィルター(非表示項目も含む)',
    resultCount: (n) => `${n}件`,
    viewProfileGone: 'このプロフィールは取り下げられたか見つかりませんでした。',
    viewProfileLoading: '読み込み中…',
    exportGenerating: '画像を作成しています…',
    exportFail: '画像の作成に失敗しました。時間をおいて再度お試しください。',
    exportSiteTitle: '＃原神フレンド承認板',
  },
  en: {
    justNow: 'just now',
    minAgo: (n) => `${n}m ago`,
    hourAgo: (n) => `${n}h ago`,
    dayAgo: (n) => `${n}d ago`,
    emptyMy: "You haven't saved your profile yet",
    emptySearch: 'No matching posts found',
    deleteBtn: 'Withdraw',
    deleteConfirm: "Withdraw your profile from search? You'll lose access to Search until you save again.",
    blockBtn: 'Block',
    blockConfirm: "Block this person? You'll disappear from each other's lists and chat (they won't be notified).",
    blockOk: 'Blocked.',
    blockFail: 'Failed to block. Please try again later.',
    unblockBtn: 'Unblock',
    unblockConfirm: 'Unblock this person?',
    unblockFail: 'Failed to unblock. Please try again later.',
    reportBtn: 'Report',
    reportReasonPrompt: 'Reason for reporting (optional).',
    reportOk: 'Reported. Thank you for letting us know.',
    reportFail: 'Failed to report. Please try again later.',
    blockedListTitle: 'Blocked users',
    emptyBlockedList: 'No blocked users',
    postOk: 'Saved!',
    postFail: 'Failed to save. Please try again later.',
    draftSaved: 'Draft saved (this device only)',
    draftSaveFail: 'Failed to save draft.',
    deleteFail: 'Failed to withdraw.',
    postFreshness: (lastActive, daysLeft) => `Last active: ${lastActive} · Hidden from Search in ${daysLeft} day(s) unless refreshed (applying to another post also refreshes it)`,
    refreshPostOk: 'Refreshed your active status!',
    refreshPostFail: 'Refresh failed. Please try again later.',
    fillAll: 'Please fill in all required (＊) fields.',
    fillAllMissing: (labels) => `Please fill in all required (＊) fields.\nMissing: ${labels}`,
    uidLabel: 'UID',
    applyBtn: 'Apply without a message',
    applyWithMsgBtn: 'Apply with a message',
    appliedBtn: 'Applied',
    applyOk: 'Request sent! You can see their UID once they accept.',
    applyFail: 'Failed to apply. Please try again later.',
    applyProfileIncomplete: 'Please fill in and save your Genshin UID and server first (save on the "My Profile" tab).',
    applyMessageModalTitle: 'Apply with a message',
    applyMessagePlaceholder: 'Add a short note, e.g. "Nice to meet you!" (optional — you can send without one)',
    applyMessageSendBtn: 'Send this request',
    visPublic: 'Public',
    visHidden: 'Hidden',
    visApproval: 'Visible after approval',
    visCloseFriend: "Once we're close",
    oshiPickerFull: 'You can select up to 3 favorite characters',
    secretFieldsNote: (labels) => `🔒 ${labels} available after approval`,
    matchLabel: (pct) => `${pct}% match`,
    savedImageShowLabel: { genshinRanking: 'Show Genshin Character Ranking', genshinCheck: 'Show Genshin Check Sheet' },
    groupTitles: { basic: 'Basic Info', style: 'About You', contact: 'Contact & Availability', voice: 'Voice Chat', sns: 'SNS' },
    playStyleOfferTitle: 'I can help with...',
    playStyleRequestTitle: 'Please help me with...',
    filterBarTitle: 'Filter',
    filterResetBtn: 'Reset',
    filterGroupAttrTitle: 'Additional traits',
    filterAdminTitle: 'Admin filters (includes hidden fields)',
    resultCount: (n) => `${n} result${n === 1 ? '' : 's'}`,
    viewProfileGone: 'This profile was withdrawn or could not be found.',
    viewProfileLoading: 'Loading…',
    exportGenerating: 'Generating image…',
    exportFail: 'Failed to generate the image. Please try again later.',
    exportSiteTitle: '#Genshin Friend Approval Board',
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

// 30日以上アクティブ更新がない投稿を探す一覧から除外するための判定。
// タイムスタンプがまだ書き込み確定していない(pending write)場合はfalse扱いにせず
// 表示し続ける(誤って新規投稿を隠さないため)。
function isPostFresh(post) {
  const ts = post.lastActiveAt || post.createdAt;
  if (!ts || typeof ts.toMillis !== 'function') return true;
  return (Date.now() - ts.toMillis()) < POST_STALE_MS;
}

// タブ切替のクリック処理はscript.js(非モジュール)側で行う。
// board.jsはFirebaseの読み込みに依存するモジュールスクリプトのため、
// 万一その読み込みが遅れたり失敗したりしてもタブの見た目切替自体は動くようにするため。

// ===== プロフィール自動反映(募集フォーム) =====
const uidInput = document.getElementById('input-uid');
const displayNameInput = document.getElementById('input-displayName');
const serverInput = document.getElementById('input-server');
const commentInput = document.getElementById('input-comment');
const arInput = document.getElementById('input-ar');
const wlInput = document.getElementById('input-wl');
const twitterInput = document.getElementById('input-twitter');
const tiktokInput = document.getElementById('input-tiktok');
const lineInput = document.getElementById('input-line');
const instagramInput = document.getElementById('input-instagram');
const jokingOkInput = document.getElementById('input-jokingOk');
const yuriOkInput = document.getElementById('input-yuriOk');
const fujoshiOkInput = document.getElementById('input-fujoshiOk');
const ageGroupInput = document.getElementById('input-ageGroup');
const casualOkInput = document.getElementById('input-casualOk');
const roughTalkInput = document.getElementById('input-roughTalk');
// あなたの追加属性: チェックを入れた項目だけリストを表示する
const ATTR_TOGGLE_FIELDS = ['casualOk', 'jokingOk', 'yuriOk', 'fujoshiOk', 'roughTalk', 'sameOshiReject'];
const attrToggleInputs = Object.fromEntries(ATTR_TOGGLE_FIELDS.map((k) => [k, document.getElementById(`attr-toggle-${k}`)]));
const vcNoteInput = document.getElementById('input-vcNote');
const vcDiscordIdInput = document.getElementById('input-vcDiscordId');
const vcLineIdInput = document.getElementById('input-vcLineId');
const vcAppsOtherInput = document.getElementById('input-vcAppsOtherText');
const playStylesOtherInput = document.getElementById('input-playStylesOtherText');
const multiFrequencyInput = document.getElementById('input-multiFrequency');
const multiFrequencyByDayInput = document.getElementById('multiFrequency-by-day');
const multiFrequencyDaysGroup = document.getElementById('multiFrequency-byday-days');
const multiFrequencyNoteInput = document.getElementById('input-multiFrequencyNote');
const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const showGenshinRankingInput = document.getElementById('input-showGenshinRanking');
const showGenshinCheckInput = document.getElementById('input-showGenshinCheck');
const sameOshiRejectInput = document.getElementById('input-sameOshiReject');
const weekdayStartInput = document.getElementById('weekday-start');
const weekdayEndInput = document.getElementById('weekday-end');
const weekendStartInput = document.getElementById('weekend-start');
const weekendEndInput = document.getElementById('weekend-end');
const weekdayByDayInput = document.getElementById('weekday-by-day');
const weekendByDayInput = document.getElementById('weekend-by-day');
const WEEKDAY_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND_DAYS = ['sat', 'sun'];
const weekdayDayInputs = Object.fromEntries(WEEKDAY_DAYS.map((d) => [d, {
  active: document.getElementById(`weekday-${d}-active`),
  start: document.getElementById(`weekday-${d}-start`),
  end: document.getElementById(`weekday-${d}-end`),
}]));
const weekendDayInputs = Object.fromEntries(WEEKEND_DAYS.map((d) => [d, {
  active: document.getElementById(`weekend-${d}-active`),
  start: document.getElementById(`weekend-${d}-start`),
  end: document.getElementById(`weekend-${d}-end`),
}]));

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
  WEEKDAY_DAYS.forEach((d) => { populateTimeSelect(weekdayDayInputs[d].start); populateTimeSelect(weekdayDayInputs[d].end); });
  WEEKEND_DAYS.forEach((d) => { populateTimeSelect(weekendDayInputs[d].start); populateTimeSelect(weekendDayInputs[d].end); });
}

// VCが「可能」の場合だけVC利用アプリ・通話スタイル一式を表示する
function updateVcExtraGroupVisibility() {
  const group = document.getElementById('vc-extra-group');
  if (group) group.classList.toggle('hidden', getRadioValue('vc') !== 'yes');
}
// VCが「相談」のときだけ詳細入力欄を表示する
function updateVcNoteEnabled() {
  const row = document.getElementById('row-vcNote');
  const enabled = getRadioValue('vc') === 'maybe';
  if (row) row.classList.toggle('hidden', !enabled);
  if (vcNoteInput && !enabled) vcNoteInput.value = '';
}
// プレイスタイルで「その他」を選んだときだけ詳細入力欄を表示する
function updatePlayStylesOtherEnabled() {
  const row = document.getElementById('row-playStylesOtherText');
  const enabled = getCheckboxValues('playStyles').includes('other');
  if (row) row.classList.toggle('hidden', !enabled);
  if (playStylesOtherInput && !enabled) playStylesOtherInput.value = '';
}
// マルチ頻度が「要相談」のときだけ詳細入力欄を表示する(曜日単位のときは対象外)
function updateMultiFrequencyNoteEnabled() {
  const row = document.getElementById('row-multiFrequencyNote');
  const enabled = !multiFrequencyByDayInput?.checked && multiFrequencyInput?.value === 'ask';
  if (row) row.classList.toggle('hidden', !enabled);
  if (multiFrequencyNoteInput && !enabled) multiFrequencyNoteInput.value = '';
}
// マルチ頻度の「曜日単位」チェックで、コンボボックスと曜日チェック一式を切り替える
function updateMultiFrequencyByDayVisibility() {
  const byDay = !!multiFrequencyByDayInput?.checked;
  if (multiFrequencyInput) multiFrequencyInput.classList.toggle('hidden', byDay);
  if (multiFrequencyDaysGroup) multiFrequencyDaysGroup.classList.toggle('hidden', !byDay);
  updateMultiFrequencyNoteEnabled();
}
document.getElementById('group-vc')?.addEventListener('change', () => {
  updateVcExtraGroupVisibility();
  updateVcNoteEnabled();
});
document.getElementById('group-playStyles')?.addEventListener('change', updatePlayStylesOtherEnabled);
multiFrequencyInput?.addEventListener('change', updateMultiFrequencyNoteEnabled);
multiFrequencyByDayInput?.addEventListener('change', updateMultiFrequencyByDayVisibility);
// 「曜日単位」チェックで、平日/休日それぞれ単一の時間帯入力と曜日別の入力を切り替える
function updateWeekdayByDayVisibility() {
  const enabled = !!weekdayByDayInput?.checked;
  document.getElementById('weekday-range-row')?.classList.toggle('hidden', enabled);
  document.getElementById('weekday-byday-rows')?.classList.toggle('hidden', !enabled);
}
function updateWeekendByDayVisibility() {
  const enabled = !!weekendByDayInput?.checked;
  document.getElementById('weekend-range-row')?.classList.toggle('hidden', enabled);
  document.getElementById('weekend-byday-rows')?.classList.toggle('hidden', !enabled);
}
weekdayByDayInput?.addEventListener('change', updateWeekdayByDayVisibility);
weekendByDayInput?.addEventListener('change', updateWeekendByDayVisibility);

// 曜日単位の各曜日チェック(有効/無効)。外すとその曜日の時間帯入力を非活性化・クリアする
// (「水・金だけ都合が良い」のように、曜日ごとに全く不可の日があるケースに対応)
function updateDayActiveState(dayInput) {
  if (!dayInput?.active) return;
  const active = dayInput.active.checked;
  if (dayInput.start) dayInput.start.disabled = !active;
  if (dayInput.end) dayInput.end.disabled = !active;
  if (!active) {
    if (dayInput.start) dayInput.start.value = '';
    if (dayInput.end) dayInput.end.value = '';
  }
}
[...WEEKDAY_DAYS.map((d) => weekdayDayInputs[d]), ...WEEKEND_DAYS.map((d) => weekendDayInputs[d])].forEach((dayInput) => {
  dayInput.active?.addEventListener('change', () => updateDayActiveState(dayInput));
});

// ===== 保存画像(推しキャラランキング/チェックシート)のライブプレビュー =====
const SAVED_IMAGE_NOT_SAVED_YET_HTML = {
  genshinRanking: {
    ja: 'まだ保存された画像がありません。<a href="https://uko05.github.io/TiersList01/" target="_blank" rel="noopener">原神推しキャラランキング</a>のページで先に保存してください。',
    en: 'No saved image found yet. Please save one on the <a href="https://uko05.github.io/TiersList01/" target="_blank" rel="noopener">Genshin Character Ranking</a> page first.',
  },
  genshinCheck: {
    ja: 'まだ保存された画像がありません。<a href="https://uko05.github.io/genshinCheck06/" target="_blank" rel="noopener">原神チェックシート</a>のページで先に保存してください。',
    en: 'No saved image found yet. Please save one on the <a href="https://uko05.github.io/genshinCheck06/" target="_blank" rel="noopener">Genshin Check Sheet</a> page first.',
  },
};

async function refreshSavedImagePreview(siteId, checkboxInput, wrapId, imgId, msgId) {
  const wrap = document.getElementById(wrapId);
  const img = document.getElementById(imgId);
  const msg = document.getElementById(msgId);
  if (!wrap || !img || !msg || !checkboxInput) return;
  if (!checkboxInput.checked) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  const entry = await getSavedProfileImageFor(siteId, getUserId());
  if (entry) {
    img.src = entry.url;
    img.style.display = 'block';
    msg.style.display = 'none';
  } else {
    img.style.display = 'none';
    msg.style.display = 'block';
    msg.innerHTML = SAVED_IMAGE_NOT_SAVED_YET_HTML[siteId][currentLang()];
  }
}
function refreshGenshinRankingPreview() {
  refreshSavedImagePreview('genshinRanking', showGenshinRankingInput, 'preview-genshinRanking', 'preview-genshinRanking-img', 'preview-genshinRanking-message');
}
function refreshGenshinCheckPreview() {
  refreshSavedImagePreview('genshinCheck', showGenshinCheckInput, 'preview-genshinCheck', 'preview-genshinCheck-img', 'preview-genshinCheck-message');
}
showGenshinRankingInput?.addEventListener('change', refreshGenshinRankingPreview);
showGenshinCheckInput?.addEventListener('change', refreshGenshinCheckPreview);

// 「同担拒否あり」が選ばれているときだけキャラ選択欄を表示する
function updateSameOshiCharsVisibility() {
  const row = document.getElementById('row-sameOshiChars');
  if (row) row.classList.toggle('hidden', sameOshiRejectInput?.value !== 'yes');
}
sameOshiRejectInput?.addEventListener('change', updateSameOshiCharsVisibility);

// 追加属性のトグルにチェックが入っている項目だけリストを表示する。
// トグルを外したときは選択値もクリアする(非表示のまま古い値が投稿されるのを防ぐ)。
function updateAttrToggleVisibility(key, { clearOnHide = false } = {}) {
  const toggle = attrToggleInputs[key];
  const row = document.getElementById(`row-${key}`);
  const checked = !!toggle?.checked;
  if (row) row.classList.toggle('hidden', !checked);
  if (!checked && clearOnHide) {
    const select = document.getElementById(`input-${key}`);
    if (select) select.value = '';
  }
}
ATTR_TOGGLE_FIELDS.forEach((key) => {
  attrToggleInputs[key]?.addEventListener('change', () => {
    updateAttrToggleVisibility(key, { clearOnHide: true });
    if (key === 'sameOshiReject') updateSameOshiCharsVisibility();
  });
});

function fillFormFromProfile() {
  if (uidInput && store.genshinUid) uidInput.value = store.genshinUid;
  if (displayNameInput && store.displayName) displayNameInput.value = store.displayName;
  if (serverInput && store.server) serverInput.value = store.server;
  if (commentInput && store.intro) commentInput.value = store.intro;
  if (arInput) arInput.value = store.adventureRank || 60;
  if (wlInput) wlInput.value = store.worldLevel != null ? store.worldLevel : 9;
  if (twitterInput && store.twitterId) twitterInput.value = store.twitterId;
  if (tiktokInput && store.tiktokId) tiktokInput.value = store.tiktokId;
  if (lineInput && store.lineId) lineInput.value = store.lineId;
  if (instagramInput && store.instagramId) instagramInput.value = store.instagramId;
  if (jokingOkInput) jokingOkInput.value = store.jokingOk ? 'yes' : '';
  if (yuriOkInput) yuriOkInput.value = store.yuriOk ? 'yes' : '';
  if (fujoshiOkInput) fujoshiOkInput.value = store.fujoshiOk ? 'yes' : '';
  if (roughTalkInput) roughTalkInput.value = store.roughTalk || '';
  if (sameOshiRejectInput) sameOshiRejectInput.value = store.sameOshiReject || '';
  if (vcNoteInput && store.vcNote) vcNoteInput.value = store.vcNote;
  if (vcDiscordIdInput && store.vcDiscordId) vcDiscordIdInput.value = store.vcDiscordId;
  if (vcLineIdInput && store.vcLineId) vcLineIdInput.value = store.vcLineId;
  if (vcAppsOtherInput && store.vcAppsOtherText) vcAppsOtherInput.value = store.vcAppsOtherText;
  if (playStylesOtherInput && store.playStylesOtherText) playStylesOtherInput.value = store.playStylesOtherText;
  if (multiFrequencyNoteInput && store.multiFrequencyNote) multiFrequencyNoteInput.value = store.multiFrequencyNote;
  if (showGenshinRankingInput) showGenshinRankingInput.checked = !!store.showGenshinRanking;
  if (showGenshinCheckInput) showGenshinCheckInput.checked = !!store.showGenshinCheck;
  if (weekdayByDayInput) weekdayByDayInput.checked = !!store.weekdayTimesByDay;
  if (store.weekdayTimesByDay) {
    WEEKDAY_DAYS.forEach((d) => {
      const dv = store.weekdayTimes?.[d] || {};
      const input = weekdayDayInputs[d];
      if (input.active) input.active.checked = dv.active !== false;
      if (input.start) input.start.value = dv.start || '';
      if (input.end) input.end.value = dv.end || '';
      updateDayActiveState(input);
    });
  } else {
    if (weekdayStartInput) weekdayStartInput.value = store.weekdayTimes?.start || '';
    if (weekdayEndInput) weekdayEndInput.value = store.weekdayTimes?.end || '';
  }
  if (weekendByDayInput) weekendByDayInput.checked = !!store.weekendTimesByDay;
  if (store.weekendTimesByDay) {
    WEEKEND_DAYS.forEach((d) => {
      const dv = store.weekendTimes?.[d] || {};
      const input = weekendDayInputs[d];
      if (input.active) input.active.checked = dv.active !== false;
      if (input.start) input.start.value = dv.start || '';
      if (input.end) input.end.value = dv.end || '';
      updateDayActiveState(input);
    });
  } else {
    if (weekendStartInput) weekendStartInput.value = store.weekendTimes?.start || '';
    if (weekendEndInput) weekendEndInput.value = store.weekendTimes?.end || '';
  }

  setRadioValue('gender', store.gender);
  if (ageGroupInput) ageGroupInput.checked = !!store.ageGroup;
  setRadioValue('spending', store.spending);
  setRadioValue('inviteStyle', store.inviteStyle);
  if (multiFrequencyByDayInput) multiFrequencyByDayInput.checked = !!store.multiFrequencyByDay;
  if (store.multiFrequencyByDay) {
    setCheckboxValues('multiFrequencyDays', Array.isArray(store.multiFrequency) ? store.multiFrequency : []);
  } else if (multiFrequencyInput && store.multiFrequency) {
    multiFrequencyInput.value = store.multiFrequency;
  }
  setRadioValue('vc', store.vc);
  if (casualOkInput) casualOkInput.value = store.casualOk || '';
  setCheckboxValues('platforms', store.platforms);
  setCheckboxValues('playStyles', store.playStyles);
  setCheckboxValues('friendPreference', store.friendPreference);
  updateVcExtraGroupVisibility();
  updateVcNoteEnabled();
  updatePlayStylesOtherEnabled();
  updateMultiFrequencyByDayVisibility();
  updateWeekdayByDayVisibility();
  updateWeekendByDayVisibility();
  ATTR_TOGGLE_FIELDS.forEach((key) => {
    if (attrToggleInputs[key]) attrToggleInputs[key].checked = !!store[key];
    updateAttrToggleVisibility(key);
  });
  updateSameOshiCharsVisibility();
  refreshGenshinRankingPreview();
  refreshGenshinCheckPreview();

  oshiPicker.renderSelected();
  sameOshiPicker.renderSelected();
}

// ===== 公開設定(非公開/公開/承認制)セレクト =====
function populateVisibilitySelects() {
  VISIBILITY_FIELDS.forEach((key) => {
    const sel = document.getElementById(`vis-${key}`);
    if (!sel) return;
    sel.innerHTML = '';
    const isNoPublic = NO_PUBLIC_FIELDS.includes(key);
    const options = isNoPublic
      ? [['hidden', s().visHidden], ['approval', s().visApproval], ['closeFriend', s().visCloseFriend]]
      : [['public', s().visPublic], ['hidden', s().visHidden], ['approval', s().visApproval]];
    options.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      sel.appendChild(opt);
    });
    // 過去に保存された値が今回の選択肢に無い場合(例:SNS項目が以前「公開」だった等)は
    // 表示上の既定値へフォールバックし、ストア側も併せて補正する
    const allowedValues = options.map(([v]) => v);
    if (!allowedValues.includes(store.visibility[key])) {
      store.visibility[key] = isNoPublic ? 'approval' : 'public';
    }
    sel.value = store.visibility[key];
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

// ===== 募集投稿 =====
const postForm = document.getElementById('post-form');
const postSubmitBtn = document.getElementById('post-submit-btn');
const postFormMsg = document.getElementById('post-form-msg');
const draftSaveBtn = document.getElementById('draft-save-btn');

function showMsg(el, text, isError) {
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.classList.toggle('ok', !isError);
}

// ===== 入力内容の一時保存(この端末のlocalStorageのみ、Firestoreには送らない) =====
// 推しキャラランキング/チェックシートのサイトを開くために離脱しても、
// 「保存する」まで済ませていない入力が消えてしまわないようにするための下書き機能。
const DRAFT_LS_KEY = 'friendBoard_draft';

let draftSaveFlashTimer = null;
function flashDraftSaveBtn(ok) {
  if (!draftSaveBtn) return;
  const originalLabel = draftSaveBtn.dataset.originalLabel || draftSaveBtn.textContent;
  draftSaveBtn.dataset.originalLabel = originalLabel;
  draftSaveBtn.classList.toggle('saved', ok);
  draftSaveBtn.classList.toggle('failed', !ok);
  draftSaveBtn.textContent = ok
    ? (currentLang() === 'en' ? '✓ Saved' : '✓ 保存しました')
    : (currentLang() === 'en' ? '✕ Failed' : '✕ 失敗しました');
  if (draftSaveFlashTimer) clearTimeout(draftSaveFlashTimer);
  draftSaveFlashTimer = setTimeout(() => {
    draftSaveBtn.classList.remove('saved', 'failed');
    draftSaveBtn.textContent = draftSaveBtn.dataset.originalLabel;
    draftSaveFlashTimer = null;
  }, 1500);
}

function saveDraft() {
  try {
    const draft = collectFormValues();
    draft.intro = commentInput?.value.trim() || ''; // storeではコメントの既定値はintroという名前
    localStorage.setItem(DRAFT_LS_KEY, JSON.stringify(draft));
    showMsg(postFormMsg, s().draftSaved, false);
    flashDraftSaveBtn(true);
    formDirty = false;
  } catch (e) {
    console.error('[board] draft save failed', e);
    showMsg(postFormMsg, s().draftSaveFail, true);
    flashDraftSaveBtn(false);
  }
}
draftSaveBtn?.addEventListener('click', saveDraft);

// ===== 未保存の変更があるまま離脱しようとしたら警告する =====
// 「保存する」「一時保存」どちらも済ませていない入力・選択の変更をformDirtyで追跡し、
// beforeunloadでブラウザ標準の離脱確認ダイアログを出す。
let formDirty = false;
postForm?.addEventListener('input', () => { formDirty = true; });
postForm?.addEventListener('change', () => { formDirty = true; });
window.addEventListener('beforeunload', (e) => {
  if (!formDirty) return;
  e.preventDefault();
  e.returnValue = '';
});

// 一時保存した内容をstoreへ重ね書きする(Firestoreの保存済みプロフィールより優先)。
// 実際のフォーム反映はfillFormFromProfile()が読むstoreを経由するので、ここではstoreを書き換えるだけでよい。
function applyDraftIfAny() {
  try {
    const raw = localStorage.getItem(DRAFT_LS_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    Object.assign(store, draft);
  } catch (e) {
    console.error('[board] draft load failed', e);
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_LS_KEY);
}

// フォームの現在値を全項目分集めて{key: value}で返す(genshinUid/serverも含む)
function collectFormValues() {
  // VCが「可能」以外のときはVC利用アプリ一式は非表示にしているため、
  // 古い入力値が残っていても投稿には含めない(あなたの属性一式はVCの可否と関係ないため対象外)
  const vcOpen = getRadioValue('vc') === 'yes';
  const sameOshiRejectYes = sameOshiRejectInput?.value === 'yes';
  const weekdayByDay = !!weekdayByDayInput?.checked;
  const weekendByDay = !!weekendByDayInput?.checked;
  const multiFrequencyByDay = !!multiFrequencyByDayInput?.checked;

  // 利用アプリの判定はチェックボックスではなく、IDを入力したかどうかで決まる
  // (「つながれるSNS」と同じ考え方: 入力があるアプリ=使っているアプリ)
  const vcDiscordId = vcOpen ? (vcDiscordIdInput?.value.trim() || '') : '';
  const vcLineId = vcOpen ? (vcLineIdInput?.value.trim() || '') : '';
  const vcAppsOtherText = vcOpen ? (vcAppsOtherInput?.value.trim() || '') : '';
  const vcApps = [
    vcDiscordId && 'discord',
    vcLineId && 'line',
    vcAppsOtherText && 'other',
  ].filter(Boolean);

  return {
    genshinUid: uidInput.value.trim(),
    displayName: displayNameInput?.value.trim() || '',
    server: serverInput.value,
    adventureRank: arInput.value ? Number(arInput.value) : '',
    worldLevel: wlInput.value !== '' ? Number(wlInput.value) : '',
    gender: getRadioValue('gender'),
    ageGroup: !!ageGroupInput?.checked,
    platforms: getCheckboxValues('platforms'),
    oshiChars: store.oshiChars,
    spending: getRadioValue('spending'),
    playStyles: getCheckboxValues('playStyles'),
    playStylesOtherText: getCheckboxValues('playStyles').includes('other') ? (playStylesOtherInput?.value.trim() || '') : '',
    showGenshinRanking: !!showGenshinRankingInput?.checked,
    showGenshinCheck: !!showGenshinCheckInput?.checked,
    inviteStyle: getRadioValue('inviteStyle'),
    multiFrequency: multiFrequencyByDay ? getCheckboxValues('multiFrequencyDays') : (multiFrequencyInput?.value || ''),
    multiFrequencyByDay,
    multiFrequencyNote: (!multiFrequencyByDay && multiFrequencyInput?.value === 'ask') ? (multiFrequencyNoteInput?.value.trim() || '') : '',
    vc: getRadioValue('vc'),
    vcNote: getRadioValue('vc') === 'maybe' ? (vcNoteInput?.value.trim() || '') : '',
    vcApps,
    vcDiscordId,
    vcLineId,
    vcAppsOtherText,
    casualOk: casualOkInput?.value || '',
    jokingOk: jokingOkInput?.value === 'yes',
    yuriOk: yuriOkInput?.value === 'yes',
    fujoshiOk: fujoshiOkInput?.value === 'yes',
    roughTalk: roughTalkInput?.value || '',
    sameOshiReject: sameOshiRejectInput?.value || '',
    sameOshiChars: sameOshiRejectYes ? store.sameOshiChars : [],
    twitterId: twitterInput.value.trim(),
    tiktokId: tiktokInput?.value.trim() || '',
    lineId: lineInput?.value.trim() || '',
    instagramId: instagramInput?.value.trim() || '',
    weekdayTimes: weekdayByDay
      ? Object.fromEntries(WEEKDAY_DAYS.map((d) => [d, {
        active: weekdayDayInputs[d].active?.checked !== false,
        start: weekdayDayInputs[d].start?.value || '',
        end: weekdayDayInputs[d].end?.value || '',
      }]))
      : { start: weekdayStartInput?.value || '', end: weekdayEndInput?.value || '' },
    weekdayTimesByDay: weekdayByDay,
    weekendTimes: weekendByDay
      ? Object.fromEntries(WEEKEND_DAYS.map((d) => [d, {
        active: weekendDayInputs[d].active?.checked !== false,
        start: weekendDayInputs[d].start?.value || '',
        end: weekendDayInputs[d].end?.value || '',
      }]))
      : { start: weekendStartInput?.value || '', end: weekendEndInput?.value || '' },
    weekendTimesByDay: weekendByDay,
    friendPreference: getCheckboxValues('friendPreference'),
  };
}

// weekdayTimes/weekendTimesは通常{start,end}だが、曜日単位のときは{mon:{start,end},...}になる。
// どちらの形でも、最低1つの時間帯(範囲、または曜日のいずれか)が入力されていればOKとする。
function timesFieldFilled(v) {
  if (!v || typeof v !== 'object') return false;
  if ('start' in v || 'end' in v) return !!(v.start && v.end);
  return Object.values(v).some((d) => d && d.active !== false && d.start && d.end);
}

// 必須項目(＊)一覧。未入力があれば足りない項目名を案内し、最初の1つまでスクロールする。
const REQUIRED_FIELDS = [
  { key: 'displayName', el: displayNameInput, filled: (v) => !!v.displayName },
  { key: 'genshinUid', el: uidInput, filled: (v) => !!v.genshinUid },
  { key: 'server', el: serverInput, filled: (v) => !!v.server },
  { key: 'gender', el: document.getElementById('group-gender'), filled: (v) => !!v.gender },
  {
    key: 'platforms',
    el: document.getElementById('group-platforms'),
    filled: (v) => Array.isArray(v.platforms) && v.platforms.length > 0,
  },
  {
    key: 'weekdayTimes',
    el: () => document.getElementById(weekdayByDayInput?.checked ? 'weekday-byday-rows' : 'weekday-range-row'),
    filled: (v) => timesFieldFilled(v.weekdayTimes),
  },
  {
    key: 'weekendTimes',
    el: () => document.getElementById(weekendByDayInput?.checked ? 'weekend-byday-rows' : 'weekend-range-row'),
    filled: (v) => timesFieldFilled(v.weekendTimes),
  },
  { key: 'inviteStyle', el: document.getElementById('group-inviteStyle'), filled: (v) => !!v.inviteStyle },
  {
    key: 'multiFrequency',
    el: () => (multiFrequencyByDayInput?.checked ? multiFrequencyDaysGroup : multiFrequencyInput),
    filled: (v) => (Array.isArray(v.multiFrequency) ? v.multiFrequency.length > 0 : !!v.multiFrequency),
  },
  { key: 'vc', el: document.getElementById('group-vc'), filled: (v) => !!v.vc },
  { key: 'spending', el: document.getElementById('group-spending'), filled: (v) => !!v.spending },
];

postForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const values = collectFormValues();
  const comment = commentInput.value.trim();

  const missing = REQUIRED_FIELDS.filter((f) => !f.filled(values));
  if (missing.length) {
    const lang = currentLang();
    const labels = missing.map((f) => fieldLabel(f.key, lang)).join(lang === 'en' ? ', ' : '、');
    showMsg(postFormMsg, s().fillAllMissing(labels), true);
    const target = typeof missing[0].el === 'function' ? missing[0].el() : missing[0].el;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    // 'approval'指定の項目(genshinUidは常にこれ)は値を一切書き込まず、項目名だけを
    // secretFieldKeysへ記録する(承認された時点で初めてfriendBoardApplicationsへ実際の値を
    // 書き込む＝applications.js参照)。
    const { publicFields, secretFieldKeys } = buildPostFieldBuckets(values, store.visibility);

    // 1ユーザー = 1リスティング(=マイプロフィール)。ドキュメントIDをuserIdで固定し、
    // 保存の度に丸ごと上書きする(既存の下書きを部分的に残す必要がないため)。
    await setDoc(doc(db, 'friendBoardPosts', getUserId()), {
      userId: getUserId(),
      comment,
      avatarGame: avatar.game,
      avatarIcon: avatar.icon,
      publicFields,
      secretFieldKeys,
      requiresApproval: secretFieldKeys.length > 0,
      active: true,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });

    clearDraft();
    formDirty = false;
    showMsg(postFormMsg, s().postOk, false);

    // QRなどから開いた個別プロフィール表示で「マイプロフ設定後に申請する」を経由した
    // 場合、保存が終わったら自動でさっきのプロフィール表示に戻す(一致/相性◎の色分けも
    // 自分の情報を保存した状態で見られるようになる)。
    if (pendingReturnUserId) {
      const targetUserId = pendingReturnUserId;
      pendingReturnUserId = null;
      renderViewProfilePanel(targetUserId);
    }
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
  const headFields = new Set(['genshinUid', 'server', 'displayName']); // ヘッダー側で個別に描画する項目
  const ownerUserId = mine ? getUserId() : post.userId;

  VISIBILITY_FIELDS.forEach((key) => {
    // どういうフレンドがほしい？はマッチ度計算専用の内部データであり、
    // 自分/他人どちらのカードにもチップとして表示しない(ユーザーへの明言済み仕様)。
    if (key === 'friendPreference') return;
    if (mine) {
      // 自分のカードは常にstoreの値をそのまま見せる(自分自身なので隠す意味がない)。
      // ただし本人が「非公開」にした項目は一覧に出さない(フォーム側で確認できるため)。
      const vis = store.visibility[key] || 'public';
      if (vis === 'hidden') return;
      if (headFields.has(key)) return;
      pushFieldRow(rows, key, store[key], lang, ownerUserId);
    } else {
      if (post.secretFieldKeys?.includes(key)) {
        // 原神UID・名前は誰でも常に承認後公開のため、都度の注記には出さず
        // 検索一覧上部の固定の注記(searchApprovalNote)でまとめて案内する
        if (key !== 'genshinUid' && key !== 'displayName') secretLabels.push(fieldLabel(key, lang));
        return;
      }
      if (headFields.has(key)) return;
      if (post.publicFields && key in post.publicFields) {
        pushFieldRow(rows, key, post.publicFields[key], lang, ownerUserId);
      }
    }
  });
  return { rows, secretLabels };
}

const SAVED_IMAGE_FIELD_SITE_IDS = { showGenshinRanking: 'genshinRanking', showGenshinCheck: 'genshinCheck' };

function pushFieldRow(rows, key, value, lang, ownerUserId) {
  if (key === 'oshiChars' || key === 'sameOshiChars') {
    if (Array.isArray(value) && value.length) rows.push({ key, oshiIcons: value });
    return;
  }
  if (SAVED_IMAGE_FIELD_SITE_IDS[key]) {
    if (value === true) rows.push({ key, savedImageSite: SAVED_IMAGE_FIELD_SITE_IDS[key], ownerUserId });
    return;
  }
  const text = formatFieldValue(key, value, lang);
  if (text) rows.push({ key, value, text: `${fieldLabel(key, lang)}: ${text}` });
}

// ===== 募集カード描画 =====
// onNeedProfile: 指定時、申請ボタン押下時にマイプロフィール未設定なら通常のalertの
// 代わりにこれを呼ぶ(QRなどから開いた個別プロフィール表示専用の誘導ポップ用)。
function buildCard(post, { mine, matchPercent, onNeedProfile } = {}) {
  const card = document.createElement('div');
  card.className = 'board-card';

  const avatarCol = document.createElement('div');
  avatarCol.className = 'board-card-avatar-col';
  card.appendChild(avatarCol);

  const avatarImg = document.createElement('img');
  avatarImg.className = 'board-card-avatar';
  avatarImg.src = avatarUrl(post.avatarGame, post.avatarIcon);
  avatarImg.alt = '';
  avatarImg.loading = 'lazy';
  avatarCol.appendChild(avatarImg);

  const body = document.createElement('div');
  body.className = 'board-card-body';
  card.appendChild(body);

  const nameVisible = mine
    ? (store.visibility.displayName || 'public') !== 'hidden'
    : (post.publicFields && 'displayName' in post.publicFields);
  const nameValue = mine ? store.displayName : post.publicFields?.displayName;
  if (nameVisible && nameValue) {
    const nameEl = document.createElement('div');
    nameEl.className = 'board-card-name';
    nameEl.textContent = nameValue;
    body.appendChild(nameEl);
  }

  const { rows: allRows, secretLabels } = getDisplayFields(post, mine);

  // 推しキャラは項目数が多いとカテゴリー枠内で文字と被ってしまうため、
  // アバター画像の下(元々余白ができやすい場所)に縦に並べて表示する
  const oshiCharsRow = allRows.find((row) => row.key === 'oshiChars');
  const rows = allRows.filter((row) => row.key !== 'oshiChars');
  if (oshiCharsRow) {
    const oshiCol = document.createElement('div');
    oshiCol.className = 'board-card-oshi-col';
    const oshiLabel = document.createElement('span');
    oshiLabel.className = 'board-card-oshi-col-label';
    oshiLabel.textContent = fieldLabel('oshiChars', currentLang());
    oshiCol.appendChild(oshiLabel);
    oshiCharsRow.oshiIcons.forEach((icon) => {
      const img = document.createElement('img');
      img.className = 'board-card-oshi-icon-lg';
      img.src = GENSHIN_ICON_BASE + icon;
      img.alt = '';
      img.loading = 'lazy';
      oshiCol.appendChild(img);
    });
    avatarCol.appendChild(oshiCol);
  }

  const head = document.createElement('div');
  head.className = 'board-card-head';

  if (!mine && matchPercent != null) {
    const matchBadge = document.createElement('span');
    matchBadge.className = 'board-card-match-badge';
    matchBadge.textContent = s().matchLabel(matchPercent);
    head.appendChild(matchBadge);
  }

  if (secretLabels.length) {
    const note = document.createElement('span');
    note.className = 'board-card-secret-note';
    note.textContent = s().secretFieldsNote(secretLabels.join(currentLang() === 'en' ? ', ' : '、'));
    head.appendChild(note);
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

  const savedImageRows = rows.filter((row) => row.savedImageSite);
  const chipRows = rows.filter((row) => !row.savedImageSite);
  // フォームの見出し(基本情報/あなたについて/連絡・時間帯/ボイスチャット/つながれるSNS)に
  // 対応するカテゴリーごとに枠で区切って表示する(項目が多く雑然として見えるのを防ぐため)
  FIELD_GROUPS.forEach((group) => {
    const groupRows = chipRows.filter((row) => group.fields.includes(row.key));
    if (!groupRows.length) return;
    const box = document.createElement('div');
    box.className = 'board-card-group';
    const title = document.createElement('p');
    title.className = 'board-card-group-title';
    title.textContent = s().groupTitles[group.key] || group.key;
    box.appendChild(title);
    const chips = document.createElement('div');
    chips.className = 'board-card-chips';
    const playStylesRow = groupRows.find((row) => row.key === 'playStyles');
    const otherRows = groupRows.filter((row) => row.key !== 'playStyles');
    otherRows.forEach((row) => {
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
      if (!mine) {
        const matchKind = fieldMatchKind(store[row.key], row.value, row.key);
        if (matchKind === 'exact') chip.classList.add('board-card-chip-matched');
        else if (matchKind === 'complementary') chip.classList.add('board-card-chip-complementary');
      }
      chip.textContent = row.text;
      chips.appendChild(chip);
    });
    // playStylesは「手伝います！」「手伝ってください！」を別枠に分け、値ごとに個別チップで
    // 表示する(まとめて1チップにすると、どの項目が一致/相性なのか分からなくなるため)。
    let offerBox = null;
    let requestBox = null;
    if (playStylesRow) {
      const lang = currentLang();
      const generalValues = playStylesRow.value.filter((v) => !PLAYSTYLE_OFFER_VALUES.includes(v) && !PLAYSTYLE_REQUEST_VALUES.includes(v));
      const offerValues = playStylesRow.value.filter((v) => PLAYSTYLE_OFFER_VALUES.includes(v));
      const requestValues = playStylesRow.value.filter((v) => PLAYSTYLE_REQUEST_VALUES.includes(v));
      const appendValueChip = (parent, v) => {
        const chip = document.createElement('span');
        chip.className = 'board-card-chip';
        if (!mine) {
          const matchKind = playStyleValueMatchKind(store.playStyles, v);
          if (matchKind === 'exact') chip.classList.add('board-card-chip-matched');
          else if (matchKind === 'complementary') chip.classList.add('board-card-chip-complementary');
        }
        chip.textContent = formatFieldValue('playStyles', [v], lang);
        parent.appendChild(chip);
      };
      generalValues.forEach((v) => appendValueChip(chips, v));
      if (offerValues.length) {
        offerBox = document.createElement('div');
        offerBox.className = 'board-card-group board-card-group-nested board-card-group-offer';
        const offerTitle = document.createElement('p');
        offerTitle.className = 'board-card-group-title board-card-group-title-offer';
        offerTitle.textContent = s().playStyleOfferTitle;
        offerBox.appendChild(offerTitle);
        const offerChips = document.createElement('div');
        offerChips.className = 'board-card-chips';
        offerValues.forEach((v) => appendValueChip(offerChips, v));
        offerBox.appendChild(offerChips);
      }
      if (requestValues.length) {
        requestBox = document.createElement('div');
        requestBox.className = 'board-card-group board-card-group-nested board-card-group-request';
        const requestTitle = document.createElement('p');
        requestTitle.className = 'board-card-group-title board-card-group-title-request';
        requestTitle.textContent = s().playStyleRequestTitle;
        requestBox.appendChild(requestTitle);
        const requestChips = document.createElement('div');
        requestChips.className = 'board-card-chips';
        requestValues.forEach((v) => appendValueChip(requestChips, v));
        requestBox.appendChild(requestChips);
      }
    }
    box.appendChild(chips);
    if (offerBox) box.appendChild(offerBox);
    if (requestBox) box.appendChild(requestBox);
    body.appendChild(box);
  });
  savedImageRows.forEach((row) => {
    const wrap = document.createElement('div');
    wrap.className = 'board-card-saved-image';
    body.appendChild(wrap);

    if (mine) {
      // 自分のプレビュー(マイプロフィールタブ)は従来通り即表示
      const img = document.createElement('img');
      img.className = 'board-card-saved-image-img';
      img.alt = '';
      img.loading = 'lazy';
      wrap.appendChild(img);
      getSavedProfileImageFor(row.savedImageSite, row.ownerUserId).then((entry) => {
        if (entry) {
          img.src = entry.url;
          img.addEventListener('load', () => { img.style.width = `${img.naturalWidth * 0.3}px`; });
        } else {
          wrap.remove();
        }
      });
      return;
    }

    // さがす一覧では、押すまで画像を読み込み・表示しない
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'board-card-saved-image-toggle';
    toggleBtn.textContent = s().savedImageShowLabel[row.savedImageSite] || row.savedImageSite;
    wrap.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', () => {
      toggleBtn.disabled = true;
      getSavedProfileImageFor(row.savedImageSite, row.ownerUserId).then((entry) => {
        if (entry) {
          const img = document.createElement('img');
          img.className = 'board-card-saved-image-img';
          img.alt = '';
          img.src = entry.url;
          img.addEventListener('load', () => { img.style.width = `${img.naturalWidth * 0.3}px`; });
          wrap.replaceChild(img, toggleBtn);
        } else {
          wrap.remove();
        }
      });
    }, { once: true });
  });

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
    if (hasAppliedTo(post.id)) {
      const appliedBtn = document.createElement('button');
      appliedBtn.type = 'button';
      appliedBtn.className = 'board-card-apply-btn';
      appliedBtn.textContent = s().appliedBtn;
      appliedBtn.disabled = true;
      foot.appendChild(appliedBtn);
    } else {
      const btnRow = document.createElement('div');
      btnRow.className = 'board-request-btn-row';

      const applyMsgBtn = document.createElement('button');
      applyMsgBtn.type = 'button';
      applyMsgBtn.className = 'board-card-apply-msg-btn';
      applyMsgBtn.textContent = s().applyWithMsgBtn;
      applyMsgBtn.addEventListener('click', () => {
        if (onNeedProfile && (!store.genshinUid || !store.server)) { onNeedProfile(); return; }
        openApplyMessageModal(post);
      });
      btnRow.appendChild(applyMsgBtn);

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'board-card-apply-btn';
      applyBtn.textContent = s().applyBtn;
      applyBtn.addEventListener('click', () => {
        if (onNeedProfile && (!store.genshinUid || !store.server)) { onNeedProfile(); return; }
        handleApply(post);
      });
      btnRow.appendChild(applyBtn);

      foot.appendChild(btnRow);
    }
  }

  body.appendChild(foot);
  if (!mine) body.appendChild(buildBlockReportRow(post.userId, { postId: post.id }));
  return card;
}

async function handleBlock(userId) {
  if (!confirm(s().blockConfirm)) return;
  try {
    await blockUser(userId);
    alert(s().blockOk);
  } catch (e) {
    console.error('[board] block failed', e);
    alert(s().blockFail);
  }
}

async function handleReport({ reportedUserId, postId, applicationId, chatMessages }) {
  const reason = prompt(s().reportReasonPrompt);
  if (reason === null) return; // キャンセル時は何もしない(空文字での送信はOK)
  try {
    await reportUser({ reporterUserId: getUserId(), reportedUserId, postId, applicationId, chatMessages, reason });
    alert(s().reportOk);
  } catch (e) {
    console.error('[board] report failed', e);
    alert(s().reportFail);
  }
}

// 自分以外の投稿カードの一番下に置く、目立たせすぎない「ブロックする/通報する」リンク。
function buildBlockReportRow(targetUserId, { postId } = {}) {
  const row = document.createElement('div');
  row.className = 'board-card-safety-row';

  const blockBtn = document.createElement('button');
  blockBtn.type = 'button';
  blockBtn.className = 'board-card-safety-link';
  blockBtn.textContent = s().blockBtn;
  blockBtn.addEventListener('click', () => handleBlock(targetUserId));
  row.appendChild(blockBtn);

  const reportBtn = document.createElement('button');
  reportBtn.type = 'button';
  reportBtn.className = 'board-card-safety-link';
  reportBtn.textContent = s().reportBtn;
  reportBtn.addEventListener('click', () => handleReport({ reportedUserId: targetUserId, postId }));
  row.appendChild(reportBtn);

  return row;
}

async function handleApply(post, message) {
  try {
    await applyToPost(post, message);
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

// ===== メッセージをつけて申請するモーダル =====
let pendingApplyPost = null;
const applyMessageModal = document.getElementById('apply-message-modal');
const applyMessageInput = document.getElementById('apply-message-input');
const applyMessageSendBtn = document.getElementById('apply-message-send');

function openApplyMessageModal(post) {
  pendingApplyPost = post;
  if (applyMessageInput) applyMessageInput.value = '';
  if (applyMessageModal) applyMessageModal.style.display = 'flex';
  applyMessageInput?.focus();
}
function closeApplyMessageModal() {
  if (applyMessageModal) applyMessageModal.style.display = 'none';
  pendingApplyPost = null;
}
document.getElementById('apply-message-close')?.addEventListener('click', closeApplyMessageModal);
document.querySelector('#apply-message-modal .col-modal-backdrop')?.addEventListener('click', closeApplyMessageModal);
applyMessageSendBtn?.addEventListener('click', async () => {
  if (!pendingApplyPost) return;
  applyMessageSendBtn.disabled = true;
  const post = pendingApplyPost;
  const message = applyMessageInput?.value || '';
  try {
    await applyToPost(post, message);
    closeApplyMessageModal();
    alert(s().applyOk);
  } catch (err) {
    if (err.code === 'PROFILE_INCOMPLETE') {
      alert(s().applyProfileIncomplete);
    } else {
      console.error('[board] apply failed', err);
      alert(s().applyFail);
    }
  } finally {
    applyMessageSendBtn.disabled = false;
  }
});

async function deletePost(postId) {
  if (!confirm(s().deleteConfirm)) return;
  try {
    await deleteDoc(doc(db, 'friendBoardPosts', postId));
  } catch (err) {
    console.error('[board] delete failed', err);
    alert(s().deleteFail);
  }
}

async function handleUnblock(userId) {
  if (!confirm(s().unblockConfirm)) return;
  try {
    await unblockUser(userId);
  } catch (err) {
    console.error('[board] unblock failed', err);
    alert(s().unblockFail);
  }
}

// マイプロフィール画面の「ブロック中のユーザー」一覧。名前等は承認後公開の
// 可能性があるためあえて出さず、アイコンと解除ボタンだけのシンプルな表示にする。
async function renderBlockedList() {
  const list = document.getElementById('blocked-users-list');
  if (!list) return;
  const ids = blockedByMeList();
  list.innerHTML = '';
  if (!ids.length) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptyBlockedList;
    list.appendChild(p);
    return;
  }
  const avatars = await Promise.all(ids.map((id) => getMyAvatar(id)));
  list.innerHTML = '';
  ids.forEach((id, i) => {
    const row = document.createElement('div');
    row.className = 'board-blocked-row';

    const img = document.createElement('img');
    img.className = 'board-card-avatar';
    img.src = avatarUrl(avatars[i].game, avatars[i].icon);
    img.alt = '';
    row.appendChild(img);

    const unblockBtn = document.createElement('button');
    unblockBtn.type = 'button';
    unblockBtn.className = 'board-blocked-unblock-btn';
    unblockBtn.textContent = s().unblockBtn;
    unblockBtn.addEventListener('click', () => handleUnblock(id));
    row.appendChild(unblockBtn);

    list.appendChild(row);
  });
}

// ===== マイプロフィール(=自分のリスティング、1ユーザー1件) =====
let latestMyListing = null;

function renderMyListing() {
  const list = document.getElementById('my-posts-list');
  const exportBtn = document.getElementById('export-profile-image-btn');
  const refreshBtn = document.getElementById('refresh-post-btn');
  const freshnessMsg = document.getElementById('post-freshness-msg');
  if (!list) return;
  list.innerHTML = '';
  if (!latestMyListing) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptyMy;
    list.appendChild(p);
    exportBtn?.classList.add('hidden');
    refreshBtn?.classList.add('hidden');
    freshnessMsg?.classList.add('hidden');
    return;
  }
  list.appendChild(buildCard(latestMyListing, { mine: true }));
  exportBtn?.classList.remove('hidden');
  refreshBtn?.classList.remove('hidden');
  if (freshnessMsg) {
    const ts = latestMyListing.lastActiveAt || latestMyListing.createdAt;
    if (ts && typeof ts.toMillis === 'function') {
      const daysLeft = Math.max(0, Math.ceil((POST_STALE_MS - (Date.now() - ts.toMillis())) / (24 * 60 * 60 * 1000)));
      freshnessMsg.textContent = s().postFreshness(relTime(ts), daysLeft);
      freshnessMsg.classList.toggle('warn', daysLeft <= 7);
      freshnessMsg.classList.remove('hidden');
    } else {
      freshnessMsg.classList.add('hidden');
    }
  }
}

document.getElementById('refresh-post-btn')?.addEventListener('click', async () => {
  const refreshBtn = document.getElementById('refresh-post-btn');
  const msgEl = document.getElementById('export-profile-image-msg');
  if (!latestMyListing || !refreshBtn) return;
  refreshBtn.disabled = true;
  try {
    await updateDoc(doc(db, 'friendBoardPosts', getUserId()), { lastActiveAt: serverTimestamp() });
    if (msgEl) {
      showMsg(msgEl, s().refreshPostOk, false);
      msgEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('[board] refresh post failed', err);
    if (msgEl) {
      showMsg(msgEl, s().refreshPostFail, true);
      msgEl.classList.remove('hidden');
    }
  } finally {
    refreshBtn.disabled = false;
  }
});

// プロフィールを保存済み(=friendBoardPostsに自分のドキュメントがある)でなければ
// 「さがす」タブを使わせない。これが「全員が申請承認式を使う」ための必須ゲートになる。
function updateSearchTabLock() {
  const tabBtn = document.getElementById('tab-btn-search');
  const hint = document.getElementById('tab-lock-hint');
  const unlocked = !!latestMyListing;
  if (tabBtn) tabBtn.disabled = !unlocked;
  if (hint) hint.classList.toggle('hidden', unlocked);
}

function startMyListingListener() {
  onSnapshot(doc(db, 'friendBoardPosts', getUserId()), (snap) => {
    latestMyListing = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    renderMyListing();
    updateSearchTabLock();
  }, (err) => {
    console.error('[board] my listing listen failed', err);
    latestMyListing = null;
    renderMyListing();
    updateSearchTabLock();
  });
}

// ===== QRコード等から開く、個別プロフィール表示(?u=userId) =====
// script.js側のタブ切替(.board-tab-btn/.board-tab-panel)と同じDOM操作を行う。
// viewprofileは通常のタブバーに存在しないボタンのため、対応するタブボタンが
// 無くてもエラーにならないようにしておく。
// 一部のモバイルブラウザで、非表示(display:none)から表示への切り替えや、その後の
// JSだけによるDOM更新が画面に反映されないことがある(下に引っ張って更新すると
// 直る症状がまさにこれ)。offsetHeightを読むと強制的にレイアウト計算・再描画が
// 起こるため、それを利用して確実に画面を更新させる。
function forceReflow(el) {
  if (el) void el.offsetHeight;
}

function switchToPanel(tabName) {
  document.querySelectorAll('.board-tab-btn').forEach((b) => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.board-tab-panel').forEach((p) => p.classList.add('hidden'));
  const target = document.getElementById(`tab-panel-${tabName}`);
  if (target) {
    target.classList.remove('hidden');
    forceReflow(target);
  }
  const btn = document.getElementById(`tab-btn-${tabName}`);
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }
  // QRの個別プロフィール表示(縦に長い)から「マイプロフ設定後に申請する」で
  // マイプロフィールタブへ移動した時など、直前のスクロール位置のまま切り替わると
  // フォーム途中(基本情報など)から表示され、一番上の名前欄が見えず入力し忘れ
  // やすいため、タブ切替時は必ずページ先頭へ戻す。
  // window.scrollToだけだと、この直後に起こるレイアウト変化(スクロール位置維持の
  // ためのブラウザの自動補正等)で元の位置へ戻されてしまうことがあるため、
  // documentElement/bodyへも直接書き込み、次のフレームでもう一度実行して確実にする。
  const scrollTop = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  scrollTop();
  requestAnimationFrame(scrollTop);
}

// 自分のプロフィール保存直後の自動復帰など、書き込み直後に別ドキュメントを読む
// ケースでごく稀に反映が一瞬遅れることがあるため、見つからなければ少し待って
// 1回だけ読み直す。
async function fetchViewProfilePost(targetUserId) {
  const snap = await getDoc(doc(db, 'friendBoardPosts', targetUserId));
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  await new Promise((resolve) => setTimeout(resolve, 800));
  const retrySnap = await getDoc(doc(db, 'friendBoardPosts', targetUserId));
  return retrySnap.exists() ? { id: retrySnap.id, ...retrySnap.data() } : null;
}

// 内部で何が起きても(取得失敗・想定外のデータ形状など)、空白のまま何も表示され
// ないことだけは避け、必ず何かしら(カードか案内文)を表示する。
async function renderViewProfilePanel(targetUserId) {
  switchToPanel('viewprofile');
  const container = document.getElementById('view-profile-card');
  if (!container) return;
  container.innerHTML = '';
  // 取得中も何か表示しておく(空のまま待つより、モバイルブラウザの再描画も
  // 誘発しやすくなる)。
  const loading = document.createElement('p');
  loading.className = 'board-list-empty';
  loading.textContent = s().viewProfileLoading;
  container.appendChild(loading);
  forceReflow(container);

  try {
    const post = await fetchViewProfilePost(targetUserId);
    container.innerHTML = '';
    if (!post || post.active === false || (post.userId !== getUserId() && isBlocked(post.userId))) {
      const p = document.createElement('p');
      p.className = 'board-list-empty';
      p.textContent = s().viewProfileGone;
      container.appendChild(p);
    } else {
      const mine = post.userId === getUserId();
      const matchPercent = mine ? null : computeFriendMatch(store.friendPreference, store.gender, post.publicFields || {});
      container.appendChild(buildCard(post, {
        mine,
        matchPercent,
        onNeedProfile: () => openProfileIncompleteModal(targetUserId),
      }));
    }
  } catch (e) {
    console.error('[board] view profile render failed', e);
    container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().viewProfileGone;
    container.appendChild(p);
  }

  // 一部のモバイルブラウザで、この後の画面更新が反映されない(下に引っ張って
  // 更新すると直る)ことがあるため、最後に必ず強制的に再描画させる。
  forceReflow(container);
}

function checkViewProfileFromUrl() {
  const targetUserId = new URLSearchParams(location.search).get('u');
  if (targetUserId) renderViewProfilePanel(targetUserId);
}

// ===== マイプロフィール未設定での申請を、設定後に自動継続するための誘導ポップ =====
let pendingReturnUserId = null;
const profileIncompleteModal = document.getElementById('profile-incomplete-modal');

function openProfileIncompleteModal(targetUserId) {
  pendingReturnUserId = targetUserId;
  if (profileIncompleteModal) profileIncompleteModal.style.display = 'flex';
}
function closeProfileIncompleteModal() {
  if (profileIncompleteModal) profileIncompleteModal.style.display = 'none';
}
document.getElementById('profile-incomplete-close')?.addEventListener('click', closeProfileIncompleteModal);
document.querySelector('#profile-incomplete-modal .col-modal-backdrop')?.addEventListener('click', closeProfileIncompleteModal);
document.getElementById('profile-incomplete-goto-btn')?.addEventListener('click', () => {
  closeProfileIncompleteModal();
  switchToPanel('post');
});

// ===== 検索一覧(さがす) =====
// サーバーが違うと実際にフレンドになれないため、自分と同じサーバーのユーザーのみを表示する(必須の絞り込み)。
let latestSearchPosts = [];

// ===== さがす一覧のフィルター =====
// OPTION_LABELSに選択肢が無い真偽値項目は、チェックひとつ("yes")のみのフィルターにする。
const BOOLEAN_ONLY_FILTER_FIELDS = ['jokingOk', 'yuriOk', 'fujoshiOk', 'ageGroup', 'showGenshinRanking', 'showGenshinCheck'];
function booleanFilterLabel(key, lang) {
  // ageGroupは「年齢」だけだと分かりにくいため、実際の表示文言(成人済)を使う
  if (key === 'ageGroup') return formatFieldValue('ageGroup', true, lang);
  return fieldLabel(key, lang);
}
function filterFieldOptions(key, lang) {
  if (BOOLEAN_ONLY_FILTER_FIELDS.includes(key)) {
    return [{ value: 'yes', label: booleanFilterLabel(key, lang) }];
  }
  return fieldOptions(key, lang);
}

// フィールドキー -> 選択中の値のSet。値が1つも無いフィールドは絞り込み対象外(=全件通す)。
const searchFilters = {};
// フィルターは基本閉じておき、開閉状態は再描画(言語切替など)をまたいで保持する
let filterBarOpen = false;
// 管理者専用: userId -> friendBoardProfilesの生データ(非表示項目を含む全項目)
const adminProfileCache = new Map();

function isAdminViewer() {
  return getAuthUid() === ADMIN_UID;
}

// 配列なら選択値のいずれかと重なるか、真偽値なら'yes'選択時のみtrue必須、
// それ以外(文字列)は選択値に含まれるかを見る。
function matchesFieldFilter(value, checkedValues) {
  if (Array.isArray(value)) return value.some((v) => checkedValues.has(v));
  if (typeof value === 'boolean') return checkedValues.has('yes') ? value === true : true;
  return checkedValues.has(value);
}

// 管理者は非表示項目も含めてfriendBoardProfilesの生データを参照して判定する。
// 非管理者は今まで通りpost.publicFields(公開設定を反映済み)のみを参照する。
function matchesSearchFilters(post) {
  const source = isAdminViewer()
    ? (adminProfileCache.get(post.userId) || post.publicFields || {})
    : (post.publicFields || {});
  return Object.entries(searchFilters).every(([key, checked]) => {
    if (!checked || !checked.size) return true;
    return matchesFieldFilter(source[key], checked);
  });
}

// 表示中の投稿ぶんだけ、未取得のプロフィールを遅延取得する(コレクション全体は購読しない)。
async function ensureAdminProfilesLoaded(posts) {
  if (!isAdminViewer()) return;
  const missing = [...new Set(posts.map((p) => p.userId))].filter((uid) => uid && !adminProfileCache.has(uid));
  if (!missing.length) return;
  await Promise.all(missing.map(async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'friendBoardProfiles', uid));
      adminProfileCache.set(uid, snap.exists() ? snap.data() : {});
    } catch (e) {
      console.warn('[board] admin profile fetch failed', uid, e);
    }
  }));
  renderSearchList();
}

function appendFilterGroup(parent, titleText, entries) {
  if (!entries.length) return;
  const group = document.createElement('div');
  group.className = 'board-filter-field-group';
  const groupTitle = document.createElement('p');
  groupTitle.className = 'board-filter-field-title';
  groupTitle.textContent = titleText;
  group.appendChild(groupTitle);
  const checks = document.createElement('div');
  checks.className = 'board-checkbox-group';
  entries.forEach(({ fieldKey, value, label }) => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!searchFilters[fieldKey]?.has(value);
    cb.addEventListener('change', () => {
      if (!searchFilters[fieldKey]) searchFilters[fieldKey] = new Set();
      if (cb.checked) searchFilters[fieldKey].add(value);
      else searchFilters[fieldKey].delete(value);
      renderSearchList();
    });
    const span = document.createElement('span');
    span.textContent = label;
    lbl.appendChild(cb);
    lbl.appendChild(span);
    checks.appendChild(lbl);
  });
  group.appendChild(checks);
  parent.appendChild(group);
}

function renderSearchFilterBar() {
  const container = document.getElementById('search-filter-bar');
  if (!container) return;
  const lang = currentLang();
  const toEntries = (fieldKey, options) => options.map((o) => ({ fieldKey, ...o }));

  container.innerHTML = '';

  const rootDetails = document.createElement('details');
  rootDetails.className = 'board-filter-details';
  rootDetails.open = filterBarOpen;
  rootDetails.addEventListener('toggle', () => { filterBarOpen = rootDetails.open; });
  const summary = document.createElement('summary');
  summary.className = 'board-filter-bar-title';
  summary.textContent = s().filterBarTitle;
  rootDetails.appendChild(summary);

  const header = document.createElement('div');
  header.className = 'board-filter-bar-header';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'board-filter-reset-btn';
  resetBtn.textContent = s().filterResetBtn;
  resetBtn.addEventListener('click', () => {
    Object.values(searchFilters).forEach((set) => set.clear());
    renderSearchFilterBar();
    renderSearchList();
  });
  header.appendChild(resetBtn);
  rootDetails.appendChild(header);

  const body = document.createElement('div');
  body.className = 'board-filter-bar-body';
  appendFilterGroup(body, fieldLabel('vc', lang), toEntries('vc', filterFieldOptions('vc', lang)));
  const psOptions = filterFieldOptions('playStyles', lang);
  const generalPs = psOptions.filter((o) => !PLAYSTYLE_OFFER_VALUES.includes(o.value) && !PLAYSTYLE_REQUEST_VALUES.includes(o.value));
  const offerPs = psOptions.filter((o) => PLAYSTYLE_OFFER_VALUES.includes(o.value));
  const requestPs = psOptions.filter((o) => PLAYSTYLE_REQUEST_VALUES.includes(o.value));
  appendFilterGroup(body, fieldLabel('playStyles', lang), toEntries('playStyles', generalPs));
  appendFilterGroup(body, s().playStyleOfferTitle, toEntries('playStyles', offerPs));
  appendFilterGroup(body, s().playStyleRequestTitle, toEntries('playStyles', requestPs));
  appendFilterGroup(body, fieldLabel('inviteStyle', lang), toEntries('inviteStyle', filterFieldOptions('inviteStyle', lang)));
  appendFilterGroup(body, fieldLabel('vcApps', lang), toEntries('vcApps', filterFieldOptions('vcApps', lang)));
  const attrEntries = ['casualOk', 'jokingOk', 'yuriOk', 'fujoshiOk', 'roughTalk', 'sameOshiReject']
    .flatMap((fk) => toEntries(fk, filterFieldOptions(fk, lang)));
  appendFilterGroup(body, s().filterGroupAttrTitle, attrEntries);
  rootDetails.appendChild(body);

  if (isAdminViewer()) {
    const adminDetails = document.createElement('details');
    adminDetails.className = 'board-filter-admin-details';
    const adminSummary = document.createElement('summary');
    adminSummary.textContent = s().filterAdminTitle;
    adminDetails.appendChild(adminSummary);
    const adminBody = document.createElement('div');
    adminBody.className = 'board-filter-bar-body';
    ['gender', 'ageGroup', 'platforms', 'spending', 'multiFrequency', 'showGenshinRanking', 'showGenshinCheck', 'friendPreference'].forEach((fk) => {
      appendFilterGroup(adminBody, fieldLabel(fk, lang), toEntries(fk, filterFieldOptions(fk, lang)));
    });
    adminDetails.appendChild(adminBody);
    rootDetails.appendChild(adminDetails);
  }
  container.appendChild(rootDetails);
}

function renderSearchList() {
  const list = document.getElementById('search-list');
  if (!list) return;
  const myUserId = getUserId();

  const filtered = latestSearchPosts
    .filter((post) => post.userId === myUserId || (post.publicFields?.server === store.server && matchesSearchFilters(post) && isPostFresh(post) && !isBlocked(post.userId)))
    .map((post) => ({
      post,
      // 自分の「どういうフレンドがほしい？」と相手の公開フィールドを突き合わせてマッチ度を計算する。
      // 自分の投稿(mine)には表示しないので、そちらは計算しない。
      matchPercent: post.userId === myUserId
        ? null
        : computeFriendMatch(store.friendPreference, store.gender, post.publicFields || {}),
    }))
    .sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1));

  const countEl = document.getElementById('search-result-count');
  if (countEl) countEl.textContent = s().resultCount(filtered.length);

  list.innerHTML = '';
  if (!filtered.length) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptySearch;
    list.appendChild(p);
    return;
  }
  filtered.forEach(({ post, matchPercent }) => list.appendChild(buildCard(post, { mine: post.userId === myUserId, matchPercent })));
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
    ensureAdminProfilesLoaded(latestSearchPosts);
  }, (err) => {
    console.error('[board] search listen failed', err);
    latestSearchPosts = [];
    renderSearchList();
  });
}

// アバター変更時、自分のリスティング(投稿時点のアバターを非正規化済み)にも反映する。
// 1ユーザー1件なので対象ドキュメントは常に自分のuserId。まだ保存前(リスティング未作成)
// なら何もしない(次の保存時に最新のアバターが自然に反映されるため)。
async function updateLatestOwnPostAvatar({ game, icon }) {
  if (!latestMyListing) return;
  try {
    await updateDoc(doc(db, 'friendBoardPosts', getUserId()), { avatarGame: game || null, avatarIcon: icon || null });
  } catch (e) {
    console.warn('[board] listing avatar sync failed', e);
  }
}

// 言語切替時、描画済みの一覧を今の言語で再描画
// (script.jsのdocument.documentElement.lang更新が同じ change イベントの別リスナーで
//  行われるため、setTimeoutで1タスク遅らせて確実に新しい言語を読んでから再描画する)
document.querySelectorAll('input[name="lang"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    setTimeout(() => {
      renderMyListing();
      renderSearchFilterBar();
      renderSearchList();
      populateVisibilitySelects();
      oshiPicker.renderElemTabs();
      oshiPicker.renderCharList();
      sameOshiPicker.renderElemTabs();
      sameOshiPicker.renderCharList();
    }, 0);
  });
});

// ===== マイプロフィール画像出力(QRコード付き) =====
// 公開設定にかかわらず全項目ぶんレイアウトしたいので、投稿時と同じ仕分けロジック
// (buildPostFieldBuckets)を今のstore/visibilityに対してその場で計算し直す。
// 承認後に公開の項目は値を出さず「🔒 ラベル」のマスク表示にする(申請を後押しする狙い)。
const EXPORT_CANVAS_WIDTH = 1080;
const EXPORT_MIN_HEIGHT = Math.round(EXPORT_CANVAS_WIDTH * 16 / 9); // インスタのストーリーズ目安(9:16)
const EXPORT_SCRATCH_HEIGHT = 4000; // 下書き用の十分大きい高さ(最後に実際の高さへ切り詰める)

function exportViewProfileUrl(userId) {
  return `${location.origin}${location.pathname}?u=${encodeURIComponent(userId)}`;
}

// qrcode-generator(index.htmlでグローバル読み込み済み)は文字数に対してtypeNumberが
// 小さすぎると例外を投げるため、収まるまでtypeNumberを大きくしながら試す。
function makeQrCode(text) {
  for (let typeNumber = 4; typeNumber <= 40; typeNumber++) {
    try {
      const qr = qrcode(typeNumber, 'M');
      qr.addData(text);
      qr.make();
      return qr;
    } catch (e) {
      // このtypeNumberでは収まらない → 次のサイズで再試行
    }
  }
  throw new Error('QR code generation failed: text too long');
}

function loadImageForExport(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

// 日本語(空白なし)・英語(空白あり)のどちらでも自然に折り返す。
// 通常は空白区切りの単語単位で折り返し、1単語が幅に収まらない場合(日本語の長文など)は
// その単語だけ1文字ずつ折り返す。
function wrapTextForExport(ctx, text, maxWidth) {
  const lines = [];
  String(text).split('\n').forEach((para) => {
    if (!para) { lines.push(''); return; }
    let line = '';
    para.split(' ').forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        return;
      }
      let chunk = '';
      for (const ch of word) {
        const test = chunk + ch;
        if (ctx.measureText(test).width <= maxWidth) {
          chunk = test;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      line = chunk;
    });
    if (line) lines.push(line);
  });
  return lines;
}

// 画面上のカードデザイン(styles.cssの.board-card系)をそのままCanvasへ持ち込むための
// 定数群。フォントも実サイトと同じ'mihoyo-zenzero'(+sans-serifフォールバック)を使う。
const EXPORT_FONT_FAMILY = "'mihoyo-zenzero', sans-serif";
const EXPORT_COLORS = {
  cardBg: '#fff',
  cardBorder: '#ffcc00',
  uid: '#888',
  comment: '#222',
  chipBg: '#f2f2f2', chipColor: '#555',         // .board-card-chip
  groupBorder: 'rgba(0,0,0,0.15)', groupBg: 'rgba(0,0,0,0.02)', groupTitle: '#a08000', // .board-card-group
  approvalBg: '#fff6d9', approvalColor: '#8a6d00', // .board-fixed-approval-badge / .board-request-revealed-chip
};

function roundedRectPathForExport(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRoundedRectForExport(ctx, x, y, w, h, r, fill) {
  roundedRectPathForExport(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}
function strokeRoundedRectForExport(ctx, x, y, w, h, r, stroke, lineWidth) {
  roundedRectPathForExport(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// 事前に各チップがどの行に収まるかだけを計算する(実際の描画はしない)。
// 枠(.board-card-group)の高さを先に確定させたいので、描画とレイアウト計算を分けている。
function layoutChipRowsForExport(ctx, chips, maxWidth) {
  const chipPadX = 20;
  const gapX = 12;
  const rows = [];
  let current = [];
  let x = 0;
  chips.forEach((chip) => {
    ctx.font = `${chip.bold ? 'bold ' : ''}30px ${EXPORT_FONT_FAMILY}`;
    const chipW = ctx.measureText(chip.text).width + chipPadX * 2;
    if (x + chipW > maxWidth && current.length) {
      rows.push(current);
      current = [];
      x = 0;
    }
    current.push({ ...chip, w: chipW });
    x += chipW + gapX;
  });
  if (current.length) rows.push(current);
  return rows;
}
function chipRowsHeightForExport(rows) {
  const chipH = 48;
  const gapY = 12;
  return rows.length ? rows.length * chipH + (rows.length - 1) * gapY : 0;
}
function drawChipRowsForExport(ctx, rows, startX, startY) {
  const chipH = 48;
  const gapX = 12;
  const gapY = 12;
  const chipPadX = 20;
  let y = startY;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  rows.forEach((row) => {
    let x = startX;
    row.forEach((chip) => {
      ctx.font = `${chip.bold ? 'bold ' : ''}30px ${EXPORT_FONT_FAMILY}`;
      fillRoundedRectForExport(ctx, x, y, chip.w, chipH, chipH / 2, chip.bg);
      ctx.fillStyle = chip.color;
      ctx.fillText(chip.text, x + chipPadX, y + chipH / 2 + 1);
      x += chip.w + gapX;
    });
    y += chipH + gapY;
  });
  return y - gapY;
}

// chips: [{text, bg, color, bold}, ...] を、.board-card-group と同じ「枠+浮き見出し」の
// 箱に入れて描画する。nestedGroups: [{title, chips, border, bg, titleColor}, ...] を渡すと、
// その箱の内側にさらに小さい入れ子の枠(.board-card-group-nested相当。マルチで何を
// したい？の「手伝います！」「手伝ってください！」用)を追加で描画する。
// iconRow: {label, icons} を渡すと、箱の一番下にラベル付きのキャラアイコン列
// (同担拒否キャラ用)を追加で描画する。
// 戻り値は描画し終えた後のyの位置。
async function drawFieldGroupBoxForExport(ctx, title, chips, x, y, width, nestedGroups = [], iconRow = null) {
  const boxPad = 30;
  const titleH = 44;
  const innerWidth = width - boxPad * 2;
  const rows = chips.length ? layoutChipRowsForExport(ctx, chips, innerWidth) : [];
  const chipsH = chips.length ? chipRowsHeightForExport(rows) : 0;

  const nestedPad = 24;
  const nestedGap = 16;
  const nestedTitleH = 40;
  const nestedLayouts = nestedGroups.map((ng) => {
    const ngRows = layoutChipRowsForExport(ctx, ng.chips, innerWidth - nestedPad * 2);
    const ngChipsH = chipRowsHeightForExport(ngRows);
    return { ...ng, rows: ngRows, height: nestedTitleH + ngChipsH + nestedPad * 1.3 };
  });

  const iconRowIconD = 82; // ヘッダーの推しキャラアイコンと同じサイズに揃える
  const iconRowGap = 10;
  const iconRowLabelH = 32;
  const iconRowH = iconRow ? iconRowLabelH + iconRowIconD : 0;

  let innerHeight = titleH;
  if (chips.length) innerHeight += chipsH + 16;
  nestedLayouts.forEach((ng) => { innerHeight += ng.height + nestedGap; });
  if (iconRow) innerHeight += iconRowH + (chips.length || nestedLayouts.length ? 16 : 0);
  const boxHeight = innerHeight + boxPad * 1.4;

  fillRoundedRectForExport(ctx, x, y, width, boxHeight, 20, EXPORT_COLORS.groupBg);
  strokeRoundedRectForExport(ctx, x, y, width, boxHeight, 20, EXPORT_COLORS.groupBorder, 2);

  ctx.font = `bold 28px ${EXPORT_FONT_FAMILY}`;
  ctx.fillStyle = EXPORT_COLORS.groupTitle;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, x + boxPad, y + boxPad + 14);

  let contentY = y + boxPad + titleH;
  if (chips.length) {
    contentY = drawChipRowsForExport(ctx, rows, x + boxPad, contentY) + 16;
  }

  for (const ng of nestedLayouts) {
    const nx = x + boxPad;
    const nw = innerWidth;
    fillRoundedRectForExport(ctx, nx, contentY, nw, ng.height, 14, ng.bg);
    strokeRoundedRectForExport(ctx, nx, contentY, nw, ng.height, 14, ng.border, 2);
    ctx.font = `bold 24px ${EXPORT_FONT_FAMILY}`;
    ctx.fillStyle = ng.titleColor;
    ctx.fillText(ng.title, nx + nestedPad, contentY + nestedPad + 4);
    drawChipRowsForExport(ctx, ng.rows, nx + nestedPad, contentY + nestedPad + nestedTitleH);
    contentY += ng.height + nestedGap;
  }

  if (iconRow) {
    ctx.font = `bold 24px ${EXPORT_FONT_FAMILY}`;
    ctx.fillStyle = EXPORT_COLORS.groupTitle;
    ctx.fillText(iconRow.label, x + boxPad, contentY + 20);
    const iconY = contentY + iconRowLabelH;
    let ix = x + boxPad;
    for (const icon of iconRow.icons) {
      try {
        const img = await loadImageForExport(GENSHIN_ICON_BASE + icon);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix + iconRowIconD / 2, iconY + iconRowIconD / 2, iconRowIconD / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, ix, iconY, iconRowIconD, iconRowIconD);
        ctx.restore();
        ctx.strokeStyle = EXPORT_COLORS.cardBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix + iconRowIconD / 2, iconY + iconRowIconD / 2, iconRowIconD / 2, 0, Math.PI * 2);
        ctx.stroke();
      } catch (e) {
        console.warn('[board] export: sameOshiChars icon load failed', e);
      }
      ix += iconRowIconD + iconRowGap;
    }
  }

  return y + boxHeight;
}

// 承認後に公開の項目(値は出さない)を、公開項目と同じ「ラベル: 値」の見た目に揃えつつ、
// 値の部分に visApproval(承認後に公開) + 鍵アイコンを入れて区別する。
function maskedFieldText(lang, key) {
  return `${fieldLabel(key, lang)}: ${s().visApproval}🔒`;
}

async function buildProfileExportImage(post) {
  const lang = currentLang();

  // Canvasのテキスト描画はフォントの読み込み完了を待たないため、実サイトと同じ
  // 'mihoyo-zenzero'を確実に使えるよう先に読み込んでおく(失敗してもsans-serif
  // フォールバックで続行する)。
  try {
    await document.fonts.load(`16px ${EXPORT_FONT_FAMILY}`);
    await document.fonts.ready;
  } catch (e) {
    console.warn('[board] export: font load failed, falling back', e);
  }

  const scratch = document.createElement('canvas');
  scratch.width = EXPORT_CANVAS_WIDTH;
  scratch.height = EXPORT_SCRATCH_HEIGHT;
  const ctx = scratch.getContext('2d');

  ctx.fillStyle = EXPORT_COLORS.cardBg;
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  const PAD = 48;
  let y = PAD;

  // サイト名を画像の一番上に表示する
  ctx.textAlign = 'center';
  ctx.font = `bold 34px ${EXPORT_FONT_FAMILY}`;
  ctx.fillStyle = '#222';
  ctx.fillText(s().exportSiteTitle, scratch.width / 2, y + 30);
  ctx.textAlign = 'left';
  y += 68;

  // ヘッダー: アバター + 名前/UID/サーバー(名前・UIDは常に承認後公開のためマスク表示)
  const avatarSize = 132;
  try {
    const avatarImg = await loadImageForExport(avatarUrl(post.avatarGame, post.avatarIcon));
    ctx.save();
    ctx.beginPath();
    ctx.arc(PAD + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, PAD, y, avatarSize, avatarSize);
    ctx.restore();
  } catch (e) {
    console.warn('[board] export: avatar load failed', e);
  }
  ctx.strokeStyle = EXPORT_COLORS.cardBorder;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(PAD + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  const { publicFields, secretFieldKeys } = buildPostFieldBuckets(store, store.visibility);
  const secretSet = new Set(secretFieldKeys);

  const nameX = PAD + avatarSize + 28;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `32px ${EXPORT_FONT_FAMILY}`;
  ctx.fillStyle = EXPORT_COLORS.approvalColor;
  ctx.fillText(maskedFieldText(lang, 'displayName'), nameX, y + 44);
  ctx.font = `26px ${EXPORT_FONT_FAMILY}`;
  ctx.fillText(`${s().uidLabel}: ${s().visApproval}🔒`, nameX, y + 82);
  if (secretSet.has('server')) {
    ctx.fillText(maskedFieldText(lang, 'server'), nameX, y + 118);
  } else if (publicFields.server) {
    ctx.fillStyle = EXPORT_COLORS.uid;
    ctx.fillText(`${fieldLabel('server', lang)}: ${formatFieldValue('server', publicFields.server, lang)}`, nameX, y + 118);
  }

  // QRコード(アバター行の右側、空いているスペースに配置)。読み取ると個別プロフィール
  // 表示(?u=userId)が開く。アバターの高さに収まるサイズにして行の高さは増やさない。
  const qr = makeQrCode(exportViewProfileUrl(post.userId));
  const moduleCount = qr.getModuleCount();
  const qrSize = avatarSize;
  const cellSize = qrSize / moduleCount;
  const qrX = scratch.width - PAD - qrSize;
  // isDark(row, col)のrow=縦方向・col=横方向という対応は、このライブラリの
  // createDataURL/createImgTag(最も実績のある標準的な使われ方)の実装に合わせている。
  // QRコードは特定の並び順を持つため、縦横を取り違えると読み取れなくなる。
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      ctx.fillStyle = qr.isDark(row, col) ? '#000000' : '#ffffff';
      ctx.fillRect(qrX + col * cellSize, y + row * cellSize, cellSize + 0.5, cellSize + 0.5);
    }
  }

  // 推しキャラ(公開の場合)は、名前欄とQRコードの間が空くので、そこに収まるなら
  // ヘッダー行に表示する。収まらない場合(英語表記で名前欄が長くなる場合など)は
  // 従来通り「なんでも一言」の下に表示する。
  let oshiDrawnInHeader = false;
  if (!secretSet.has('oshiChars') && Array.isArray(store.oshiChars) && store.oshiChars.length) {
    ctx.font = `32px ${EXPORT_FONT_FAMILY}`;
    const nameTextWidth = ctx.measureText(maskedFieldText(lang, 'displayName')).width;
    ctx.font = `26px ${EXPORT_FONT_FAMILY}`;
    const uidTextWidth = ctx.measureText(`${s().uidLabel}: ${s().visApproval}🔒`).width;
    let serverTextWidth = 0;
    if (secretSet.has('server')) {
      serverTextWidth = ctx.measureText(maskedFieldText(lang, 'server')).width;
    } else if (publicFields.server) {
      serverTextWidth = ctx.measureText(`${fieldLabel('server', lang)}: ${formatFieldValue('server', publicFields.server, lang)}`).width;
    }
    const nameColumnRight = nameX + Math.max(nameTextWidth, uidTextWidth, serverTextWidth);

    const iconD = 82;
    const iconGap = 10;
    const oshiStartX = nameColumnRight + 28;
    const neededWidth = store.oshiChars.length * iconD + (store.oshiChars.length - 1) * iconGap;
    const availWidth = qrX - 24 - oshiStartX;

    if (availWidth >= neededWidth) {
      ctx.font = `bold 22px ${EXPORT_FONT_FAMILY}`;
      ctx.fillStyle = EXPORT_COLORS.groupTitle;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(fieldLabel('oshiChars', lang), oshiStartX, y + 22);

      const oshiY = y + 34;
      let ix = oshiStartX;
      for (const icon of store.oshiChars) {
        try {
          const img = await loadImageForExport(GENSHIN_ICON_BASE + icon);
          ctx.save();
          ctx.beginPath();
          ctx.arc(ix + iconD / 2, oshiY + iconD / 2, iconD / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, ix, oshiY, iconD, iconD);
          ctx.restore();
          ctx.strokeStyle = EXPORT_COLORS.cardBorder;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(ix + iconD / 2, oshiY + iconD / 2, iconD / 2, 0, Math.PI * 2);
          ctx.stroke();
        } catch (e) {
          console.warn('[board] export: oshiChars icon load failed', e);
        }
        ix += iconD + iconGap;
      }
      oshiDrawnInHeader = true;
    }
  }

  y += avatarSize + 44;

  // なんでも一言(常に公開)
  if (post.comment) {
    ctx.font = `28px ${EXPORT_FONT_FAMILY}`;
    ctx.fillStyle = EXPORT_COLORS.comment;
    wrapTextForExport(ctx, post.comment, scratch.width - PAD * 2).forEach((line) => {
      y += 38;
      ctx.fillText(line, PAD, y);
    });
    y += 30;
  }

  // 推しキャラ: 公開なら実アイコン(ヘッダーに収まらなかった場合のみここに表示)、
  // 承認後公開ならマスクのみ
  if (secretSet.has('oshiChars')) {
    y = drawChipRowsForExport(ctx, layoutChipRowsForExport(ctx, [
      { text: maskedFieldText(lang, 'oshiChars'), bg: EXPORT_COLORS.approvalBg, color: EXPORT_COLORS.approvalColor, bold: true },
    ], scratch.width - PAD * 2), PAD, y);
    y += 26;
  } else if (!oshiDrawnInHeader && Array.isArray(store.oshiChars) && store.oshiChars.length) {
    ctx.font = `bold 26px ${EXPORT_FONT_FAMILY}`;
    ctx.fillStyle = EXPORT_COLORS.groupTitle;
    ctx.fillText(fieldLabel('oshiChars', lang), PAD, y + 24);
    y += 36;
    let x = PAD;
    for (const icon of store.oshiChars) {
      try {
        const img = await loadImageForExport(GENSHIN_ICON_BASE + icon);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + 42, y + 42, 42, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, x, y, 84, 84);
        ctx.restore();
        ctx.strokeStyle = EXPORT_COLORS.cardBorder;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + 42, y + 42, 42, 0, Math.PI * 2);
        ctx.stroke();
      } catch (e) {
        console.warn('[board] export: oshiChars icon load failed', e);
      }
      x += 100;
    }
    y += 106;
  }

  // カテゴリー枠(基本情報/あなたについて/連絡・時間帯/ボイスチャット/つながれるSNS)を
  // さがす一覧と同じ「枠+左上見出し」の見た目で描画する。承認後に公開の項目は値を
  // 伏せ、公開項目と同じ「ラベル: 値」の形のまま「承認後公開🔒」を値として見せる。
  // 推しキャラは上で個別描画済み、画像系(ランキング/チェックシート)は別サイトの
  // 画像を都度取得する必要があり複雑になるため対象外にする。
  for (const group of FIELD_GROUPS) {
    const chips = [];
    // マルチで何をしたい？(playStyles)のうち「手伝います！」「手伝ってください！」に
    // 属する値は、さがす一覧と同じく入れ子の別枠に分ける(それ以外は通常のチップ)。
    const offerChips = [];
    const requestChips = [];
    group.fields
      .filter((k) => k !== 'oshiChars' && k !== 'sameOshiChars' && k !== 'showGenshinRanking' && k !== 'showGenshinCheck')
      .forEach((key) => {
        if (secretSet.has(key)) {
          chips.push({ text: maskedFieldText(lang, key), bg: EXPORT_COLORS.approvalBg, color: EXPORT_COLORS.approvalColor, bold: true });
          return;
        }
        const value = publicFields[key];
        if (value == null || value === '' || (Array.isArray(value) && !value.length)) return;
        if (key === 'playStyles') {
          value.forEach((v) => {
            const text = formatFieldValue('playStyles', [v], lang);
            if (!text) return;
            const chip = { text, bg: EXPORT_COLORS.chipBg, color: EXPORT_COLORS.chipColor };
            if (PLAYSTYLE_OFFER_VALUES.includes(v)) offerChips.push(chip);
            else if (PLAYSTYLE_REQUEST_VALUES.includes(v)) requestChips.push(chip);
            else chips.push(chip);
          });
          return;
        }
        const text = formatFieldValue(key, value, lang);
        if (text) chips.push({ text: `${fieldLabel(key, lang)}: ${text}`, bg: EXPORT_COLORS.chipBg, color: EXPORT_COLORS.chipColor });
      });

    const nestedGroups = [];
    if (offerChips.length) {
      nestedGroups.push({
        title: s().playStyleOfferTitle, chips: offerChips,
        border: 'rgba(123,31,162,0.25)', bg: 'rgba(123,31,162,0.06)', titleColor: '#7b1fa2',
      });
    }
    if (requestChips.length) {
      nestedGroups.push({
        title: s().playStyleRequestTitle, chips: requestChips,
        border: 'rgba(46,125,50,0.25)', bg: 'rgba(46,125,50,0.06)', titleColor: '#2e7d32',
      });
    }

    // 同担拒否キャラ(sameOshiChars)は常に公開固定の項目なので、承認後公開のマスク対象には
    // ならない。アイコン付きなので枠の一番下にラベル+アイコン列として追加する。
    let iconRow = null;
    if (group.fields.includes('sameOshiChars') && Array.isArray(store.sameOshiChars) && store.sameOshiChars.length) {
      iconRow = { label: fieldLabel('sameOshiChars', lang), icons: store.sameOshiChars };
    }

    if (!chips.length && !nestedGroups.length && !iconRow) continue;

    y = await drawFieldGroupBoxForExport(ctx, s().groupTitles[group.key] || group.key, chips, PAD, y, scratch.width - PAD * 2, nestedGroups, iconRow);
    y += 26;
  }

  // 下書き(scratch)の実際に使った高さぶんだけ、最終キャンバスへ切り詰めてコピーし、
  // さがす一覧のカード(.board-card)と同じ黄色い枠を最後に重ねる。
  const finalHeight = Math.max(EXPORT_MIN_HEIGHT, y + PAD);
  const final = document.createElement('canvas');
  final.width = EXPORT_CANVAS_WIDTH;
  final.height = finalHeight;
  const fctx = final.getContext('2d');
  fctx.fillStyle = EXPORT_COLORS.cardBg;
  fctx.fillRect(0, 0, final.width, final.height);
  fctx.drawImage(scratch, 0, 0, EXPORT_CANVAS_WIDTH, y + PAD, 0, 0, EXPORT_CANVAS_WIDTH, y + PAD);
  strokeRoundedRectForExport(fctx, 6, 6, final.width - 12, final.height - 12, 32, EXPORT_COLORS.cardBorder, 8);

  return final.toDataURL('image/png');
}

function downloadDataUrlAsFile(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ファイル名用にyyyyMMddHHmmss形式のタイムスタンプ(端末のローカル時刻)を作る。
function timestampForFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

document.getElementById('export-profile-image-btn')?.addEventListener('click', async () => {
  if (!latestMyListing) return;
  const btn = document.getElementById('export-profile-image-btn');
  const msgEl = document.getElementById('export-profile-image-msg');
  btn.disabled = true;
  if (msgEl) {
    msgEl.textContent = s().exportGenerating;
    msgEl.classList.remove('hidden', 'error');
  }
  try {
    const dataUrl = await buildProfileExportImage(latestMyListing);
    downloadDataUrlAsFile(dataUrl, `friendboard_${timestampForFilename()}.png`);
    if (msgEl) msgEl.classList.add('hidden');
  } catch (e) {
    console.error('[board] export image failed', e);
    if (msgEl) {
      msgEl.textContent = s().exportFail;
      msgEl.classList.remove('hidden');
      msgEl.classList.add('error');
    }
  } finally {
    btn.disabled = false;
  }
});

// ===== 初期化 =====
async function init() {
  // ログイン中ならaccountLinksから共有IDを解決してから(=正しいuserIdが確定してから)
  // プロフィール読み込み・一覧購読を始める
  await waitForAccountLink();
  if (getAuthUid() === ADMIN_UID) {
    const infoModal = document.getElementById('info-modal');
    if (infoModal) infoModal.style.display = 'flex';
  }
  renderSearchFilterBar();
  populateNumberAndTimeSelects();
  await loadProfileFromFirestore();
  applyDraftIfAny();
  fillFormFromProfile();
  populateVisibilitySelects();
  initAvatarUI({ getUserId, getAuthUid, onChange: updateLatestOwnPostAvatar });
  initBlocks({ getUserId });
  onBlocksChange(() => { renderSearchList(); renderBlockedList(); });
  initApplications({ getUserId, getAuthUid, onSentChange: renderSearchList });
  startMyListingListener();
  startSearchListener();
  checkViewProfileFromUrl();
}

init();
