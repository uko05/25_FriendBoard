// userData.js
// 匿名端末ID(userId)とプロフィール(原神UID・サーバー等)の管理。
// 14_GenshinOmikuji/userData.js と同じ方式：
//   - localStorageに残すのはuserIdのみ
//   - プロフィール本体はFirestoreを正源泉とし、インメモリのstoreで保持
//   - 変更のたびにデバウンスしてFirestoreへ同期

import { app, db } from './firebaseConfig.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { VISIBILITY_FIELDS, defaultVisibility } from './fields.js';

// 14_GenshinOmikujiと同じキーをあえて使う。uko05.github.io配下は全サイト同一オリジンで
// localStorageを共有しているため、キーを揃えるだけで「Omikuji/AccountCenterで使っている
// IDと同じID」がFriendBoardでも自動的に使われ、24_AccountCenterのログイン連携
// (accountLinks: authUid -> omikujiUserId)がそのまま効くようになる。
const LS_SHARED_UID = 'genshinOmikuji_userId';

const auth = getAuth(app);
let _authUid = null;

// ログイン中(24_AccountCenterでID/パスワード登録済み)のFirebase Auth uid。
// アバター設定など「登録者だけができる操作」の表示切替に使う。
export function getAuthUid() {
  return _authUid;
}

export function getUserId() {
  let id = localStorage.getItem(LS_SHARED_UID);
  if (!id) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = 'u_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(LS_SHARED_UID, id);
  }
  return id;
}

// ログイン中(24_AccountCenterでID/パスワード登録済み)なら、accountLinksに紐づく
// 共有IDをlocalStorageへ反映する（別端末でログインした場合など、ローカルのIDが
// 登録時のものとズレているケースに対応）。ログインしていない/連携先が無い場合は何もしない。
export function waitForAccountLink() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };

    onAuthStateChanged(auth, async (user) => {
      _authUid = (user && user.email) ? user.uid : null;
      if (user && user.email) {
        try {
          const linkSnap = await getDoc(doc(db, 'accountLinks', user.uid));
          const linkedId = linkSnap.exists() ? linkSnap.data().omikujiUserId : null;
          if (linkedId && linkedId !== localStorage.getItem(LS_SHARED_UID)) {
            localStorage.setItem(LS_SHARED_UID, linkedId);
          }
        } catch (e) {
          console.warn('[userData] account link lookup failed', e);
        }
      }
      finish();
    });

    // 万一onAuthStateChangedが発火しない場合でも起動をブロックしない
    setTimeout(finish, 2500);
  });
}

export const store = {
  genshinUid: '',
  server: '',
  intro: '', // 募集コメントの既定値（次回の募集フォームにも自動反映される）
  adventureRank: 60,
  worldLevel: 9,
  gender: '',
  platforms: [],
  oshiChars: [], // 原神キャラのicon名、最大3件
  spending: '',
  playStyles: [],
  inviteStyle: '',
  multiFrequency: '',
  workCallOk: false,
  vc: '',
  vcApps: [],
  casualOk: false,
  jokingOk: false,
  sameOshiReject: false,
  sameOshiChars: [], // 原神キャラのicon名、人数制限なし
  twitterId: '',
  weekdayTimes: { start: '', end: '' },
  weekendTimes: { start: '', end: '' },
  visibility: defaultVisibility(), // 項目名 -> 'hidden' | 'public' | 'approval'
};

const ARRAY_FIELDS = ['platforms', 'oshiChars', 'playStyles', 'vcApps', 'sameOshiChars'];
const TIME_RANGE_FIELDS = ['weekdayTimes', 'weekendTimes'];

export async function loadProfileFromFirestore() {
  try {
    const userId = getUserId();
    const snap = await getDoc(doc(db, 'friendBoardProfiles', userId));
    if (snap.exists()) {
      const d = snap.data();
      if (d.genshinUid != null) store.genshinUid = d.genshinUid;
      if (d.server != null) store.server = d.server;
      if (d.intro != null) store.intro = d.intro;
      if (d.adventureRank != null) store.adventureRank = d.adventureRank;
      if (d.worldLevel != null) store.worldLevel = d.worldLevel;
      if (d.gender != null) store.gender = d.gender;
      if (d.spending != null) store.spending = d.spending;
      if (d.inviteStyle != null) store.inviteStyle = d.inviteStyle;
      if (d.multiFrequency != null) store.multiFrequency = d.multiFrequency;
      if (d.workCallOk != null) store.workCallOk = !!d.workCallOk;
      if (d.vc != null) store.vc = d.vc;
      if (d.casualOk != null) store.casualOk = !!d.casualOk;
      if (d.jokingOk != null) store.jokingOk = !!d.jokingOk;
      if (d.sameOshiReject != null) store.sameOshiReject = !!d.sameOshiReject;
      if (d.twitterId != null) store.twitterId = d.twitterId;
      ARRAY_FIELDS.forEach((k) => { if (Array.isArray(d[k])) store[k] = d[k]; });
      TIME_RANGE_FIELDS.forEach((k) => {
        if (d[k] && typeof d[k] === 'object') store[k] = { start: d[k].start || '', end: d[k].end || '' };
      });
      if (d.visibility && typeof d.visibility === 'object') {
        VISIBILITY_FIELDS.forEach((k) => {
          if (d.visibility[k]) store.visibility[k] = d.visibility[k];
        });
      }
    }
  } catch (e) {
    console.warn('[userData] profile load failed', e);
  }
}

export async function syncProfileToFirestore() {
  try {
    const userId = getUserId();
    await setDoc(doc(db, 'friendBoardProfiles', userId), {
      genshinUid: store.genshinUid,
      server: store.server,
      intro: store.intro,
      adventureRank: store.adventureRank,
      worldLevel: store.worldLevel,
      gender: store.gender,
      platforms: store.platforms,
      oshiChars: store.oshiChars,
      spending: store.spending,
      playStyles: store.playStyles,
      inviteStyle: store.inviteStyle,
      multiFrequency: store.multiFrequency,
      workCallOk: store.workCallOk,
      vc: store.vc,
      vcApps: store.vcApps,
      casualOk: store.casualOk,
      jokingOk: store.jokingOk,
      sameOshiReject: store.sameOshiReject,
      sameOshiChars: store.sameOshiChars,
      twitterId: store.twitterId,
      weekdayTimes: store.weekdayTimes,
      weekendTimes: store.weekendTimes,
      visibility: store.visibility,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (e) {
    console.error('[userData] profile sync failed', e);
    return false;
  }
}

let _syncTimer = null;
export function scheduleSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    syncProfileToFirestore();
  }, 1200);
}
