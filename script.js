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

  const langRadios = document.querySelectorAll('input[name="lang"]');
  const siteTitle = document.getElementById("site-title");
  if (!siteTitle || !langRadios.length) return;

  const dict = {
    ja: {
      homeTitle: "フレンド募集掲示板",
      headerSub: "原神のフレンド募集・co-op相手探しはこちらから",
      accountLink: "アカウント管理（登録は任意です）",
      langJa: "JP",
      langEn: "EN",

      tabPost: "マイプロフィール",
      tabSearch: "さがす",
      tabRequests: "申請",
      tabLockHint: "マイプロフィールを保存すると「さがす」が使えるようになります",

      postFormTitle: "マイプロフィール",
      profileDesc: "この掲示板を使うには、まずあなたの情報を保存してください。保存すると「さがす」が使えるようになります。",
      uidAlwaysApproval: "🔒承認制(固定)",
      approvalNoticeFixed: "原神UIDは常に承認制です。あなたが申請を承認した相手にのみ公開されます。他の項目は項目ごとに公開設定を選べます。",
      avatarHint: "タップしてアイコンを変更（要アカウント登録）",
      avatarNudgeText: "アカウント登録することでアイコンを設定できます",
      avatarNudgeBtn: "アカウント登録へ",
      labelUid: "原神UID",
      uidPlaceholder: "例）123456789",
      labelServer: "サーバー",
      serverAsia: "アジア",
      serverAmerica: "北米",
      serverEurope: "欧州",
      serverSar: "香港・マカオ・台湾",
      groupBasic: "基本情報",
      groupStyle: "プレイスタイル",
      groupContact: "連絡・時間帯",
      groupVoice: "ボイスチャット",
      groupCallStyle: "通話スタイル",
      groupComment: "コメント",

      labelAdventureRank: "冒険者ランク",
      labelWorldLevel: "世界ランク",
      labelGender: "性別",
      genderMale: "男性",
      genderFemale: "女性",
      genderSecret: "回答しない",
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
      labelPlayStyles: "プレイスタイル",
      styleChill: "まったり勢",
      styleHardcore: "がっつり勢",
      styleBeginner: "初心者歓迎",
      styleCallOnly: "通話しながら各々プレイしたい！",
      styleCanHelpExplore: "探索手伝います！",
      styleWantPhotos: "写真撮影しよう！",
      styleWantElites: "精鋭狩りしたい！",
      styleCanHelpBuild: "育成手伝います！",
      styleBeginnerGroupTitle: "初心者向け",
      styleNeedExploreHelp: "探索手伝って！",
      styleNeedFarmHelp: "育成素材集め手伝って！",
      styleNeedQuestions: "わからないことが多いので質問させて！",
      styleNeedCarry: "とにかくキャリーして！",
      styleNeedDomainHelp: "秘境周回手伝って！",
      labelInviteStyle: "マルチ誘い/誘われタイプ",
      inviteInvite: "誘うタイプ",
      inviteInvited: "誘われたいタイプ",
      inviteEither: "どちらでも",
      labelMultiFrequency: "マルチ頻度",
      freqAnytime: "オンラインの時ならいつでも可",
      freqDaily: "ほぼ毎日",
      freqOften: "週３～５くらい",
      freqSometimes: "週１～２くらい",
      freqAsk: "要相談",
      workCallOkLabel: "作業通話だけの参加でもOK",
      casualOkLabel: "タメ口で話してもOK",
      jokingOkLabel: "おふざけしながらでもOK",
      sameOshiRejectLabel: "同担拒否あり",
      labelSameOshiChars: "同担拒否キャラ",

      labelVc: "VC(ボイスチャット)",
      vcYes: "可能",
      vcNo: "不可",
      vcMaybe: "相談",
      labelVcApps: "VC利用アプリ",
      vcAppDiscord: "Discord",
      vcAppLine: "LINE",
      vcAppOther: "その他",
      labelTwitter: "ツイッターID",
      twitterPlaceholder: "例）@your_id",
      labelWeekdayTimes: "平日のマルチ可能時間帯",
      labelWeekendTimes: "休日のマルチ可能時間帯",

      visPublic: "公開",
      visHidden: "非公開",
      visApproval: "承認制",

      labelComment: "なんでも一言",
      commentPlaceholder: "例）深境螺旋の周回相手を探しています！",
      postSubmitBtn: "保存する",
      myPostsTitle: "現在の公開状況",

      searchTitle: "募集をさがす",
      filterServerLabel: "サーバーで絞り込み",
      filterAll: "すべて",

      requestsTitle: "申請の管理",
      requestsDesc: "気になる募集に申請すると相手に通知が届きます。相手が承認すると、原神UIDが確認できるようになります。",
      receivedTitle: "届いた申請",
      sentTitle: "送った申請",

      friend: "＜友達ください…",
    },
    en: {
      homeTitle: "Friend Board",
      headerSub: "Find Genshin Impact friends and co-op partners here",
      accountLink: "Account Center (registration optional)",
      langJa: "JP",
      langEn: "EN",

      tabPost: "My Profile",
      tabSearch: "Search",
      tabRequests: "Requests",
      tabLockHint: "Save your My Profile to unlock Search",

      postFormTitle: "My Profile",
      profileDesc: "To use this board, save your info first. Once saved, Search will be unlocked.",
      uidAlwaysApproval: "🔒Vetted (fixed)",
      approvalNoticeFixed: "Your Genshin UID is always Vetted. It's only revealed to applicants you accept. You can choose the visibility of every other field individually.",
      avatarHint: "Tap to change your icon (account registration required)",
      avatarNudgeText: "Register an account to set a custom icon",
      avatarNudgeBtn: "Go to Account Center",
      labelUid: "Genshin UID",
      uidPlaceholder: "e.g. 123456789",
      labelServer: "Server",
      serverAsia: "Asia",
      serverAmerica: "America",
      serverEurope: "Europe",
      serverSar: "HK/MO/TW",
      groupBasic: "Basic Info",
      groupStyle: "Play Style",
      groupContact: "Contact & Availability",
      groupVoice: "Voice Chat",
      groupCallStyle: "Call Style",
      groupComment: "Comment",

      labelAdventureRank: "Adventure Rank",
      labelWorldLevel: "World Level",
      labelGender: "Gender",
      genderMale: "Male",
      genderFemale: "Female",
      genderSecret: "Prefer not to say",
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
      labelPlayStyles: "Play Style",
      styleChill: "Casual",
      styleHardcore: "Hardcore",
      styleBeginner: "Beginner friendly",
      styleCallOnly: "Want to play separately while on call!",
      styleCanHelpExplore: "I'll help you explore!",
      styleWantPhotos: "Let's take photos!",
      styleWantElites: "Want to hunt elites!",
      styleCanHelpBuild: "I'll help with character building!",
      styleBeginnerGroupTitle: "Beginner-oriented",
      styleNeedExploreHelp: "Help me explore!",
      styleNeedFarmHelp: "Help me farm ascension materials!",
      styleNeedQuestions: "I have lots of questions, let me ask!",
      styleNeedCarry: "Just carry me!",
      styleNeedDomainHelp: "Help me farm domains!",
      labelInviteStyle: "Invite/Invited Type",
      inviteInvite: "I invite",
      inviteInvited: "I wait to be invited",
      inviteEither: "Either",
      labelMultiFrequency: "Multiplayer Frequency",
      freqAnytime: "Anytime I'm online",
      freqDaily: "Almost every day",
      freqOften: "3-5 times/week",
      freqSometimes: "1-2 times/week",
      freqAsk: "Ask me",
      workCallOkLabel: "OK to just hang out on call without playing together",
      casualOkLabel: "OK to talk casually",
      jokingOkLabel: "OK to joke around",
      sameOshiRejectLabel: "Same-favorite rejection",
      labelSameOshiChars: "Rejected characters",

      labelVc: "Voice Chat",
      vcYes: "Available",
      vcNo: "Not available",
      vcMaybe: "Ask me",
      labelVcApps: "VC App",
      vcAppDiscord: "Discord",
      vcAppLine: "LINE",
      vcAppOther: "Other",
      labelTwitter: "X (Twitter) ID",
      twitterPlaceholder: "e.g. @your_id",
      labelWeekdayTimes: "Weekday availability",
      labelWeekendTimes: "Weekend availability",

      visPublic: "Public",
      visHidden: "Hidden",
      visApproval: "Vetted",

      labelComment: "One-liner",
      commentPlaceholder: "e.g. Looking for Spiral Abyss co-op partners!",
      postSubmitBtn: "Save",
      myPostsTitle: "Current Status",

      searchTitle: "Search recruitment posts",
      filterServerLabel: "Filter by server",
      filterAll: "All",

      requestsTitle: "Manage requests",
      requestsDesc: "Apply to a post you're interested in and the poster gets notified. Once they accept, you'll be able to see their Genshin UID.",
      receivedTitle: "Received requests",
      sentTitle: "Sent requests",

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
