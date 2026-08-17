// avatar.js
// うこ氏サイト群共通のアバター設定(userAvatars/{sharedUserId})。
// 14_GenshinOmikuji/feed.js・24_AccountCenter/script.js と同じ仕組みをそのまま使う：
//   - 原神/スタレのキャラアイコンから選ぶ
//   - 変更できるのは24_AccountCenterでアカウント登録し、この共有IDに紐付いた本人のみ
//     (Firestoreルール側でも accountLinks を見て強制している)

import { db } from './firebaseConfig.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { genshinChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_data/genshin_chars.js';
import { starrailChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/02_Starrail/chara_data/starrail_chars.js';

const GENSHIN_ICON_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_icon/';
const STARRAIL_ICON_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/02_Starrail/chara_icon/';
const DEFAULT_AVATAR_URL = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/00_common/image/sonota.png';

const ELEM_LABELS = {
  ja: { hi: '炎', mizu: '水', koori: '氷', kaminari: '雷', kusa: '草', kaze: '風', iwa: '岩', kyosuu: '虚数', ryoushi: '量子', butsuri: '物理' },
  en: { hi: 'Fire', mizu: 'Hydro', koori: 'Ice', kaminari: 'Lightning', kusa: 'Dendro', kaze: 'Wind', iwa: 'Geo', kyosuu: 'Imaginary', ryoushi: 'Quantum', butsuri: 'Physical' },
};
const GAME_ELEMS = {
  genshin: ['hi', 'mizu', 'koori', 'kaminari', 'kusa', 'kaze', 'iwa'],
  starrail: ['hi', 'koori', 'kaze', 'kaminari', 'kyosuu', 'ryoushi', 'butsuri'],
};
const GAME_CHARS = { genshin: genshinChars, starrail: starrailChars };
const GAME_ICON_BASE = { genshin: GENSHIN_ICON_BASE, starrail: STARRAIL_ICON_BASE };

function currentLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'ja';
}

export function avatarUrl(game, icon) {
  if (!game || !icon) return DEFAULT_AVATAR_URL;
  return (game === 'starrail' ? STARRAIL_ICON_BASE : GENSHIN_ICON_BASE) + icon;
}

export async function getMyAvatar(userId) {
  try {
    const snap = await getDoc(doc(db, 'userAvatars', userId));
    if (snap.exists()) {
      const d = snap.data();
      return { game: d.game || null, icon: d.icon || null };
    }
  } catch (e) {
    console.error('[avatar] fetch failed', e);
  }
  return { game: null, icon: null };
}

let _getUserId = null;
let _onChange = null;
let pickerGame = 'genshin';
let pickerElem = GAME_ELEMS.genshin[0];

function renderPickerGameTabs() {
  const bar = document.getElementById('avatar-picker-game-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  const isEn = currentLang() === 'en';
  [['genshin', isEn ? 'Genshin' : '原神'], ['starrail', isEn ? 'Star Rail' : 'スタレ']].forEach(([game, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-game-tab-btn' + (game === pickerGame ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      pickerGame = game;
      pickerElem = GAME_ELEMS[game][0];
      renderPickerGameTabs();
      renderPickerElemTabs();
      renderPickerCharList();
    });
    bar.appendChild(btn);
  });
}

function renderPickerElemTabs() {
  const bar = document.getElementById('avatar-picker-elem-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  const labels = ELEM_LABELS[currentLang()];
  GAME_ELEMS[pickerGame].forEach((elem) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-elem-tab-btn' + (elem === pickerElem ? ' active' : '');
    btn.textContent = labels[elem];
    btn.addEventListener('click', () => {
      pickerElem = elem;
      renderPickerElemTabs();
      renderPickerCharList();
    });
    bar.appendChild(btn);
  });
}

function renderPickerCharList() {
  const list = document.getElementById('avatar-picker-char-list');
  if (!list) return;
  list.innerHTML = '';
  const chars = GAME_CHARS[pickerGame].filter((c) => c.element === pickerElem);
  chars.forEach((c) => {
    const name = c.name || c.icon.replace(/\.\w+$/, '');
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'avatar-picker-thumb';
    thumb.title = name;
    const img = document.createElement('img');
    img.src = GAME_ICON_BASE[pickerGame] + c.icon;
    img.alt = name;
    img.loading = 'lazy';
    thumb.appendChild(img);
    thumb.addEventListener('click', () => selectAvatarFromPicker(pickerGame, c.icon));
    list.appendChild(thumb);
  });
}

function openAvatarPicker() {
  const modal = document.getElementById('avatar-picker-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderPickerGameTabs();
  renderPickerElemTabs();
  renderPickerCharList();
}

function closeAvatarPicker() {
  const modal = document.getElementById('avatar-picker-modal');
  if (modal) modal.style.display = 'none';
}

function openNudgeModal() {
  const modal = document.getElementById('avatar-nudge-modal');
  if (modal) modal.style.display = 'flex';
}

function closeNudgeModal() {
  const modal = document.getElementById('avatar-nudge-modal');
  if (modal) modal.style.display = 'none';
}

async function selectAvatarFromPicker(game, icon) {
  if (!_getUserId) return;
  const userId = _getUserId();
  try {
    await setDoc(doc(db, 'userAvatars', userId), {
      game, icon, updatedAt: serverTimestamp(),
    });
    const img = document.getElementById('player-avatar');
    if (img) img.src = avatarUrl(game, icon);
    closeAvatarPicker();
    if (_onChange) _onChange({ game, icon });
  } catch (e) {
    console.error('[avatar] select failed', e);
  }
}

async function refreshPlayerAvatarImg() {
  const img = document.getElementById('player-avatar');
  if (!img || !_getUserId) return;
  const avatar = await getMyAvatar(_getUserId());
  img.src = avatarUrl(avatar.game, avatar.icon);
}

// getUserId: 現在の共有ユーザーIDを返す関数
// getAuthUid: ログイン中ならFirebase Auth uidを返す関数（未ログインならnull）
// onChange: アバター変更時に呼ばれるコールバック({game,icon}) => void
export function initAvatarUI({ getUserId, getAuthUid, onChange }) {
  _getUserId = getUserId;
  _onChange = onChange || null;

  refreshPlayerAvatarImg();

  const img = document.getElementById('player-avatar');
  img?.addEventListener('click', () => {
    if (getAuthUid && getAuthUid()) {
      openAvatarPicker();
    } else {
      openNudgeModal();
    }
  });

  document.getElementById('avatar-picker-close')?.addEventListener('click', closeAvatarPicker);
  document.querySelector('#avatar-picker-modal .col-modal-backdrop')?.addEventListener('click', closeAvatarPicker);
  document.getElementById('avatar-nudge-close')?.addEventListener('click', closeNudgeModal);
  document.querySelector('#avatar-nudge-modal .col-modal-backdrop')?.addEventListener('click', closeNudgeModal);
}
