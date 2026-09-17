# ＃原神フレンド承認板 — 開発メモ

静的サイト（ビルド無し、ESモジュール直読み）。Firestoreがバックエンド。
ここには「コードを読むだけでは分かりにくい設計判断・落とし穴」だけを書く。
普通に読めば分かること（ファイル構成、関数の役割など）は書かない。

## 運用ルール
- 修正するたびに `index.html` の `#site-version` を1つ上げる。
- 同時に `index.html` の `<link rel="stylesheet" href="styles.css?v=X.X">` の
  クエリパラメータも同じ番号に揃える（CSSだけキャッシュが古いまま反映されない
  症状が実際にあったため。styles.cssを変更した時だけでなく、version番号を
  上げる時は毎回揃えておくと安全）。
- 修正するたびに commit + push まで行う（確認を挟まない）。

## データモデルの前提
- `friendBoardPosts/{userId}`：1ユーザー1ドキュメント固定。募集フォームの保存は
  常に `setDoc`（丸ごと上書き）なので、`createdAt` は実質「最終保存日時」であり
  本当の初回作成日時ではない。
- `lastActiveAt`：投稿の「アクティブ度」用の別フィールド。保存時／マイプロフの
  「更新する」ボタン／他の投稿への申請／チャット送信、のいずれかで更新される。
  `POST_STALE_MS`（30日, board.js）を過ぎると探す一覧から自動的に除外される
  （`isPostFresh()`）。本人のマイプロフ画面には出続けるので、いつでも復活可能。
- `computeFriendMatch`（fields.js）による「マッチ度」は、v12.6でバッジ表示を
  廃止した（0%と出ると申請しづらいという理由）。ただし`renderSearchList`の
  `.sort()`では引き続き計算・使用しており、探す一覧の並び順（マッチ度が高い人
  ほど上）にだけ生きている。数値を画面に一切出さないので、一見「計算している
  のに使っていない」ように見えるが意図的。QRなどの個別プロフィール表示
  （`renderViewProfilePanel`）では並び替えの意味がないため、そもそも計算すら
  していない。
- `matchesGenderPreference`（fields.js, v12.13追加）は、`friendPreference`の
  同性/異性/男女問わずの3項目**だけ**を対象にした、`computeFriendMatch`とは別の
  ハードフィルター（`computeFriendMatch`はスコアで並び替えるだけで除外はしない
  が、こちらは`renderSearchList`の`.filter()`側に入っていて実際に一覧から消す）。
  判定は**双方向**：自分の希望×相手の性別、かつ相手の希望×自分の性別の両方を
  満たす人だけ通す（例: 自分が「同性のフレンドがほしい」を選んでいても、相手が
  「異性のフレンドがほしい」を選んでいれば一覧に出ない）。この3項目を
  **1つも選んでいない場合／「男女問わず」を選んでいる場合／「同性」と「異性」を
  矛盾して両方選んでいる場合**は、そちらの当事者からは無条件で「制限なし」扱いに
  なる（ユーザーからの要望通り、チェックを外せば今まで通り関係なく出る）。
  相手の`gender`が非公開等で取得できない場合も判定不能として素通りさせる
  （誤って隠さない方に倒す）。QRの個別プロフィール表示（`renderViewProfilePanel`）
  には適用していない（一覧の絞り込みだけが対象で、直接共有されたリンクは
  ブロック関係とは違い意図的に対象外）。
- 上記`matchesGenderPreference`のon/off切り替え（v12.14追加、デフォルトoff）は
  「性別相互フィルター」チェックボックスとして、さがす一覧・届いた申請一覧の
  両方の「件数」表示と同じ行に右寄せで置いている（`filterBar.js`の
  `isGenderMutualFilterOn`/`setGenderMutualFilterOn`という**1つの共有フラグ**で、
  どちらの画面で切り替えても同じ状態を指す。他の絞り込み項目
  （`searchFilters`/`receivedFilters`）と同じくセッション内のみでFirestoreには
  保存しない）。`searchFilters`側の絞り込み（フィールド値ベース）とは別枠の
  独立したON/OFFなので、`matchesFilters`とは組み合わせるが混同しないこと。
