// scripts/seedTestData.mjs
// 「さがす」一覧・申請機能を手動テストするためのダミーデータをFirestoreへ流し込む開発用スクリプト。
// サイト自体からは読み込まれない(index.htmlに参照なし)。
//
// 使い方: プロジェクトルートで `node scripts/seedTestData.mjs` を実行する。
// 何度実行しても安全(冪等)。実行の度に、前回このスクリプトが作った
// friendBoardPosts(id: seedtest_*) / friendBoardApplications(id: seedtest_app_*) を
// 全て削除してから、新しいテストデータを作り直す。それ以外の実データ・個人のテスト
// プロフィールには一切触れない。
//
// 認証を経由しないFirestore REST APIを、サイトが使っているのと同じ公開APIキーで叩く
// (このプロジェクトのFirestoreセキュリティルールが未認証の読み書きを許可しているため、
// サイト自体もFirebase Authなしでpost/applyできる。詳しくはfirebaseConfig.js参照)。

import { buildPostFieldBuckets, defaultVisibility } from '../fields.js';

const PROJECT_ID = 'genshin-bakatare01';
const API_KEY = 'AIzaSyCP4QfMGDDBSI8VDERnESBOlHpUhy7wGPk';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const POST_COUNT = 50;

// ===== Firestore REST の型付きJSON変換 =====
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    Object.entries(v).forEach(([k, val]) => { fields[k] = toFirestoreValue(val); });
    return { mapValue: { fields } };
  }
  throw new Error(`unsupported value type: ${typeof v}`);
}
function toFirestoreFields(obj) {
  const fields = {};
  Object.entries(obj).forEach(([k, v]) => { fields[k] = toFirestoreValue(v); });
  return fields;
}

async function listDocIds(collection) {
  const ids = [];
  let pageToken;
  do {
    const url = new URL(`${BASE}/${collection}`);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('pageSize', '300');
    url.searchParams.set('mask.fieldPaths', '__name__'); // 中身は不要、IDだけ欲しい
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url);
    const data = await res.json();
    (data.documents || []).forEach((d) => ids.push(d.name.split('/').pop()));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

async function deleteDocs(collection, ids) {
  for (const id of ids) {
    const url = `${BASE}/${collection}/${id}?key=${API_KEY}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) console.error(`delete failed: ${collection}/${id}`, await res.text());
  }
}

async function putDoc(collection, id, fieldsObj) {
  const url = `${BASE}/${collection}/${id}?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(fieldsObj) }),
  });
  if (!res.ok) console.error(`write failed: ${collection}/${id}`, await res.text());
}

// ===== テストデータのバリエーション素材 =====
const NAME_POOL = [
  'ソラ', 'ユキ', 'カエデ', 'ヒカリ', 'ミナト', 'ツバサ', 'アヤメ', 'レン', 'ハル', 'フウカ',
  'ノア', 'リン', 'アオイ', 'コハク', 'シオン', 'マヒロ', 'ユウナ', 'カイト', 'ミオ', 'ソウマ',
];
const COMMENT_POOL = [
  '無言加入歓迎！まったり長く遊べるフレンドさん募集中です。',
  '毎日ログインしてます。デイリーだけの絡みでもOK！',
  '腐女子です、そういう話もできる人だと嬉しいです。',
  'エンドコンテンツ一緒に周ってくれる人探してます！',
  '雑談メインでVC繋ぎながらまったりしたいです。',
  '他ゲー（スタレ）のフレンドも募集中！',
  '幻想シアター/激戦攻略を手伝ってほしいです。',
  '推し活友達がほしいです！同じ担当いたら語りましょう。',
  '暴言NG、優しい人と長く仲良くしたいです。',
  '写真撮影・観光地巡りが好きです、一緒に周りましょう！',
  '土日は時間取れるので誘ってもらえると嬉しいです。',
  'ソロ活動多めですが、たまにマルチもしたいです。',
  '同担拒否ありです、プロフィール見てから申請してください。',
  '成人済みです、下ネタOKな人歓迎！',
  '初心者なので色々教えてもらえると助かります。',
];
// genshin_chars.js(CDN)の実際のicon値と1文字も違わず一致させること。
// 大半は先頭大文字のローマ字だが、一部だけ小文字/日本語のものが混ざっており、
// 単純なcamelCase化では作れないため、実データから確認した値をそのまま書き写す。
const OSHI_ICON_POOL = [
  'Furina.png', 'Nahida.png', 'Hutao.png', 'Raiden.png', 'Zhongli.png',
  'Yelan.png', 'Xiao.png', 'AyakaKamisato.png', 'Klee.png', 'Venti.png',
  'Mavuika.png', 'Arlecchino.png', 'niko.png', 'arisu.png', 'dorin.png',
];
const PLAYSTYLE_POOL = [
  'callOnly', 'wantPhotos', 'wantElites', 'wantJokeMulti',
  'canHelpExplore', 'canHelpBuild', 'canHelpDomain', 'canHelpIllusive', 'canHelpAchievements', 'canHelpQuestions',
  'needExploreHelp', 'needFarmHelp', 'needDomainHelp', 'needIllusiveHelp', 'wantAchievements', 'needQuestions',
];
const FRIEND_PREF_POOL = ['sameGender', 'anyGender', 'wantPartner', 'wantOshiFriend', 'vcNotNeeded', 'workCallOk', 'discordServer'];
const SNS_HANDLE_POOL = ['@genshin_tabi', '@uho_uho77', '@teyvat_life', '@moko_prpr', '@travelerJP'];

