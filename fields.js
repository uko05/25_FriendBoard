// fields.js
// プロフィール項目の定義（表示ラベル・選択肢・既定の公開設定）を一箇所に集約する。
// board.js(投稿フォーム・カード表示)とapplications.js(申請カード表示)の両方から使う。

// 推しキャラ・同担拒否キャラのアイコン画像を置いているCDNのベースURL。
export const GENSHIN_ICON_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_icon/';

// 公開設定(visibility)の対象となる項目一覧。コメントは常に公開のため対象外。
// フォームの並び順とだいたい揃えている(カードのチップ表示順にも使われる)。
export const VISIBILITY_FIELDS = [
  'genshinUid', 'displayName', 'server', 'adventureRank', 'worldLevel', 'gender', 'ageGroup', 'platforms',
  'oshiChars', 'spending', 'playStyles', 'playStylesOtherText', 'showGenshinRanking', 'showGenshinCheck',
  'multiFrequency', 'multiFrequencyNote', 'weekdayTimes', 'weekendTimes', 'inviteStyle',
  'vc', 'vcNote', 'vcApps', 'vcDiscordId', 'vcLineId', 'vcAppsOtherText',
  'casualOk', 'jokingOk', 'yuriOk', 'fujoshiOk', 'roughTalk', 'sameOshiReject', 'sameOshiChars',
  'twitterId', 'tiktokId', 'lineId', 'instagramId',
  'friendPreference',
];

// カード上でチップをカテゴリー別の枠で区切って表示するためのグループ分け。
// フォームの見出し(基本情報/あなたについて/連絡・時間帯/ボイスチャット/つながれるSNS)と対応させている。
// genshinUid/displayName/serverはヘッダー側で個別描画、friendPreferenceはチップに出さないため、
// どちらもここには含めない。
export const FIELD_GROUPS = [
  { key: 'basic', fields: ['adventureRank', 'worldLevel', 'gender', 'ageGroup', 'platforms'] },
  { key: 'style', fields: ['oshiChars', 'spending', 'playStyles', 'playStylesOtherText', 'showGenshinRanking', 'showGenshinCheck'] },
  { key: 'contact', fields: ['multiFrequency', 'multiFrequencyNote', 'weekdayTimes', 'weekendTimes', 'inviteStyle'] },
  { key: 'voice', fields: ['vc', 'vcNote', 'vcApps', 'vcDiscordId', 'vcLineId', 'vcAppsOtherText', 'casualOk', 'jokingOk', 'yuriOk', 'fujoshiOk', 'roughTalk', 'sameOshiReject', 'sameOshiChars'] },
  { key: 'sns', fields: ['twitterId', 'tiktokId', 'lineId', 'instagramId'] },
];

// playStylesの値のうち「手伝います！」「手伝ってください！」枠に属するもの一覧。
// フォーム側の枠分け(index.html)・カード表示側の枠分け(board.js)の両方で使う。
export const PLAYSTYLE_OFFER_VALUES = ['canHelpExplore', 'canHelpBuild', 'canHelpDomain', 'canHelpIllusive', 'canHelpAchievements', 'canHelpQuestions'];
export const PLAYSTYLE_REQUEST_VALUES = ['needExploreHelp', 'needFarmHelp', 'needDomainHelp', 'needIllusiveHelp', 'wantAchievements', 'needQuestions'];

// SNSは「公開」を選ばせず、非公開/承認後に公開/仲良くなったら の3択にする対象
export const NO_PUBLIC_FIELDS = ['twitterId', 'tiktokId', 'lineId', 'instagramId'];

// フォームに公開設定セレクトを出さず、常に固定値にする項目
const FIXED_VISIBILITY = {
  genshinUid: 'approval',
  displayName: 'approval',
  playStyles: 'public',
  playStylesOtherText: 'public',
  showGenshinRanking: 'public',
  showGenshinCheck: 'public',
  vcDiscordId: 'approval',
  vcLineId: 'approval',
  vcAppsOtherText: 'approval',
  casualOk: 'public',
  jokingOk: 'public',
  yuriOk: 'public',
  fujoshiOk: 'public',
  roughTalk: 'public',
  sameOshiReject: 'public',
  sameOshiChars: 'public',
};