- `friendBoardApplications/{id}`：申請1件＝1ドキュメント。承認まで、双方の
  「承認後に公開」項目は**お互い完全に隠す**（`buildPostFieldBuckets`を投稿・
  申請どちらの作成時にも対称に使うことで実現。過去に非対称で漏れていたことがある
  ので、ここを触るときは必ず両側で同じ関数を通しているか確認する）。
- `ownerSeen` / `applicantSeen` は**二重の意味**を持つ:
  1. `status: 'pending'` の間 → 「新規申請の通知トーストを出したか」のフラグ
     （届いた申請一覧のバッジ数はこれを見ておらず、`status`だけで数えている）
  2. `status: 'accepted'` 後 → 「やり取り」タブの**未読チャット**フラグとして再利用
     （相手がチャットを送ると `false` に戻り、「やり取り」タブを開くと `true` に戻る）
  この2つの用途は時間的に重ならない（pending中はチャット機能自体が使えない）ため
  実害はないが、将来この2フィールドを見るときは「今どちらの意味で読んでいるか」を
  意識すること。
- `hasAppliedTo(postId)`：`latestSent`はcreatedAt降順なので`.find()`の最初の1件が
  最新の申請。`status==='rejected'`かつ`respondedAt`から`REAPPLY_AFTER_MS`
  （14日, applications.js）経過していれば「未申請」扱いに戻す＝再申請可能。
  `accepted`/`pending`は経過日数を見ずに常にブロックしたまま。

## 申請〜チャットのフロー
- 承認されるまでのやり取りは申請時の一言メッセージ（`message`, 最大150字）のみ。
- 承認後のチャットは`chatMessages`配列に追記していく方式で、LINEのように
  交互発言のルールなく自由に送れる（2026-08-28以前は最大10往復・交互発言必須の
  「ラリー制度」だったが廃止した）。代わりに1日あたりの送信数に上限があり、
  アカウント登録済みかどうかで変わる（未登録1通/日・登録済み10通/日,
  `CHAT_DAILY_LIMIT_UNREGISTERED`/`CHAT_DAILY_LIMIT_REGISTERED`。v12.0で
  登録済み分は20→5に引き下げ、v12.5で5→10に引き上げ）。登録を後押しする狙いなので、会話の
  途中で登録すればその日のうちに上限が上がる。さらに08_UPoint（うーこ
  ポイント交換所）で交換した「チャット送信可能数+5」は
  `omikujiUsers/{userId}.sitePerks.friendBoard.permanentExtraChat`として
  永続加算される（日付リセット無し、何回でも交換可、`myChatDailyLimit()`が
  base+この値を返す。`applications.js`の`startSitePerksListener`）。
  「今日」の判定は各メッセージの`at`(Date.now())をその場のローカル日付の
  0時と比較して行う（`startOfTodayMs()`）。`at`を持たない古いメッセージは
  「今日」に含めない。
- 承認済みの申請は、届いた/送ったの区別なく「やり取り」サブタブに集約される。
  届いた申請／送った申請のサブタブには `pending` と `rejected` だけを表示する。

## ブロック・通報機能（`blocks.js`, `reports.js`, 2026-08-28追加）
- `friendBoardBlocks/{blockerUserId}_{blockedUserId}` に1件書き込むだけの
  シンプルな方式。ブロックは**双方向で完全に非表示**になる（探す一覧／届いた
  申請／送った申請／やり取り／QRの個別プロフィール表示、すべてから消える）。
  裏側の投稿・申請・チャットのデータ自体は削除しない（誤ブロックの復旧、
  通報時に経緯を確認できるようにするため）。ブロックされたことは相手に
  通知しない（LINE/X等と同じ作法）。
- `blocks.js`はboard.js/applications.jsの両方から`initBlocks({getUserId})`が
  呼ばれる想定で、実際のFirestore購読(`onSnapshot`2本)は最初の1回だけ開始する
  （`started`フラグで二重購読を防止）。`onBlocksChange(fn)`で複数箇所から
  再描画をフックできる。
