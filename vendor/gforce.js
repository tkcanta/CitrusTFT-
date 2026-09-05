/* Classic-script wrapper for file:// compatibility. Original: G-Force UI 1.0.0 (MIT). */
(function(){
/**
 * G-Force UI 1.0.0
 * Vanilla JavaScript behavior layer.
 */

const gfuStorage = { getItem(k) { try { return window.localStorage.getItem(k); } catch { return null; } }, setItem(k,v) { try { window.localStorage.setItem(k,v); } catch {} } };
const ICONS = {
  menu: '<path d="M3 6h18V4H3v2Zm0 7h18v-2H3v2Zm0 7h18v-2H3v2Z"/>',
  search: '<path d="M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/>',
  close: '<path d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.71 10.59 12 5.7 18.29l1.41 1.42L12 13.41l4.89 4.88 1.41-1.42L13.41 12l4.89-6.29Z"/>',
  add: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z"/>',
  check: '<path d="m9 16.17-4.17-4.17-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/>',
  chevron_right: '<path d="m9.29 6.71 1.42-1.42L17.41 12l-6.7 6.71-1.42-1.42L14.59 12 9.29 6.71Z"/>',
  chevron_left: '<path d="m14.71 6.71-1.42-1.42L6.59 12l6.7 6.71 1.42-1.42L9.41 12l5.3-5.29Z"/>',
  expand_more: '<path d="m7.41 8.59 4.59 4.58 4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z"/>',
  more_vert: '<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2Zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Z"/>',
  home: '<path d="M12 3 2 12h3v9h6v-6h2v6h6v-9h3L12 3Zm5 16h-2v-6H9v6H7v-7.9l5-4.5 5 4.5V19Z"/>',
  dashboard: '<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>',
  tune: '<path d="M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z"/>',
  palette: '<path d="M12 3C7.03 3 3 6.58 3 11c0 3.31 2.69 6 6 6h1.45c.69 0 1.09-.76.73-1.35a2.98 2.98 0 0 1-.43-1.55c0-1.66 1.34-3 3-3H16c2.76 0 5-2.24 5-5C21 4.39 17.13 3 12 3Zm-5.5 9A1.5 1.5 0 1 1 6.5 9a1.5 1.5 0 0 1 0 3Zm3-4A1.5 1.5 0 1 1 9.5 5a1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>',
  code: '<path d="m8.59 16.59-4.58-4.58 4.58-4.59L7.17 6l-6 6 6 6 1.42-1.41Zm6.82 0 4.58-4.58-4.58-4.59L16.83 6l6 6-6 6-1.42-1.41ZM9.5 20h2l3-16h-2l-3 16Z"/>',
  widgets: '<path d="M13 13v8h8v-8h-8Zm-10 8h8v-8H3v8ZM3 3v8h8V3H3Zm12.5 0L11 7.5l4.5 4.5L20 7.5 15.5 3Z"/>',
  text_fields: '<path d="M5 4v3h5.5v12h3V7H19V4H5Z"/>',
  space_bar: '<path d="M18 9v4H6V9H4v6h16V9h-2Z"/>',
  rounded_corner: '<path d="M19 19v2h2v-2h-2Zm0-2h2v-2h-2v2Zm-8 4h2v-2h-2v2Zm4 0h2v-2h-2v2Zm4-8h2v-2h-2v2Zm0-4h2V7h-2v2Zm-8-6v2h2V3h-2Zm8 2h2V3h-2v2Zm-4 0h2V3h-2v2ZM3 21h6v-2H5v-4c0-5.52 4.48-10 10-10V3C8.37 3 3 8.37 3 15v6Z"/>',
  animation: '<path d="M15.55 5.55 11 1v3.07a8 8 0 0 0-6.93 6.93H1l4.55 4.55L10.1 11H7.12A5 5 0 0 1 11 7.12V10l4.55-4.45ZM22.93 13H19.9A5 5 0 0 1 16 16.88V14l-4.55 4.45L16 23v-3.07A8 8 0 0 0 22.93 13Z"/>',
  settings: '<path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65-2-3.46-2.49 1a7.2 7.2 0 0 0-1.69-.98L15 3.27h-4l-.35 2.66c-.61.25-1.17.57-1.69.98l-2.49-1-2 3.46 2.11 1.65A6.7 6.7 0 0 0 6.5 12c0 .33.03.66.08.98l-2.11 1.65 2 3.46 2.49-1c.52.41 1.08.74 1.69.98L11 20.73h4l.35-2.66c.61-.25 1.17-.57 1.69-.98l2.49 1 2-3.46-2.1-1.65ZM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5Z"/>',
  dark_mode: '<path d="M12.74 2a9.5 9.5 0 1 0 9.26 11.74A7.5 7.5 0 0 1 12.74 2Zm-.24 17.5A7.5 7.5 0 0 1 9.6 5.08 9.5 9.5 0 0 0 18.92 14.4a7.48 7.48 0 0 1-6.42 5.1Z"/>',
  light_mode: '<path d="M6.76 4.84 5.35 3.43 3.93 4.84l1.42 1.42 1.41-1.42ZM1 13h3v-2H1v2Zm10-12v3h2V1h-2Zm8.66 2.42-1.42 1.42 1.42 1.42 1.41-1.42-1.41-1.42ZM17.24 19.16l1.42 1.41 1.41-1.41-1.41-1.42-1.42 1.42ZM20 13h3v-2h-3v2ZM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM11 20v3h2v-3h-2ZM3.93 19.16l1.42 1.41 1.41-1.41-1.41-1.42-1.42 1.42Z"/>',
  density_medium: '<path d="M4 18h16v-2H4v2Zm0-5h16v-2H4v2Zm0-7v2h16V6H4Z"/>',
  person: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/>',
  group: '<path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3c-.32 0-.63.05-.91.14A5 5 0 0 1 15 11h1ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-3.87 0-7 1.79-7 4v2h10v-2c0-1.09.42-2.09 1.14-2.93A9.7 9.7 0 0 0 8 13Zm8 0c-.67 0-1.3.07-1.88.2A5.42 5.42 0 0 1 16 17v2h7v-2c0-2.21-3.13-4-7-4Z"/>',
  notifications: '<path d="M18 16v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Zm-6 6a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Z"/>',
  help: '<path d="M11 18h2v-2h-2v2Zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 3.28 1.53C12.13 12.46 11 13.32 11 15h2c0-.91.63-1.45 1.54-2.18A4 4 0 0 0 12 6Z"/>',
  info: '<path d="M11 17h2v-6h-2v6Zm1-15a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-11h2V7h-2v2Z"/>',
  warning: '<path d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z"/>',
  error: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z"/>',
  check_circle: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9Z"/>',
  delete: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM8 9h8v10H8V9Zm7.5-5-1-1h-5l-1 1H5v2h14V4h-3.5Z"/>',
  edit: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>',
  save: '<path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z"/>',
  upload: '<path d="M9 16h6v-6h4l-7-7-7 7h4v6Zm-4 2h14v2H5v-2Z"/>',
  download: '<path d="M19 9h-4V3H9v6H5l7 7 7-7ZM5 18v2h14v-2H5Z"/>',
  filter_list: '<path d="M10 18h4v-2h-4v2ZM3 6v2h18V6H3Zm3 7h12v-2H6v2Z"/>',
  sort: '<path d="M3 18h6v-2H3v2ZM3 6v2h18V6H3Zm0 7h12v-2H3v2Z"/>',
  calendar: '<path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V9h14v10ZM5 7V6h14v1H5Z"/>',
  schedule: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm1-13h-2v6l5.25 3.15 1-1.64L13 12V7Z"/>',
  mail: '<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z"/>',
  link: '<path d="M3.9 12a5 5 0 0 1 5-5H12v2H8.9a3 3 0 1 0 0 6H12v2H8.9a5 5 0 0 1-5-5Zm5.1 1v-2h6v2H9Zm6.1-6H12V5h3.1a5 5 0 0 1 0 10H12v-2h3.1a3 3 0 1 0 0-6Z"/>',
  visibility: '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5Zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>',
  lock: '<path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm3-9H9V6a3 3 0 0 1 6 0v2Z"/>',
  refresh: '<path d="M17.65 6.35A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.76-4.24L13 11h8V3l-3.35 3.35Z"/>',
  open_in_new: '<path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7ZM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7Z"/>',
  content_copy: '<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/>',
  star: '<path d="m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z"/>',
  folder: '<path d="M10 4H2v16h20V6H12l-2-2Zm10 14H4V6h5.17l2 2H20v10Z"/>',
  description: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm2 16H8v-2h8v2Zm0-4H8v-2h8v2Zm-3-5V3.5L18.5 9H13Z"/>',
  terminal: '<path d="m4 17 6-5-6-5v3l2.5 2L4 14v3Zm7 1h9v-2h-9v2Z"/>',
  arrow_up: '<path d="m4 12 1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8Z"/>',
  arrow_down: '<path d="m20 12-1.41-1.41L13 16.17V4h-2v12.17l-5.59-5.58L4 12l8 8 8-8Z"/>',
  logout: '<path d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59ZM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/>'
};

const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

function renderIcons(root = document) {
  qsa('[data-icon]:not([data-icon-rendered])', root).forEach((host) => {
    const name = host.dataset.icon;
    const body = ICONS[name] || ICONS.widgets;
    const size = host.dataset.iconSize || host.getAttribute('data-size') || '';
    const title = host.getAttribute('aria-label');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', `gfu-icon${host.classList.contains('gfu-icon') ? '' : ''}`);
    if (size) svg.dataset.size = size;
    if (title) {
      svg.setAttribute('role', 'img');
      const titleNode = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      titleNode.textContent = title;
      svg.append(titleNode);
    } else {
      svg.setAttribute('aria-hidden', 'true');
    }
    svg.insertAdjacentHTML('beforeend', body);
    host.replaceChildren(svg);
    host.dataset.iconRendered = 'true';
  });
}

function emit(target, name, detail = {}, cancelable = false) {
  return target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail, cancelable }));
}

function setTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = normalized;
  gfuStorage.setItem('gfu-theme', normalized);
  qsa('[data-gfu-theme-label]').forEach((node) => {
    node.textContent = normalized === 'dark' ? 'ライトテーマへ切替' : 'ダークテーマへ切替';
  });
  qsa('[data-gfu-theme-icon]').forEach((node) => {
    node.dataset.icon = normalized === 'dark' ? 'light_mode' : 'dark_mode';
    delete node.dataset.iconRendered;
  });
  renderIcons();
}

function cycleDensity() {
  const order = ['compact', 'comfortable', 'touch'];
  const current = document.documentElement.dataset.density || 'comfortable';
  const next = order[(order.indexOf(current) + 1) % order.length];
  document.documentElement.dataset.density = next;
  gfuStorage.setItem('gfu-density', next);
  qsa('[data-gfu-density-label]').forEach((node) => { node.textContent = next; });
  showSnackbar(`表示密度を「${next}」に変更しました。`);
}

function initPreferences() {
  const storedTheme = gfuStorage.getItem('gfu-theme');
  const preferredDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  setTheme(storedTheme || (preferredDark ? 'dark' : 'light'));

  const storedDensity = gfuStorage.getItem('gfu-density');
  if (['compact', 'comfortable', 'touch'].includes(storedDensity)) {
    document.documentElement.dataset.density = storedDensity;
  }
  qsa('[data-gfu-density-label]').forEach((node) => {
    node.textContent = document.documentElement.dataset.density || 'comfortable';
  });
}

