document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     タブ切替（募集する／さがす）
     board.js(Firebase読み込みに依存するモジュール)とは独立させ、
     ページの見た目としてのタブ切替は常に動くようにする
     ========================= */
  const tabButtons = document.querySelectorAll(".board-tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      document.querySelectorAll(".board-tab-panel").forEach((panel) => panel.classList.add("hidden"));
      const target = document.getElementById(`tab-panel-${btn.dataset.tab}`);
      if (target) target.classList.remove("hidden");
    });
  });

  /* =========================
     申請タブ内のサブタブ切替（届いた申請／送った申請）
     ========================= */
  const subTabButtons = document.querySelectorAll(".board-subtab-btn");
  subTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      subTabButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      document.querySelectorAll(".board-subtab-panel").forEach((panel) => panel.classList.add("hidden"));
      const target = document.getElementById(`subtab-panel-${btn.dataset.subtab}`);
      if (target) target.classList.remove("hidden");
    });
  });

  /* =========================
     このサイトについて(?)モーダル。
     初回訪問時は自動で1回だけ表示し、以降はlocalStorageのフラグで抑制する。
     ========================= */
  const LS_INFO_SEEN = "friendBoard_infoSeen";
  const infoModal = document.getElementById("info-modal");
  function openInfoModal() { if (infoModal) infoModal.style.display = "flex"; }
  function closeInfoModal() {
    if (infoModal) infoModal.style.display = "none";
    localStorage.setItem(LS_INFO_SEEN, "1");
  }
  document.querySelectorAll(".board-info-btn").forEach((btn) => btn.addEventListener("click", openInfoModal));
  document.getElementById("info-modal-close")?.addEventListener("click", closeInfoModal);
  document.querySelector("#info-modal .col-modal-backdrop")?.addEventListener("click", closeInfoModal);
  if (!localStorage.getItem(LS_INFO_SEEN)) openInfoModal();

  const langRadios = document.querySelectorAll('input[name="lang"]');
  const siteTitle = document.getElementById("site-title");
  if (!siteTitle || !langRadios.length) return;

  const dict = {
    ja: {
      homeTitle: "＃原神フレンド承認板",
      accountLink: "アカウント管理（登録は任意です）",
      langJa: "JP",
      langEn: "EN",

      tabPost: "マイプロフィール",
      tabSearch: "さがす",
      tabRequests: "申請",
      tabAdmin: "通報一覧",
      tabLockHint: "マイプロフィールを保存すると「さがす」が使えるようになります",

      postFormTitle: "マイプロフィール",
      profileDesc: "この掲示板を使うには、まずあなたの情報を保存してください。保存すると「さがす」が使えるようになります。",
      uidAlwaysApproval: "🔒承認後に公開",
      approvalNoticeFixed: "原神UIDは常に「承認後に公開」です。あなたが申請を承認した相手にのみ公開されます。他の項目は項目ごとに公開設定を選べます。",
      avatarHint: "タップしてアイコンを変更（要アカウント登録）",
      avatarNudgeText: "アカウント登録することでアイコンを設定できます",
      avatarNudgeBtn: "アカウント登録へ",
      labelUid: "原神UID",
      uidPlaceholder: "例）123456789",
      labelDisplayName: "名前",
      displayNamePlaceholder: "例）うーこ",
      labelServer: "サーバー",
      serverAsia: "Asia",
      serverAmerica: "America",
      serverEurope: "Europe",
      serverSar: "TW,HK,MO",
      groupBasic: "基本情報",
      groupStyle: "あなたについて",
      groupContact: "連絡・時間帯",
      groupVoice: "ボイスチャット",
      groupCallStyle: "あなたの追加属性",
      groupComment: "コメント",

      labelAdventureRank: "冒険者ランク",
      labelWorldLevel: "世界ランク",
      labelGender: "性別",
      genderMale: "男性",
      genderFemale: "女性",
      ageAdultConfirm: "成人済",
      labelPlatforms: "ハード",
      platformPc: "PC",
      platformPs5: "PS5",
      platformMobile: "スマホ",
      platformTablet: "タブレット",
      platformOther: "その他",

      labelOshiChars: "推しキャラ（最大3人）",
      oshiAddBtn: "追加する",
      oshiPickerHint: "最大3人まで選べます",
      oshiPickerFull: "推しキャラは3人まで選べます",
      labelSpending: "課金スタンス",
      spendingF2p: "無課金",
      spendingLight: "微課金",
      spendingHeavy: "廃課金",
      labelPlayStyles: "マルチで何をしたい？",
      alwaysPublic: "🌐常に公開",
      styleCallOnly: "通話しながら各々プレイしたい！",
      styleWantPhotos: "写真撮影しよう！",
      styleWantElites: "精鋭狩りしたい！",
      styleWantAchievements: "アチーブ取り",
      styleWantJokeMulti: "おふざけマルチしたい！",
      styleOther: "その他",
      playStylesOtherPlaceholder: "例）縛りプレイ好きです",
      styleHelpOfferGroupTitle: "手伝います！",
      styleCanHelpExplore: "探索",
      styleCanHelpBuild: "育成素材集め",
      styleCanHelpDomain: "秘境周回",
      styleCanHelpIllusive: "幽境の激戦",
      styleCanHelpAchievements: "アチーブ取り",
      styleCanHelpQuestions: "相談・質問乗ります！",
      styleHelpRequestGroupTitle: "手伝ってください！",
      styleNeedExploreHelp: "探索",
      styleNeedFarmHelp: "育成素材集め",
      styleNeedDomainHelp: "秘境周回",
      styleNeedIllusiveHelp: "幽境の激戦",
      styleNeedQuestions: "わからないことが多いので質問させて！",
      groupImageAdd: "画像追加",
      showGenshinRankingLabel: "原神推しキャラランキングを公開する",
      showGenshinCheckLabel: "原神チェックシートを公開する",
      labelInviteStyle: "マルチ自発について",
      inviteInvite: "お誘いします！",
      inviteInvited: "自発苦手です",
      inviteEither: "お誘いするしお誘いされたい",
      labelMultiFrequency: "マルチ頻度",
      freqBiweekly: "隔週1回くらい",
      freqWeek1: "週1くらい",
      freqWeek2to3: "週2～3くらい",
      freqWeek4to5: "週4～5くらい",
      freqWeek6to7: "週6～7くらい",
      freqDaily: "毎日やりたい！",
      freqAsk: "要相談",
      labelMultiFrequencyNote: "マルチ頻度の詳細",
      multiFrequencyNotePlaceholder: "例）土日なら頻度高めです",
      optUnspecified: "未回答",
      labelCasualOk: "タメ口",
      casualLove: "タメ口大歓迎",
      casualOkLabel: "タメ口OK",
      casualEither: "どっちでもOK",
      casualNo: "タメ口なし",
      labelJokingOk: "おふざけ",
      jokingOkLabel: "おふざけします",
      labelYuriOk: "百合",
      yuriOkLabel: "百合いけます",
      labelFujoshiOk: "腐",
      fujoshiOkLabel: "腐いけます",
      labelRoughTalk: "暴言",
      roughTalkNo: "暴言NG",
      roughTalkYes: "暴言出ます",
      labelSameOshiReject: "同担拒否",
      sameOshiRejectNo: "同担拒否なし",
      sameOshiRejectLabel: "同担拒否あり",
      labelSameOshiChars: "同担拒否キャラ",

      labelVc: "VC(ボイスチャット)",
      vcYes: "可能",
      vcNo: "不可",
      vcMaybe: "相談",
      labelVcNote: "VC相談の詳細",
      vcNotePlaceholder: "例）バイト・夜勤があるので不定期です",
      labelVcApps: "VC利用アプリ",
      vcAppDiscord: "Discord",
      vcAppLine: "LINE",
      vcAppOther: "その他",
      vcAppsDesc: "※IDを入力したアプリが「利用アプリ」として表示されます(IDそのものは承認後に公開)",
      vcDiscordIdPlaceholder: "例）uko#0000",
      vcLineIdPlaceholder: "例）line_id123",
      vcAppsOtherPlaceholder: "例）Zoom：ID",
      labelWeekdayTimes: "平日のマルチ可能時間帯",
      labelWeekendTimes: "休日のマルチ可能時間帯",
      labelByDay: "曜日単位",
      dayMon: "月",
      dayTue: "火",
      dayWed: "水",
      dayThu: "木",
      dayFri: "金",
      daySat: "土",
      daySun: "日",

      groupSns: "つながれるSNS",
      labelTwitter: "ツイッターID",
      twitterPlaceholder: "例）@uko_dayo_",
      labelTiktok: "TikTok ID",
      tiktokPlaceholder: "例）@uko_dayo_",
      labelLineId: "LINE ID",
      lineIdPlaceholder: "例）uko_dayo_",
      labelInstagram: "Instagram ID",
      instagramPlaceholder: "例）@uko_dayo_",

      groupFriendPref: "どういうフレンドがほしい？",
      friendPrefDesc: "ここで選んだ内容は「さがす」でのマッチ度計算に使われます。",
      friendPrefDesc2: "ここのチェックした内容は相手に公開されません。一致条件のみ公開されます。",
      labelFriendPreference: "どういうフレンドがほしい？",
      prefSameGender: "同性のフレンドがほしい",
      prefAnyGender: "男女問わずフレンドがほしい",
      prefWantPartner: "恋人がほしい",
      prefWantOshiFriend: "推し活友達がほしい",
      prefVcNotNeeded: "VCなしでも大丈夫",
      prefWorkCallOk: "作業通話だけでもOK",
      prefDiscordServer: "交流用Discordサーバーで複数人でやりたい",

      infoModalTitle: "このサイトは承認制です",
      infoModalBody1: "このサイトは一般的なフレンド募集とは異なり、相手に承認されないとUIDなどの公開されません。",
      infoModalBody2: "全利用者はマイプロフィールの設定が必須です。気になる人に申請をしたら相手にマイプロフィールが一部公開されます。相手が承認することで、お互いにUIDなど承認後に公開される情報を閲覧でき、ゲーム内でフレンド申請することができるようになります。",
      infoModalBody3: "お互いのことを事前にしっかり知れるので、挨拶だけで終わらない長続きするフレンドを探すことができます",

      visPublic: "公開",
      visHidden: "非公開",
      visApproval: "承認後に公開",
      visCloseFriend: "仲良くなったら",

      labelComment: "なんでも一言",
      commentPlaceholder: "別ゲー○○のフレンドも募集中！とか無言加入歓迎！とか腐女子/夢女子です！とか下ネタ/暴言OK NGとか他に書きたいことがあれば書いておこう！",
      postSubmitBtn: "保存する",
      draftSaveBtn: "一時保存",
      draftSaved: "一時保存しました（この端末のみ）",
      draftSaveFail: "一時保存に失敗しました。",
      myPostsTitle: "現在の公開状況",
      exportImageBtn: "画像として保存（QRコード付き）",
      refreshPostBtn: "更新する（まだ募集中です）",
      blockedListTitle: "ブロック中のユーザー",

      searchTitle: "募集をさがす",
      searchServerNote: "あなたと同じサーバーのユーザーのみ表示されます",
      searchApprovalNote: "原神UID・名前は承認後に確認できます",
      matchLegendLabel: "チップの色について:",
      matchLegendExact: "一致",
      matchLegendComplementary: "相性◎",

      viewProfileTitle: "プロフィール",
      profileIncompleteModalTitle: "マイプロフィールを設定してください",
      profileIncompleteModalBody: "申請するには、まずあなたのマイプロフィールを保存する必要があります。保存が終わると、自動でこの画面に戻ってきます。",
      profileIncompleteGotoBtn: "マイプロフ設定後に申請する",

      requestsTitle: "申請の管理",
      adminReportsTitle: "通報一覧",
      adminHideHandled: "対応済みを非表示にする",
      requestsDesc: "気になる募集に申請すると相手に通知が届きます。相手が承認すると、原神UIDが確認できるようになります。",
      receivedTitle: "届いた申請",
      sentTitle: "送った申請",
      matchTitle: "やり取り",

      applyMessageModalTitle: "メッセージをつけて申請",
      applyMessagePlaceholder: "「よろしくお願いします」など、一言添えてみましょう（未入力でも送信できます）",
      applyMessageSendBtn: "この内容で申請する",

      friend: "＜友達ください…",
    },
    en: {
      homeTitle: "#Genshin Friend Approval Board",
      accountLink: "Account Center (registration optional)",
      langJa: "JP",
      langEn: "EN",

      tabPost: "My Profile",
      tabSearch: "Search",
      tabRequests: "Requests",
      tabAdmin: "Reports",
      tabLockHint: "Save your My Profile to unlock Search",

      postFormTitle: "My Profile",
      profileDesc: "To use this board, save your info first. Once saved, Search will be unlocked.",
      uidAlwaysApproval: "🔒Visible after approval",
      approvalNoticeFixed: "Your Genshin UID is always \"Visible after approval\". It's only revealed to applicants you accept. You can choose the visibility of every other field individually.",
      avatarHint: "Tap to change your icon (account registration required)",
      avatarNudgeText: "Register an account to set a custom icon",
      avatarNudgeBtn: "Go to Account Center",
      labelUid: "Genshin UID",
      uidPlaceholder: "e.g. 123456789",
      labelDisplayName: "Name",
      displayNamePlaceholder: "e.g. Uko",
      labelServer: "Server",
      serverAsia: "Asia",
      serverAmerica: "America",
      serverEurope: "Europe",
      serverSar: "TW,HK,MO",
      groupBasic: "Basic Info",
      groupStyle: "About You",
      groupContact: "Contact & Availability",
      groupVoice: "Voice Chat",
      groupCallStyle: "More About You",
      groupComment: "Comment",

      labelAdventureRank: "Adventure Rank",
      labelWorldLevel: "World Level",
      labelGender: "Gender",
      genderMale: "Male",
      genderFemale: "Female",
      ageAdultConfirm: "I'm an adult",
      labelPlatforms: "Platform",
      platformPc: "PC",
      platformPs5: "PS5",
      platformMobile: "Mobile",
      platformTablet: "Tablet",
      platformOther: "Other",

      labelOshiChars: "Favorite Characters (up to 3)",
      oshiAddBtn: "Add",
      oshiPickerHint: "You can pick up to 3",
      oshiPickerFull: "You can select up to 3 favorite characters",
      labelSpending: "Spending",
      spendingF2p: "F2P",
      spendingLight: "Light spender",
      spendingHeavy: "Heavy spender",
      labelPlayStyles: "What do you want to do in multiplayer?",
      alwaysPublic: "🌐Always public",
      styleCallOnly: "Want to play separately while on call!",
      styleWantPhotos: "Let's take photos!",
      styleWantElites: "Want to hunt elites!",
      styleWantAchievements: "Achievements",
      styleWantJokeMulti: "Want a goofy multiplayer session!",
      styleOther: "Other",
      playStylesOtherPlaceholder: "e.g. I love challenge runs",
      styleHelpOfferGroupTitle: "I can help with...",
      styleCanHelpExplore: "Explore",
      styleCanHelpBuild: "Farm ascension materials",
      styleCanHelpDomain: "Farm domains",
      styleCanHelpIllusive: "Illusive Realm's Trounce Domain",
      styleCanHelpAchievements: "Achievements",
      styleCanHelpQuestions: "I'll take your questions!",
      styleHelpRequestGroupTitle: "Please help me with...",
      styleNeedExploreHelp: "Explore",
      styleNeedFarmHelp: "Farm ascension materials",
      styleNeedDomainHelp: "Farm domains",
      styleNeedIllusiveHelp: "Illusive Realm's Trounce Domain",
      styleNeedQuestions: "I have lots of questions, let me ask!",
      groupImageAdd: "Add Image",
      showGenshinRankingLabel: "Show my Genshin Character Ranking",
      showGenshinCheckLabel: "Show my Genshin Check Sheet",
      labelInviteStyle: "Taking initiative in multiplayer",
      inviteInvite: "I'll invite you!",
      inviteInvited: "Not great at taking initiative",
      inviteEither: "I'll invite, and I'm happy to be invited too",
      labelMultiFrequency: "Multiplayer Frequency",
      freqBiweekly: "About once every 2 weeks",
      freqWeek1: "About once a week",
      freqWeek2to3: "About 2-3 times/week",
      freqWeek4to5: "About 4-5 times/week",
      freqWeek6to7: "About 6-7 times/week",
      freqDaily: "Want to play every day!",
      freqAsk: "Ask me",
      labelMultiFrequencyNote: "Multiplayer frequency details",
      multiFrequencyNotePlaceholder: "e.g. More often on weekends",
      optUnspecified: "Unspecified",
      labelCasualOk: "Casual speech",
      casualLove: "Love casual speech",
      casualOkLabel: "Casual speech OK",
      casualEither: "Either is fine",
      casualNo: "No casual speech",
      labelJokingOk: "Joking around",
      jokingOkLabel: "I like to joke around",
      labelYuriOk: "Yuri",
      yuriOkLabel: "Into yuri (girls' love)",
      labelFujoshiOk: "BL",
      fujoshiOkLabel: "Into BL (boys' love)",
      labelRoughTalk: "Rough language",
      roughTalkNo: "No rough language",
      roughTalkYes: "I use rough language",
      labelSameOshiReject: "Same-favorite rejection",
      sameOshiRejectNo: "No same-favorite rejection",
      sameOshiRejectLabel: "Same-favorite rejection",
      labelSameOshiChars: "Rejected characters",

      labelVc: "Voice Chat",
      vcYes: "Available",
      vcNo: "Not available",
      vcMaybe: "Ask me",
      labelVcNote: "VC details",
      vcNotePlaceholder: "e.g. I work part-time/night shifts, so it's irregular",
      labelVcApps: "VC App",
      vcAppDiscord: "Discord",
      vcAppLine: "LINE",
      vcAppOther: "Other",
      vcAppsDesc: "※Apps with an ID entered are shown as \"apps used\" (the ID itself is visible after approval)",
      vcDiscordIdPlaceholder: "e.g. uko#0000",
      vcLineIdPlaceholder: "e.g. line_id123",
      vcAppsOtherPlaceholder: "e.g. Zoom: ID",
      labelWeekdayTimes: "Weekday availability",
      labelWeekendTimes: "Weekend availability",
      labelByDay: "By day",
      dayMon: "Mon",
      dayTue: "Tue",
      dayWed: "Wed",
      dayThu: "Thu",
      dayFri: "Fri",
      daySat: "Sat",
      daySun: "Sun",

      groupSns: "Connect via SNS",
      labelTwitter: "X (Twitter) ID",
      twitterPlaceholder: "e.g. @uko_dayo_",
      labelTiktok: "TikTok ID",
      tiktokPlaceholder: "e.g. @uko_dayo_",
      labelLineId: "LINE ID",
      lineIdPlaceholder: "e.g. uko_dayo_",
      labelInstagram: "Instagram ID",
      instagramPlaceholder: "e.g. @uko_dayo_",

      groupFriendPref: "What kind of friend are you looking for?",
      friendPrefDesc: "These selections are used to calculate your match score in Search.",
      friendPrefDesc2: "What you check here is not shown to the other party — only the match result is disclosed.",
      labelFriendPreference: "What kind of friend are you looking for?",
      prefSameGender: "Looking for a same-gender friend",
      prefAnyGender: "Gender doesn't matter",
      prefWantPartner: "Looking for a romantic partner",
      prefWantOshiFriend: "Looking for a fellow fan friend",
      prefVcNotNeeded: "OK without VC",
      prefWorkCallOk: "OK with just hanging out on call",
      prefDiscordServer: "Want to hang out as a group on our social Discord server",

      infoModalTitle: "This site is approval-based",
      infoModalBody1: "Unlike typical friend-recruitment sites, your UID and other details are never shown to someone unless they've been approved by you.",
      infoModalBody2: "Every user is required to fill out their My Profile. When you apply to someone you're interested in, part of your profile is shown to them. Once they approve, both of you can view each other's UID and any other approval-gated info, and you'll be able to send a friend request in-game.",
      infoModalBody3: "Because you can get to know each other well beforehand, you can find friendships that last beyond just a greeting.",

      visPublic: "Public",
      visHidden: "Hidden",
      visApproval: "Visible after approval",
      visCloseFriend: "Once we're close",

      labelComment: "One-liner",
      commentPlaceholder: "e.g. \"Also looking for friends on [other game]!\", \"silent adds welcome!\", \"into BL/otome fandom!\", \"dirty jokes/cursing OK or NG\" — write anything else you'd like to share!",
      postSubmitBtn: "Save",
      draftSaveBtn: "Save Draft",
      draftSaved: "Draft saved (this device only)",
      draftSaveFail: "Failed to save draft.",
      myPostsTitle: "Current Status",
      exportImageBtn: "Save as image (with QR code)",
      refreshPostBtn: "Refresh (still looking)",
      blockedListTitle: "Blocked users",

      searchTitle: "Search recruitment posts",
      searchServerNote: "Only users on the same server as you are shown",
      searchApprovalNote: "Genshin UID and name are visible after approval",
      matchLegendLabel: "Chip colors:",
      matchLegendExact: "Match",
      matchLegendComplementary: "Good match",

      viewProfileTitle: "Profile",
      profileIncompleteModalTitle: "Please set up your My Profile",
      profileIncompleteModalBody: "You need to save your My Profile before you can apply. Once saved, you'll be brought back here automatically.",
      profileIncompleteGotoBtn: "Set up profile, then apply",

      requestsTitle: "Manage requests",
      adminReportsTitle: "Reports",
      adminHideHandled: "Hide handled reports",
      requestsDesc: "Apply to a post you're interested in and the poster gets notified. Once they accept, you'll be able to see their Genshin UID.",
      receivedTitle: "Received requests",
      sentTitle: "Sent requests",
      matchTitle: "Chats",

      applyMessageModalTitle: "Apply with a message",
      applyMessagePlaceholder: "Add a short note, e.g. \"Nice to meet you!\" (optional — you can send without one)",
      applyMessageSendBtn: "Send this request",

      friend: "< Follow me on X!",
    },
  };

  function applyLang(lang) {
    const d = dict[lang] || dict.ja;

    localStorage.setItem("lang", lang);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (Object.prototype.hasOwnProperty.call(d, key)) {
        el.textContent = d[key];
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (Object.prototype.hasOwnProperty.call(d, key)) {
        el.placeholder = d[key];
      }
    });

    document.documentElement.lang = lang;
  }

  const savedLang = localStorage.getItem("lang");
  const initialLang = (savedLang === "en" || savedLang === "ja") ? savedLang : "ja";

  const targetRadio = document.querySelector(`input[name="lang"][value="${initialLang}"]`);
  if (targetRadio) targetRadio.checked = true;

  applyLang(initialLang);

  langRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => applyLang(e.target.value));
  });

});