function pick(pool, n, offset) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[(offset + i) % pool.length]);
  return out;
}

function buildPersona(i) {
  const n = i + 1; // 1-indexed
  const gender = n % 2 === 0 ? 'female' : 'male';
  const server = n <= 40 ? 'asia' : ['america', 'europe', 'sar'][n % 3];
  const useByDayFreq = n % 5 === 0;
  const useByDayTimes = n % 4 === 0;
  const vc = ['yes', 'no', 'maybe'][n % 3];

  const values = {
    displayName: `${NAME_POOL[n % NAME_POOL.length]}${n}`,
    genshinUid: String(900000000 + n),
    server,
    adventureRank: 20 + (n * 3) % 41, // 20〜60
    worldLevel: (n % 9),
    gender,
    ageGroup: n % 11 !== 0, // たまにfalse(未回答)を混ぜる
    platforms: pick(['pc', 'mobile', 'tablet', 'ps5', 'other'], 1 + (n % 3), n),
    oshiChars: pick(OSHI_ICON_POOL, 1 + (n % 3), n),
    spending: ['f2p', 'light', 'heavy'][n % 3],
    playStyles: pick(PLAYSTYLE_POOL, 2 + (n % 4), n),
    playStylesOtherText: '',
    showGenshinRanking: n % 6 === 0,
    showGenshinCheck: n % 7 === 0,
    multiFrequency: useByDayFreq
      ? pick(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 2 + (n % 3), n)
      : ['biweekly', 'week1', 'week2to3', 'week4to5', 'week6to7', 'daily', 'ask'][n % 7],
    multiFrequencyNote: (!useByDayFreq && n % 7 === 6) ? '土日は頻度高めです' : '',
    weekdayTimes: useByDayTimes
      ? { mon: { start: '20:00', end: '24:00', active: true }, wed: { start: '21:00', end: '23:00', active: true } }
      : { start: `${18 + (n % 4)}:00`, end: `${22 + (n % 2)}:00` },
    weekendTimes: useByDayTimes
      ? { sat: { start: '14:00', end: '24:00', active: true }, sun: { start: '14:00', end: '22:00', active: true } }
      : { start: `${12 + (n % 6)}:00`, end: `${22 + (n % 2)}:00` },
    inviteStyle: ['invite', 'either', 'invited'][n % 3],
    vc,
    vcNote: vc === 'maybe' ? '基本可能ですが夜勤があるので不定期です' : '',
    vcApps: vc === 'no' ? [] : pick(['discord', 'line', 'other'], 1 + (n % 2), n),
    vcDiscordId: vc !== 'no' && n % 2 === 0 ? `uko_test${n}#0000` : '',
    vcLineId: vc !== 'no' && n % 3 === 0 ? `line_test_${n}` : '',
    vcAppsOtherText: vc !== 'no' && n % 5 === 0 ? `Zoom: test${n}` : '',
    casualOk: n % 4 === 0 ? '' : ['love', 'ok', 'either', 'no'][n % 4],
    jokingOk: n % 3 === 0,
    yuriOk: n % 6 === 0,
    fujoshiOk: n % 6 === 3,
    roughTalk: n % 5 === 0 ? '' : (n % 2 === 0 ? 'no' : 'yes'),
    sameOshiReject: n % 4 === 0 ? '' : (n % 2 === 0 ? 'no' : 'yes'),
    sameOshiChars: (n % 2 === 1) ? pick(OSHI_ICON_POOL, 1 + (n % 2), n + 5) : [],
    twitterId: n % 3 === 0 ? SNS_HANDLE_POOL[n % SNS_HANDLE_POOL.length] : '',
    tiktokId: n % 4 === 0 ? SNS_HANDLE_POOL[(n + 1) % SNS_HANDLE_POOL.length] : '',
    lineId: n % 5 === 0 ? `test_line_${n}` : '',
    instagramId: n % 6 === 0 ? SNS_HANDLE_POOL[(n + 2) % SNS_HANDLE_POOL.length] : '',
    friendPreference: pick(FRIEND_PREF_POOL, 1 + (n % 3), n),
  };

  return { n, comment: COMMENT_POOL[n % COMMENT_POOL.length], values };
}