function initNavigation() {
  const drawer = document.querySelector('[data-gfu-nav-drawer]');
  const scrim = document.querySelector('[data-gfu-nav-scrim]');
  if (!drawer) return;

  const setOpen = (open) => {
    drawer.dataset.open = String(open);
    if (scrim) scrim.dataset.open = String(open);
    qsa('[data-gfu-nav-toggle]').forEach((button) => button.setAttribute('aria-expanded', String(open)));
    if (open && window.innerWidth < 840) drawer.querySelector('a,button')?.focus();
  };

  qsa('[data-gfu-nav-toggle]').forEach((button) => button.addEventListener('click', () => {
    setOpen(drawer.dataset.open !== 'true');
  }));
  scrim?.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('click', (event) => {
    if (event.target.closest('a') && window.innerWidth < 840) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.dataset.open === 'true') setOpen(false);
  });
}

function initSearchFields(root = document) {
  qsa('[data-gfu-search]', root).forEach((search) => {
    const input = search.querySelector('input');
    const clear = search.querySelector('[data-gfu-search-clear]');
    if (!input || !clear) return;
    const sync = () => { clear.hidden = input.value.length === 0; };
    input.addEventListener('input', sync);
    clear.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    sync();
  });
}

function activateTab(tab, moveFocus = false) {
  const list = tab.closest('[role="tablist"]');
  if (!list) return;
  const tabs = qsa('[role="tab"]', list);
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    const panelId = item.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (panel) panel.hidden = !selected;
  });
  if (moveFocus) tab.focus();
  emit(list, 'gfu:change', { tabId: tab.id });
}

