// board.js
// フレンド募集掲示板：タブ切替・プロフィール自動反映・投稿(募集する)・一覧購読(さがす)

import { db } from './firebaseConfig.js';
import { getUserId, getAuthUid, store, loadProfileFromFirestore, scheduleSync, waitForAccountLink } from './userData.js';
import { initAvatarUI, getMyAvatar, avatarUrl } from './avatar.js';
import { initApplications, applyToPost, hasAppliedTo } from './applications.js';
import {
  VISIBILITY_FIELDS, NO_PUBLIC_FIELDS, FIELD_GROUPS, PLAYSTYLE_OFFER_VALUES, PLAYSTYLE_REQUEST_VALUES,
  fieldLabel, formatFieldValue, buildPostFieldBuckets, computeFriendMatch,
} from './fields.js';
import { getSavedProfileImageFor } from 'https://uko05.github.io/24_AccountCenter/saved-image.js';
import { genshinChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_data/genshin_chars.js';
import {
  collection, setDoc, updateDoc, deleteDoc, doc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const GENSHIN_ICON_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_icon/';
const OSHI_ELEMS = ['hi', 'mizu', 'koori', 'kaminari', 'kusa', 'kaze', 'iwa'];
const OSHI_ELEM_LABELS = {
  ja: { hi: '炎', mizu: '水', koori: '氷', kaminari: '雷', kusa: '草', kaze: '風', iwa: '岩' },
  en: { hi: 'Fire', mizu: 'Hydro', koori: 'Ice', kaminari: 'Lightning', kusa: 'Dendro', kaze: 'Wind', iwa: 'Geo' },
};
const OSHI_MAX = 3;

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
    postOk: '保存しました！',
    postFail: '保存に失敗しました。時間をおいて再度お試しください。',
    draftSaved: '一時保存しました（この端末のみ）',
    draftSaveFail: '一時保存に失敗しました。',
    deleteFail: '取り下げに失敗しました。',
    fillAll: '必須項目（＊）をすべて入力してください。',
    fillAllMissing: (labels) => `必須項目（＊）をすべて入力してください。\n不足している項目: ${labels}`,
    uidLabel: 'UID',
    applyBtn: '申請する',
    appliedBtn: '申請済み',
    applyOk: '申請しました！相手が承認するとUIDが確認できます。',
    applyFail: '申請に失敗しました。時間をおいて再度お試しください。',
    applyProfileIncomplete: '先に原神UID・サーバーを入力・保存してください（「マイプロフィール」タブから保存してください）。',
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
    postOk: 'Saved!',
    postFail: 'Failed to save. Please try again later.',
    draftSaved: 'Draft saved (this device only)',
    draftSaveFail: 'Failed to save draft.',
    deleteFail: 'Failed to withdraw.',
    fillAll: 'Please fill in all required (＊) fields.',
    fillAllMissing: (labels) => `Please fill in all required (＊) fields.\nMissing: ${labels}`,
    uidLabel: 'UID',
    applyBtn: 'Apply',
    appliedBtn: 'Applied',
    applyOk: 'Request sent! You can see their UID once they accept.',
    applyFail: 'Failed to apply. Please try again later.',
    applyProfileIncomplete: 'Please fill in and save your Genshin UID and server first (save on the "My Profile" tab).',
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
const displayNameInput = document.getElementById('input-displayName');
const serverInput = document.getElementById('input-server');
const commentInput = document.getElementById('input-comment');
const arInput = document.getElementById('input-ar');
const wlInput = document.getElementById('input-wl');
const twitterInput = document.getElementById('input-twitter');
const tiktokInput = document.getElementById('input-tiktok');
const lineInput = document.getElementById('input-line');
const instagramInput = document.getElementById('input-instagram');
const workCallOkInput = document.getElementById('input-workCallOk');
const jokingOkInput = document.getElementById('input-jokingOk');
const vcNoteInput = document.getElementById('input-vcNote');
const vcDiscordIdInput = document.getElementById('input-vcDiscordId');
const vcLineIdInput = document.getElementById('input-vcLineId');
const vcAppsOtherInput = document.getElementById('input-vcAppsOtherText');
const playStylesOtherInput = document.getElementById('input-playStylesOtherText');
const multiFrequencyInput = document.getElementById('input-multiFrequency');
const multiFrequencyNoteInput = document.getElementById('input-multiFrequencyNote');
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
// マルチ頻度が「要相談」のときだけ詳細入力欄を表示する
function updateMultiFrequencyNoteEnabled() {
  const row = document.getElementById('row-multiFrequencyNote');
  const enabled = multiFrequencyInput?.value === 'ask';
  if (row) row.classList.toggle('hidden', !enabled);
  if (multiFrequencyNoteInput && !enabled) multiFrequencyNoteInput.value = '';
}
document.getElementById('group-vc')?.addEventListener('change', () => {
  updateVcExtraGroupVisibility();
  updateVcNoteEnabled();
});
document.getElementById('group-playStyles')?.addEventListener('change', updatePlayStylesOtherEnabled);
multiFrequencyInput?.addEventListener('change', updateMultiFrequencyNoteEnabled);
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

// 「同担拒否あり」にチェックが入っているときだけキャラ選択欄を表示する
function updateSameOshiCharsVisibility() {
  const row = document.getElementById('row-sameOshiChars');
  if (row) row.classList.toggle('hidden', !sameOshiRejectInput?.checked);
}
sameOshiRejectInput?.addEventListener('change', updateSameOshiCharsVisibility);

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
  if (workCallOkInput) workCallOkInput.checked = !!store.workCallOk;
  if (jokingOkInput) jokingOkInput.checked = !!store.jokingOk;
  if (sameOshiRejectInput) sameOshiRejectInput.checked = !!store.sameOshiReject;
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
  setRadioValue('ageGroup', store.ageGroup);
  setRadioValue('spending', store.spending);
  setRadioValue('inviteStyle', store.inviteStyle);
  if (multiFrequencyInput) multiFrequencyInput.value = store.multiFrequency || '';
  setRadioValue('vc', store.vc);
  setRadioValue('casualOk', store.casualOk);
  setCheckboxValues('platforms', store.platforms);
  setCheckboxValues('playStyles', store.playStyles);
  setCheckboxValues('friendPreference', store.friendPreference);
  updateVcExtraGroupVisibility();
  updateVcNoteEnabled();
  updatePlayStylesOtherEnabled();
  updateMultiFrequencyNoteEnabled();
  updateWeekdayByDayVisibility();
  updateWeekendByDayVisibility();
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
  // VCが「可能」以外のときはVC利用アプリ・通話スタイル一式は非表示にしているため、
  // 古い入力値が残っていても投稿には含めない
  const vcOpen = getRadioValue('vc') === 'yes';
  const sameOshiReject = vcOpen && !!sameOshiRejectInput?.checked;
  const weekdayByDay = !!weekdayByDayInput?.checked;
  const weekendByDay = !!weekendByDayInput?.checked;

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
    ageGroup: getRadioValue('ageGroup'),
    platforms: getCheckboxValues('platforms'),
    oshiChars: store.oshiChars,
    spending: getRadioValue('spending'),
    playStyles: getCheckboxValues('playStyles'),
    playStylesOtherText: getCheckboxValues('playStyles').includes('other') ? (playStylesOtherInput?.value.trim() || '') : '',
    showGenshinRanking: !!showGenshinRankingInput?.checked,
    showGenshinCheck: !!showGenshinCheckInput?.checked,
    inviteStyle: getRadioValue('inviteStyle'),
    multiFrequency: multiFrequencyInput?.value || '',
    multiFrequencyNote: multiFrequencyInput?.value === 'ask' ? (multiFrequencyNoteInput?.value.trim() || '') : '',
    workCallOk: vcOpen && !!workCallOkInput?.checked,
    vc: getRadioValue('vc'),
    vcNote: getRadioValue('vc') === 'maybe' ? (vcNoteInput?.value.trim() || '') : '',
    vcApps,
    vcDiscordId,
    vcLineId,
    vcAppsOtherText,
    casualOk: vcOpen ? getRadioValue('casualOk') : '',
    jokingOk: vcOpen && !!jokingOkInput?.checked,
    sameOshiReject,
    sameOshiChars: sameOshiReject ? store.sameOshiChars : [],
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
  { key: 'ageGroup', el: document.getElementById('group-ageGroup'), filled: (v) => !!v.ageGroup },
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
  { key: 'multiFrequency', el: multiFrequencyInput, filled: (v) => !!v.multiFrequency },
  { key: 'vc', el: document.getElementById('group-vc'), filled: (v) => !!v.vc },
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
    });

    clearDraft();
    formDirty = false;
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

