// reports.js
// 通報機能：投稿/申請/やり取りの画面から、問題のあるユーザーを管理者へ通報できる。
// 現時点ではFirestoreへの記録のみで、管理者用の確認画面は別途用意する予定
// (それまでは開発者がFirestoreのfriendBoardReportsコレクションを直接確認する)。

import { db } from './firebaseConfig.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const REASON_MAXLEN = 500;

// postId/applicationId/chatMessagesはコンテキストに応じて渡せるだけ渡す(どれも省略可)。
// chatMessagesは通報時点のスナップショットをそのままコピーして残す
// (後から会話が続いても、通報時点の内容が変わらず確認できるようにするため)。
export async function reportUser({
  reporterUserId, reportedUserId, postId = null, applicationId = null, chatMessages = null, reason = '',
}) {
  await addDoc(collection(db, 'friendBoardReports'), {
    reporterUserId,
    reportedUserId,
    postId,
    applicationId,
    chatMessages: chatMessages || null,
    reason: (reason || '').trim().slice(0, REASON_MAXLEN),
    handled: false,
    createdAt: serverTimestamp(),
  });
}