function initTabs(root = document) {
  qsa('[data-gfu-tabs]', root).forEach((tabsRoot) => {
    if (tabsRoot.dataset.gfuReady === 'true') return;
    tabsRoot.dataset.gfuReady = 'true';
    const list = tabsRoot.querySelector('[role="tablist"]');
    if (!list) return;
    const tabs = qsa('[role="tab"]', list);
    list.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) activateTab(tab, false);
    });
    list.addEventListener('keydown', (event) => {
      const current = event.target.closest('[role="tab"]');
      if (!current) return;
      let index = tabs.indexOf(current);
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[index], true);
    });
  });
}

function initPressedControls(root = document) {
  root.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-gfu-toggle]');
    if (toggle) {
      const pressed = toggle.getAttribute('aria-pressed') === 'true';
      toggle.setAttribute('aria-pressed', String(!pressed));
      emit(toggle, 'gfu:change', { pressed: !pressed });
    }

    const segmented = event.target.closest('[data-gfu-segmented] .gfu-segmented__button');
    if (segmented) {
      qsa('.gfu-segmented__button', segmented.closest('[data-gfu-segmented]')).forEach((button) => {
        button.setAttribute('aria-pressed', String(button === segmented));
      });
      emit(segmented.closest('[data-gfu-segmented]'), 'gfu:change', { value: segmented.value || segmented.dataset.value });
    }

    const chip = event.target.closest('[data-gfu-filter-chip]');
    if (chip) {
      const pressed = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!pressed));
    }

    const remove = event.target.closest('[data-gfu-chip-remove]');
    if (remove) {
      const chipHost = remove.closest('.gfu-chip');
      chipHost?.remove();
      showSnackbar('チップを削除しました。');
    }
  });
}

let activeFloating = null;
function positionFloating(trigger, panel) {
  const rect = trigger.getBoundingClientRect();
  panel.style.inset = 'auto';
  panel.style.top = `${Math.min(window.innerHeight - panel.offsetHeight - 8, rect.bottom + 6)}px`;
  const left = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, rect.right - panel.offsetWidth));
  panel.style.left = `${left}px`;
}

function closeFloating({ returnFocus = false } = {}) {
  if (!activeFloating) return;
  const { trigger, panel } = activeFloating;
  panel.dataset.open = 'false';
  trigger.setAttribute('aria-expanded', 'false');
  activeFloating = null;
  if (returnFocus) trigger.focus();
}

function openFloating(trigger, panel) {
  if (!emit(panel, 'gfu:beforeopen', {}, true)) return;
  closeFloating();
  panel.hidden = false;
  panel.dataset.open = 'true';
  trigger.setAttribute('aria-expanded', 'true');
  positionFloating(trigger, panel);
  activeFloating = { trigger, panel };
  const first = panel.querySelector('[role="menuitem"], button, a, input');
  requestAnimationFrame(() => first?.focus());
  emit(panel, 'gfu:open');
}

