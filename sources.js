/* Safe, optional asset-catalog adapter. No proxy, credentials, eval, or server. */
(function () {
  'use strict';
  const URL_SOURCE = 'https://gamers-hack.com/tftimg/set-18';
  const raster = /\.(png|jpe?g|webp|avif)(?:[?#]|$)/i;
  const forbidden = /(?:avatar|favicon|tracking|spacer|pixel|badge|site-logo|gravatar)/i;
  const CATEGORIES = { champion: 'チャンピオン', trait: '特性', item: 'アイテム', augment: 'オーグメント', tactician: 'タクティシャン', arena: 'アリーナ', charms: 'チャーム', 'region-portal': '地域ポータル', regalia: 'レガリア', mission: 'ミッション', queue: 'キュー', sprite: 'スプライト', 'stage-round-data': 'ステージ・ラウンド', 'augment-container': 'オーグメント枠', other: 'その他' };
  function categoryOf(item) {
    try {
      const url = new URL(item.url);
      const category = url.hostname === 'raw.githubusercontent.com' ? url.pathname.match(/^\/noxelisdev\/TFT_DDragon\/[^/]+\/img\/([^/]+)\//)?.[1] : null;
      return Object.hasOwn(CATEGORIES, category) ? category : 'other';
    } catch { return 'other'; }
  }
  function filterCatalog(items, category = 'champion', query = '') {
    const q = query.trim().toLocaleLowerCase('ja');
    return items.filter(item => categoryOf(item) === category && (!q || item.name.toLocaleLowerCase('ja').includes(q) || item.url.toLowerCase().includes(q)));
  }
  function imageURL(value, base = URL_SOURCE) {
    if (typeof value !== 'string' || value.length > 4096) return null;
    try { const u = new URL(value.replace(/&amp;/g, '&'), base); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
  }
  function nameFromURL(url) {
    try { return decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 100); } catch { return '画像'; }
  }
  function parseHTML(html, base = URL_SOURCE) {
    if (html.length > 12 * 1024 * 1024) throw new Error('一覧ファイルが大きすぎます。');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const results = new Map();
    const add = (url, name, trustedImage = false) => {
      const u = imageURL(url, base);
      if (!u || forbidden.test(u) || (!trustedImage && !raster.test(u))) return;
      if (!results.has(u) && results.size < 1500) results.set(u, { url: u, name: (name || nameFromURL(u)).slice(0, 140) });
    };
    doc.querySelectorAll('img').forEach(img => {
      const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
      const variants = srcset.split(',').map(s => s.trim().split(/\s+/)).filter(s => s[0]).sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0));
      const name = img.getAttribute('alt') || img.getAttribute('title') || '';
      const parent = img.closest('a');
      const href = parent?.getAttribute('href');
      if (href && raster.test(href)) add(href, name, true);
      else add(img.getAttribute('data-full') || img.getAttribute('data-original') || variants[0]?.[0] || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src'), name, true);
    });
    doc.querySelectorAll('a[href]').forEach(a => add(a.getAttribute('href'), a.getAttribute('title') || a.textContent.trim()));
    doc.querySelectorAll('[data-image],[data-url],[data-src],[data-full],[data-bg],[data-background]').forEach(el => {
      for (const key of ['data-image', 'data-url', 'data-src', 'data-full', 'data-bg', 'data-background']) add(el.getAttribute(key), el.getAttribute('data-name') || el.getAttribute('aria-label') || el.getAttribute('title'));
    });
    doc.querySelectorAll('[style]').forEach(el => {
      for (const m of el.getAttribute('style').matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(m[1], el.getAttribute('aria-label'));
    });
    // Extract only literal image URLs from embedded JSON. Never execute page scripts.
    doc.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]').forEach(script => {
      let count = 0;
      function walk(v, name, depth) {
        if (++count > 12000 || depth > 14) return;
        if (typeof v === 'string') add(v, name);
        else if (Array.isArray(v)) v.forEach(x => walk(x, name, depth + 1));
        else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, typeof v.name === 'string' ? v.name : name, depth + 1));
      }
      try { walk(JSON.parse(script.textContent), '', 0); } catch { /* Non-catalog JSON is ignored. */ }
    });
    return [...results.values()];
  }
  async function fetchCatalog() {
    if (!Array.isArray(window.TFTCatalog) || !window.TFTCatalog.length) throw new Error('同梱の素材一覧が見つかりません。ページを再読み込みするか、最新版をダウンロードしてください。');
    return window.TFTCatalog.map(item => ({ ...item }));
  }
  async function parseCatalogFile(file) {
    if (file.size > 12 * 1024 * 1024) throw new Error('一覧ファイルは12 MB以内にしてください。');
    const text = await file.text();
    if (/\.html?$/i.test(file.name) || /^\s*</.test(text)) return parseHTML(text);
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('一覧JSONを読み込めませんでした。'); }
    const arr = Array.isArray(data) ? data : data.images || data.assets;
    if (!Array.isArray(arr)) throw new Error('images 配列のある画像一覧JSONが必要です。');
    const base = imageURL(data.source) || URL_SOURCE;
    const unique = new Map();
    arr.slice(0, 1500).forEach(entry => {
      const item = typeof entry === 'string' ? { url: entry } : entry;
      const url = imageURL(item?.url || item?.src, base);
      if (url) unique.set(url, { url, name: String(item.name || item.alt || nameFromURL(url)).slice(0, 140) });
    });
    if (!unique.size) throw new Error('使用できる画像URLがありません。');
    return [...unique.values()];
  }
  async function fetchImage(url) {
    const safeURL = imageURL(url);
    if (!safeURL) throw new Error('http / https の画像URLを入力してください。');
    let response;
    try { response = await fetch(safeURL, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error('画像を直接取得できません。配信元の外部読込制限、または通信エラーです。画像を保存して「手元の画像」から追加してください。'); }
    if (!response.ok) throw new Error(`画像の取得に失敗しました（HTTP ${response.status}）。`);
    const contentType = (response.headers.get('content-type') || '').split(';')[0];
    if (contentType && !['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'application/octet-stream'].includes(contentType)) throw new Error('対応画像ではありません。ページではなく、PNG・JPG・WebP・AVIFの画像URLを指定してください。');
    if (+response.headers.get('content-length') > 20 * 1024 * 1024) throw new Error('画像は20 MB以下にしてください。');
    const blob = await response.blob();
    if (blob.size > 20 * 1024 * 1024) throw new Error('画像は20 MB以下にしてください。');
    return { blob, name: nameFromURL(safeURL), source: safeURL };
  }
  // User-invoked on the source site. It only downloads a URL manifest locally.
  function bookmarkletBody() {
    const map = new Map();
    function add(src, name) {
      try { const url = new URL(src, location.href); if (!/^https?:$/.test(url.protocol)) return; if (!map.has(url.href)) map.set(url.href, { url: url.href, name: name || decodeURIComponent(url.pathname.split('/').pop()) }); } catch {}
    }
    document.querySelectorAll('img').forEach(img => {
      if (img.naturalWidth && img.naturalWidth < 48) return;
      const a = img.closest('a');
      const href = a && a.href;
      const candidates = (img.getAttribute('data-srcset') || img.srcset || '').split(',').map(s => s.trim().split(/\s+/)).sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0));
      add(href && /\.(png|jpe?g|webp|avif)(?:[?#]|$)/i.test(href) ? href : img.getAttribute('data-original') || candidates[0]?.[0] || img.currentSrc || img.src, img.alt || img.title);
    });
    document.querySelectorAll('a[href]').forEach(a => { if (/\.(png|jpe?g|webp|avif)(?:[?#]|$)/i.test(a.href)) add(a.href, a.title || a.textContent.trim()); });
    document.querySelectorAll('[style]').forEach(el => { const b = getComputedStyle(el).backgroundImage; for (const m of b.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(m[1], el.title); });
    const blob = new Blob([JSON.stringify({ kind: 'tft-asset-catalog', source: location.href, images: [...map.values()] }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tft-assets.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 15000);
  }
  const bookmarklet = 'javascript:(' + bookmarkletBody.toString() + ')()';
  window.TFTSources = { URL_SOURCE, CATEGORIES, categoryOf, filterCatalog, imageURL, nameFromURL, parseHTML, fetchCatalog, parseCatalogFile, fetchImage, bookmarklet };
})();