- **重要**: ここでの制御はすべてクライアント側の表示フィルター
  （`isBlocked()`をリスト描画時に見ているだけ）であり、Firestoreの
  セキュリティルールでの強制ではない。ルールファイル自体は
  `24_AccountCenter`リポジトリ（`genshin-bakatare01`プロジェクト、共有
  Firebase）側の`firestore.rules`で管理されており、このリポジトリには無い。
  `friendBoardProfiles`/`friendBoardPosts`は`allow read, write: if true`で
  意図的に全開放されている（匿名運用のサイト群方針に合わせたもので、
  console側の場当たり運用ではなく明示的な設計）。悪意を持って直接Firestoreを
  叩けば理論上は回避できるため、完全なセキュリティ境界ではなく、あくまで
  通常利用時の摩擦（嫌がらせの抑止）としての機能と捉えること。
  **ただし`friendBoardApplications`だけは例外で、`read`こそ`if true`だが
  `update`には`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`
  による更新可能フィールドの許可リストがある**（postId/postOwnerUserId/
  applicantUserIdの改ざん防止と合わせて設定）。そのため
  `applications.js`側でこのドキュメントに新しいフィールドを追記する処理を
  足す時は、`24_AccountCenter/firestore.rules`の許可リストにもそのフィールド名を
  追加してデプロイしないと、Permission Deniedで書き込みが失敗する
  （2026-09-17、`lastChatAt`追加時にこれを忘れてチャット送信が全滅する
  実障害が発生・修正済み）。
- 通報は`friendBoardReports`へ`addDoc`するだけ（`reports.js`の`reportUser`）。
  `chatMessages`は通報時点のスナップショットをコピーして保存するので、後で
  会話が続いても通報時点の内容が変わらず確認できる。
- 管理者用の確認画面（2026-08-28追加, `board.js`の`startAdminReportsListener`/
  `renderAdminReports`）は、`isAdminViewer()`（実体は`getAuthUid() === ADMIN_UID`）
  がtrueの時だけ`#tab-btn-admin`のhiddenを外して表示する新しい4つ目のタブ。
  通報者/被通報者のuserId、理由、関連するpostId/applicationId、通報時点の
  チャット内容スナップショット、「対応済みにする」チェックボックスを表示する。
  あえて「この場で相手をブロックする」ボタンは付けていない
  ——`blockUser()`は常に「今ログイン中の自分」を`blockerUserId`にするため、
  管理者画面から呼んでも管理者自身の一覧から相手が消えるだけで、実際の
  被害者(通報者)を守ることにはならず誤解を招くため。もし本当の意味での
  「利用停止」を実装するなら、`bannedUserIds`のような別のコレクション＋
  各書き込み処理でのチェックが必要になる（未実装、将来必要になったら検討）。
- ユーザー本人からは「ADMIN_UIDというよりは管理者ロール」という表現の方が
  実態に近いという指摘があった（今は単一UIDのハードコードだが、将来複数
  管理者が必要になったらロールベースへの変更を検討すること）。v12.7で
  `ADMIN_UID`は`board.js`から`userData.js`へ移動し`export`した
  （`applications.js`もインポートして使うため。`board.js`が`applications.js`を
  importする関係上、逆方向のimportは循環参照になるので不可）。

## フィルターバー（`filterBar.js`, v12.7追加）
- 「さがす」一覧（board.js）と「届いた申請」一覧（applications.js）は、
  フィルターのフィールド構成を意図的に完全一致させている
  （vc/playStyles(手伝います/手伝ってください込み)/inviteStyle/vcApps/属性系 +
  管理者専用の追加フィールド）。この共通ロジックを`filterBar.js`
  （`matchesFilters`/`renderFilterBar`）に集約しているので、フィルター対象の
  フィールドを増減する時は両画面に影響する前提で触ること。個別の画面だけ
  変えたい場合は`filterBar.js`を分岐させず、呼び出し側で完結させる方法を
  先に検討する。
- 管理者専用フィルター（gender/ageGroup/platforms/spending/multiFrequency/
  showGenshinRanking/showGenshinCheck/friendPreference）は、`friendBoardProfiles`
  の生データ（非表示項目も含む）をuserId単位で遅延取得するキャッシュ
  （board.jsの`adminProfileCache`、applications.jsの`adminApplicantProfileCache`。
  それぞれ独立したMapで、共有はしていない）を通して判定する。取得タイミングは
  「一覧が絞り込まれる前の生データ」に対して行うこと
  （`onSnapshot`のコールバック内で`ensureAdmin*ProfilesLoaded(絞り込み前の配列)`
  を呼ぶ。絞り込み後の配列を渡すと、キャッシュが空の初回描画時に管理者フィルターの
  対象外フィールドを持つユーザーが誤って除外され、その人のプロフィール取得
  自体が発生せず一覧に戻ってこない不具合になる）。