function initFloating(root = document) {
  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-gfu-menu-trigger], [data-gfu-popover-trigger]');
    if (trigger) {
      event.stopPropagation();
      const id = trigger.dataset.gfuMenuTrigger || trigger.dataset.gfuPopoverTrigger;
      const panel = document.getElementById(id);
      if (!panel) return;
      if (activeFloating?.panel === panel) closeFloating({ returnFocus: true });
      else openFloating(trigger, panel);
      return;
    }

    if (event.target.closest('.gfu-menu__item')) closeFloating();
    else if (activeFloating && !event.target.closest('.gfu-menu, .gfu-popover')) closeFloating();
  });

  document.addEventListener('keydown', (event) => {
    if (!activeFloating) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFloating({ returnFocus: true });
      return;
    }
    if (activeFloating.panel.matches('[role="menu"]') && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const items = qsa('[role="menuitem"]:not([disabled])', activeFloating.panel);
      const current = document.activeElement;
      let index = items.indexOf(current);
      if (event.key === 'ArrowDown') index = (index + 1) % items.length;
      if (event.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;
      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = items.length - 1;
      event.preventDefault();
      items[index]?.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (activeFloating) positionFloating(activeFloating.trigger, activeFloating.panel);
  });
  window.addEventListener('scroll', () => {
    if (activeFloating) positionFloating(activeFloating.trigger, activeFloating.panel);
  }, true);
}

function initDialogs(root = document) {
  root.addEventListener('click', (event) => {
    const open = event.target.closest('[data-gfu-dialog-open]');
    if (open) {
      const dialog = document.getElementById(open.dataset.gfuDialogOpen);
      if (dialog && emit(dialog, 'gfu:beforeopen', {}, true)) {
        dialog.dataset.returnFocus = open.id || '';
        dialog.showModal();
        requestAnimationFrame(() => dialog.querySelector('[data-autofocus], input, button')?.focus());
        emit(dialog, 'gfu:open');
      }
    }

    const close = event.target.closest('[data-gfu-dialog-close]');
    if (close) {
      const dialog = close.closest('dialog');
      if (dialog && emit(dialog, 'gfu:beforeclose', { reason: close.dataset.gfuDialogClose }, true)) {
        dialog.close(close.dataset.gfuDialogClose || 'close');
      }
    }
  });

  qsa('dialog.gfu-dialog', root).forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && dialog.dataset.dismissible !== 'false') dialog.close('backdrop');
    });
    dialog.addEventListener('close', () => {
      const returnTo = dialog.dataset.returnFocus && document.getElementById(dialog.dataset.returnFocus);
      returnTo?.focus();
      emit(dialog, 'gfu:close', { returnValue: dialog.returnValue });
    });
  });
}

function initSideSheets(root = document) {
  const overlay = document.querySelector('[data-gfu-overlay]');
  const closeAll = () => {
    qsa('[data-gfu-side-sheet][data-open="true"]').forEach((sheet) => {
      sheet.dataset.open = 'false';
      sheet.setAttribute('aria-hidden', 'true');
    });
    if (overlay) overlay.dataset.open = 'false';
  };

  root.addEventListener('click', (event) => {
    const open = event.target.closest('[data-gfu-side-sheet-open]');
    if (open) {
      const sheet = document.getElementById(open.dataset.gfuSideSheetOpen);
      if (!sheet) return;
      closeAll();
      sheet.dataset.open = 'true';
      sheet.setAttribute('aria-hidden', 'false');
      sheet.dataset.returnFocus = open.id || '';
      if (overlay) overlay.dataset.open = 'true';
      requestAnimationFrame(() => sheet.querySelector('button, input, a')?.focus());
    }
    if (event.target.closest('[data-gfu-side-sheet-close]')) {
      const sheet = event.target.closest('[data-gfu-side-sheet]');
      const returnTo = sheet?.dataset.returnFocus && document.getElementById(sheet.dataset.returnFocus);
      closeAll();
      returnTo?.focus();
    }
  });
  overlay?.addEventListener('click', closeAll);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

function showSnackbar(message, options = {}) {
  let stack = document.querySelector('[data-gfu-snackbar-stack]');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'gfu-snackbar-stack';
    stack.dataset.gfuSnackbarStack = '';
    stack.setAttribute('aria-live', 'polite');
    document.body.append(stack);
  }
  const snackbar = document.createElement('div');
  snackbar.className = 'gfu-snackbar';
  snackbar.setAttribute('role', 'status');
  const messageNode = document.createElement('span');
  messageNode.className = 'gfu-snackbar__message';
  messageNode.textContent = message;
  snackbar.append(messageNode);

  if (options.action) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'gfu-button gfu-snackbar__action';
    action.dataset.variant = 'text';
    action.textContent = options.action.label;
    action.addEventListener('click', () => {
      options.action.onClick?.();
      snackbar.remove();
    });
    snackbar.append(action);
  }
  stack.append(snackbar);
  const duration = options.duration ?? 5000;
  if (duration > 0) window.setTimeout(() => snackbar.remove(), duration);
  return snackbar;
}

