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
      serverAsia: "アジア",
      serverAmerica: "北米",
      serverEurope: "欧州",
      serverSar: "香港・マカオ・台湾",
      groupBasic: "基本情報",
      groupStyle: "あなたについて",
      groupContact: "連絡・時間帯",
      groupVoice: "ボイスチャット",
      groupCallStyle: "通話スタイル",
      groupComment: "コメント",

      labelAdventureRank: "冒険者ランク",
      labelWorldLevel: "世界ランク",
      labelGender: "性別",
      genderMale: "男性",
      genderFemale: "女性",
      labelAgeGroup: "年齢",
      ageAdult: "成人",
      ageMinor: "未成年",
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
      styleCanHelpExplore: "探索手伝います！",
      styleWantPhotos: "写真撮影しよう！",
      styleWantElites: "精鋭狩りしたい！",
      styleCanHelpBuild: "育成手伝います！",
      styleWantAchievements: "アチーブ取りしたい！",
      styleWantJokeMulti: "おふざけマルチしたい！",
      styleOther: "その他",
      playStylesOtherPlaceholder: "例）縛りプレイ好きです",
      styleBeginnerGroupTitle: "初心者向け",
      styleNeedExploreHelp: "探索手伝って！",
      styleNeedFarmHelp: "育成素材集め手伝って！",
      styleNeedQuestions: "わからないことが多いので質問させて！",
      styleNeedCarry: "とにかくキャリーして！",
      styleNeedDomainHelp: "秘境周回手伝って！",
      groupImageAdd: "画像追加",
      showGenshinRankingLabel: "原神推しキャラランキングを公開する",
      showGenshinCheckLabel: "原神チェックシートを公開する",
      savedImageNotSavedYet: "まだ保存された画像がありません。ランキング/チェックシートのサイトで先に保存してください。",
      labelInviteStyle: "マルチ自発について",
      inviteInvite: "お誘いします！",
      inviteInvited: "自発苦手です",
      inviteEither: "お誘いするしお誘いされたい",
      labelMultiFrequency: "マルチ頻度",
      freqAnytime: "オンラインの時ならいつでも可",
      freqDaily: "ほぼ毎日",
      freqOften: "週３～５くらい",
      freqSometimes: "週１～２くらい",
      freqAsk: "要相談",
      labelMultiFrequencyNote: "マルチ頻度の詳細",
      multiFrequencyNotePlaceholder: "例）土日なら頻度高めです",
      workCallOkLabel: "作業通話だけの参加でもOK",
      labelCasualOk: "タメ口について",
      casualLove: "タメ口大歓迎",
      casualOkLabel: "タメ口OK",
      casualEither: "どっちでもOK",
      casualNo: "タメ口なし",
      jokingOkLabel: "おふざけしながらでもOK",
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
      labelVcAppsOtherText: "その他アプリ名",
      vcAppsOtherPlaceholder: "例）Zoom",
      labelWeekdayTimes: "平日のマルチ可能時間帯",
      labelWeekendTimes: "休日のマルチ可能時間帯",

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
      prefChatOnly: "マルチしない雑談通話でも可",
      prefVcNotNeeded: "VCなしでも大丈夫",

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
      serverSar: "HK/MO/TW",
      groupBasic: "Basic Info",
      groupStyle: "About You",
      groupContact: "Contact & Availability",
      groupVoice: "Voice Chat",
      groupCallStyle: "Call Style",
      groupComment: "Comment",

      labelAdventureRank: "Adventure Rank",
      labelWorldLevel: "World Level",
      labelGender: "Gender",
      genderMale: "Male",
      genderFemale: "Female",
      labelAgeGroup: "Age",
      ageAdult: "Adult",
      ageMinor: "Minor",
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
      styleCanHelpExplore: "I'll help you explore!",
      styleWantPhotos: "Let's take photos!",
      styleWantElites: "Want to hunt elites!",
      styleCanHelpBuild: "I'll help with character building!",
      styleWantAchievements: "Want to hunt achievements!",
      styleWantJokeMulti: "Want a goofy multiplayer session!",
      styleOther: "Other",
      playStylesOtherPlaceholder: "e.g. I love challenge runs",
      styleBeginnerGroupTitle: "Beginner-oriented",
      styleNeedExploreHelp: "Help me explore!",
      styleNeedFarmHelp: "Help me farm ascension materials!",
      styleNeedQuestions: "I have lots of questions, let me ask!",
      styleNeedCarry: "Just carry me!",
      styleNeedDomainHelp: "Help me farm domains!",
      groupImageAdd: "Add Image",
      showGenshinRankingLabel: "Show my Genshin Character Ranking",
      showGenshinCheckLabel: "Show my Genshin Check Sheet",
      savedImageNotSavedYet: "No saved image found yet. Save one on the ranking/check-sheet site first.",
      labelInviteStyle: "Taking initiative in multiplayer",
      inviteInvite: "I'll invite you!",
      inviteInvited: "Not great at taking initiative",
      inviteEither: "I'll invite, and I'm happy to be invited too",
      labelMultiFrequency: "Multiplayer Frequency",
      freqAnytime: "Anytime I'm online",
      freqDaily: "Almost every day",
      freqOften: "3-5 times/week",
      freqSometimes: "1-2 times/week",
      freqAsk: "Ask me",
      labelMultiFrequencyNote: "Multiplayer frequency details",
      multiFrequencyNotePlaceholder: "e.g. More often on weekends",
      workCallOkLabel: "OK to just hang out on call without playing together",
      labelCasualOk: "Casual speech",
      casualLove: "Love casual speech",
      casualOkLabel: "Casual speech OK",
      casualEither: "Either is fine",
      casualNo: "No casual speech",
      jokingOkLabel: "OK to joke around",
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
      labelVcAppsOtherText: "Other app name",
      vcAppsOtherPlaceholder: "e.g. Zoom",
      labelWeekdayTimes: "Weekday availability",
      labelWeekendTimes: "Weekend availability",

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
      prefChatOnly: "OK with just chatting, no multiplayer",
      prefVcNotNeeded: "OK without VC",

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
