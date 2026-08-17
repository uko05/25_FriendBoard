// fields.js
// プロフィール項目の定義（表示ラベル・選択肢・既定の公開設定）を一箇所に集約する。
// board.js(投稿フォーム・カード表示)とapplications.js(申請カード表示)の両方から使う。

// 公開設定(visibility)の対象となる項目一覧。コメントは常に公開のため対象外。
export const VISIBILITY_FIELDS = [
  'genshinUid', 'server', 'adventureRank', 'gender', 'platforms',
  'oshiChars', 'spending', 'playStyles', 'inviteStyle', 'workCallOk',
  'vc', 'vcApps', 'twitterId', 'weekdayTimes', 'weekendTimes',
];

// 既定の公開設定。性別だけ非公開始まり、他は公開始まり。
export function defaultVisibility() {
  const v = {};
  VISIBILITY_FIELDS.forEach((k) => { v[k] = k === 'gender' ? 'hidden' : 'public'; });
  return v;
}

const FIELD_LABELS = {
  genshinUid: { ja: '原神UID', en: 'Genshin UID' },
  server: { ja: 'サーバー', en: 'Server' },
  adventureRank: { ja: '冒険者ランク', en: 'Adventure Rank' },
  gender: { ja: '性別', en: 'Gender' },
  platforms: { ja: 'ハード', en: 'Platform' },
  oshiChars: { ja: '推しキャラ', en: 'Favorite Characters' },
  spending: { ja: '課金スタンス', en: 'Spending' },
  playStyles: { ja: 'プレイスタイル', en: 'Play Style' },
  inviteStyle: { ja: 'マルチの誘うタイプ', en: 'Invite Style' },
  workCallOk: { ja: '作業通話のみでもOK', en: 'OK with silent/work call' },
  vc: { ja: 'VC(ボイスチャット)', en: 'Voice Chat' },
  vcApps: { ja: 'VC利用アプリ', en: 'VC App' },
  twitterId: { ja: 'ツイッターID', en: 'X (Twitter) ID' },
  weekdayTimes: { ja: '平日のマルチ可能時間帯', en: 'Weekday availability' },
  weekendTimes: { ja: '休日のマルチ可能時間帯', en: 'Weekend availability' },
};

export function fieldLabel(key, lang) {
  const l = FIELD_LABELS[key];
  return l ? (lang === 'en' ? l.en : l.ja) : key;
}

const OPTION_LABELS = {
  server: {
    asia: { ja: 'アジア', en: 'Asia' },
    america: { ja: '北米', en: 'America' },
    europe: { ja: '欧州', en: 'Europe' },
    sar: { ja: '香港・マカオ・台湾', en: 'HK/MO/TW' },
  },
  gender: {
    male: { ja: '男性', en: 'Male' },
    female: { ja: '女性', en: 'Female' },
    secret: { ja: '回答しない', en: 'Prefer not to say' },
  },
  platforms: {
    pc: { ja: 'PC', en: 'PC' },
    ps5: { ja: 'PS5', en: 'PS5' },
    ps4: { ja: 'PS4', en: 'PS4' },
    mobile: { ja: 'スマホ', en: 'Mobile' },
  },
  spending: {
    f2p: { ja: '無課金', en: 'F2P' },
    light: { ja: '微課金', en: 'Light spender' },
    heavy: { ja: '廃課金', en: 'Heavy spender' },
  },
  playStyles: {
    chill: { ja: 'まったり勢', en: 'Casual' },
    hardcore: { ja: 'がっつり勢', en: 'Hardcore' },
    beginnerFriendly: { ja: '初心者歓迎', en: 'Beginner friendly' },
    efficient: { ja: '効率重視', en: 'Efficiency focused' },
  },
  inviteStyle: {
    invite: { ja: '誘うタイプ', en: 'I invite' },
    invited: { ja: '誘われたいタイプ', en: 'I wait to be invited' },
    either: { ja: 'どちらでも', en: 'Either' },
  },
  vc: {
    yes: { ja: '可能', en: 'Available' },
    no: { ja: '不可', en: 'Not available' },
    maybe: { ja: '相談', en: 'Ask me' },
  },
  vcApps: {
    discord: { ja: 'Discord', en: 'Discord' },
    line: { ja: 'LINE', en: 'LINE' },
    other: { ja: 'その他', en: 'Other' },
  },
  timeSlot: {
    morning: { ja: '朝(6-12)', en: 'Morning (6-12)' },
    day: { ja: '昼(12-18)', en: 'Day (12-18)' },
    night: { ja: '夜(18-24)', en: 'Night (18-24)' },
    midnight: { ja: '深夜(0-6)', en: 'Late night (0-6)' },
    irregular: { ja: '不定期', en: 'Irregular' },
  },
};

const TIME_SLOT_FIELDS = new Set(['weekdayTimes', 'weekendTimes']);

function optionLabel(key, value, lang) {
  const group = TIME_SLOT_FIELDS.has(key) ? OPTION_LABELS.timeSlot : OPTION_LABELS[key];
  if (!group) return String(value);
  const l = group[value];
  return l ? (lang === 'en' ? l.en : l.ja) : String(value);
}

function isEmptyValue(v) {
  if (Array.isArray(v)) return v.length === 0;
  return v === '' || v == null;
}

// 投稿用に、公開設定(visibility)に応じて値を振り分ける。
// values: {key: 現在の入力値, ...}, visibility: {key: 'hidden'|'public'|'approval', ...}
// 戻り値: { publicFields: {key:value,...}, secretFieldKeys: [key,...] }
// 'approval'は登録者(isRegistered)だけが使える機能のため、未登録なら'public'として扱う。
export function buildPostFieldBuckets(values, visibility, isRegistered) {
  const publicFields = {};
  const secretFieldKeys = [];
  VISIBILITY_FIELDS.forEach((key) => {
    const vis = visibility[key] || 'public';
    const value = values[key];
    if (isEmptyValue(value)) return;
    if (vis === 'hidden') return;
    if (vis === 'approval' && isRegistered) {
      secretFieldKeys.push(key);
    } else {
      publicFields[key] = value;
    }
  });
  return { publicFields, secretFieldKeys };
}

// 申請時、申請者が相手(募集主)に見せる自分のプロフィール一式を作る。
// 非公開(hidden)の項目だけ除外し、公開/承認制はどちらも含める
// (申請という行為自体が、その相手への開示に同意したことを意味するため)。
export function snapshotVisibleFields(values, visibility) {
  const out = {};
  VISIBILITY_FIELDS.forEach((key) => {
    const vis = visibility[key] || 'public';
    const value = values[key];
    if (vis === 'hidden' || isEmptyValue(value)) return;
    out[key] = value;
  });
  return out;
}

// 保存されている値(文字列/配列/真偽値/数値)を画面表示用の文字列に整形する。
// oshiCharsだけはアイコン画像なのでここでは扱わず、呼び出し側でアイコン表示する。
export function formatFieldValue(key, value, lang) {
  if (value == null || value === '') return '';
  if (key === 'workCallOk') {
    return value ? (lang === 'en' ? 'OK' : 'OK') : '';
  }
  if (key === 'adventureRank') {
    return `AR ${value}`;
  }
  if (Array.isArray(value)) {
    if (!value.length) return '';
    return value.map((v) => optionLabel(key, v, lang)).join(lang === 'en' ? ', ' : '、');
  }
  return optionLabel(key, value, lang);
}
