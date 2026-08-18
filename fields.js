// fields.js
// プロフィール項目の定義（表示ラベル・選択肢・既定の公開設定）を一箇所に集約する。
// board.js(投稿フォーム・カード表示)とapplications.js(申請カード表示)の両方から使う。

// 公開設定(visibility)の対象となる項目一覧。コメントは常に公開のため対象外。
// フォームの並び順とだいたい揃えている(カードのチップ表示順にも使われる)。
export const VISIBILITY_FIELDS = [
  'genshinUid', 'server', 'adventureRank', 'worldLevel', 'gender', 'platforms',
  'oshiChars', 'spending', 'playStyles',
  'weekdayTimes', 'weekendTimes', 'inviteStyle', 'multiFrequency', 'twitterId',
  'vc', 'vcApps', 'casualOk', 'jokingOk', 'sameOshiReject', 'sameOshiChars', 'workCallOk',
];

// 既定の公開設定。genshinUidは常に承認制で固定(フォームにセレクトを出していない)。
// 性別だけ非公開始まり、他は公開始まり。
export function defaultVisibility() {
  const v = {};
  VISIBILITY_FIELDS.forEach((k) => {
    if (k === 'genshinUid') v[k] = 'approval';
    else if (k === 'gender') v[k] = 'hidden';
    else v[k] = 'public';
  });
  return v;
}

const FIELD_LABELS = {
  genshinUid: { ja: '原神UID', en: 'Genshin UID' },
  server: { ja: 'サーバー', en: 'Server' },
  adventureRank: { ja: '冒険者ランク', en: 'Adventure Rank' },
  worldLevel: { ja: '世界ランク', en: 'World Level' },
  gender: { ja: '性別', en: 'Gender' },
  platforms: { ja: 'ハード', en: 'Platform' },
  oshiChars: { ja: '推しキャラ', en: 'Favorite Characters' },
  spending: { ja: '課金スタンス', en: 'Spending' },
  playStyles: { ja: 'プレイスタイル', en: 'Play Style' },
  inviteStyle: { ja: 'マルチ誘い/誘われタイプ', en: 'Invite Style' },
  multiFrequency: { ja: 'マルチ頻度', en: 'Multiplayer Frequency' },
  workCallOk: { ja: '作業通話のみでもOK', en: 'OK with silent/work call' },
  vc: { ja: 'VC(ボイスチャット)', en: 'Voice Chat' },
  vcApps: { ja: 'VC利用アプリ', en: 'VC App' },
  twitterId: { ja: 'ツイッターID', en: 'X (Twitter) ID' },
  weekdayTimes: { ja: '平日のマルチ可能時間帯', en: 'Weekday availability' },
  weekendTimes: { ja: '休日のマルチ可能時間帯', en: 'Weekend availability' },
  casualOk: { ja: 'タメ口OK', en: 'Casual speech OK' },
  jokingOk: { ja: 'おふざけOK', en: 'Joking around OK' },
  sameOshiReject: { ja: '同担拒否', en: 'Same-favorite rejection' },
  sameOshiChars: { ja: '同担拒否キャラ', en: 'Rejected characters' },
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
    mobile: { ja: 'スマホ', en: 'Mobile' },
    tablet: { ja: 'タブレット', en: 'Tablet' },
    ps5: { ja: 'PS5', en: 'PS5' },
    other: { ja: 'その他', en: 'Other' },
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
    callOnly: { ja: '通話しながら各々プレイしたい！', en: 'Want to play separately while on call!' },
    canHelpExplore: { ja: '探索手伝います！', en: "I'll help you explore!" },
    wantPhotos: { ja: '写真撮影しよう！', en: "Let's take photos!" },
    wantElites: { ja: '精鋭狩りしたい！', en: 'Want to hunt elites!' },
    canHelpBuild: { ja: '育成手伝います！', en: "I'll help with character building!" },
    needExploreHelp: { ja: '探索手伝って！', en: 'Help me explore!' },
    needFarmHelp: { ja: '育成素材集め手伝って！', en: 'Help me farm ascension materials!' },
    needQuestions: { ja: 'わからないことが多いので質問させて！', en: "I have lots of questions, let me ask!" },
    needCarry: { ja: 'とにかくキャリーして！', en: 'Just carry me!' },
    needDomainHelp: { ja: '秘境周回手伝って！', en: 'Help me farm domains!' },
  },
  inviteStyle: {
    invite: { ja: '誘うタイプ', en: 'I invite' },
    invited: { ja: '誘われたいタイプ', en: 'I wait to be invited' },
    either: { ja: 'どちらでも', en: 'Either' },
  },
  multiFrequency: {
    anytime: { ja: 'オンラインの時ならいつでも可', en: 'Anytime I\'m online' },
    daily: { ja: 'ほぼ毎日', en: 'Almost every day' },
    often: { ja: '週３～５くらい', en: '3-5 times/week' },
    sometimes: { ja: '週１～２くらい', en: '1-2 times/week' },
    ask: { ja: '要相談', en: 'Ask me' },
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
};

function optionLabel(key, value, lang) {
  const group = OPTION_LABELS[key];
  if (!group) return String(value);
  const l = group[value];
  return l ? (lang === 'en' ? l.en : l.ja) : String(value);
}

function isEmptyValue(v) {
  if (Array.isArray(v)) return v.length === 0;
  if (v && typeof v === 'object') return !v.start && !v.end;
  return v === '' || v == null;
}

// 投稿用に、公開設定(visibility)に応じて値を振り分ける。
// values: {key: 現在の入力値, ...}, visibility: {key: 'hidden'|'public'|'approval', ...}
// 戻り値: { publicFields: {key:value,...}, secretFieldKeys: [key,...] }
// 全ユーザーが'approval'を使える(誰でも承認制の項目を持てる)。genshinUidは常にapproval固定。
export function buildPostFieldBuckets(values, visibility) {
  const publicFields = {};
  const secretFieldKeys = [];
  VISIBILITY_FIELDS.forEach((key) => {
    const vis = visibility[key] || 'public';
    const value = values[key];
    if (isEmptyValue(value)) return;
    if (vis === 'hidden') return;
    if (vis === 'approval') {
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

// 保存されている値(文字列/配列/真偽値/数値/{start,end})を画面表示用の文字列に整形する。
// oshiCharsだけはアイコン画像なのでここでは扱わず、呼び出し側でアイコン表示する。
export function formatFieldValue(key, value, lang) {
  if (isEmptyValue(value)) return '';
  if (key === 'workCallOk' || key === 'casualOk' || key === 'jokingOk') {
    return value ? 'OK' : '';
  }
  if (key === 'sameOshiReject') {
    return value ? (lang === 'en' ? 'Yes' : 'あり') : '';
  }
  if (key === 'adventureRank') return `AR ${value}`;
  if (key === 'worldLevel') return `WL ${value}`;
  if (key === 'weekdayTimes' || key === 'weekendTimes') {
    return `${value.start || '?'} ~ ${value.end || '?'}`;
  }
  if (Array.isArray(value)) {
    if (!value.length) return '';
    return value.map((v) => optionLabel(key, v, lang)).join(lang === 'en' ? ', ' : '、');
  }
  return optionLabel(key, value, lang);
}