async function seedPosts() {
  console.log('--- friendBoardPosts: 既存のseedtest_*を削除 ---');
  const existingIds = await listDocIds('friendBoardPosts');
  const toDelete = existingIds.filter((id) => id.startsWith('seedtest_'));
  console.log(`削除対象: ${toDelete.length}件`);
  await deleteDocs('friendBoardPosts', toDelete);

  console.log(`--- friendBoardPosts: ${POST_COUNT}件を新規作成 ---`);
  const personas = [];
  for (let i = 0; i < POST_COUNT; i++) {
    const persona = buildPersona(i);
    const visibility = defaultVisibility();
    const { publicFields, secretFieldKeys } = buildPostFieldBuckets(persona.values, visibility);
    const id = `seedtest_${String(persona.n).padStart(2, '0')}`;
    const doc = {
      userId: id,
      comment: persona.comment,
      avatarGame: null,
      avatarIcon: null,
      publicFields,
      secretFieldKeys,
      requiresApproval: secretFieldKeys.length > 0,
      active: true,
      createdAt: new Date(),
    };
    await putDoc('friendBoardPosts', id, doc);
    personas.push({ id, ...persona, publicFields, secretFieldKeys });
  }
  console.log('done.');
  return personas;
}

// ===== 申請データ(message/ownerReply/承認前後の公開ルールの検証用) =====
// REAL_PROFILE_IDS: 手動テスト用に既に存在する、あなた自身のプロフィール(userId)。
// どのアカウントでサイトを開いても「届いた申請」「送った申請」に何かしら表示されるよう、
// 全員ぶんに受信・送信の両方を用意する。
const REAL_PROFILE_IDS = [
  'u_98161cf62727f133496de6d7f974c5b8',
  'u_1b6f98a7e2cc3da240e4b58e27569a25',
  'u_da5a88bc89e207961d04887402d62e50',
  'u_ea650affe48d31eb21e5308a46cfe586',
];
// 実プロフィールの実際のsecretFieldKeys(Firestoreの現状から確認済み)。
// 承認前は値を書かないので、この一覧をpostSecretFieldKeysにそのまま使って良い。
const REAL_PROFILE_SECRET_KEYS = {
  'u_98161cf62727f133496de6d7f974c5b8': ['genshinUid', 'displayName', 'tiktokId', 'lineId', 'instagramId'],
  'u_1b6f98a7e2cc3da240e4b58e27569a25': ['genshinUid', 'displayName', 'twitterId', 'tiktokId'],
  'u_da5a88bc89e207961d04887402d62e50': ['genshinUid', 'displayName', 'vcDiscordId', 'vcLineId', 'vcAppsOtherText', 'twitterId', 'tiktokId', 'lineId', 'instagramId'],
  'u_ea650affe48d31eb21e5308a46cfe586': ['genshinUid', 'displayName', 'twitterId'],
};
// 同じく実プロフィールの実際のcomment(空の場合は「募集:」欄が分かりやすいようダミー文言を使う)。
const REAL_PROFILE_COMMENTS = {
  'u_98161cf62727f133496de6d7f974c5b8': 'ドラフトテスト用コメント',
  'u_1b6f98a7e2cc3da240e4b58e27569a25': '(コメント未設定のテストプロフィールです)',
  'u_da5a88bc89e207961d04887402d62e50': 'yorosiku',
  'u_ea650affe48d31eb21e5308a46cfe586': 'テスト一言！',
};

function fakeApplicantBuckets(seed) {
  // 実プロフィールの生の入力値は分からないので、申請カード表示の検証用にそれらしい値を捏造する。
  const visibility = defaultVisibility();
  const values = {
    displayName: `テスト申請者${seed}`,
    genshinUid: String(800000000 + seed),
    server: 'asia',
    gender: seed % 2 === 0 ? 'female' : 'male',
    ageGroup: true,
    vc: 'yes',
    inviteStyle: 'either',
    multiFrequency: 'week2to3',
    weekdayTimes: { start: '20:00', end: '23:00' },
    weekendTimes: { start: '14:00', end: '22:00' },
    platforms: ['pc'],
  };
  return buildPostFieldBuckets(values, visibility);
}

