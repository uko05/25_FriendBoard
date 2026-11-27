// storageImage.js
// 「画像保管庫の画像を公開する」(2026-11-24追加)。
// 17_storage(画像保管庫)に保存した画像から1枚選んで、募集カードに表示できるようにする。
//
// 表示までの流れ:
//   1. 選べるのは、保管庫の自動審査(SafeSearch)に通った自分の画像だけ
//      (screenshotStorageImages の moderationStatus == 'approved')。
//   2. 選ぶと friendBoardImageReviews/{userId} に status:'pending' で書き込む。
//      本人は 'pending' しか書けない(Firestoreルールで強制)。
//   3. 管理者が管理タブの「画像の確認」で目視して 'approved' / 'rejected' にする。
//   4. 募集カードでは status == 'approved' のときだけ表示する。
//
// 表示側の読み取りは、カードの「画像保管庫の画像を表示」ボタンを押した時の getDoc 1回だけ
// (推しキャラランキング/チェックシートと同じく、押すまで読み込まない)。
// 画面上の文言には「管理者」という言葉を出さない(ユーザーの要望, 2026-11-24)。

import { db } from './firebaseConfig.js?v=2';
import { getUserId, getAuthUid } from './userData.js?v=5';
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const REVIEW_COLLECTION = 'friendBoardImageReviews';
const STORAGE_COLLECTION = 'screenshotStorageImages';
const STORAGE_SITE_URL = 'https://uko05.github.io/17_storage/';
const ACCOUNT_URL = 'https://uko05.github.io/24_AccountCenter/';

const STR = {
  ja: {
    pickBtn: '画像を選ぶ',
    changeBtn: '別の画像を選ぶ',
    pickerTitle: '公開する画像を選んでください',
    pickerLoading: '読み込み中…',
    pickerEmpty: `公開できる画像がありません。<a href="${STORAGE_SITE_URL}" target="_blank" rel="noopener">画像保管庫</a>で画像を保存してください（保存してから選べるようになるまで少し時間がかかることがあります）。`,
    pickerFail: '画像の読み込みに失敗しました。時間をおいて再度お試しください。',
    needLogin: `画像保管庫の画像を公開するには、<a href="${ACCOUNT_URL}" target="_blank" rel="noopener">アカウント</a>へのログインが必要です。`,
    notPicked: 'まだ画像が選ばれていません。',
    saveFail: '画像の選択に失敗しました。時間をおいて再度お試しください。',
    statusPending: '画像承認待ち',
    statusApproved: '表示中',
    statusRejected: 'この画像は表示できませんでした。別の画像を選んでください。',
    showBtn: '画像保管庫の画像を表示',
  },
  en: {
    pickBtn: 'Choose an image',
    changeBtn: 'Choose another image',
    pickerTitle: 'Choose an image to show',
    pickerLoading: 'Loading…',
    pickerEmpty: `No images available. Please save one in <a href="${STORAGE_SITE_URL}" target="_blank" rel="noopener">Image Storage</a> first (it may take a little while before it can be chosen).`,
    pickerFail: 'Failed to load images. Please try again later.',
    needLogin: `You need to log in to your <a href="${ACCOUNT_URL}" target="_blank" rel="noopener">account</a> to show an image from Image Storage.`,
    notPicked: 'No image chosen yet.',
    saveFail: 'Failed to choose the image. Please try again later.',
    statusPending: 'Waiting for image approval',
    statusApproved: 'Shown',
    statusRejected: 'This image could not be shown. Please choose another one.',
    showBtn: 'Show Image Storage image',
  },
};

function lang() {
  return document.documentElement.lang === 'en' ? 'en' : 'ja';
}
export function storageImageStr() { return STR[lang()]; }

export async function fetchImageReview(userId) {
  if (!userId) return null;
  try {
    const snap = await getDoc(doc(db, REVIEW_COLLECTION, userId));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('[storageImage] review fetch failed', e);
    return null;
  }
}

