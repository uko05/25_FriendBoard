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

      tabPost: "募集する",
      tabSearch: "さがす",
      tabRequests: "申請",

      postFormTitle: "募集を出す",
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
      labelInviteStyle: "マルチの誘うタイプ",
      inviteInvite: "誘うタイプ",
      inviteInvited: "誘われたいタイプ",
      inviteEither: "どちらでも",
      labelWorkCallOk: "作業通話のみでもOK",
      workCallOkLabel: "作業通話だけの参加でもOK",
      labelCasualOk: "タメ口OK",
      casualOkLabel: "タメ口で話してもOK",
      labelJokingOk: "おふざけOK",
      jokingOkLabel: "おふざけしながらでもOK",
      labelSameOshiPolicy: "同担拒否",
      sameOshiReject: "あり",
      sameOshiOk: "なし",
      sameOshiNoOpinion: "気にしたことない",

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
      visApprovalLoginHint: "（承認制はログインすると選べます）",

      labelComment: "募集コメント",
      commentPlaceholder: "例）深境螺旋の周回相手を探しています！",
      postSubmitBtn: "募集を投稿する",
      myPostsTitle: "自分の募集",

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

      tabPost: "Post",
      tabSearch: "Search",
      tabRequests: "Requests",

      postFormTitle: "Create a recruitment post",
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
      labelInviteStyle: "Invite Style",
      inviteInvite: "I invite",
      inviteInvited: "I wait to be invited",
      inviteEither: "Either",
      labelWorkCallOk: "OK with silent/work call",
      workCallOkLabel: "OK to just hang out on call without playing together",
      labelCasualOk: "Casual speech OK",
      casualOkLabel: "OK to talk casually",
      labelJokingOk: "Joking around OK",
      jokingOkLabel: "OK to joke around",
      labelSameOshiPolicy: "Same-favorite policy",
      sameOshiReject: "Yes",
      sameOshiOk: "No",
      sameOshiNoOpinion: "Never thought about it",

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
      visApprovalLoginHint: "(log in to enable Vetted)",

      labelComment: "Comment",
      commentPlaceholder: "e.g. Looking for Spiral Abyss co-op partners!",
      postSubmitBtn: "Submit post",
      myPostsTitle: "My posts",

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
