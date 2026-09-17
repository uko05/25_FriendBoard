// filterBar.js
// さがす一覧(board.js)・届いた申請一覧(applications.js)で共通のフィルターバーUI。
// 両画面ともフィールド構成(vc/playStyles/inviteStyle/vcApps/属性系 + 管理者専用の
// 追加項目)を完全に同じにする、という前提(CLAUDE.md参照)なので、生成ロジックを
// ここに集約している。

import { fieldLabel, filterFieldOptions, PLAYSTYLE_OFFER_VALUES, PLAYSTYLE_REQUEST_VALUES } from './fields.js';

// 配列なら選択値のいずれかと重なるか、真偽値なら'yes'選択時のみtrue必須、
// それ以外(文字列)は選択値に含まれるかを見る。
function matchesFieldFilter(value, checkedValues) {
  if (Array.isArray(value)) return value.some((v) => checkedValues.has(v));
  if (typeof value === 'boolean') return checkedValues.has('yes') ? value === true : true;
  return checkedValues.has(value);
}

// filters: フィールドキー -> 選択中の値のSet。値が1つも無いフィールドは絞り込み対象外(=全件通す)。
export function matchesFilters(source, filters) {
  return Object.entries(filters).every(([key, checked]) => {
    if (!checked || !checked.size) return true;
    return matchesFieldFilter(source[key], checked);
  });
}

function appendFilterGroup(parent, titleText, entries, filters, onChange) {
  if (!entries.length) return;
  const group = document.createElement('div');
  group.className = 'board-filter-field-group';
  const groupTitle = document.createElement('p');
  groupTitle.className = 'board-filter-field-title';
  groupTitle.textContent = titleText;
  group.appendChild(groupTitle);
  const checks = document.createElement('div');
  checks.className = 'board-checkbox-group';
  entries.forEach(({ fieldKey, value, label }) => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!filters[fieldKey]?.has(value);
    cb.addEventListener('change', () => {
      if (!filters[fieldKey]) filters[fieldKey] = new Set();
      if (cb.checked) filters[fieldKey].add(value);
      else filters[fieldKey].delete(value);
      onChange();
    });
    const span = document.createElement('span');
    span.textContent = label;
    lbl.appendChild(cb);
    lbl.appendChild(span);
    checks.appendChild(lbl);
  });
  group.appendChild(checks);
  parent.appendChild(group);
}

// options:
//   containerId: 描画先要素のid
//   filters: フィールドキー -> 選択中の値のSet (呼び出し側が保持するオブジェクトをそのまま渡す)
//   lang: 現在の言語
//   isAdmin: 管理者専用の追加フィルター(gender/ageGroup/platforms/spending/multiFrequency/
//            showGenshinRanking/showGenshinCheck/friendPreference)を出すかどうか
//   isOpen/setOpen: フィルターバー(<details>)の開閉状態を画面の再描画をまたいで保持するためのgetter/setter
//   onChange: フィルターが変わるたびに呼ばれる(一覧の再描画をトリガーする)
//   strings: { barTitle, resetBtn, attrGroupTitle, offerTitle, requestTitle, adminTitle }
export function renderFilterBar({ containerId, filters, lang, isAdmin, isOpen, setOpen, onChange, strings }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const toEntries = (fieldKey, opts) => opts.map((o) => ({ fieldKey, ...o }));

  container.innerHTML = '';

  const rootDetails = document.createElement('details');
  rootDetails.className = 'board-filter-details';
  rootDetails.open = isOpen();
  rootDetails.addEventListener('toggle', () => { setOpen(rootDetails.open); });
  const summary = document.createElement('summary');
  summary.className = 'board-filter-bar-title';
  summary.textContent = strings.barTitle;
  rootDetails.appendChild(summary);

  const header = document.createElement('div');
  header.className = 'board-filter-bar-header';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'board-filter-reset-btn';
  resetBtn.textContent = strings.resetBtn;
  resetBtn.addEventListener('click', () => {
    Object.values(filters).forEach((set) => set.clear());
    renderFilterBar({ containerId, filters, lang, isAdmin, isOpen, setOpen, onChange, strings });
    onChange();
  });
  header.appendChild(resetBtn);
  rootDetails.appendChild(header);

  const body = document.createElement('div');
  body.className = 'board-filter-bar-body';
  appendFilterGroup(body, fieldLabel('vc', lang), toEntries('vc', filterFieldOptions('vc', lang)), filters, onChange);
  const psOptions = filterFieldOptions('playStyles', lang);
  const generalPs = psOptions.filter((o) => !PLAYSTYLE_OFFER_VALUES.includes(o.value) && !PLAYSTYLE_REQUEST_VALUES.includes(o.value));
  const offerPs = psOptions.filter((o) => PLAYSTYLE_OFFER_VALUES.includes(o.value));
  const requestPs = psOptions.filter((o) => PLAYSTYLE_REQUEST_VALUES.includes(o.value));
  appendFilterGroup(body, fieldLabel('playStyles', lang), toEntries('playStyles', generalPs), filters, onChange);
  appendFilterGroup(body, strings.offerTitle, toEntries('playStyles', offerPs), filters, onChange);
  appendFilterGroup(body, strings.requestTitle, toEntries('playStyles', requestPs), filters, onChange);
  appendFilterGroup(body, fieldLabel('inviteStyle', lang), toEntries('inviteStyle', filterFieldOptions('inviteStyle', lang)), filters, onChange);
  appendFilterGroup(body, fieldLabel('vcApps', lang), toEntries('vcApps', filterFieldOptions('vcApps', lang)), filters, onChange);
  const attrEntries = ['casualOk', 'jokingOk', 'yuriOk', 'fujoshiOk', 'roughTalk', 'sameOshiReject']
    .flatMap((fk) => toEntries(fk, filterFieldOptions(fk, lang)));
  appendFilterGroup(body, strings.attrGroupTitle, attrEntries, filters, onChange);
  rootDetails.appendChild(body);

  if (isAdmin) {
    const adminDetails = document.createElement('details');
    adminDetails.className = 'board-filter-admin-details';
    const adminSummary = document.createElement('summary');
    adminSummary.textContent = strings.adminTitle;
    adminDetails.appendChild(adminSummary);
    const adminBody = document.createElement('div');
    adminBody.className = 'board-filter-bar-body';
    ['gender', 'ageGroup', 'platforms', 'spending', 'multiFrequency', 'showGenshinRanking', 'showGenshinCheck', 'friendPreference'].forEach((fk) => {
      appendFilterGroup(adminBody, fieldLabel(fk, lang), toEntries(fk, filterFieldOptions(fk, lang)), filters, onChange);
    });
    adminDetails.appendChild(adminBody);
    rootDetails.appendChild(adminDetails);
  }
  container.appendChild(rootDetails);
}