function initSnackbarTriggers(root = document) {
  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-gfu-snackbar]');
    if (trigger) {
      showSnackbar(trigger.dataset.gfuSnackbar, {
        action: trigger.dataset.gfuSnackbarAction ? { label: trigger.dataset.gfuSnackbarAction, onClick: () => showSnackbar('操作を取り消しました。') } : null
      });
    }
  });
}

function initSliders(root = document) {
  qsa('[data-gfu-slider]', root).forEach((slider) => {
    const input = slider.querySelector('input[type="range"]');
    const output = slider.querySelector('output');
    if (!input || !output) return;
    const sync = () => { output.value = input.value; output.textContent = input.value; };
    input.addEventListener('input', sync);
    sync();
  });
}

function initFileUploads(root = document) {
  qsa('[data-gfu-file-upload]', root).forEach((host) => {
    const input = host.querySelector('input[type="file"]');
    const status = host.querySelector('[data-gfu-file-status]');
    if (!input || !status) return;
    const update = () => {
      status.textContent = input.files?.length ? [...input.files].map((file) => file.name).join(', ') : 'PNG、JPG、PDF。最大10MB。';
    };
    input.addEventListener('change', update);
    ['dragenter', 'dragover'].forEach((type) => host.addEventListener(type, () => { host.dataset.dragging = 'true'; }));
    ['dragleave', 'drop'].forEach((type) => host.addEventListener(type, () => { host.dataset.dragging = 'false'; }));
  });
}

function initComboboxes(root = document) {
  qsa('[data-gfu-combobox]', root).forEach((combo) => {
    if (combo.dataset.gfuReady === 'true') return;
    combo.dataset.gfuReady = 'true';
    const input = combo.querySelector('[role="combobox"]');
    const list = combo.querySelector('[role="listbox"]');
    if (!input || !list) return;
    let activeIndex = -1;

    const visibleOptions = () => qsa('[role="option"]:not([hidden])', list);
    const setOpen = (open) => {
      list.hidden = !open;
      input.setAttribute('aria-expanded', String(open));
      if (!open) activeIndex = -1;
    };
    const render = () => {
      const query = input.value.trim().toLocaleLowerCase('ja');
      let visible = 0;
      qsa('[role="option"]', list).forEach((option) => {
        const match = option.textContent.toLocaleLowerCase('ja').includes(query);
        option.hidden = !match;
        option.dataset.active = 'false';
        if (match) visible += 1;
      });
      const empty = list.querySelector('[data-gfu-combobox-empty]');
      if (empty) empty.hidden = visible !== 0;
      setOpen(true);
    };
    const activate = (index) => {
      const options = visibleOptions();
      if (!options.length) return;
      activeIndex = (index + options.length) % options.length;
      options.forEach((option, i) => option.dataset.active = String(i === activeIndex));
      input.setAttribute('aria-activedescendant', options[activeIndex].id);
      options[activeIndex].scrollIntoView({ block: 'nearest' });
    };
    const choose = (option) => {
      input.value = option.dataset.value || option.textContent.trim();
      qsa('[role="option"]', list).forEach((item) => item.setAttribute('aria-selected', String(item === option)));
      setOpen(false);
      input.focus();
      emit(combo, 'gfu:change', { value: input.value });
    };

    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); activate(activeIndex + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); activate(activeIndex - 1); }
      else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); choose(visibleOptions()[activeIndex]); }
      else if (event.key === 'Escape') { setOpen(false); }
    });
    list.addEventListener('mousedown', (event) => {
      const option = event.target.closest('[role="option"]');
      if (option) { event.preventDefault(); choose(option); }
    });
    document.addEventListener('click', (event) => {
      if (!combo.contains(event.target)) setOpen(false);
    });
    setOpen(false);
  });
}