// 読み込めなかった画像(保管庫から削除された等)は、枠ごと消す
function removeOnError(img, target) {
  img.addEventListener('error', () => { (target || img).remove(); });
}

// 他人のカード用: 状態の読み取り結果を覚えておく(一覧の描き直しのたびに読み直さない)。
// 10分たったら読み直す(その間に表示OKになった人も、いずれボタンが出るように)。
const REVIEW_CACHE_MS = 10 * 60 * 1000;
const reviewCache = new Map(); // userId -> { at, promise }
function cachedImageReview(userId) {
  const hit = reviewCache.get(userId);
  if (hit && Date.now() - hit.at < REVIEW_CACHE_MS) return hit.promise;
  const promise = fetchImageReview(userId);
  reviewCache.set(userId, { at: Date.now(), promise });
  return promise;
}

// ===== 募集カードでの表示 =====
// mine: 自分のカード(マイプロフィール)ではすぐに表示し、状態も添える。
// 他人のカード: 表示OK(approved)の人にだけ「画像保管庫の画像を表示」ボタンを出す
// (チェックだけ入れて画像を選んでいない人・画像承認待ちの人には出さない。2026-11-24)。
// 画像そのものはボタンを押すまで読み込まない。
export function renderStorageImageOnCard(wrap, ownerUserId, mine) {
  const show = (review) => {
    if (!review || review.status !== 'approved' || !review.viewUrl) {
      if (mine && review && review.viewUrl) {
        // 自分のカードには、承認前でも状態だけ出しておく(表示はされていないことが分かるように)
        const note = document.createElement('p');
        note.className = 'board-storage-image-card-status';
        note.textContent = review.status === 'rejected' ? storageImageStr().statusRejected : storageImageStr().statusPending;
        wrap.replaceChildren(note);
        return;
      }
      wrap.remove();
      return;
    }
    const img = document.createElement('img');
    img.className = 'board-card-saved-image-img board-storage-image-card-img';
    img.alt = '';
    img.src = review.viewUrl;
    removeOnError(img, wrap);
    wrap.replaceChildren(img);
  };

  if (mine) {
    fetchImageReview(ownerUserId).then(show);
    return;
  }
  cachedImageReview(ownerUserId).then((review) => {
    if (!review || review.status !== 'approved' || !review.viewUrl) {
      wrap.remove();
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'board-card-saved-image-toggle';
    btn.textContent = storageImageStr().showBtn;
    wrap.appendChild(btn);
    btn.addEventListener('click', () => {
      btn.disabled = true;
      show(review);
    }, { once: true });
  });
}

// ===== 募集フォーム側(チェック・プレビュー・画像選択) =====
let formEls = null;
let pickerImages = null; // 選択ポップで読み込んだ画像一覧(開くたびに読み直す。画像保管庫で保存した直後の画像も出るように 2026-11-28)
let currentReview = null; // 今選ばれている画像(同じ画像を選び直した時に承認待ちへ戻さないため)

export function initStorageImageForm() {
  formEls = {
    checkbox: document.getElementById('input-showStorageImage'),
    wrap: document.getElementById('preview-storageImage'),
    msg: document.getElementById('preview-storageImage-message'),
    img: document.getElementById('preview-storageImage-img'),
    status: document.getElementById('preview-storageImage-status'),
    pickBtn: document.getElementById('storage-image-pick-btn'),
    modal: document.getElementById('storage-image-modal'),
    grid: document.getElementById('storage-image-modal-grid'),
    modalMsg: document.getElementById('storage-image-modal-message'),
    close: document.getElementById('storage-image-modal-close'),
  };
  if (!formEls.checkbox) return;
  formEls.checkbox.addEventListener('change', refreshStorageImagePreview);
  formEls.pickBtn?.addEventListener('click', openPicker);
  formEls.close?.addEventListener('click', closePicker);
  formEls.modal?.querySelector('.col-modal-backdrop')?.addEventListener('click', closePicker);
  // 言語を切り替えたら、ボタンや状態の文言も切り替える(script.jsの切替のあとに実行)
  document.querySelectorAll('input[name="lang"]').forEach((r) => {
    r.addEventListener('change', () => setTimeout(refreshStorageImagePreview, 0));
  });
}

export async function refreshStorageImagePreview() {
  if (!formEls?.checkbox) return;
  const { checkbox, wrap, msg, img, status, pickBtn } = formEls;
  if (!checkbox.checked) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  const t = storageImageStr();
  if (!getAuthUid()) {
    msg.innerHTML = t.needLogin;
    msg.style.display = 'block';
    img.style.display = 'none';
    status.textContent = '';
    pickBtn.classList.add('hidden');
    return;
  }
  pickBtn.classList.remove('hidden');
  const review = await fetchImageReview(getUserId());
  currentReview = review;
  if (!review || !review.viewUrl) {
    msg.textContent = t.notPicked;
    msg.style.display = 'block';
    img.style.display = 'none';
    status.textContent = '';
    pickBtn.textContent = t.pickBtn;
    return;
  }
  msg.style.display = 'none';
  img.src = review.thumbUrl || review.viewUrl;
  img.style.display = 'block';
  status.textContent = review.status === 'approved' ? t.statusApproved
    : review.status === 'rejected' ? t.statusRejected : t.statusPending;
  status.dataset.status = review.status || 'pending';
  pickBtn.textContent = t.changeBtn;
}

async function loadPickerImages() {
  const uid = getAuthUid();
  const snap = await getDocs(query(collection(db, STORAGE_COLLECTION), where('ownerUid', '==', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.moderationStatus === 'approved' && d.viewUrl)
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

async function openPicker() {
  const { modal, grid, modalMsg } = formEls;
  if (!modal) return;
  const t = storageImageStr();
  modal.style.display = 'flex';
  grid.replaceChildren();
  modalMsg.textContent = t.pickerLoading;
  modalMsg.style.display = 'block';
  try {
    pickerImages = await loadPickerImages();
  } catch (e) {
    console.warn('[storageImage] picker load failed', e);
    modalMsg.textContent = t.pickerFail;
    return;
  }
  if (!pickerImages.length) {
    modalMsg.innerHTML = t.pickerEmpty;
    pickerImages = null; // 保存してから戻ってきた時に読み直せるように
    return;
  }
  modalMsg.style.display = 'none';
  pickerImages.forEach((im) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'board-storage-picker-item';
    const thumb = document.createElement('img');
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumb.src = im.thumbUrl || im.viewUrl;
    removeOnError(thumb, btn);
    btn.appendChild(thumb);
    btn.addEventListener('click', () => chooseImage(im, btn));
    grid.appendChild(btn);
  });
}

function closePicker() {
  if (formEls?.modal) formEls.modal.style.display = 'none';
}

async function chooseImage(im, btn) {
  const t = storageImageStr();
  // 今と同じ画像を選んだだけなら何も変えない(承認済みが承認待ちに戻ってしまうため)
  if (currentReview && currentReview.storageImageId === im.id && currentReview.status !== 'rejected') {
    closePicker();
    return;
  }
  formEls.grid.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  btn.classList.add('is-busy');
  try {
    // 選び直すたびに承認待ちに戻る(本人は'pending'しか書けない。ルールで強制)
    await setDoc(doc(db, REVIEW_COLLECTION, getUserId()), {
      userId: getUserId(),
      authUid: getAuthUid(),
      storageImageId: im.id,
      viewUrl: im.viewUrl,
      thumbUrl: im.thumbUrl || im.viewUrl,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
    closePicker();
    refreshStorageImagePreview();
  } catch (e) {
    console.warn('[storageImage] choose failed', e);
    formEls.modalMsg.textContent = t.saveFail;
    formEls.modalMsg.style.display = 'block';
  } finally {
    formEls.grid.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    btn.classList.remove('is-busy');
  }
}