// 既定の公開設定。genshinUidは常に承認制で固定(フォームにセレクトを出していない)。
// 名前も承認後に公開が初期値。性別は非公開始まり、SNSは承認後に公開始まり、他は公開始まり。
export function defaultVisibility() {
  const v = {};
  VISIBILITY_FIELDS.forEach((k) => {
    if (FIXED_VISIBILITY[k]) v[k] = FIXED_VISIBILITY[k];
    else if (k === 'gender') v[k] = 'hidden';
    else if (NO_PUBLIC_FIELDS.includes(k)) v[k] = 'approval';
    else v[k] = 'public';
  });
  return v;
}

// 固定項目は、以前の入力やFirestore上の古い値に関わらず常にこの値へ矯正する
// (例: playStylesが以前は選べていた「承認制」等が過去に保存されているケースの救済)。
export function normalizeVisibility(visibility) {
  Object.keys(FIXED_VISIBILITY).forEach((k) => { visibility[k] = FIXED_VISIBILITY[k]; });
  return visibility;
}

const FIELD_LABELS = {
  genshinUid: { ja: '原神UID', en: 'Genshin UID' },
  displayName: { ja: '名前', en: 'Name' },
  server: { ja: 'サーバー', en: 'Server' },
  adventureRank: { ja: '冒険者ランク', en: 'Adventure Rank' },
  worldLevel: { ja: '世界ランク', en: 'World Level' },
  gender: { ja: '性別', en: 'Gender' },
  ageGroup: { ja: '年齢', en: 'Age' },
  platforms: { ja: 'ハード', en: 'Platform' },
  oshiChars: { ja: '推しキャラ', en: 'Favorite Characters' },
  spending: { ja: '課金スタンス', en: 'Spending' },
  playStyles: { ja: 'マルチで何をしたい？', en: 'What do you want to do in multiplayer?' },
  playStylesOtherText: { ja: 'マルチその他詳細', en: 'Multiplayer other details' },
  showGenshinRanking: { ja: '原神推しキャラランキング', en: 'Genshin Character Ranking' },
  showGenshinCheck: { ja: '原神チェックシート', en: 'Genshin Check Sheet' },
  inviteStyle: { ja: 'マルチ自発について', en: 'Taking initiative in multiplayer' },
  multiFrequency: { ja: 'マルチ頻度', en: 'Multiplayer Frequency' },
  multiFrequencyNote: { ja: 'マルチ頻度の詳細', en: 'Multiplayer frequency details' },
  vc: { ja: 'VC(ボイスチャット)', en: 'Voice Chat' },
  vcNote: { ja: 'VC相談の詳細', en: 'VC details' },
  vcApps: { ja: 'VC利用アプリ', en: 'VC App' },
  vcDiscordId: { ja: 'Discord ID', en: 'Discord ID' },
  vcLineId: { ja: 'LINE ID', en: 'LINE ID' },
  vcAppsOtherText: { ja: 'その他アプリ名', en: 'Other app name' },
  twitterId: { ja: 'ツイッターID', en: 'X (Twitter) ID' },
  tiktokId: { ja: 'TikTok ID', en: 'TikTok ID' },
  lineId: { ja: 'LINE ID', en: 'LINE ID' },
  instagramId: { ja: 'Instagram ID', en: 'Instagram ID' },
  weekdayTimes: { ja: '平日のマルチ可能時間帯', en: 'Weekday availability' },
  weekendTimes: { ja: '休日のマルチ可能時間帯', en: 'Weekend availability' },
  casualOk: { ja: 'タメ口', en: 'Casual speech' },
  jokingOk: { ja: 'おふざけOK', en: 'Joking around OK' },
  yuriOk: { ja: '百合いけます', en: 'OK with yuri (girls’ love)' },
  fujoshiOk: { ja: '腐いけます', en: 'OK with BL (boys’ love)' },
  roughTalk: { ja: '暴言', en: 'Rough language' },
  sameOshiReject: { ja: '同担拒否', en: 'Same-favorite rejection' },
  sameOshiChars: { ja: '同担拒否キャラ', en: 'Rejected characters' },
  friendPreference: { ja: 'どういうフレンドがほしい？', en: 'What kind of friend are you looking for?' },
};