- 届いた申請一覧のフィルターは`app.applicantFields`（申請時点で公開されていた
  項目、さがす一覧の`post.publicFields`相当）を対象にする。「承認後に公開」の
  項目（`app.applicantSecretFields`）はそもそも未承認の間はここに無いため
  フィルター対象外だが、承認済みの申請は「やり取り」タブに移りこの一覧自体の
  対象外になるので実害はない。

## お知らせ機能（`friendBoardAnnouncements`, v12.11追加）
- タブバー一番右の「お知らせ」タブ（`#tab-btn-announcements`/`#tab-panel-announcements`）。
  一般ユーザーは閲覧のみ、投稿は管理者ロール（`getAuthUid() === ADMIN_UID`）だけが
  `#announcement-post-form`（`init()`内でisAdminViewer相当の判定時にhiddenを外す）
  から`title`/`body`/`createdAt`(`serverTimestamp()`)で`addDoc`する。フィールドは
  この3つだけで、既読管理用のフィールドはFirestore側に一切持たない。
- 本文の改行はそのまま保持する。`<textarea>.value`は元々改行を含むので特別な処理は
  不要だが、表示側は`textContent`代入＋CSS `white-space: pre-wrap`
  （`.board-announcement-body`）の組み合わせで改行を反映している
  （`innerHTML`+`<br>`変換は使っていない。XSS対策と実装の単純さを優先）。
- 日時表示は`relTime()`（「3時間前」のような相対表示）ではなく、あえて
  `formatDateTime()`で`YYYY-MM-DD HH:mm`の絶対表示にしている。理由は、他の
  「投稿」「申請」と違い、お知らせは後から読み返す一覧（ちょっとしたお知らせの
  archiveのようなもの）なので、日が経つと「3日前」より具体的な日付の方が
  読み返しやすいと判断したため。
- 未読バッジ（タブの①のような赤丸数字、他のタブと同じ`board-tab-badge`の仕組み）は
  Firestoreにユーザーごとの既読フラグを持たせず、**この端末のlocalStorage**
  （`friendBoard_lastSeenAnnouncementAt`キー、最後に読んだお知らせの投稿日時の
  ミリ秒を保存するだけ）で判定している。このサイトが匿名ID中心の運用（ユーザー
  識別の項参照）なことに合わせた設計で、「お知らせタブを開いた瞬間」に現在時刻を
  書き込んでバッジを消す(`markAnnouncementsSeen()`、`#tab-btn-announcements`の
  クリックで発火)。裏を返すと、お知らせタブを開かずに別タブへ直接URLで
  飛んだ場合などは既読にならない。
- Firestoreルール（`24_AccountCenter/firestore.rules`）は`friendBoardReports`と
  ちょうど逆の非対称構成: `friendBoardReports`は「誰でも作成できるが閲覧は管理者
  のみ」、`friendBoardAnnouncements`は「誰でも閲覧できるが作成/更新/削除は管理者
  のみ」。両方とも`isAdmin()`関数（単一UIDのハードコード＋`sharedUserRoles`での
  ロール付与、両対応）を使っている。

## QRコード生成の注意（board.js, `makeQrCode`）
- `qrcode-generator`（kazuhikoarase）ライブラリは `renderTo2dContext` と
  `createDataURL`/`createImgTag` とで **row/colとx/yの対応が逆**になっている
  （内部バグに近い非一貫性）。このコードは`createDataURL`側の規約
  （row=縦/Y, col=横/X）に合わせて自前でCanvas描画している。ここを書き換える時は
  再度ライブラリのソースを確認してから行うこと（renderTo2dContextの規約を
  そのまま真似ると、スキャンできないQRコードになる）。

## モバイルSafari特有の注意
- `<input>`/`<select>`/`<textarea>` の `font-size` が16px未満だと、フォーカス時に
  iOSが勝手に画面を拡大する。フォーム系の入力要素は16px以上を維持すること。
- 横並びペア（原神UID/サーバー等）の `.board-form-row-head` は、両側の高さを
  完全に一致させるため、末尾に来る要素（`.board-fixed-approval-badge`と
  `.board-visibility-select`など）のfont-size/padding/borderを意図的に揃えている。
  どちらか一方だけ変更すると高さがずれるので、変更时は両方確認する。