function initTables(root = document) {
  qsa('[data-gfu-table]', root).forEach((table) => {
    qsa('[data-sort-key]', table).forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.sortKey;
        const tbody = table.tBodies[0];
        if (!tbody) return;
        const ascending = button.getAttribute('aria-sort') !== 'ascending';
        qsa('[data-sort-key]', table).forEach((item) => item.removeAttribute('aria-sort'));
        button.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
        const rows = [...tbody.rows];
        rows.sort((a, b) => {
          const av = a.querySelector(`[data-key="${key}"]`)?.dataset.sortValue || a.querySelector(`[data-key="${key}"]`)?.textContent.trim() || '';
          const bv = b.querySelector(`[data-key="${key}"]`)?.dataset.sortValue || b.querySelector(`[data-key="${key}"]`)?.textContent.trim() || '';
          const an = Number(av); const bn = Number(bv);
          const result = Number.isNaN(an) || Number.isNaN(bn) ? av.localeCompare(bv, 'ja') : an - bn;
          return ascending ? result : -result;
        });
        rows.forEach((row) => tbody.append(row));
      });
    });

    const selectAll = table.querySelector('[data-gfu-select-all]');
    const rowChecks = qsa('[data-gfu-row-select]', table);
    const syncRows = () => {
      rowChecks.forEach((check) => { check.closest('tr').dataset.selected = String(check.checked); });
      if (selectAll) {
        selectAll.checked = rowChecks.length > 0 && rowChecks.every((check) => check.checked);
        selectAll.indeterminate = rowChecks.some((check) => check.checked) && !selectAll.checked;
      }
    };
    selectAll?.addEventListener('change', () => { rowChecks.forEach((check) => check.checked = selectAll.checked); syncRows(); });
    rowChecks.forEach((check) => check.addEventListener('change', syncRows));
    syncRows();
  });
}

function initSteppers(root = document) {
  qsa('[data-gfu-stepper-demo]', root).forEach((demo) => {
    let current = Number(demo.dataset.step || 1);
    const items = qsa('.gfu-stepper__item', demo);
    const status = demo.querySelector('[data-gfu-step-status]');
    const sync = () => {
      current = Math.max(1, Math.min(items.length, current));
      demo.dataset.step = String(current);
      items.forEach((item, index) => item.dataset.state = index + 1 < current ? 'complete' : index + 1 === current ? 'current' : 'upcoming');
      if (status) status.textContent = `ステップ ${current} / ${items.length}`;
      const back = demo.querySelector('[data-gfu-step-back]');
      const next = demo.querySelector('[data-gfu-step-next]');
      if (back) back.disabled = current === 1;
      if (next) next.textContent = current === items.length ? '完了' : '次へ';
    };
    demo.querySelector('[data-gfu-step-back]')?.addEventListener('click', () => { current -= 1; sync(); });
    demo.querySelector('[data-gfu-step-next]')?.addEventListener('click', () => {
      if (current === items.length) showSnackbar('セットアップが完了しました。');
      else current += 1;
      sync();
    });
    sync();
  });
}

function initDismissibles(root = document) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-gfu-dismiss]');
    if (!button) return;
    const selector = button.dataset.gfuDismiss;
    const target = selector === 'parent' ? button.parentElement : button.closest(selector);
    target?.remove();
  });
}

function initCatalogSearch() {
  const input = document.querySelector('[data-catalog-search]');
  if (!input) return;
  const sections = qsa('[data-catalog-item]');
  const count = document.querySelector('[data-catalog-count]');
  const empty = document.querySelector('[data-catalog-empty]');

  const filter = () => {
    const query = input.value.trim().toLocaleLowerCase('ja');
    let visible = 0;
    sections.forEach((section) => {
      const match = !query || `${section.dataset.catalogKeywords || ''} ${section.textContent}`.toLocaleLowerCase('ja').includes(query);
      section.hidden = !match;
      if (match) visible += 1;
    });
    if (count) count.textContent = `${visible} / ${sections.length}`;
    if (empty) empty.hidden = visible !== 0;
  };
  input.addEventListener('input', filter);
  filter();
}