export function fieldLabel(key, lang) {
  const l = FIELD_LABELS[key];
  return l ? (lang === 'en' ? l.en : l.ja) : key;
}

const OPTION_LABELS = {
  server: {
    asia: { ja: 'Asia', en: 'Asia' },
    america: { ja: 'America', en: 'America' },
    europe: { ja: 'Europe', en: 'Europe' },
    sar: { ja: 'TW,HK,MO', en: 'TW,HK,MO' },
  },
  gender: {
    male: { ja: '男性', en: 'Male' },
    female: { ja: '女性', en: 'Female' },
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
    callOnly: { ja: '通話しながら各々プレイしたい！', en: 'Want to play separately while on call!' },
    canHelpExplore: { ja: '探索', en: 'Explore' },
    wantPhotos: { ja: '写真撮影しよう！', en: "Let's take photos!" },
    wantElites: { ja: '精鋭狩りしたい！', en: 'Want to hunt elites!' },
    canHelpBuild: { ja: '育成素材集め', en: 'Farm ascension materials' },
    canHelpDomain: { ja: '秘境周回', en: 'Farm domains' },
    canHelpIllusive: { ja: '幽境の激戦', en: "Illusive Realm's Trounce Domain" },
    canHelpAchievements: { ja: 'アチーブ取り', en: 'Achievements' },
    canHelpQuestions: { ja: '相談・質問乗ります！', en: "I'll take your questions!" },
    needIllusiveHelp: { ja: '幽境の激戦', en: "Illusive Realm's Trounce Domain" },
    wantAchievements: { ja: 'アチーブ取り', en: 'Achievements' },
    wantJokeMulti: { ja: 'おふざけマルチしたい！', en: 'Want a goofy multiplayer session!' },
    other: { ja: 'その他', en: 'Other' },
    needExploreHelp: { ja: '探索', en: 'Explore' },
    needFarmHelp: { ja: '育成素材集め', en: 'Farm ascension materials' },
    needQuestions: { ja: 'わからないことが多いので質問させて！', en: "I have lots of questions, let me ask!" },
    needDomainHelp: { ja: '秘境周回', en: 'Farm domains' },
  },
  inviteStyle: {
    invite: { ja: 'お誘いします！', en: "I'll invite you!" },
    either: { ja: 'お誘いするしお誘いされたい', en: "I'll invite, and I'm happy to be invited too" },
    invited: { ja: '自発苦手です', en: "Not great at taking initiative" },
  },
  casualOk: {
    love: { ja: 'タメ口大歓迎', en: 'Love casual speech' },
    ok: { ja: 'タメ口OK', en: 'Casual speech OK' },
    either: { ja: 'どっちでもOK', en: 'Either is fine' },
    no: { ja: 'タメ口なし', en: 'No casual speech' },
  },
  roughTalk: {
    no: { ja: '暴言NG', en: 'No rough language' },
    yes: { ja: '暴言出ます', en: 'I use rough language' },
  },
  sameOshiReject: {
    no: { ja: '同担拒否なし', en: 'No same-favorite rejection' },
    yes: { ja: '同担拒否あり', en: 'Same-favorite rejection' },
  },
  multiFrequency: {
    biweekly: { ja: '隔週1回くらい', en: 'About once every 2 weeks' },
    week1: { ja: '週1くらい', en: 'About once a week' },
    week2to3: { ja: '週2～3くらい', en: 'About 2-3 times/week' },
    week4to5: { ja: '週4～5くらい', en: 'About 4-5 times/week' },
    week6to7: { ja: '週6～7くらい', en: 'About 6-7 times/week' },
    daily: { ja: '毎日やりたい！', en: 'Want to play every day!' },
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
  friendPreference: {
    sameGender: { ja: '同性のフレンドがほしい', en: 'Looking for a same-gender friend' },
    anyGender: { ja: '男女問わずフレンドがほしい', en: "Gender doesn't matter" },
    wantPartner: { ja: '恋人がほしい', en: 'Looking for a romantic partner' },
    wantOshiFriend: { ja: '推し活友達がほしい', en: 'Looking for a fellow fan friend' },
    chatOnly: { ja: 'マルチしない雑談通話でも可', en: 'OK with just chatting, no multiplayer' },
    vcNotNeeded: { ja: 'VCなしでも大丈夫', en: 'OK without VC' },
    workCallOk: { ja: '作業通話だけの参加でもOK', en: 'OK with just hanging out on call without playing' },
  },
};

const DAY_LABELS = {
  mon: { ja: '月', en: 'Mon' },
  tue: { ja: '火', en: 'Tue' },
  wed: { ja: '水', en: 'Wed' },
  thu: { ja: '木', en: 'Thu' },
  fri: { ja: '金', en: 'Fri' },
  sat: { ja: '土', en: 'Sat' },
  sun: { ja: '日', en: 'Sun' },
};

function optionLabel(key, value, lang) {
  const group = OPTION_LABELS[key];
  if (!group) return String(value);
  const l = group[value];
  return l ? (lang === 'en' ? l.en : l.ja) : String(value);
}

// 項目の選択肢一覧を{value, label}の配列で返す(検索フィルターUIの動的生成用)。
// 選択肢が無い項目(OPTION_LABELSに定義が無い)には空配列を返す。
export function fieldOptions(key, lang) {
  const group = OPTION_LABELS[key];
  if (!group) return [];
  return Object.keys(group).map((value) => ({ value, label: optionLabel(key, value, lang) }));
}

function isEmptyValue(v) {
  if (Array.isArray(v)) return v.length === 0;
  if (v && typeof v === 'object') {
    if ('start' in v || 'end' in v) return !v.start && !v.end;
    // 曜日単位の時間帯({月: {start,end,active}, ...}): 有効な曜日が1つも無ければ空
    return Object.values(v).every((d) => !d || d.active === false || (!d.start && !d.end));
  }
  return v === '' || v == null;
}

// 公開設定(visibility)に応じて値を振り分ける。募集の投稿時、申請時のどちらでも使う
// (どちらも「承認するまでapproval項目は相手に見せない」という同じルールのため)。
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
    if (vis === 'hidden' || vis === 'closeFriend') return;
    if (vis === 'approval') {
      secretFieldKeys.push(key);
    } else {
      publicFields[key] = value;
    }
  });
  return { publicFields, secretFieldKeys };
}