// 値としては違うが相性が良い(非対称に噛み合う)組み合わせ。
// 例: マルチ自発について「お誘いします！」⇔「自発苦手です(誘われたい)」は
// 同じ値ではないが、誘う側と誘われたい側でちょうど噛み合うため好相性として扱う。
const COMPLEMENTARY_VALUE_PAIRS = {
  inviteStyle: [['invite', 'invited']],
  playStyles: [
    ['needExploreHelp', 'canHelpExplore'],
    ['needFarmHelp', 'canHelpBuild'],
    ['needDomainHelp', 'canHelpDomain'],
    ['needIllusiveHelp', 'canHelpIllusive'],
    ['wantAchievements', 'canHelpAchievements'],
    ['needQuestions', 'canHelpQuestions'],
  ],
};

// 相手のチップの値が自分のプロフィールと一致(配列は重複あり)しているか、上記の
// 相性ペアに該当しているかを判定する。戻り値は 'exact' | 'complementary' | null で、
// 呼び出し側で色分け表示に使う。
// 時間帯({start,end})や数値(AR/WLなど)は曖昧になりすぎるため判定対象外(常にnull)。
function fieldMatchKind(myValue, otherValue, key) {
  const pairs = COMPLEMENTARY_VALUE_PAIRS[key];
  if (Array.isArray(myValue) && Array.isArray(otherValue)) {
    if (myValue.some((v) => otherValue.includes(v))) return 'exact';
    const isComplementary = !!pairs && pairs.some(([a, b]) => (
      (myValue.includes(a) && otherValue.includes(b)) || (myValue.includes(b) && otherValue.includes(a))
    ));
    return isComplementary ? 'complementary' : null;
  }
  if (Array.isArray(myValue) || Array.isArray(otherValue)) return null;
  if (typeof myValue === 'object' || typeof otherValue === 'object') return null;
  if (myValue == null || myValue === '' || otherValue == null || otherValue === '') return null;
  if (myValue === otherValue) return 'exact';
  const isComplementary = !!pairs && pairs.some(([a, b]) => (myValue === a && otherValue === b) || (myValue === b && otherValue === a));
  return isComplementary ? 'complementary' : null;
}

