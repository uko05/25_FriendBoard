// visibleListener.js
// タブが裏に回っている間は Firestore のリアルタイム購読(onSnapshot)を止め、表に戻ったら
// 張り直す(2026-10-25、読み取り課金の削減。14_GenshinOmikuji/visibleListener.js と同じ考え方)。
// 見ていないタブが他の人の募集の更新を受信し続けると、そのたびに読み取りが課金されるため。
// 張り直した時の読み取りは、firebaseConfig.js の永続キャッシュ(resume token)により
// 「止めていた間に変わったドキュメントだけ」で済む(止めていたのが30分を超えたら全件読み直し)。
// ちょっと別タブを見ただけで張り直さないよう、裏に回ってから1分待ってから止める。
// 使い方: firebase-firestore.js の onSnapshot の代わりに、ここの onSnapshot を同じ引数で呼ぶ。
// 引数(クエリ)は張り直しでも同じものを使うので、「今から○時間前」のような条件には使わないこと。
import { onSnapshot as rawOnSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const HIDDEN_GRACE_MS = 60 * 1000;
const subs = new Set();
let paused = false;
let pauseTimer = null;

function pauseAll() {
  pauseTimer = null;
  paused = true;
  subs.forEach((sub) => { if (sub.unsub) { sub.unsub(); sub.unsub = null; } });
}

function resumeAll() {
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  if (!paused) return;
  paused = false;
  subs.forEach((sub) => { if (!sub.unsub) sub.unsub = sub.start(); });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (!pauseTimer && !paused) pauseTimer = setTimeout(pauseAll, HIDDEN_GRACE_MS);
  } else {
    resumeAll();
  }
});
if (document.visibilityState === 'hidden') pauseTimer = setTimeout(pauseAll, HIDDEN_GRACE_MS);

export function onSnapshot(...args) {
  const sub = { start: () => rawOnSnapshot(...args), unsub: null };
  if (!paused) sub.unsub = sub.start();
  subs.add(sub);
  return () => { if (sub.unsub) sub.unsub(); subs.delete(sub); };
}