// 値としては違うが相性が良い(非対称に噛み合う)組み合わせ。
// 例: マルチ自発について「お誘いします！」⇔「自発苦手です(誘われたい)」は
// 同じ値ではないが、誘う側と誘われたい側でちょうど噛み合うため好相性として扱う。
export const COMPLEMENTARY_VALUE_PAIRS = {
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
// 呼び出し側で色分け表示に使う(さがす一覧・申請タブどちらのチップ表示からも使う)。
// 時間帯({start,end})や数値(AR/WLなど)は曖昧になりすぎるため判定対象外(常にnull)。
export function fieldMatchKind(myValue, otherValue, key) {
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
// myValues(自分のplayStyles配列)のどれかと完全一致するか、相性ペアの相手側を持っているかを見る。
export function playStyleValueMatchKind(myValues, otherValue) {
  const mine = myValues || [];
  if (mine.includes(otherValue)) return 'exact';
  const pairs = COMPLEMENTARY_VALUE_PAIRS.playStyles || [];
  const isComplementary = pairs.some(([a, b]) => (
    (otherValue === a && mine.includes(b)) || (otherValue === b && mine.includes(a))
  ));
  return isComplementary ? 'complementary' : null;
}

// 「どういうフレンドがほしい？」のマッチ度を計算する。
// myPrefs: 自分のfriendPreference配列, myGender: 自分の性別
// candidate: 相手側の公開フィールド一式相当のオブジェクト(gender/vc/friendPreferenceを含む)
// 判定できる項目が1つも無ければnullを返す(マッチ度を表示しない)。
// 「男女問わず」「マルチしない雑談通話でも可」「VCなしでも大丈夫」は制限を課さない
// 宣言のみの項目なので採点対象にしない。
export function computeFriendMatch(myPrefs, myGender, candidate) {
  if (!Array.isArray(myPrefs) || !myPrefs.length) return null;
  const candidatePrefs = Array.isArray(candidate.friendPreference) ? candidate.friendPreference : [];
  let total = 0;
  let matched = 0;

  myPrefs.forEach((pref) => {
    if (pref === 'sameGender') {
      if (candidate.gender) {
        total++;
        if (candidate.gender === myGender) matched++;
      }
      return;
    }
    if (pref === 'wantPartner' || pref === 'wantOshiFriend') {
      total++;
      if (candidatePrefs.includes(pref)) matched++;
      return;
    }
    // anyGender / chatOnly / vcNotNeeded は宣言のみのため採点しない
  });

  if (total === 0) return null;
  return Math.round((matched / total) * 100);
}

// 保存されている値(文字列/配列/真偽値/数値/{start,end})を画面表示用の文字列に整形する。
// oshiCharsだけはアイコン画像なのでここでは扱わず、呼び出し側でアイコン表示する。
export function formatFieldValue(key, value, lang) {
  if (isEmptyValue(value)) return '';
  if (key === 'jokingOk' || key === 'yuriOk' || key === 'fujoshiOk') {
    return value ? 'OK' : '';
  }
  if (key === 'ageGroup') {
    return value ? (lang === 'en' ? "Adult (confirmed)" : '成人済') : '';
  }
  if (key === 'sameOshiReject' && typeof value === 'boolean') {
    // 過去は真偽値で保存されていたため(まだ再保存していない他ユーザーの投稿に残る)、
    // ここでも新しい選択肢の文言に変換して表示する
    return value ? optionLabel(key, 'yes', lang) : '';
  }
  if (key === 'adventureRank') return String(value);
  if (key === 'worldLevel') return String(value);
  if (key === 'weekdayTimes' || key === 'weekendTimes') {
    if ('start' in value || 'end' in value) {
      return `${value.start || '?'} ~ ${value.end || '?'}`;
    }
    // 曜日単位: 入力済みの曜日だけを「月 20:00~24:00」のように並べる
    const order = key === 'weekdayTimes' ? ['mon', 'tue', 'wed', 'thu', 'fri'] : ['sat', 'sun'];
    return order
      .filter((d) => value[d] && value[d].active !== false && (value[d].start || value[d].end))
      .map((d) => `${DAY_LABELS[d][lang === 'en' ? 'en' : 'ja']} ${value[d].start || '?'}~${value[d].end || '?'}`)
      .join(lang === 'en' ? ', ' : '、');
  }
  if (key === 'multiFrequency' && Array.isArray(value)) {
    // 曜日単位: 選んだ曜日だけを「月、水、金」のように並べる
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      .filter((d) => value.includes(d))
      .map((d) => DAY_LABELS[d][lang === 'en' ? 'en' : 'ja'])
      .join(lang === 'en' ? ', ' : '、');
  }
  if (Array.isArray(value)) {
    if (!value.length) return '';
    return value.map((v) => optionLabel(key, v, lang)).join(lang === 'en' ? ', ' : '、');
  }
  return optionLabel(key, value, lang);
}