// playStylesを個別の値(1つ1つのチップ)単位で判定する版。相手の1つの値が、
// 自分のplayStyles配列のどれかと完全一致するか、相性ペアの相手側を持っているかを見る。
function playStyleValueMatchKind(otherValue) {
  const myValues = store.playStyles || [];
  if (myValues.includes(otherValue)) return 'exact';
  const pairs = COMPLEMENTARY_VALUE_PAIRS.playStyles || [];
  const isComplementary = pairs.some(([a, b]) => (
    (otherValue === a && myValues.includes(b)) || (otherValue === b && myValues.includes(a))
  ));
  return isComplementary ? 'complementary' : null;
}

// ===== 募集カード描画 =====
function buildCard(post, { mine, matchPercent }) {
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

  const { rows, secretLabels } = getDisplayFields(post, mine);

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
          const matchKind = playStyleValueMatchKind(v);
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

// ===== マイプロフィール(=自分のリスティング、1ユーザー1件) =====
let latestMyListing = null;

function renderMyListing() {
  const list = document.getElementById('my-posts-list');
  if (!list) return;
  list.innerHTML = '';
  if (!latestMyListing) {
    const p = document.createElement('p');
    p.className = 'board-list-empty';
    p.textContent = s().emptyMy;
    list.appendChild(p);
    return;
  }
  list.appendChild(buildCard(latestMyListing, { mine: true }));
}

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

// ===== 検索一覧(さがす) =====
// サーバーが違うと実際にフレンドになれないため、自分と同じサーバーのユーザーのみを表示する(必須の絞り込み)。
let latestSearchPosts = [];

function renderSearchList() {
  const list = document.getElementById('search-list');
  if (!list) return;
  const myUserId = getUserId();

  const filtered = latestSearchPosts
    .filter((post) => post.userId === myUserId || post.publicFields?.server === store.server)
    .map((post) => ({
      post,
      // 自分の「どういうフレンドがほしい？」と相手の公開フィールドを突き合わせてマッチ度を計算する。
      // 自分の投稿(mine)には表示しないので、そちらは計算しない。
      matchPercent: post.userId === myUserId
        ? null
        : computeFriendMatch(store.friendPreference, store.gender, post.publicFields || {}),
    }))
    .sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1));

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
      renderSearchList();
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
  if (getAuthUid() === ADMIN_UID) {
    const infoModal = document.getElementById('info-modal');
    if (infoModal) infoModal.style.display = 'flex';
  }
  populateNumberAndTimeSelects();
  await loadProfileFromFirestore();
  applyDraftIfAny();
  fillFormFromProfile();
  populateVisibilitySelects();
  initAvatarUI({ getUserId, getAuthUid, onChange: updateLatestOwnPostAvatar });
  initApplications({ getUserId, onSentChange: renderSearchList });
  startMyListingListener();
  startSearchListener();
}

init();
