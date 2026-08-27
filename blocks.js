// blocks.js
// ブロック機能：ブロックした/された相手は、探す一覧・届いた申請・送った申請・
// やり取り、どの画面からもお互いに見えなくなる(双方向)。裏側のデータ(投稿・
// 申請・チャット履歴)自体は削除しない(誤ブロックからの復旧、通報時に経緯を
// 確認できるようにするため)。ブロックされたことは相手には通知しない
// (LINE/X等の一般的なブロックの作法と同じ)。
//
// board.js(探す一覧・マイプロフィール)とapplications.js(届いた/送った申請・
// やり取り)の両方から使われるため、状態はこのモジュール内に一元管理し、
// どちらから呼ばれても購読は最初の1回だけ開始する(initBlocks参照)。
//
// 注意: ここでの制御はすべてクライアント側の表示フィルターであり、Firestore
// のセキュリティルール側での強制ではない。悪意を持って直接Firestoreを叩けば
// 回避できてしまうため、あくまで通常利用時の摩擦(嫌がらせの抑止)としての
// 機能であり、完全なセキュリティ境界ではないことを踏まえておくこと。

import { db } from './firebaseConfig.js';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let _getUserId = null;
let started = false;
let blockedByMe = [];
let blockedMe = [];
let hiddenUserIds = new Set();
const listeners = [];

function recompute() {
  hiddenUserIds = new Set([...blockedByMe, ...blockedMe]);
  listeners.forEach((fn) => fn());
}

// ブロック状態が変わるたびに呼ばれるコールバックを登録する(再描画のトリガー用)。
export function onBlocksChange(fn) {
  if (typeof fn === 'function') listeners.push(fn);
}

// userIdが自分との間でブロック関係にある(自分がブロックした/相手にブロックされた
// のどちらか)かどうか。一覧の表示フィルターに使う。
export function isBlocked(userId) {
  return hiddenUserIds.has(userId);
}

// マイプロフィール画面の「ブロック中のユーザー」一覧表示・解除ボタン用。
export function blockedByMeList() {
  return [...blockedByMe];
}

function blockDocId(blockerUserId, blockedUserId) {
  return `${blockerUserId}_${blockedUserId}`;
}

export async function blockUser(userId) {
  const myId = _getUserId?.();
  if (!myId || !userId || myId === userId) return;
  await setDoc(doc(db, 'friendBoardBlocks', blockDocId(myId, userId)), {
    blockerUserId: myId,
    blockedUserId: userId,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(userId) {
  const myId = _getUserId?.();
  if (!myId || !userId) return;
  await deleteDoc(doc(db, 'friendBoardBlocks', blockDocId(myId, userId)));
}

export function initBlocks({ getUserId }) {
  _getUserId = getUserId;
  if (started) return;
  started = true;
  const myId = getUserId();

  onSnapshot(query(collection(db, 'friendBoardBlocks'), where('blockerUserId', '==', myId)), (snap) => {
    blockedByMe = snap.docs.map((d) => d.data().blockedUserId);
    recompute();
  }, (e) => console.error('[blocks] blockedByMe listen failed', e));

  onSnapshot(query(collection(db, 'friendBoardBlocks'), where('blockedUserId', '==', myId)), (snap) => {
    blockedMe = snap.docs.map((d) => d.data().blockerUserId);
    recompute();
  }, (e) => console.error('[blocks] blockedMe listen failed', e));
}