- JSのみでのDOM更新が画面に反映されない（下に引っ張って更新すると直る）症状が
  まれに起きる。`forceReflow()`（`el.offsetHeight`を読む）や、タブ切替後の
  `scrollTo(0,0)`は`overflow-anchor: none`と組み合わせて使っている
  （スクロールアンカリングがJSの位置リセットを上書きすることがあるため）。

## ユーザー識別
- `uko05.github.io`系サイト共通のlocalStorageキー（`genshinOmikuji_userId`）で
  匿名IDを共有している。24_AccountCenterでのアカウント作成は、この匿名IDを
  ログインに**リンクするだけ**（置き換えではない）。「アカウント作成から
  フローを検証したい」と言われたら、既存データを壊さないようプライベート/
  シークレットブラウジングでの検証を勧める。

## 将来的な構想（まだ実装しない）
- ユーザーの構想として、将来的に00_TopPage側で全サイト（FriendBoard、
  GenshinOmikujiなど）の通知を横断的に一覧できるようにしたい、という話がある
  （例:「＃原神フレンド承認板で申請が届きました。16時間前」等をトップページで
  まとめて見られるようにする）。今すぐアグリゲーター自体は作らないが、
  通知に関わる部分（新規申請/承認/チャット）を触るときは、将来トップページ側
  から読み取れる形（タイムスタンプ付きで追いやすいデータ）を意識しておくとよい。
- この構想を見越して、`chatMessages`の各要素には送信時刻`at`(ミリ秒epoch,
  `Date.now()`)を追加済み(`sendChatMessage`)。Firestoreの制約で
  `serverTimestamp()`は配列要素内では解決されない(nullになる)ため、あえて
  クライアント時計を使っている。**この`at`は数値のミリ秒であり、他の
  `createdAt`等のFirestore Timestampオブジェクト(`.toMillis()`を持つ)とは
  型が違う**ので、`relTime()`にそのまま渡さず扱うこと。またこの変更より前に
  送信された既存の`chatMessages`には`at`が無いので、読み取り側は欠損を
  前提にすること。
- 同じ理由で`friendBoardApplications/{id}`にも`lastChatAt`
  （画面には出さない、Firestore Timestamp）を追加済み(v12.3, `sendChatMessage`)。
  チャット送信のたび`serverTimestamp()`で更新する。`chatMessages`配列要素内の
  `at`とは違いドキュメント直下のフィールドなので、こちらは`serverTimestamp()`が
  正常に解決される。将来トップページ側で「会話単位」の通知を作る際、
  どの申請（＝会話）が直近やり取りされたかを`orderBy('lastChatAt', 'desc')`
  等で拾えるようにする狙い。v12.3より前に作られた申請にはこのフィールドが
  無いので、読み取り側は欠損を前提にすること。
- トップページを開いている間のリアルタイム通知も技術的には問題ない見込み
  （2026-08-27時点で確認済み）。FriendBoard内で既に使っている`onSnapshot`の
  リアルタイム購読の仕組みがそのままトップページ側でも使える。Firestoreの
  アクセス制御は「どのページから来たか」ではなく「誰が読もうとしているか
  （認証情報）」で判定するため、CORS的な制限は受けない。以前はサイトごとに
  Firebaseプロジェクトを分けていたが、最近`genshin-bakatare01`
  （このリポジトリの`firebaseConfig.js`のprojectIdと同じ）に集約したとのことなので、
  トップページはFirebaseアプリのインスタンス1つで全サイト分のデータへ届く。
- 通知の粒度は「メッセージ単位」ではなく「会話（相手）単位」にする方針
  （2026-08-28確認）。ユーザーが挙げた例文も「○○さんからチャットが来ました」と
  相手ごとの1件になっており、これは今の未読バッジの数え方（`ownerSeen`/
  `applicantSeen`は単なるbool。10通連続で来ても1会話としてカウントされ、
  メッセージ数はカウントしない）と同じ粒度。現状FriendBoard自身にはチャット
  メッセージ用のトースト通知が無い（新規申請/承認・見送りにはあるが、
  チャットには無い）。将来これを追加する際も、10連投で10回トーストが出ない
  ように「会話単位でまとめる」実装にすること（将来のトップページ集約と
  表現がズレないようにするため）。