async function seedApplications(personas) {
  console.log('--- friendBoardApplications: 既存のseedtest_app_*を削除 ---');
  const existingIds = await listDocIds('friendBoardApplications');
  const toDelete = existingIds.filter((id) => id.startsWith('seedtest_app_'));
  console.log(`削除対象: ${toDelete.length}件`);
  await deleteDocs('friendBoardApplications', toDelete);

  const byId = (id) => personas.find((p) => p.id === id);
  const postFor = (id) => byId(id) || { comment: '(テスト投稿)', publicFields: {}, secretFieldKeys: [] };

  // [postOwnerUserId, applicantUserId, status, message, ownerReply, includeApplicantSecret]
  const scenarios = [
    // 各実プロフィールへ「届いた申請」(seed投稿者から実プロフィールへ)
    [REAL_PROFILE_IDS[0], 'seedtest_01', 'pending', '', '', false],
    [REAL_PROFILE_IDS[0], 'seedtest_02', 'pending', 'よろしくお願いします！プロフィール拝見して気になりました。', '', true],
    [REAL_PROFILE_IDS[1], 'seedtest_03', 'pending', 'マルチ頻度近そうなので申請しました！', '', true],
    [REAL_PROFILE_IDS[1], 'seedtest_04', 'accepted', '', '', false],
    [REAL_PROFILE_IDS[2], 'seedtest_05', 'accepted', 'はじめまして、よろしくお願いします！', 'こちらこそよろしくお願いします！', true],
    [REAL_PROFILE_IDS[2], 'seedtest_06', 'rejected', 'よろしくお願いします', '', false],
    [REAL_PROFILE_IDS[3], 'seedtest_07', 'pending', '', '', true],
    [REAL_PROFILE_IDS[3], 'seedtest_08', 'accepted', '推し活友達募集中とのことで申請しました！', '', true],

    // 各実プロフィールが送った「送った申請」(実プロフィールからseed投稿者へ)
    [ 'seedtest_09', REAL_PROFILE_IDS[0], 'pending', 'こんにちは、気になったので申請しました！', '', false],
    [ 'seedtest_10', REAL_PROFILE_IDS[1], 'accepted', '', '相手からの返信テストです、よろしく！', false],
    [ 'seedtest_11', REAL_PROFILE_IDS[2], 'rejected', 'よろしくお願いします', '', false],
    [ 'seedtest_12', REAL_PROFILE_IDS[3], 'accepted', 'マルチ一緒にどうですか？', 'ぜひやりましょう！', false],
  ];

  console.log(`--- friendBoardApplications: ${scenarios.length}件を新規作成 ---`);
  let idx = 0;
  for (const [ownerId, applicantId, status, message, ownerReply, includeApplicantSecret] of scenarios) {
    idx++;
    const id = `seedtest_app_${String(idx).padStart(2, '0')}`;
    const post = postFor(ownerId);
    const isApplicantReal = REAL_PROFILE_IDS.includes(applicantId);
    const isOwnerReal = REAL_PROFILE_IDS.includes(ownerId);

    // 申請者側のフィールド。seed投稿者ならその投稿データをそのまま流用、実プロフィールなら捏造する。
    const applicantPersona = isApplicantReal ? null : byId(applicantId);
    const { publicFields: applicantFields, secretFieldKeys: applicantSecretFieldKeys } = applicantPersona
      ? { publicFields: applicantPersona.publicFields, secretFieldKeys: applicantPersona.secretFieldKeys }
      : fakeApplicantBuckets(idx);
    const applicantSecretFields = {};
    if (includeApplicantSecret) {
      applicantSecretFieldKeys.forEach((key) => {
        if (key === 'genshinUid') applicantSecretFields[key] = String(700000000 + idx);
        else if (key === 'displayName') applicantSecretFields[key] = `テスト表示名${idx}`;
      });
    }

    const ownerSecretKeys = isOwnerReal ? REAL_PROFILE_SECRET_KEYS[ownerId] : post.secretFieldKeys;
    const revealedFields = {};
    if (status === 'accepted') {
      // 承認済みなら、募集主側の承認後公開項目もそれらしく埋めておく(見た目確認用)。
      ownerSecretKeys.forEach((key) => {
        if (key === 'genshinUid') revealedFields[key] = String(600000000 + idx);
        else if (key === 'displayName') revealedFields[key] = `テスト募集主${idx}`;
      });
    }

    const doc = {
      postId: ownerId,
      postComment: isOwnerReal ? REAL_PROFILE_COMMENTS[ownerId] : post.comment,
      postOwnerUserId: ownerId,
      postOwnerAvatarGame: null,
      postOwnerAvatarIcon: null,
      postSecretFieldKeys: ownerSecretKeys,
      revealedFields,

      applicantUserId: applicantId,
      applicantFields,
      applicantSecretFieldKeys,
      applicantSecretFields,
      applicantAvatarGame: null,
      applicantAvatarIcon: null,
      message,

      status,
      ownerSeen: status !== 'pending',
      applicantSeen: status === 'pending',
      ownerReply,

      createdAt: new Date(Date.now() - idx * 3600_000),
      respondedAt: status === 'pending' ? null : new Date(),
    };
    await putDoc('friendBoardApplications', id, doc);
  }
  console.log('done.');
}

const personas = await seedPosts();
await seedApplications(personas);
console.log('=== 全て完了しました ===');