function initScrollSpy() {
  const links = qsa('[data-catalog-nav] a[href^="#"]');
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach((link) => link.dataset.active = String(link.getAttribute('href') === `#${visible.target.id}`));
  }, { rootMargin: '-20% 0px -70% 0px', threshold: [0, 0.25, 0.5] });
  sections.forEach((section) => observer.observe(section));
}

function initCommandPalette() {
  const dialog = document.querySelector('[data-gfu-command]');
  if (!dialog) return;
  const input = dialog.querySelector('input');
  const items = qsa('[data-command-item]', dialog);
  let active = 0;

  const sync = () => {
    const query = input.value.trim().toLocaleLowerCase('ja');
    let firstVisible = -1;
    items.forEach((item, index) => {
      const show = !query || item.textContent.toLocaleLowerCase('ja').includes(query);
      item.hidden = !show;
      if (show && firstVisible < 0) firstVisible = index;
    });
    active = firstVisible;
    items.forEach((item, index) => item.dataset.active = String(index === active));
  };
  const move = (direction) => {
    const visible = items.filter((item) => !item.hidden);
    const current = visible.indexOf(items[active]);
    const next = visible[(current + direction + visible.length) % visible.length];
    active = items.indexOf(next);
    items.forEach((item, index) => item.dataset.active = String(index === active));
    next?.scrollIntoView({ block: 'nearest' });
  };
  const choose = (item) => {
    const target = item?.dataset.commandTarget;
    dialog.close('select');
    if (target) document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dialog.showModal();
      input.value = '';
      sync();
      requestAnimationFrame(() => input.focus());
    }
  });
  input.addEventListener('input', sync);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(items[active]); }
  });
  dialog.addEventListener('click', (event) => {
    const item = event.target.closest('[data-command-item]');
    if (item) choose(item);
  });
  sync();
}

function initCounterFields(root = document) {
  qsa('[data-gfu-counter-field]', root).forEach((field) => {
    const input = field.querySelector('input, textarea');
    const counter = field.querySelector('[data-gfu-counter]');
    if (!input || !counter) return;
    const max = Number(input.maxLength);
    const sync = () => { counter.textContent = `${input.value.length} / ${max}`; };
    input.addEventListener('input', sync);
    sync();
  });
}

function initLoadingDemos(root = document) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-gfu-loading-demo]');
    if (!button || button.dataset.loading === 'true') return;
    const original = button.innerHTML;
    button.dataset.loading = 'true';
    button.disabled = true;
    button.innerHTML = '<span class="gfu-spinner" aria-hidden="true"></span><span class="gfu-button__label">保存中</span>';
    window.setTimeout(() => {
      button.innerHTML = original;
      button.dataset.loading = 'false';
      button.disabled = false;
      renderIcons(button);
      showSnackbar('変更を保存しました。');
    }, 1400);
  });
}

function initGlobalActions(root = document) {
  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-gfu-theme-toggle]')) {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    }
    if (event.target.closest('[data-gfu-density-toggle]')) cycleDensity();
  });
}

function init(root = document) {
  if (root === document && document.documentElement.dataset.gfuInitialized === 'true') return;
  if (root === document) document.documentElement.dataset.gfuInitialized = 'true';

  initPreferences();
  renderIcons(root);
  initNavigation();
  initSearchFields(root);
  initTabs(root);
  initPressedControls(root);
  initFloating(root);
  initDialogs(root);
  initSideSheets(root);
  initSnackbarTriggers(root);
  initSliders(root);
  initFileUploads(root);
  initComboboxes(root);
  initTables(root);
  initSteppers(root);
  initDismissibles(root);
  initCatalogSearch();
  initScrollSpy();
  initCommandPalette();
  initCounterFields(root);
  initLoadingDemos(root);
  initGlobalActions(root);
}

const GForceUI = {
  init,
  renderIcons,
  setTheme,
  cycleDensity,
  snackbar: { show: showSnackbar },
  dialog: {
    open(id) { document.getElementById(id)?.showModal(); },
    close(id, value = 'close') { document.getElementById(id)?.close(value); }
  },
  tabs: { select(id) { const tab = document.getElementById(id); if (tab) activateTab(tab, true); } }
};

window.GForceUI = GForceUI;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init(document), { once: true });
} else {
  init(document);
}



})();
