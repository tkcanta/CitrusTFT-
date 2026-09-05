/* UI, persistence, image import, font readiness, transforms, export.
 * All user-controlled text is assigned via textContent/value, never HTML.
 */
(function () {
  'use strict';
  const C = window.TFTCore, S = window.TFTSources;
  const $ = id => document.getElementById(id);
  const assets = new Map();
  let state = C.defaultState(), scene, selected = null, panMode = false, guides = false;
  let history = [], future = [], lastHistoryKey = '', lastHistoryTime = 0;
  let activePanel = 'basic', sourcePurpose = 'background', sourceTab = 'local';
  let catalog = [], catalogAttempted = false, sourceEpoch = 0, importBusy = false;
  let renderPending = false, saveTimer = null, fontTimer = null, toastTimer = null;
  let initialized = false, dbPromise = null, saveRevision = 0, persistedAssets = new Set();
  let pointer = null, snapLines = [], dragLayer = null, lastSelection = { start: 0, end: 0 };
  let recentChoice = null;
  let isComposing = false, sourceFont = 'serif', fontEpoch = 0, fontState = 'loading', fontSignature = '';
  const localFonts = { serif: false, sans: false };
  const canvas = $('canvas'), ctx = canvas.getContext('2d', { alpha: false });
  const overlay = $('interaction'), oc = overlay.getContext('2d');
  const mini = $('mini-preview'), miniCtx = mini.getContext('2d', { alpha: false });
  const ICONS = {
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-7 5 7"/>',
    person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    undo: '<path d="m9 4-6 6 6 6M3 10h11a7 7 0 0 1 7 7v2"/>',
    redo: '<path d="m15 4 6 6-6 6m6-6H10a7 7 0 0 0-7 7v2"/>',
    align: '<path d="M4 4v16M20 4v16M8 6h8v4H8zM7 14h10v4H7z"/>',
    move: '<path d="M12 2v20M2 12h20m-13-7 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    cursor: '<path d="m5 3 14 10-7 1-3 7-4-18Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    warn: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17v.5"/>',
    type: '<path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3"/>',
    eyeOff: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9 5.3A11 11 0 0 1 22 12a13 13 0 0 1-4 4M6 6A15 15 0 0 0 2 12a12 12 0 0 0 14.4 6.5"/>'
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    // Constant, developer-owned SVG paths only.
    svg.innerHTML = ICONS[name] || ICONS.image; return svg;
  }
  function renderCustomIcons(root = document) { root.querySelectorAll('[data-ticon]').forEach(el => { if (!el.firstElementChild) el.append(icon(el.dataset.ticon)); }); }
  function gfuIconButton(name, label, action) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gfu-icon-button'; b.setAttribute('aria-label', label); b.title = label;
    if (action) b.dataset.action = action;
    const span = document.createElement('span'); span.dataset.icon = name; b.append(span); return b;
  }
  function setValue(id, value, force = false) {
    const el = $(id); if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else if ((force || !isComposing || document.activeElement !== el) && el.value !== String(value)) el.value = String(value);
  }
  function setPressed(id, value) { $(id)?.querySelectorAll('[data-value]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === String(value)))); }
  function trackingLabel(value) { return Math.round(C.trackingPercent(value)) + '%'; }
  function toast(message, duration = 3800) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, duration); }
  function busy(on, message = '画像を処理中…') { $('busy').hidden = !on; $('busy-text').textContent = message; }
  function uid(prefix) { return prefix + '-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)); }
  function openDialog(id) { const d = $(id); if (!d.open) d.showModal(); }
  function closeDialog(id) { $(id).close(); }
  function anyDialog() { return !!document.querySelector('dialog[open]'); }
  function confirmAction(message, title = '内容を置き換えますか？') {
    $('confirm-title').textContent = title; $('confirm-message').textContent = message;
    const d = $('confirm-dialog'); d.returnValue = ''; openDialog('confirm-dialog');
    return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }));
  }
  function record(key = '') {
    const now = performance.now();
    if (!(key && key === lastHistoryKey && now - lastHistoryTime < 650)) {
      history.push(C.clone(state)); if (history.length > 60) history.shift();
    }
    future = []; lastHistoryKey = key; lastHistoryTime = now;
  }
  function mutate(fn, key = '') {
    const before = JSON.stringify(state); record(key); fn(state);
    if (JSON.stringify(state) === before && history.length && JSON.stringify(history[history.length - 1]) === before && !key) history.pop();
    changed();
  }
  function changed(options = {}) {
    trimAssets(); scene = C.layout(state, assets); requestRender(); syncUI(options.force); scheduleSave();
    if (options.fonts !== false) { clearTimeout(fontTimer); fontTimer = setTimeout(() => ensureFonts(), 350); }
  }
  function undo() {
    if (!history.length) return;
    future.push(C.clone(state)); state = history.pop(); lastHistoryKey = ''; selected = C.getLayer(state, selected) || ['headline','subtitle','logo','band'].includes(selected) ? selected : null;
    changed({ force: true }); toast('元に戻しました', 1600);
  }
  function redo() {
    if (!future.length) return;
    history.push(C.clone(state)); state = future.pop(); lastHistoryKey = ''; changed({ force: true }); toast('やり直しました', 1600);
  }
  function db() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open('tft-thumbnail-local-v1', 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => { req.result.createObjectStore('projects'); req.result.createObjectStore('assets', { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); req.onblocked = () => reject(new Error('保存領域が別タブで使用中です。'));
    });
    return dbPromise;
  }
  async function dbGet(store, key) {
    const database = await db();
    return new Promise((resolve, reject) => { const req = database.transaction(store).objectStore(store).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  }
  function usedAssetIDs(s = state) { return [...new Set([s.background.asset, s.logo.asset, s.character?.asset, ...s.overlays.map(v => v.asset)].filter(id => id && id !== 'builtin-logo'))]; }
  function recentAssets() { return [...assets.values()].filter(a=>a.id!=='builtin-logo').sort((a,b)=>b.at-a.at).slice(0,24); }
  function trimAssets() {
    const keep = new Set(['builtin-logo',...recentAssets().map(a=>a.id),...usedAssetIDs()]);
    [...history,...future].forEach(s=>usedAssetIDs(s).forEach(id=>keep.add(id)));
    for(const id of assets.keys()) if(!keep.has(id)) assets.delete(id);
  }
  async function useExistingAsset(a,purpose=sourcePurpose) {
    if(purpose==='character' && a.alpha) {
      const [header,data]=a.data.split(','),bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
      return importBlob(new Blob([bytes],{type:header.slice(5).split(';')[0]}),purpose,a.name,a.source);
    }
    applyAsset(a,purpose);
  }
  function scheduleSave() {
    if (!initialized) return;
    ++saveRevision;
    $('save-status').textContent = '変更を保存中…'; $('save-dot').dataset.state = 'saving';
    clearTimeout(saveTimer); saveTimer = setTimeout(saveAuto, 700);
  }
  async function saveAuto() {
    const revision = saveRevision, snapshot = C.clone(state);
    try {
      const database = await db();
      const recentIDs = recentAssets().map(a=>a.id).reverse();
      const durableIDs = new Set([...usedAssetIDs(snapshot),...recentIDs]);
      const newAssets = [...assets.values()].filter(a => a.id !== 'builtin-logo' && durableIDs.has(a.id) && !persistedAssets.has(a.id));
      await new Promise((resolve, reject) => {
        const tx = database.transaction(['projects', 'assets'], 'readwrite');
        const keys = tx.objectStore('assets').getAllKeys();
        keys.onsuccess = () => keys.result.forEach(id => { if(!durableIDs.has(id)) tx.objectStore('assets').delete(id); });
        newAssets.forEach(a => tx.objectStore('assets').put({ id: a.id, name: a.name, data: a.data, source: a.source || '', at: a.at }));
        tx.objectStore('projects').put({ state: snapshot, at: Date.now(), recents: recentIDs }, 'autosave');
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
      persistedAssets = new Set([...durableIDs].filter(id=>assets.has(id)));
      if (revision === saveRevision) { $('save-status').textContent = 'このブラウザに保存済み'; $('save-dot').dataset.state = 'saved'; }
    } catch {
      $('save-status').textContent = '自動保存不可 · ファイル保存を使用'; $('save-dot').dataset.state = 'error';
    }
  }
  async function restore() {
    try {
      const saved = await dbGet('projects', 'autosave'); if (!saved) return;
      const candidate = C.validate(saved.state);
      const ids = [...new Set([...usedAssetIDs(candidate), ...(saved.recents || []).slice(-24)])];
      let missing = 0;
      for (const id of ids) {
        try { const a = await dbGet('assets', id); if (!a) { missing++; continue; } await registerData(a.data, a.name, id, a.source, a.at); persistedAssets.add(id); } catch { missing++; }
      }
      state = candidate;
      if (missing) toast('一部の保存画像を復元できませんでした。画像を差し替えてください。', 6000);
      else toast('前回の編集を復元しました', 2400);
    } catch { $('save-status').textContent = '自動保存を利用できません'; $('save-dot').dataset.state = 'error'; }
  }
  function readAsData(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('ファイルを読み込めませんでした。')); r.readAsDataURL(blob); }); }
  async function decodeImage(data) {
    const image = new Image(); image.decoding = 'async';
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('画像を開けませんでした。PNG・JPG・WebP・AVIFを使用してください。')); image.src = data; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('画像が大きすぎます。4,000万ピクセル以下に縮小してください。');
    return image;
  }
  async function registerData(data, name, id = uid('asset'), source = '', at = Date.now(), target = assets) {
    if (!/^data:image\/(png|jpeg|webp|avif);base64,/i.test(data) || data.length > 32 * 1024 * 1024) throw new Error('埋め込み画像の形式またはサイズが不正です。');
    const image = await decodeImage(data);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(Math.min(160, image.naturalWidth))); c.height = Math.max(1, Math.round(c.width * image.naturalHeight / image.naturalWidth));
    if (c.height > 512) { c.height = 512; c.width = Math.max(1, Math.round(c.height * image.naturalWidth / image.naturalHeight)); }
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(image, 0, 0, c.width, c.height);
    const pixels = x.getImageData(0, 0, c.width, c.height).data;
    let hasTransparency = false; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 245) { hasTransparency = true; break; }
    const a = { id, name: C.clean(name || '画像', 140), image, data, source: String(source).slice(0, 4096), at, alpha: hasTransparency ? { data: pixels, w: c.width, h: c.height } : null };
    target.set(id, a); return a;
  }
  async function sniffType(blob) {
    const a = new Uint8Array(await blob.slice(0, 40).arrayBuffer());
    if (a[0] === 137 && a[1] === 80 && a[2] === 78 && a[3] === 71) return 'image/png';
    if (a[0] === 255 && a[1] === 216) return 'image/jpeg';
    const str = String.fromCharCode(...a);
    if (str.startsWith('RIFF') && str.slice(8, 12) === 'WEBP') return 'image/webp';
    if (str.slice(4, 8) === 'ftyp' && /avif|avis/.test(str.slice(8))) return 'image/avif';
    throw new Error('PNG・JPG・WebP・AVIF形式の画像を選んでください。SVGとGIFには対応していません。');
  }
  async function normalizeBlob(blob, purpose, name, source) {
    if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error('画像ファイルは1枚20 MB以下にしてください。');
    const mime = await sniffType(blob), data = await readAsData(new Blob([blob], { type: mime }));
    const image = await decodeImage(data);
    const maxSide = 4096, scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(image.naturalWidth * scale)); c.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const x = c.getContext('2d', { willReadFrequently: purpose === 'character' });
    x.imageSmoothingQuality = 'high'; x.drawImage(image, 0, 0, c.width, c.height);
    let normalized = c;
    if (purpose === 'character' && mime !== 'image/jpeg') {
      const p = x.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
      for (let y = 0; y < c.height; y++) for (let ix = 0; ix < c.width; ix++) if (p[(y * c.width + ix) * 4 + 3] > 8) { minX = Math.min(minX, ix); minY = Math.min(minY, y); maxX = Math.max(maxX, ix); maxY = Math.max(maxY, y); }
      if (maxX < 0) throw new Error('この画像は完全に透明です。');
      if (minX || minY || maxX < c.width - 1 || maxY < c.height - 1) {
        normalized = document.createElement('canvas'); normalized.width = maxX - minX + 1; normalized.height = maxY - minY + 1;
        normalized.getContext('2d').drawImage(c, minX, minY, normalized.width, normalized.height, 0, 0, normalized.width, normalized.height);
      }
    }
    const outData = normalized.toDataURL(mime === 'image/jpeg' ? 'image/jpeg' : 'image/png', .97);
    const a = await registerData(outData, name, undefined, source);
    if (scale < 1) toast('大きな画像を長辺4096 pxに縮小しました。', 4500);
    return a;
  }
  function createImageLayer(id, asset, purpose) {
    const ratio = asset.image.naturalWidth / asset.image.naturalHeight;
    const w = purpose === 'character' ? Math.min(860, 650 * ratio) : Math.min(360, 280 * ratio);
    return { id, asset: asset.id, name: asset.name, w, x: purpose === 'character' ? 900 : 270, y: purpose === 'character' ? 365 : 250, rotation: 0, opacity: 1, flip: false, locked: false, visible: true };
  }
  function applyAsset(a, purpose = sourcePurpose) {
    if (purpose === 'overlay' && state.overlays.length >= 5) throw new Error('追加画像は最大5枚です。不要な画像を削除してから追加してください。');
    if(a.id !== 'builtin-logo') { a.at=Date.now(); persistedAssets.delete(a.id); }
    let newSelected = null;
    mutate(s => {
      if (purpose === 'background') s.background = { ...s.background, asset: a.id, name: a.name, zoom: 1, panX: 0, panY: 0 };
      else if (purpose === 'logo') { s.logo.asset = a.id; s.logo.enabled = true; }
      else if (purpose === 'character') { s.character = createImageLayer('character', a, purpose); newSelected = 'character'; }
      else {
        const l = createImageLayer(uid('image'), a, purpose); s.overlays.push(l);
        const i = s.order.indexOf('subtitle'); s.order.splice(i >= 0 ? i : 0, 0, l.id); newSelected = l.id;
        const next = C.layout(s, assets), o = next.objects.get(l.id); if (o) Object.assign(l, C.autoPlace(o, next)); delete l.score;
      }
    });
    if ($('source-dialog').open) closeDialog('source-dialog');
    if (newSelected) selectLayer(newSelected, true); else { selected = null; requestRender(); }
    toast(purpose === 'background' ? '背景を追加しました' : purpose === 'character' ? 'キャラクターを追加。プレビューで位置を調整できます。' : purpose === 'logo' ? 'ロゴを差し替えました' : '画像を追加しました');
  }
  async function importBlob(blob, purpose, name, source = '') {
    if (importBusy) throw new Error('前の画像の処理が終わるまでお待ちください。');
    if (purpose === 'overlay' && state.overlays.length >= 5) throw new Error('追加画像は最大5枚です。');
    importBusy = true; busy(true);
    try { const a = await normalizeBlob(blob, purpose, name || blob.name || '貼り付け画像', source); applyAsset(a, purpose); return a; }
    finally { importBusy = false; busy(false); }
  }
  async function handleFiles(files, purpose = sourcePurpose) {
    const values = Array.from(files); if (!values.length) return;
    for (let i = 0; i < values.length; i++) {
      try { await importBlob(values[i], purpose, values[i].name); }
      catch (e) { showSourceError(e.message); toast(e.message, 5500); break; }
      if (purpose !== 'overlay') { if (values.length > 1) toast('この枠には最初の1枚を使用しました。追加画像は「画像」タブから追加できます。', 5000); break; }
    }
  }
  function showSourceError(message) { $('source-error').textContent = message; $('source-error').hidden = !message; }
  function requestRender() {
    if (renderPending) return; renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false; scene = C.layout(state, assets);
      const scale = pointer?.moved ? 1 : 2;
      if (canvas.width !== C.W * scale) { canvas.width = C.W * scale; canvas.height = C.H * scale; }
      C.draw(ctx, state, assets, scene, scale);
      miniCtx.imageSmoothingQuality = 'high'; miniCtx.drawImage(canvas, 0, 0, mini.width, mini.height);
      if ($('export-dialog').open) { const c=$('export-preview'); C.draw(c.getContext('2d',{alpha:false}),state,assets,scene,c.width/C.W); }
      $('canvas-empty').hidden = !!state.background.asset || state.character !== null || state.overlays.length > 0;
      $('stage-frame').dataset.pan = String(panMode);
      drawInteraction(); updateQuality();
      $('zoom-label').textContent = Math.round(canvas.clientWidth / C.W * 100) + '%';
    });
  }
  function drawInteraction() {
    oc.clearRect(0, 0, C.W, C.H);
    const unit = C.W / Math.max(canvas.clientWidth, 1), blue = '#0b57d0';
    oc.save(); oc.strokeStyle = blue; oc.lineWidth = unit * 1.5;
    if (guides) {
      oc.save(); oc.strokeStyle = 'rgba(255,255,255,.45)'; oc.setLineDash([6 * unit, 6 * unit]); oc.lineWidth = unit;
      oc.strokeRect(24, 24, C.W - 48, C.H - 48);
      for (let i = 1; i < 3; i++) { oc.beginPath(); oc.moveTo(C.W * i / 3, 0); oc.lineTo(C.W * i / 3, C.H); oc.moveTo(0, C.H * i / 3); oc.lineTo(C.W, C.H * i / 3); oc.stroke(); }
      oc.restore();
    }
    snapLines.forEach(l => { oc.beginPath(); if (l.axis === 'x') { oc.moveTo(l.value, 0); oc.lineTo(l.value, C.H); } else { oc.moveTo(0, l.value); oc.lineTo(C.W, l.value); } oc.stroke(); });
    const o = scene?.objects.get(selected);
    if (o && !panMode) {
      oc.translate(o.x, o.y); oc.rotate((o.rotation || 0) * Math.PI / 180);
      oc.strokeStyle = '#fff'; oc.lineWidth = unit * 3; oc.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
      oc.strokeStyle = blue; oc.lineWidth = unit * 1.5;
      if (o.locked) oc.setLineDash([5 * unit, 3 * unit]);
      oc.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h); oc.setLineDash([]);
      if (!o.locked) {
        const radius = 4.5 * unit;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) { oc.fillStyle = '#fff'; oc.fillRect(sx * o.w / 2 - radius, sy * o.h / 2 - radius, radius * 2, radius * 2); oc.strokeRect(sx * o.w / 2 - radius, sy * o.h / 2 - radius, radius * 2, radius * 2); }
        const rh = rotationHandle(o);
        oc.beginPath(); oc.moveTo(rh.ax, rh.ay); oc.lineTo(rh.x, rh.y); oc.stroke(); oc.beginPath(); oc.arc(rh.x, rh.y, 6 * unit, 0, Math.PI * 2); oc.fillStyle = '#fff'; oc.fill(); oc.stroke();
      }
    }
    oc.restore();
  }
  function qualityItem(text, warning = false) {
    const el = document.createElement('div'); el.className = 'quality-item'; el.dataset.warning = String(warning); el.append(icon(warning ? 'warn' : 'check'));
    const span = document.createElement('span'); span.textContent = text; el.append(span); return el;
  }
  function updateQuality() {
    if (!scene) return; const nodes = [];
    if (!state.background.asset) nodes.push(qualityItem('背景画像を選択してください。', true));
    if (state.headline) nodes.push(qualityItem(scene.mainFont < 105 ? `赤文字 ${Math.round(scene.mainFont)} px。少し短くすると、さらに大きくできます。` : `赤文字 ${Math.round(scene.mainFont)} px · 縁取り込みで1行にフィット`, scene.mainFont < 105));
    else nodes.push(qualityItem('メインの赤文字は未入力です。', true));
    const sub = scene.objects.get('subtitle');
    if (sub) nodes.push(qualityItem(`白文字 ${Math.round(scene.subFont)} px · ${sub.runs.length}行${scene.subFont < 32 ? '。文章を短くすると読みやすくなります。' : ' · 黒縁付き'}`, scene.subFont < 32));
    let low = 0, outside = 0, missing = 0;
    scene.objects.forEach(o => {
      if (o.asset && o.type !== 'logo') { const a = assets.get(o.asset); if (a && o.w / a.image.naturalWidth > 2) low++; }
      if (o.type === 'text' || o.type === 'image' || o.type === 'character') { const b = C.bounds(o); if (b.right < 8 || b.x > C.W - 8 || b.bottom < 8 || b.y > C.H - 8) outside++; }
    });
    if (state.background.asset && assets.has(state.background.asset)) { const a = assets.get(state.background.asset); const r = C.backgroundRect(state.background, a.image); if (r.w / a.image.naturalWidth > 2) low++; }
    usedAssetIDs().forEach(id => { if (!assets.has(id)) missing++; });
    if (low) nodes.push(qualityItem(`${low}枚の画像が元の解像度の2倍を超えています。高解像度の素材を推奨。`, true));
    if (outside) nodes.push(qualityItem(`${outside}個のレイヤーが画面外です。「空きスペースへ」で戻せます。`, true));
    if (missing) nodes.push(qualityItem(`${missing}枚の画像を復元できていません。差し替えが必要です。`, true));
    $('quality-items').replaceChildren(...nodes);
  }
  function syncUI(force = false) {
    setValue('headline', state.headline, force); setValue('subtitle', state.subtitle.text, force);
    setValue('headline-tracking', state.headlineTracking); setValue('subtitle-tracking', state.subtitle.tracking);
    $('headline-tracking-value').textContent = trackingLabel(state.headlineTracking); $('subtitle-tracking-value').textContent = trackingLabel(state.subtitle.tracking);
    setValue('quick-tag', state.texts.find(t => t.id === 'tag')?.text || '', force);
    setValue('band-enabled', state.band.enabled); setValue('band-text', state.band.text, force); setValue('band-tracking', state.band.tracking); $('band-options').hidden = !state.band.enabled;
    $('band-tracking-value').textContent = trackingLabel(state.band.tracking);
    setValue('logo-enabled', state.logo.enabled); setValue('logo-size', state.logo.size); setValue('logo-margin', state.logo.margin); setPressed('logo-position', state.logo.side);
    $('logo-size-value').textContent = state.logo.size + ' px'; $('logo-margin-value').textContent = state.logo.margin + ' px';
    setPressed('wrap-mode', state.subtitle.wrap); setPressed('export-size', state.output.width); setPressed('export-format', state.output.format);
    setValue('bg-zoom', state.background.zoom); setValue('bg-blur', state.background.blur); setValue('bg-shade', state.background.shade); setValue('bg-flip', state.background.flip);
    $('bg-zoom-value').textContent = Math.round(state.background.zoom * 100) + '%'; $('bg-blur-value').textContent = String(state.background.blur); $('bg-shade-value').textContent = Math.round(state.background.shade * 100) + '%';
    const bg = assets.get(state.background.asset);
    $('background-empty').hidden = !!bg; $('background-thumb').hidden = !bg; $('background-replace').hidden = !bg; $('background-info').hidden = !bg;
    if (bg) { if ($('background-thumb').src !== bg.data) $('background-thumb').src = bg.data; $('background-name').textContent = bg.name; }
    $('undo').disabled = !history.length; $('redo').disabled = !future.length;
    $('overlay-count').textContent = state.overlays.length + ' / 5'; $('add-overlay').disabled = state.overlays.length >= 5;
    $('pan-background').setAttribute('aria-pressed', String(panMode)); $('end-pan').hidden = !panMode;
    $('canvas-mode').textContent = panMode ? '背景の位置を調整中' : '仕上がりプレビュー';
    $('interaction-hint').textContent = panMode ? 'ドラッグで背景を移動。ホイールで拡大。Escで終了。' : '画像・自由文字をドラッグで移動。四隅で拡縮、丸いハンドルで回転。';
    $('toggle-guides').setAttribute('aria-pressed', String(guides));
    renderMarkedPreview(); renderLayers(); renderImageCards(); renderRecents(); syncInspector(force); captureSelection();
  }
  function renderMarkedPreview() {
    const container = $('marked-preview'); container.replaceChildren(); container.hidden = !state.subtitle.marks.length;
    let p = 0;
    const marks = state.subtitle.marks.slice().sort((a,b) => a.start - b.start);
    marks.forEach(m => { if (m.start > p) container.append(document.createTextNode(state.subtitle.text.slice(p, m.start))); const el = document.createElement('mark'); el.textContent = state.subtitle.text.slice(m.start, m.end); container.append(el); p = m.end; });
    if (p < state.subtitle.text.length) container.append(document.createTextNode(state.subtitle.text.slice(p)));
  }
  function layerName(id) {
    if (id === 'headline') return state.headline || '赤文字'; if (id === 'subtitle') return state.subtitle.text || '白文字';
    if (id === 'logo') return 'Citrus ロゴ'; if (id === 'band') return '黒帯 · ' + state.band.text;
    if (id === 'character') return 'キャラクター'; const l = C.getLayer(state, id); return l?.text || l?.name || '画像';
  }
  function layerVisible(id) { if (id === 'logo' || id === 'band') return state[id].enabled; if (id === 'headline' || id === 'subtitle') return state.visibility[id]; return C.getLayer(state, id)?.visible !== false; }
  function renderLayers() {
    const list = $('layer-list'), nodes = [];
    state.order.slice().reverse().forEach(id => {
      if (id === 'character' && !state.character) return;
      if (!['headline','subtitle','logo','band','character'].includes(id) && !C.getLayer(state, id)) return;
      if (id === 'band' && !state.band.enabled) return;
      const row = document.createElement('div'); row.className = 'layer-row'; row.draggable = true; row.dataset.layer = id; row.dataset.selected = String(selected === id); row.dataset.hidden = String(!layerVisible(id));
      const grip = document.createElement('span'); grip.className = 'drag-grip'; grip.textContent = '⋮'; grip.setAttribute('aria-hidden','true'); row.append(grip);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'layer-select'; b.dataset.selectLayer = id; b.setAttribute('aria-pressed', String(selected === id));
      const layer = C.getLayer(state, id), a = assets.get(id === 'logo' ? state.logo.asset : layer?.asset);
      if (a) { const img = document.createElement('img'); img.src = a.data; img.alt = ''; b.append(img); } else b.append(icon(id === 'band' ? 'align' : 'type'));
      const name = document.createElement('span'); name.textContent = layerName(id); b.append(name); row.append(b);
      const toggle = gfuIconButton('visibility', layerVisible(id) ? '非表示にする' : '表示する'); toggle.dataset.visibility = id;
      if (!layerVisible(id)) { toggle.replaceChildren(icon('eyeOff')); }
      row.append(toggle); nodes.push(row);
    });
    const back = document.createElement('div'); back.className = 'layer-row layer-background'; const lock = document.createElement('span'); lock.dataset.icon = 'lock'; back.append(lock);
    const span = document.createElement('span'); span.className = 'gfu-caption muted'; span.textContent = '背景 · 最背面に固定'; back.append(span); nodes.push(back);
    list.replaceChildren(...nodes); window.GForceUI?.renderIcons(list);
  }
  function imageCard(layer) {
    const a = assets.get(layer.asset); if (!a) return document.createTextNode('画像を復元できませんでした');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'image-card'; b.dataset.selectLayer = layer.id;
    const img = document.createElement('img'); img.className = 'image-thumb'; img.src = a.data; img.alt = '';
    const cp = document.createElement('span'); cp.className = 'image-copy'; const name = document.createElement('span'); name.textContent = a.name; const meta = document.createElement('small'); meta.textContent = `${a.image.naturalWidth} × ${a.image.naturalHeight} · 編集する`; cp.append(name, meta); b.append(img, cp); return b;
  }
  function renderImageCards() { $('character-card').replaceChildren(...(state.character ? [imageCard(state.character)] : [])); $('overlay-cards').replaceChildren(...state.overlays.map(imageCard)); }
  function renderRecents() {
    const recent = recentAssets();
    for (const containerID of ['recent-assets', 'source-recents']) {
      const nodes = recent.map(a => { const b = document.createElement('button'); b.type = 'button'; b.dataset.recentAsset = a.id; b.title = a.name; b.setAttribute('aria-label', a.name + 'を使用'); const img = document.createElement('img'); img.src = a.data; img.alt = a.name; b.append(img); return b; });
      $(containerID).replaceChildren(...nodes);
    }
  }
  function syncInspector(force = false) {
    const l = C.getLayer(state, selected), isFixed = ['headline','subtitle','band','logo'].includes(selected);
    $('inspector-empty').hidden = !!(l || isFixed); $('inspector').hidden = !(l || isFixed);
    if (!(l || isFixed)) return;
    $('inspector-title').textContent = isFixed ? ({ headline:'赤文字',subtitle:'白文字',band:'黒帯',logo:'ロゴ' })[selected] : state.texts.some(t => t.id === selected) ? '自由文字' : selected === 'character' ? 'キャラクター' : '追加画像';
    $('fixed-inspector').hidden = !isFixed; $('transform-inspector').hidden = isFixed;
    if (isFixed) { $('fixed-inspector-text').textContent = 'このレイヤーは自動配置です。内容と設定は「つくる」で編集できます。重ね順と表示・非表示はここで変更できます。'; return; }
    const isText = state.texts.some(t => t.id === selected), o = scene?.objects.get(selected);
    $('text-inspector').hidden = !isText;
    if (isText) { setValue('layer-text', l.text, force); setValue('text-double-outline', l.doubleOutline); setPressed('text-color', l.color); setValue('layer-tracking', l.tracking ?? 25, force); $('layer-tracking-value').textContent = trackingLabel(l.tracking ?? 25); }
    setValue('layer-x', Math.round(o?.x ?? l.x), force); setValue('layer-y', Math.round(o?.y ?? l.y), force);
    setValue('layer-rotation', Math.round(l.rotation), force); setValue('layer-opacity', Math.round(l.opacity * 100), force);
    setValue('layer-flip', l.flip); setValue('layer-locked', l.locked);
    const slider = $('layer-size'); slider.min = isText ? '15' : '20'; slider.max = isText ? '400' : '2600';
    setValue('layer-size', isText ? Math.round(l.sizeScale * 100) : Math.round(l.w), force);
    $('layer-size-value').textContent = isText ? Math.round(l.sizeScale * 100) + '%' : Math.round(l.w) + ' px';
  }
  function switchPanel(name, scroll = false) {
    activePanel = name;
    for (const p of ['basic','images','layers']) { $('panel-' + p).hidden = p !== name; $('tab-' + p).setAttribute('aria-selected', String(p === name)); $('tab-' + p).tabIndex = p === name ? 0 : -1; }
    if (scroll) document.querySelector('.panel-scroll').scrollTop = 0;
  }
  function selectLayer(id, openPanel = false) {
    selected = id; panMode = false;
    if (openPanel) switchPanel('layers');
    syncUI(); requestRender();
  }
  async function ensureFonts(force = false) {
    const texts = [state.headline || '国', state.subtitle.text, state.band.text, ...state.texts.map(t => t.text)];
    const signature = texts.join('|');
    if (!force && signature === fontSignature) return fontState === 'ready';
    fontSignature = signature;
    const epoch = ++fontEpoch; fontState = 'loading'; updateFontUI();
    try {
      if (force && !(localFonts.serif && localFonts.sans)) {
        const link = $('google-fonts');
        if (!link.sheet) link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@900&family=Noto+Serif+JP:wght@900&display=swap&retry=' + Date.now();
      }
      const needed = [
        { key: 'serif', family: 'Noto Serif JP', text: texts[0] },
        { key: 'sans', family: 'Noto Sans JP', text: texts.slice(1).join('') || '国' }
      ];
      // CSS may not have arrived yet. Empty FontFaceSet.load results are NOT success.
      for (let i = 0; i < 16; i++) {
        if (epoch !== fontEpoch) return false;
        if (needed.every(n => localFonts[n.key] || [...document.fonts].some(f => f.family.replace(/["']/g, '') === n.family))) break;
        await new Promise(r => setTimeout(r, 250));
      }
      const loaded = await Promise.race([
        Promise.all(needed.map(async n => {
          if (localFonts[n.key]) return true;
          const faces = await document.fonts.load(`900 100px "${n.family}"`, n.text);
          return faces.length > 0 && faces.every(f => f.status === 'loaded');
        })),
        new Promise((_, reject) => setTimeout(() => reject(new Error('font timeout')), 12000))
      ]);
      if (epoch !== fontEpoch) return false;
      fontState = loaded.every(Boolean) ? 'ready' : 'fallback';
      if (fontState === 'ready') fontSignature = signature;
    } catch { if (epoch === fontEpoch) fontState = 'fallback'; }
    if (epoch === fontEpoch) { C.invalidateMetrics(); scene = C.layout(state, assets); requestRender(); syncInspector(); updateFontUI(); }
    return fontState === 'ready';
  }
  function updateFontUI() {
    $('font-state').querySelector('.gfu-spinner').hidden = fontState !== 'loading';
    $('font-status').textContent = fontState === 'ready' ? '指定フォント 読込済み · 900' : fontState === 'loading' ? '指定フォントを読み込み中…' : '代替フォントで表示中 · 接続を確認';
    $('font-retry').hidden = fontState !== 'fallback';
    $('export-font-warning').hidden = fontState === 'ready';
    $('export-download').disabled = fontState !== 'ready' && !$('allow-fallback').checked;
  }
  async function loadLocalFont(file) {
    if (!file || file.size > 40 * 1024 * 1024) throw new Error('40 MB以下のフォントを選んでください。');
    const family = sourceFont === 'serif' ? 'Noto Serif JP' : 'Noto Sans JP';
    const face = new FontFace(family, await file.arrayBuffer(), { weight: '900', style: 'normal' });
    await face.load();
    // Remove unloaded network faces for this family; the user explicitly supplied a local face.
    for (const old of [...document.fonts]) if (old.family.replace(/["']/g, '') === family) document.fonts.delete(old);
    document.fonts.add(face); localFonts[sourceFont] = true; C.invalidateMetrics(); fontSignature = '';
    await ensureFonts(); toast(family + ' を読み込みました。ファイルの種類は提供元で確認してください。', 5500);
  }
  function openSource(purpose, tab = 'local') {
    if (purpose === 'overlay' && state.overlays.length >= 5) { toast('追加画像は最大5枚です。'); return; }
    sourcePurpose = purpose; ++sourceEpoch; showSourceError('');
    $('source-title').textContent = { background:'背景を選ぶ',character:'キャラクターを選ぶ',overlay:'追加画像を選ぶ',logo:'ロゴを差し替える' }[purpose];
    $('source-description').textContent = purpose === 'character' ? '透過画像の余白を整え、背景と文字の間に配置します。' : purpose === 'overlay' ? `追加画像 ${state.overlays.length} / 5 · 重ね順と変形は追加後に調整できます。` : '画像はブラウザ内で処理します。';
    $('image-file').multiple = purpose === 'overlay'; renderRecents(); setSourceTab(tab); openDialog('source-dialog');
  }
  function setSourceTab(name) {
    sourceTab = name;
    for (const n of ['local','site','url']) { $('source-' + n).hidden = n !== name; $('source-tab-' + n).setAttribute('aria-selected', String(n === name)); $('source-tab-' + n).tabIndex = n === name ? 0 : -1; }
    showSourceError('');
    if (name === 'site' && !catalogAttempted) refreshCatalog();
  }
  async function refreshCatalog() {
    catalogAttempted = true; $('source-notice').textContent = '指定サイトから画像一覧を読み込んでいます…';
    try { catalog = await S.fetchCatalog(); $('source-notice').textContent = `${catalog.length}件の画像URLを取得しました。使用する画像を選んでください。`; renderCatalog(); }
    catch (e) { $('source-notice').textContent = e.message; }
  }
  function renderCatalog() {
    const q = $('asset-search').value.trim().toLocaleLowerCase('ja');
    const entries = catalog.filter(e => !q || e.name.toLocaleLowerCase('ja').includes(q) || e.url.toLowerCase().includes(q)).slice(0, 200);
    $('source-grid').replaceChildren(...entries.map(e => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.catalogUrl = e.url; b.dataset.catalogName = e.name; b.title = e.name;
      const img = document.createElement('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = e.url; img.alt = e.name;
      const text = document.createElement('span'); text.textContent = e.name; b.append(img, text); return b;
    }));
    if (catalog.length && !entries.length) { const p = document.createElement('p'); p.className = 'gfu-caption muted'; p.textContent = '該当する画像がありません。'; $('source-grid').append(p); }
  }
  async function importURL(url, name) {
    if (importBusy) return;
    const epoch = sourceEpoch, purpose = sourcePurpose; busy(true, '画像を取得中…'); showSourceError('');
    $('load-url').disabled = true;
    try { const result = await S.fetchImage(url); if (epoch !== sourceEpoch) return; await importBlob(result.blob, purpose, name || result.name, result.source); }
    catch (e) { if (epoch === sourceEpoch) showSourceError(e.message); }
    finally { busy(false); $('load-url').disabled = false; }
  }
  function toManual(layer, object) { if (layer.auto) { layer.x = object?.x ?? layer.x; layer.y = object?.y ?? layer.y; layer.auto = false; } }
  function addText() {
    if (state.texts.length >= 20) { toast('自由文字は最大20個です。'); return; }
    let id;
    mutate(s => {
      id = uid('text'); const l = { id, text:'注目ポイント',color:'yellow',x:280,y:250,sizeScale:.85,boxWidth:560,rotation:0,opacity:1,flip:false,locked:false,visible:true,doubleOutline:false,auto:false,tracking:25 };
      s.texts.push(l); s.order.splice(Math.max(0, s.order.indexOf('logo')), 0, id);
      const next = C.layout(s, assets), o = next.objects.get(id); if (o) { const p = C.autoPlace(o, next); l.x = p.x; l.y = p.y; }
    });
    selectLayer(id, true); $('layer-text').focus(); $('layer-text').select();
  }
  function changeOrder(step) {
    if (!selected) return;
    const listed=state.order.filter(id=>(id!=='character'||state.character)&&(id!=='band'||state.band.enabled));
    const i=listed.indexOf(selected),j=i+step;
    if(i<0 || j<0 || j>=listed.length)return;
    mutate(s=>{const target=listed[j];s.order=s.order.filter(id=>id!==selected);s.order.splice(s.order.indexOf(target)+(step>0?1:0),0,selected);});
  }
  function toggleVisibility(id) {
    mutate(s => { if (id === 'logo' || id === 'band') s[id].enabled = !s[id].enabled; else if (id === 'headline' || id === 'subtitle') s.visibility[id] = !s.visibility[id]; else { const l = C.getLayer(s, id); if (l) l.visible = !l.visible; } });
  }
  function removeSelected() {
    if (!selected) return;
    const name = layerName(selected), id = selected;
    mutate(s => {
      if (id === 'character') s.character = null;
      else if (id === 'logo' || id === 'band') s[id].enabled = false;
      else if (id === 'headline' || id === 'subtitle') s.visibility[id] = false;
      else { s.texts = s.texts.filter(l => l.id !== id); s.overlays = s.overlays.filter(l => l.id !== id); s.order = s.order.filter(v => v !== id); }
      selected = null;
    }); toast(name.slice(0, 20) + ' を外しました');
  }
  function duplicateSelected() {
    const original = C.getLayer(state, selected), isText = state.texts.some(t => t.id === selected);
    if (!original) { toast('画像か自由文字を選択してください。'); return; }
    if ((!isText && state.overlays.length >= 5) || (isText && state.texts.length >= 20)) { toast(isText ? '自由文字は最大20個です。' : '追加画像は最大5枚です。'); return; }
    let id;
    mutate(s => {
      const l = C.clone(original); id = uid(isText ? 'text' : 'image'); l.id = id;
      const o = scene.objects.get(selected); l.x = (o?.x ?? l.x) + 28; l.y = (o?.y ?? l.y) + 28; l.auto = false; l.locked = false;
      if (isText) s.texts.push(l); else s.overlays.push(l); s.order.splice(s.order.indexOf(selected) + 1, 0, id);
    }); selectLayer(id, true); toast('複製しました');
  }
  function autoLayout() {
    mutate(s => {
      if (s.character && !s.character.locked) { const a = assets.get(s.character.asset); if (a) Object.assign(s.character, createImageLayer('character', a, 'character')); }
      s.texts.forEach(l => { if (l.id === 'tag' && !l.locked) { l.auto = true; l.rotation = 0; l.sizeScale = 1; } });
      for (const l of [...s.texts.filter(l => l.id !== 'tag'), ...s.overlays]) {
        if (l.locked) continue; l.rotation = 0;
        const next = C.layout(s, assets), o = next.objects.get(l.id);
        if (o) { const p = C.autoPlace(o, next); l.x = p.x; l.y = p.y; l.auto = false; }
      }
    }); toast('ロックしていない画像・自由文字を整えました。1回の「元に戻す」で戻せます。', 4200);
  }
  function autoPlaceSelected() {
    const l = C.getLayer(state, selected), o = scene.objects.get(selected);
    if (!l || !o) return;
    if (l.locked) { toast('位置のロックを解除してください。'); return; }
    mutate(() => { const p = C.autoPlace(o, scene); l.x = p.x; l.y = p.y; l.auto = false; });
  }
  function editFixed() {
    switchPanel('basic');
    const id = { headline:'headline',subtitle:'subtitle',logo:'logo-enabled',band:'band-text' }[selected];
    if (id) { $(id).scrollIntoView({ block:'center', behavior:'smooth' }); $(id).focus({ preventScroll:true }); }
  }
  function point(event) { const rect = canvas.getBoundingClientRect(); return { x:(event.clientX - rect.left) * C.W / rect.width, y:(event.clientY - rect.top) * C.H / rect.height }; }
  function rotationHandle(o) {
    const unit=C.W/Math.max(canvas.clientWidth,1), gap=28*unit, safe=10*unit;
    const options=[{x:0,y:-o.h/2-gap,ax:0,ay:-o.h/2},{x:0,y:o.h/2+gap,ax:0,ay:o.h/2},{x:o.w/2+gap,y:0,ax:o.w/2,ay:0},{x:-o.w/2-gap,y:0,ax:-o.w/2,ay:0}];
    for(const h of options){const p=C.worldPoint(o,h);if(p.x>=safe && p.x<=C.W-safe && p.y>=safe && p.y<=C.H-safe)return h;}
    const p=C.worldPoint(o,options[0]),q=C.localPoint(o,{x:C.clamp(p.x,safe,C.W-safe),y:C.clamp(p.y,safe,C.H-safe)});
    return {...options[0],x:q.x,y:q.y};
  }
  function handleAt(o, p) {
    if (!o || o.locked) return null;
    const q = C.localPoint(o, p), unit = C.W / Math.max(canvas.clientWidth, 1), r = 11 * unit;
    const rh=rotationHandle(o);
    if (Math.hypot(q.x-rh.x,q.y-rh.y) < r) return {mode:'rotate'};
    for (const sx of [-1,1]) for (const sy of [-1,1]) if (Math.hypot(q.x - sx * o.w / 2, q.y - sy * o.h / 2) < r) return { mode:'resize', sx, sy };
    return null;
  }
  function objectAt(p) {
    for (const id of scene.ids.slice().reverse()) { const o = scene.objects.get(id); if (C.hitTest(o, p, assets)) return o; }
    return null;
  }
  function pointerDown(e) {
    if (e.button !== 0 || !scene || anyDialog()) return;
    e.preventDefault(); canvas.focus({ preventScroll:true }); const p = point(e);
    if (panMode) {
      const bg = assets.get(state.background.asset); if (!bg) { toast('先に背景を選択してください。'); return; }
      pointer = { mode:'pan', start:p, startBG:C.clone(state.background), id:e.pointerId, moved:false };
    } else {
      const current = scene.objects.get(selected), handle = handleAt(current, p);
      let o = handle ? current : objectAt(p);
      if (!o) { selectLayer(null); return; }
      const isMovingLayer = !!C.getLayer(state, o.id);
      if (selected !== o.id) { selected = o.id; if (isMovingLayer) switchPanel('layers'); syncUI(); requestRender(); }
      if (o.locked || !isMovingLayer) { if (['headline','subtitle'].includes(o.id) && e.detail >= 2) editFixed(); return; }
      const original = C.clone(C.getLayer(state, o.id)); original.x = o.x; original.y = o.y;
      pointer = { mode:handle?.mode || 'move', handle, start:p, object:C.clone(o), original, id:e.pointerId, layer:o.id, moved:false };
      if (handle?.mode === 'resize') pointer.anchor = C.worldPoint(o, { x:-handle.sx * o.w / 2, y:-handle.sy * o.h / 2 });
      if (handle?.mode === 'rotate') pointer.initialAngle = Math.atan2(p.y - o.y, p.x - o.x);
    }
    canvas.setPointerCapture(e.pointerId); $('stage-frame').dataset.dragging = 'true';
  }
  function snapPosition(o, x, y, disabled) {
    snapLines = []; if (disabled) return { x,y };
    const limit = 7 * C.W / Math.max(canvas.clientWidth, 1), bounds = C.bounds({ ...o, x,y });
    const tx = [24, C.W / 2, C.W - 24], ty = [24, C.H / 2, C.H - 24];
    let bestX = { d:Infinity }, bestY = { d:Infinity };
    for (const a of [bounds.x, x, bounds.right]) for (const t of tx) if (Math.abs(t-a) < Math.abs(bestX.d)) bestX = { d:t-a, value:t };
    for (const a of [bounds.y, y, bounds.bottom]) for (const t of ty) if (Math.abs(t-a) < Math.abs(bestY.d)) bestY = { d:t-a, value:t };
    if (Math.abs(bestX.d) < limit) { x += bestX.d; snapLines.push({ axis:'x',value:bestX.value }); }
    if (Math.abs(bestY.d) < limit) { y += bestY.d; snapLines.push({ axis:'y',value:bestY.value }); }
    return { x,y };
  }
  function pointerMove(e) {
    if (!scene) return;
    const p = point(e);
    if (!pointer) {
      if (panMode) { canvas.style.cursor = 'grab'; return; }
      const handle = handleAt(scene.objects.get(selected), p);
      if (handle) canvas.style.cursor = handle.mode === 'rotate' ? 'grab' : handle.sx === handle.sy ? 'nwse-resize' : 'nesw-resize';
      else { const o = objectAt(p); canvas.style.cursor = o ? o.locked ? 'pointer' : 'move' : 'default'; }
      return;
    }
    if (e.pointerId !== pointer.id) return; e.preventDefault();
    const dx = p.x - pointer.start.x, dy = p.y - pointer.start.y;
    if (!pointer.moved && Math.hypot(dx,dy) < 2) return;
    if (!pointer.moved) { record(); pointer.moved = true; }
    if (pointer.mode === 'pan') {
      const a = assets.get(state.background.asset), r = C.backgroundRect(pointer.startBG, a.image);
      const halfX = Math.max(0, (r.w - C.W) / 2), halfY = Math.max(0, (r.h - C.H) / 2);
      state.background.panX = halfX ? C.clamp(pointer.startBG.panX + dx / halfX * (state.background.flip ? -1 : 1), -1,1) : 0;
      state.background.panY = halfY ? C.clamp(pointer.startBG.panY + dy / halfY, -1,1) : 0;
    } else {
      const l = C.getLayer(state, pointer.layer), original = pointer.original, o = pointer.object;
      if (!l) return; l.auto = false;
      if (pointer.mode === 'move') {
        const lockX = e.shiftKey && Math.abs(dy) > Math.abs(dx), lockY = e.shiftKey && Math.abs(dx) >= Math.abs(dy);
        const result = snapPosition(o, original.x + (lockX ? 0 : dx), original.y + (lockY ? 0 : dy), e.altKey);
        l.x = C.clamp(result.x,-C.W,C.W*2); l.y = C.clamp(result.y,-C.H,C.H*2);
      } else if (pointer.mode === 'rotate') {
        let angle = original.rotation + (Math.atan2(p.y-o.y,p.x-o.x) - pointer.initialAngle) * 180 / Math.PI;
        angle = ((angle + 180) % 360 + 360) % 360 - 180;
        if (e.shiftKey) angle = Math.round(angle / 15) * 15;
        l.rotation = Math.round(angle * 10) / 10; l.x = original.x; l.y = original.y;
      } else if (pointer.mode === 'resize') {
        const a = pointer.anchor, angle = -(o.rotation || 0) * Math.PI / 180;
        const xx = (p.x - a.x) * Math.cos(angle) - (p.y - a.y) * Math.sin(angle);
        const yy = (p.x - a.x) * Math.sin(angle) + (p.y - a.y) * Math.cos(angle);
        const vx = pointer.handle.sx * o.w, vy = pointer.handle.sy * o.h;
        let factor = Math.max(.02, (xx * vx + yy * vy) / (vx * vx + vy * vy));
        if ('sizeScale' in original) { l.sizeScale = C.clamp(original.sizeScale * factor,.15,4); factor = l.sizeScale / original.sizeScale; }
        else { l.w = C.clamp(original.w * factor,20,2600); factor = l.w / original.w; }
        const center = C.worldPoint({ x:a.x,y:a.y,rotation:o.rotation }, { x:vx * factor / 2,y:vy * factor / 2 });
        l.x = C.clamp(center.x,-C.W,C.W*2); l.y = C.clamp(center.y,-C.H,C.H*2);
      }
    }
    scene = C.layout(state, assets); requestRender(); syncInspector();
  }
  function pointerEnd(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const changedDoc = pointer.moved; pointer = null; snapLines = [];
    $('stage-frame').dataset.dragging = 'false';
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (changedDoc) changed({ fonts:false }); else requestRender();
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function safeFilename(value) { return String(value || 'tft-thumbnail').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/^\.+|[. ]+$/g,'').slice(0,100) || 'tft-thumbnail'; }
  async function saveProject() {
    const missing = usedAssetIDs().filter(id => !assets.has(id)); if (missing.length) { toast('復元できていない画像があります。差し替えてから保存してください。', 5000); return; }
    const data = { kind:'tft-thumbnail-project',version:1,savedAt:new Date().toISOString(),state:C.clone(state),assets:usedAssetIDs().map(id => { const a = assets.get(id); return { id:a.id,name:a.name,data:a.data,source:a.source }; }) };
    downloadBlob(new Blob([JSON.stringify(data)], { type:'application/json' }), safeFilename(state.headline || 'tft-thumbnail') + '.tft.json');
    toast('プロジェクトを保存しました');
  }
  async function loadProjectFile(file, ask = true) {
    if (!file || file.size > 100 * 1024 * 1024) throw new Error('プロジェクトは100 MB以下にしてください。');
    let doc; try { doc = JSON.parse(await file.text()); } catch { throw new Error('プロジェクトJSONを読み込めませんでした。'); }
    if (doc.kind !== 'tft-thumbnail-project' || doc.version !== 1 || !Array.isArray(doc.assets) || doc.assets.length > 20) throw new Error('対応するTFTサムネイルプロジェクトではありません。');
    const candidate = C.validate(doc.state), needed = usedAssetIDs(candidate), records = new Map();
    doc.assets.forEach(a => { if (!a || typeof a.id !== 'string' || records.has(a.id)) throw new Error('画像IDが重複しているか、不正です。'); records.set(a.id,a); });
    if (needed.some(id => !records.has(id))) throw new Error('プロジェクト内に必要な画像がありません。');
    if (ask && !(await confirmAction('現在の編集内容を置き換えます。必要な内容は、先にプロジェクトとして保存してください。'))) return false;
    busy(true,'プロジェクトを読み込み中…');
    const staged = new Map(), remap = new Map();
    try {
      for (const id of needed) {
        const a = records.get(id), newid = uid('asset');
        await registerData(a.data, a.name, newid, a.source, Date.now(), staged); remap.set(id,newid);
      }
      if (candidate.background.asset) candidate.background.asset = remap.get(candidate.background.asset);
      if (candidate.logo.asset !== 'builtin-logo') candidate.logo.asset = remap.get(candidate.logo.asset);
      if (candidate.character) candidate.character.asset = remap.get(candidate.character.asset);
      candidate.overlays.forEach(l => l.asset = remap.get(l.asset));
      record(); staged.forEach((a,id) => assets.set(id,a)); state = candidate; selected = null; panMode = false;
      changed({ force:true }); if ($('project-dialog').open) closeDialog('project-dialog'); toast('プロジェクトを開きました'); return true;
    } finally { busy(false); }
  }
  function openExport() {
    $('allow-fallback').checked = false; $('export-error').hidden = true; setValue('export-filename', state.headline || 'tft-thumbnail');
    const preview = $('export-preview'), x = preview.getContext('2d', { alpha:false });
    const s = C.layout(state, assets); C.draw(x, state, assets, s, preview.width / C.W);
    updateFontUI(); openDialog('export-dialog'); ensureFonts();
  }
  function canvasBlob(c, type, quality) { return new Promise((resolve,reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('画像の書き出しに失敗しました。')), type, quality)); }
  async function createExportBlob(forcePNG = false) {
    if (fontState !== 'ready' && !$('allow-fallback').checked) {
      const ready = await ensureFonts(); if (!ready) throw new Error('指定フォントが読み込めていません。再試行するか、代替フォントを明示的に許可してください。');
    }
    if (usedAssetIDs().some(id => !assets.has(id))) throw new Error('復元できていない画像があります。差し替え後に書き出してください。');
    const snapshot = C.clone(state), layout = C.layout(snapshot, assets), scale = Math.max(2, snapshot.output.width / C.W);
    const master = document.createElement('canvas'); master.width = C.W * scale; master.height = C.H * scale;
    C.draw(master.getContext('2d', { alpha:false }), snapshot, assets, layout, scale);
    const output = document.createElement('canvas'); output.width = snapshot.output.width; output.height = snapshot.output.width * 9 / 16;
    const x = output.getContext('2d', { alpha:false }); x.imageSmoothingQuality = 'high'; x.drawImage(master,0,0,output.width,output.height);
    const type = forcePNG || snapshot.output.format === 'png' ? 'image/png' : 'image/jpeg';
    return canvasBlob(output,type,.96);
  }
  async function downloadImage() {
    const button = $('export-download'); button.disabled = true; busy(true,'高解像度で書き出し中…'); $('export-error').hidden = true;
    try { const blob = await createExportBlob(), ext = blob.type === 'image/jpeg' ? '.jpg' : '.png'; const filename = safeFilename($('export-filename').value).replace(/\.(png|jpe?g)$/i,'') + ext;
      downloadBlob(blob,filename); toast(`${filename} · ${(blob.size / 1024 / 1024).toFixed(2)} MB を書き出しました。`, 4800);
    } catch(e) { $('export-error').textContent = e.message; $('export-error').hidden = false; }
    finally { busy(false); updateFontUI(); }
  }
  async function copyImage() {
    if (!navigator.clipboard?.write || !window.ClipboardItem) { $('export-error').textContent = 'この環境では画像コピーを利用できません。ダウンロードを使用してください。'; $('export-error').hidden = false; return; }
    try {
      if (fontState !== 'ready' && !$('allow-fallback').checked) throw new Error('指定フォントを読み込むか、代替フォントを許可してください。');
      // Promise-valued ClipboardItem keeps the clipboard call in the user gesture.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': createExportBlob(true) })]); toast('画像をコピーしました');
    } catch(e) { $('export-error').textContent = '画像をコピーできませんでした。' + (e.name === 'NotAllowedError' ? 'ブラウザの許可設定を確認するか、ダウンロードを使用してください。' : e.message); $('export-error').hidden = false; }
  }
  // Event wiring stays separate from layout/rendering; controls always mutate one
  // canonical, serializable document. There is no second export-only layout.
  function selectedMutable() {
    const layer = C.getLayer(state, selected);
    if (!layer) return null;
    if (layer.locked) { toast('位置のロックを解除してください。'); return null; }
    return layer;
  }
  function editSelected(fn, key = '') {
    const layer = selectedMutable(); if (!layer) { syncInspector(true); return; }
    mutate(() => { toManual(layer, scene.objects.get(selected)); fn(layer); }, key);
  }
  function pick(id) { $(id).value = ''; $(id).click(); }
  function captureSelection() {
    const input = $('subtitle'); lastSelection = { start: input.selectionStart, end: input.selectionEnd };
    const active = lastSelection.end > lastSelection.start;
    $('mark-yellow').disabled = !active; $('mark-white').disabled = !active;
    $('selection-help').textContent = active ? `選択中：${lastSelection.end - lastSelection.start}文字。色を指定できます。` : '入力欄で文字を選択して、黄色を指定。';
  }
  function markSelection(yellow) {
    const start = Math.min(lastSelection.start,state.subtitle.text.length), end = Math.min(lastSelection.end,state.subtitle.text.length); if (end <= start) return;
    mutate(s => { s.subtitle.marks = C.setMark(s.subtitle.text, s.subtitle.marks, start, end, yellow); });
    $('subtitle').focus({ preventScroll:true }); $('subtitle').setSelectionRange(start, end); captureSelection();
  }
  const textBindings = {
    headline(value) { state.headline = C.clean(value, 100); state.visibility.headline = true; },
    subtitle(value) { const text = C.clean(value, 160, 2); state.subtitle.marks = C.remapMarks(state.subtitle.text, text, state.subtitle.marks); state.subtitle.text = text; state.visibility.subtitle = true; },
    'quick-tag'(value) {
      let layer = state.texts.find(t => t.id === 'tag');
      if (!layer) { layer = C.defaultState().texts[0]; layer.text = ''; state.texts.push(layer); state.order.splice(Math.max(0, state.order.indexOf('subtitle')), 0, 'tag'); }
      layer.text = C.clean(value, 80); layer.visible = true;
    },
    'band-text'(value) { state.band.text = C.clean(value, 36); },
    'layer-text'(value) { const l = C.getLayer(state, selected); if (l && state.texts.includes(l)) l.text = C.clean(value, 100, 3); }
  };
  Object.entries(textBindings).forEach(([id, assign]) => {
    $(id).addEventListener('input', () => { if (isComposing) return; mutate(() => assign($(id).value), 'text-' + id); if (id === 'subtitle') captureSelection(); });
  });
  document.addEventListener('compositionstart', () => { isComposing = true; });
  document.addEventListener('compositionend', e => { isComposing = false; if (textBindings[e.target.id]) { mutate(() => textBindings[e.target.id](e.target.value), 'text-' + e.target.id); if (e.target.id === 'subtitle') captureSelection(); } });
  ['select', 'keyup', 'pointerup', 'focus'].forEach(name => $('subtitle').addEventListener(name, captureSelection));
  ['mark-yellow', 'mark-white'].forEach(id => $(id).addEventListener('pointerdown', e => e.preventDefault()));
  $('mark-yellow').addEventListener('click', () => markSelection(true)); $('mark-white').addEventListener('click', () => markSelection(false));
  const rangeBindings = {
    'bg-zoom': v => state.background.zoom = C.clamp(v,1,4),
    'bg-blur': v => state.background.blur = C.clamp(v,0,14),
    'bg-shade': v => state.background.shade = C.clamp(v,0,.8),
    'headline-tracking': v => state.headlineTracking = C.trackingPercent(v),
    'subtitle-tracking': v => state.subtitle.tracking = C.trackingPercent(v),
    'band-tracking': v => state.band.tracking = C.trackingPercent(v),
    'logo-size': v => state.logo.size = C.clamp(v,100,240),
    'logo-margin': v => state.logo.margin = C.clamp(v,0,40)
  };
  Object.entries(rangeBindings).forEach(([id, assign]) => $(id).addEventListener('input', () => mutate(() => assign(+$(id).value), id)));
  $('layer-size').addEventListener('input', () => editSelected(l => { if (state.texts.includes(l)) l.sizeScale = C.clamp(+$('layer-size').value / 100,.15,4); else l.w = C.clamp(+$('layer-size').value,20,2600); }, 'layer-size'));
  $('layer-tracking').addEventListener('input', () => editSelected(l => { if (state.texts.includes(l)) l.tracking = C.trackingPercent(+$('layer-tracking').value); }, 'layer-tracking'));
  const checks = {
    'band-enabled': v => state.band.enabled = v,
    'logo-enabled': v => state.logo.enabled = v,
    'bg-flip': v => state.background.flip = v,
    'text-double-outline': v => { const l = C.getLayer(state,selected); if (l) l.doubleOutline = v; },
    'layer-locked': v => { const l = C.getLayer(state,selected); if (l) { if (v) toManual(l,scene.objects.get(selected)); l.locked = v; } }
  };
  Object.entries(checks).forEach(([id, assign]) => $(id).addEventListener('change', () => mutate(() => assign($(id).checked))));
  $('layer-flip').addEventListener('change', () => editSelected(l => l.flip = $('layer-flip').checked));
  const numbers = { 'layer-x':['x',-1280,2560], 'layer-y':['y',-720,1440], 'layer-rotation':['rotation',-180,180], 'layer-opacity':['opacity',0,100] };
  Object.entries(numbers).forEach(([id, [key,min,max]]) => $(id).addEventListener('change', () => {
    const value = $(id).valueAsNumber; if (!Number.isFinite(value)) { syncInspector(true); return; }
    editSelected(l => l[key] = C.clamp(value,min,max) / (key === 'opacity' ? 100 : 1));
  }));
  $('allow-fallback').addEventListener('change', updateFontUI);
  $('asset-search').addEventListener('input', renderCatalog);
  $('image-url').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); importURL($('image-url').value); } });
  $('image-file').addEventListener('change', () => handleFiles($('image-file').files));
  $('project-file').addEventListener('change', async () => { const f = $('project-file').files[0]; if (!f) return; try { await loadProjectFile(f); } catch(e) { toast(e.message,6000); } });
  $('catalog-file').addEventListener('change', async () => {
    try { const f = $('catalog-file').files[0]; if (!f) return; catalog = await S.parseCatalogFile(f); catalogAttempted = true; $('source-notice').textContent = `${catalog.length}件の素材一覧を読み込みました。`; setSourceTab('site'); renderCatalog(); }
    catch(e) { showSourceError(e.message); }
  });
  $('font-file').addEventListener('change', async () => { try { if ($('font-file').files[0]) await loadLocalFont($('font-file').files[0]); } catch(e) { toast('フォントを読み込めませんでした。' + e.message,6000); } });
  $('confirm-ok').addEventListener('click', () => $('confirm-dialog').close('ok'));
  $('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close('cancel'));
  $('asset-bookmarklet').href = S.bookmarklet;
  $('asset-bookmarklet').addEventListener('click', e => { e.preventDefault(); toast('このリンクをブックマークバーへドラッグして、素材サイト上で実行してください。',6000); });
  const actions = {
    undo, redo, 'auto-layout':autoLayout, 'add-text':addText,
    'layer-up':() => changeOrder(1), 'layer-down':() => changeOrder(-1), duplicate:duplicateSelected, delete:removeSelected,
    deselect:() => { selected = null; panMode = false; syncUI(); requestRender(); },
    'auto-place':autoPlaceSelected, 'edit-fixed':editFixed,
    'reset-transform':() => editSelected(l => { l.rotation = 0; l.flip = false; }),
    'remove-background':() => mutate(s => { s.background.asset = null; s.background.name = ''; panMode = false; }),
    'reset-background':() => mutate(s => { s.background.panX = 0; s.background.panY = 0; s.background.zoom = 1; }),
    'pan-background':() => { if (!state.background.asset) { toast('まず背景画像を選んでください。'); return; } panMode = !panMode; selected = null; syncUI(); requestRender(); },
    'reset-logo':() => mutate(s => { s.logo.asset = 'builtin-logo'; s.logo.size = 164; s.logo.margin = 0; }),
    guides:() => { guides = !guides; syncUI(); requestRender(); },
    help:() => openDialog('help-dialog'), 'project-menu':() => openDialog('project-dialog'), export:openExport,
    'pick-file':() => pick('image-file'), 'refresh-source':refreshCatalog, 'import-catalog':() => pick('catalog-file'), 'load-url':() => importURL($('image-url').value),
    'download-image':downloadImage, 'copy-image':copyImage, 'save-project':saveProject, 'load-project':() => pick('project-file'),
    'retry-fonts':() => ensureFonts(true),
    'load-serif-font':() => { sourceFont = 'serif'; pick('font-file'); }, 'load-sans-font':() => { sourceFont = 'sans'; pick('font-file'); },
    'new-project':async () => {
      if (!(await confirmAction('現在の編集を新しいサムネイルに置き換えます。必要な内容は先にファイル保存してください。','新しいサムネイルを作りますか？'))) return;
      record(); const logo = C.clone(state.logo); state = C.defaultState(); state.logo = logo; selected = null; panMode = false;
      changed({force:true}); closeDialog('project-dialog'); switchPanel('basic',true); toast('新しいサムネイルを作成しました。ロゴの設定は引き継ぎました。');
    }
  };
  document.addEventListener('click', async e => {
    const button = e.target.closest('button, a[data-recent-asset]'); if (!button || button.disabled) return;
    try {
      if (button.hasAttribute('data-close-dialog')) { button.closest('dialog').close(); return; }
      if (button.dataset.panel) { switchPanel(button.dataset.panel,true); return; }
      if (button.dataset.sourceTab) { setSourceTab(button.dataset.sourceTab); return; }
      if (button.dataset.openSource) { openSource(button.dataset.openSource, button.dataset.startTab || 'local'); return; }
      if (button.dataset.selectLayer) { selectLayer(button.dataset.selectLayer,true); return; }
      if (button.dataset.visibility) { toggleVisibility(button.dataset.visibility); return; }
      if (button.dataset.recentAsset) {
        const a = assets.get(button.dataset.recentAsset); if (!a) return;
        if ($('source-dialog').open) await useExistingAsset(a);
        else { recentChoice = a.id; $('reuse-preview').src = a.data; $('reuse-name').textContent = a.name; document.querySelector('[data-reuse-purpose=overlay]').disabled = state.overlays.length >= 5; openDialog('reuse-dialog'); }
        return;
      }
      if (button.dataset.reusePurpose) { const a = assets.get(recentChoice); if(a) { await useExistingAsset(a,button.dataset.reusePurpose); closeDialog('reuse-dialog'); } return; }
      if (button.dataset.catalogUrl) { await importURL(button.dataset.catalogUrl,button.dataset.catalogName); return; }
      if (button.dataset.value !== undefined) {
        const parent = button.parentElement.id, value = button.dataset.value;
        if (parent === 'wrap-mode') mutate(s => s.subtitle.wrap = value);
        else if (parent === 'logo-position') mutate(s => s.logo.side = value);
        else if (parent === 'text-color') mutate(s => { const l = C.getLayer(s,selected); if (l && Object.hasOwn(C.COLORS,value)) l.color = value; });
        else if (parent === 'layer-align') editSelected(l => { const o = scene.objects.get(selected); const width = o ? C.bounds({...o,rotation:l.rotation}).w : 0; l.x = value === 'left' ? 24 + width/2 : value === 'right' ? C.W - 24 - width/2 : C.W/2; });
        else if (parent === 'export-size') { state.output.width = +value; syncUI(); scheduleSave(); }
        else if (parent === 'export-format') { state.output.format = value; syncUI(); scheduleSave(); }
        return;
      }
      if (button.dataset.action && actions[button.dataset.action]) await actions[button.dataset.action]();
    } catch (err) { toast(err.message || '操作を完了できませんでした。',6000); }
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return; const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  });
  $('source-dialog').addEventListener('close', () => { ++sourceEpoch; });
  document.querySelectorAll('[role="tablist"]').forEach(tablist => tablist.addEventListener('keydown', e => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    const tabs = [...tablist.querySelectorAll('[role="tab"]')], index = tabs.indexOf(document.activeElement); if (index < 0) return;
    e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length-1 : (index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].click(); tabs[next].focus();
  }));
  canvas.addEventListener('pointerdown',pointerDown); canvas.addEventListener('pointermove',pointerMove);
  ['pointerup','pointercancel','lostpointercapture'].forEach(name => canvas.addEventListener(name,pointerEnd));
  canvas.addEventListener('dblclick', () => {
    if (['headline','subtitle','band','logo'].includes(selected)) editFixed();
    else if (state.texts.some(l => l.id === selected)) { switchPanel('layers'); $('layer-text').focus(); $('layer-text').select(); }
  });
  canvas.addEventListener('wheel', e => { if (!panMode || !state.background.asset) return; e.preventDefault(); mutate(s => s.background.zoom = C.clamp(s.background.zoom * Math.exp(-e.deltaY*.001),1,4),'bg-wheel'); },{passive:false});
  document.addEventListener('keydown', e => {
    if (e.isComposing || isComposing || e.keyCode === 229 || anyDialog()) return;
    const editing = e.target.matches('input, textarea, [contenteditable="true"]'), mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 's') { e.preventDefault(); saveProject(); return; }
    if (mod && e.shiftKey && key === 'e') { e.preventDefault(); openExport(); return; }
    if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); redo(); return; }
    if (editing) return;
    if (mod && key === 'd') { e.preventDefault(); duplicateSelected(); return; }
    if (e.key === 'Escape') { e.preventDefault(); actions.deselect(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if(selected) { e.preventDefault(); removeSelected(); } return; }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && C.getLayer(state,selected)) {
      e.preventDefault(); const step=e.shiftKey?10:1; editSelected(l=>{ if(e.key==='ArrowLeft')l.x-=step; if(e.key==='ArrowRight')l.x+=step; if(e.key==='ArrowUp')l.y-=step; if(e.key==='ArrowDown')l.y+=step; l.x=C.clamp(l.x,-1280,2560);l.y=C.clamp(l.y,-720,1440); },'nudge');
    }
  });
  // Native image drop / clipboard. We never let a drop navigate away from work.
  const fileDrag = e => Array.from(e.dataTransfer?.types || []).includes('Files');
  let dragDepth = 0;
  document.addEventListener('dragenter', e => { if(!fileDrag(e))return; e.preventDefault(); dragDepth++; if (!anyDialog()) { $('drop-message').hidden=false; $('drop-label').textContent = state.background.asset ? '追加画像として配置（最大5枚）' : '背景画像として配置'; } });
  document.addEventListener('dragover', e => { if(fileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';} });
  document.addEventListener('dragleave', e => { if(!fileDrag(e))return; if(--dragDepth<=0){dragDepth=0;$('drop-message').hidden=true;} });
  document.addEventListener('drop', e => {
    if(!fileDrag(e))return; e.preventDefault(); dragDepth=0; $('drop-message').hidden=true;
    const purpose = $('source-dialog').open ? sourcePurpose : e.target.closest('#background-picker') ? 'background' : state.background.asset ? 'overlay' : 'background';
    if(anyDialog() && !$('source-dialog').open) {toast('画像追加画面からファイルを選択してください。');return;}
    handleFiles(e.dataTransfer.files,purpose);
  });
  document.addEventListener('paste', e => {
    if(anyDialog() && !$('source-dialog').open) return;
    const items=Array.from(e.clipboardData?.items || []).filter(x=>x.kind==='file' && x.type.startsWith('image/'));
    if(!items.length)return; e.preventDefault(); handleFiles(items.map(x=>x.getAsFile()).filter(Boolean),$('source-dialog').open?sourcePurpose:state.background.asset?'overlay':'background');
  });
  $('layer-list').addEventListener('dragstart', e => {
    const row=e.target.closest('[data-layer]'); if(!row || e.target.closest('[data-visibility]'))return;
    dragLayer=row.dataset.layer; e.dataTransfer.setData('application/x-tft-layer',dragLayer);e.dataTransfer.effectAllowed='move';row.dataset.dragging='true';
  });
  $('layer-list').addEventListener('dragover', e => {
    if(!dragLayer)return; const row=e.target.closest('[data-layer]');if(!row)return;e.preventDefault();e.dataTransfer.dropEffect='move';
    $('layer-list').querySelectorAll('[data-drop]').forEach(r=>delete r.dataset.drop);row.dataset.drop=e.clientY<row.getBoundingClientRect().top+row.offsetHeight/2?'before':'after';
  });
  $('layer-list').addEventListener('drop', e => {
    if(!dragLayer)return;e.preventDefault();const row=e.target.closest('[data-layer]'),from=dragLayer;dragLayer=null;
    if(!row || row.dataset.layer===from){renderLayers();return;}const target=row.dataset.layer,above=row.dataset.drop==='before';
    mutate(s=>{s.order=s.order.filter(id=>id!==from);const i=s.order.indexOf(target);s.order.splice(i+(above?1:0),0,from);selected=from;});
  });
  $('layer-list').addEventListener('dragend', () => { dragLayer=null;renderLayers(); });
  document.addEventListener('visibilitychange', () => { if(document.visibilityState==='hidden' && initialized){clearTimeout(saveTimer);saveAuto();} });
  window.addEventListener('pagehide', () => { if(initialized){clearTimeout(saveTimer);saveAuto();} });
  new ResizeObserver(requestRender).observe($('stage-frame'));
  document.fonts?.addEventListener('loadingdone', () => { C.invalidateMetrics(); requestRender(); });
  $('google-fonts').addEventListener('load', () => { fontSignature=''; ensureFonts(); });
  async function start() {
    document.querySelector('main').inert = true; $('google-fonts').media = 'all';
    renderCustomIcons(); window.GForceUI?.renderIcons(document);
    await registerData(window.TFT_ASSETS.logo, 'Citrus ロゴ', 'builtin-logo');
    scene=C.layout(state,assets);syncUI();requestRender();
    await restore(); document.querySelector('main').inert = false; initialized=true;scene=C.layout(state,assets);syncUI(true);requestRender();ensureFonts();
  }
  // Small diagnostic surface used by the included browser regression tests.
  // It returns copies, never live state references. No remote services involved.
  window.TFTApp=Object.freeze({
    getState:()=>C.clone(state),
    getScene:()=>({ids:[...scene.ids],mainFont:scene.mainFont,subFont:scene.subFont,objects:[...scene.objects.values()].map(o=>C.clone(o))}),
    getAssetInfo:()=>[...assets.values()].map(a=>({id:a.id,name:a.name,width:a.image.naturalWidth,height:a.image.naturalHeight})),
    getStatus:()=>({initialized,fontState,history:history.length,future:future.length,selected,panMode}),
    importBlob,loadProjectFile,createExportBlob
  });
  start().catch(e=>{document.querySelector('main').inert=false;initialized=true;scene=C.layout(state,assets);syncUI();requestRender();toast('初期設定の一部を読み込めませんでした。'+e.message,7000);ensureFonts();});
})();
