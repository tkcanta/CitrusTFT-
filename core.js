/* Canvas layout + rendering. Every coordinate is in a 1280×720 logical space.
 * No framework, no DOM screenshot rasterization, no runtime dependency.
 */
(function () {
  'use strict';
  const W = 1280, H = 720;
  const COLORS = Object.freeze({ red: '#ff0000', white: '#ffffff', yellow: '#ffff00' });
  const SERIF = '"Noto Serif JP", "Noto Serif CJK JP", "Yu Mincho", serif';
  const SANS = '"Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", sans-serif';
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(+n) ? +n : min));
  const clone = value => JSON.parse(JSON.stringify(value));
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
  const graphemes = text => segmenter ? Array.from(segmenter.segment(text), s => ({ text: s.segment, index: s.index })) : (() => { let p = 0; return Array.from(text, t => { const o = { text: t, index: p }; p += t.length; return o; }); })();
  const clean = (s, limit = 100, lines = 1) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r/g, '').split('\n').slice(0, lines).join(lines > 1 ? '\n' : '').slice(0, limit);
  const metricCache = new Map();
  const measureCanvas = document.createElement('canvas');
  const mc = measureCanvas.getContext('2d');
  function font(ctx, size, family = SANS) {
    ctx.font = `900 ${size}px ${family}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
    if ('fontKerning' in ctx) ctx.fontKerning = 'none';
  }
  function metric(text, size, family = SANS) {
    const key = `${family}|${size.toFixed(3)}|${text}`;
    if (metricCache.has(key)) return metricCache.get(key);
    font(mc, size, family);
    const m = mc.measureText(text || ' ');
    const fallback = mc.measureText('国');
    const out = {
      width: m.width,
      left: m.actualBoundingBoxLeft || 0,
      right: m.actualBoundingBoxRight || m.width,
      asc: m.actualBoundingBoxAscent || fallback.actualBoundingBoxAscent || size * .88,
      desc: Math.max(0, m.actualBoundingBoxDescent || 0)
    };
    if (metricCache.size > 5000) metricCache.clear();
    metricCache.set(key, out); return out;
  }
  function invalidateMetrics() { metricCache.clear(); }
  const trackingPercent = value => clamp(value ?? 25, 0, 200);
  const headlineTrackingPercent = value => clamp(value ?? 0, -100, 100);
  const trackingPx = (size, value) => size * .08 * trackingPercent(value) / 100;
  function binaryFit(test, max = 320) {
    let lo = 1, hi = max;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (test(m)) lo = m; else hi = m; }
    return Math.floor(lo * 10) / 10;
  }
  function defaultState() {
    return {
      version: 1,
      background: { asset: null, name: '', zoom: 1, panX: 0, panY: 0, blur: 0, shade: .25, flip: false },
      headline: 'ザヤ構成',
      headlineTracking: 0,
      headlineAlign: 'center',
      subtitle: { text: '新オーグで一気に最強へ！', marks: [], wrap: 'auto', tracking: 25 },
      band: { enabled: false, text: 'オーグ解説付き', tracking: 25 },
      logo: { enabled: true, side: 'right', size: 164, margin: 0, asset: 'builtin-logo' },
      character: null,
      texts: [{ id: 'tag', text: 'SET18', color: 'yellow', x: 250, y: 90, sizeScale: 1, boxWidth: 560, rotation: 0, opacity: 1, flip: false, locked: false, visible: true, doubleOutline: false, auto: true, tracking: 25 }],
      overlays: [],
      order: ['character', 'tag', 'subtitle', 'headline', 'band', 'logo'],
      visibility: { headline: true, subtitle: true },
      output: { width: 1280, format: 'png' }
    };
  }
  function getLayer(s, id) {
    if (id === 'character') return s.character;
    return s.texts.find(v => v.id === id) || s.overlays.find(v => v.id === id) || null;
  }
  function textRun(text, size, start = 0, tracking = 25, family = SANS) {
    let advance = 0, left = 0, right = 0, asc = 0, desc = 0;
    const space = family === SERIF ? size * .08 * headlineTrackingPercent(tracking) / 100 : trackingPx(size, tracking);
    const units = graphemes(text);
    const glyphs = units.map((g, i) => {
      const m = metric(g.text, size, family);
      const t = { text: g.text, index: g.index + start, x: advance, width: m.width };
      left = Math.min(left, advance - m.left); right = Math.max(right, advance + m.right);
      advance += m.width + (i < units.length - 1 ? space : 0); asc = Math.max(asc, m.asc); desc = Math.max(desc, m.desc); return t;
    });
    return { glyphs, left, right: Math.max(right, advance), width: Math.max(right, advance) - left, asc, desc, tracking: space };
  }
  // Preserve source indices across line breaking; they are also textarea selection indices.
  function chooseSubLines(s, ideal, maxWidth) {
    const text = s.subtitle.text;
    if (!text) return [];
    if (s.subtitle.wrap === 'single') return [{ text: text.replace(/\n/g, ' '), start: 0 }];
    if (text.includes('\n')) {
      let start = 0;
      return text.split('\n').slice(0, 2).map(t => { const o = { text: t, start }; start += t.length + 1; return o; });
    }
    const run = textRun(text, ideal, 0, s.subtitle.tracking);
    if (run.width <= maxWidth / .78) return [{ text, start: 0 }];
    const gs = graphemes(text);
    let best = null;
    // Balanced two-line composition, avoiding forbidden Japanese line-start/end punctuation.
    const noStart = /^[、。，．・：；？！ー〜）］｝〉》」』】〕…]/;
    const noEnd = /[（［｛〈《「『【〔]$/;
    for (let i = 1; i < gs.length; i++) {
      const at = gs[i].index, a = text.slice(0, at), b = text.slice(at);
      const aw = textRun(a, ideal, 0, s.subtitle.tracking).width, bw = textRun(b, ideal, 0, s.subtitle.tracking).width;
      let score = Math.max(aw, bw) + Math.abs(aw - bw) * .25;
      if (noStart.test(b) || noEnd.test(a)) score += maxWidth * 4;
      if (/[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b)) score += ideal * 2;
      if (/[！!？?、。\s]$/.test(a)) score -= ideal * .6;
      if (!best || score < best.score) best = { score, at };
    }
    return best ? [{ text: text.slice(0, best.at), start: 0 }, { text: text.slice(best.at), start: best.at }] : [{ text, start: 0 }];
  }
  function outlineBox(lines, size, double = false, tracking = 25, family = SANS) {
    const pad = size * (double ? .16 : .105) + 2;
    const runs = lines.map(line => textRun(line.text, size, line.start, tracking, family));
    const lineHeight = size * 1.1;
    const asc = Math.max(size * .77, ...runs.map(r => r.asc));
    const desc = Math.max(size * .05, ...runs.map(r => r.desc));
    const width = Math.max(0, ...runs.map(r => r.width));
    return { runs, font: size, pad, asc, desc, lineHeight, w: width + pad * 2, h: asc + desc + (runs.length - 1) * lineHeight + pad * 2, lines };
  }
  function layout(s, assets) {
    const objects = new Map();
    let mainFont = 240, mainTop = 480;
    if (s.headline && s.visibility.headline) {
      const tracking = headlineTrackingPercent(s.headlineTracking);
      mainFont = binaryFit(f => {
        const run = textRun(s.headline, f, 0, tracking, SERIF), pad = f * .075 + 2;
        return run.width + 2 * pad <= W - 28 && run.asc + run.desc + 2 * pad + 4 <= 244;
      });
      const run = textRun(s.headline, mainFont, 0, tracking, SERIF), pad = mainFont * .075 + 2;
      const w = run.width + 2 * pad, h = run.asc + run.desc + 2 * pad + 4;
      mainTop = H - 18 - h;
      objects.set('headline', { id: 'headline', type: 'headline', font: mainFont, run, tracking, pad, w, h, x: s.headlineAlign === 'left' ? 14 + w / 2 : W / 2, y: mainTop + h / 2, rotation: 0, locked: true });
    }
    let subFont = 0, subTop = mainTop;
    if (s.subtitle.text && s.visibility.subtitle) {
      const ideal = Math.min(88, mainFont * .46), maxWidth = W - 52;
      const lines = chooseSubLines(s, ideal, maxWidth);
      subFont = binaryFit(f => {
        const b = outlineBox(lines, f, false, s.subtitle.tracking);
        return b.w <= maxWidth && b.h <= Math.max(54, mainTop - 212);
      }, ideal);
      const box = outlineBox(lines, subFont, false, s.subtitle.tracking);
      subTop = mainTop - 10 - box.h;
      objects.set('subtitle', { ...box, id: 'subtitle', type: 'subtitle', x: 24 + box.w / 2, y: subTop + box.h / 2, rotation: 0, locked: true });
    }
    if (s.logo.enabled) {
      const a = assets.get(s.logo.asset); const ratio = a ? a.image.naturalHeight / a.image.naturalWidth : 1;
      const w = s.logo.size, h = s.logo.size * ratio;
      objects.set('logo', { id: 'logo', type: 'logo', asset: s.logo.asset, w, h, x: s.logo.side === 'right' ? W - s.logo.margin - w / 2 : s.logo.margin + w / 2, y: s.logo.margin + h / 2, rotation: 0, locked: true });
    }
    if (s.band.enabled && s.band.text) {
      const maxWidth = Math.min(880, W - (s.logo.enabled ? s.logo.size + s.logo.margin * 2 : 0) - 36);
      const tracking = trackingPercent(s.band.tracking);
      const size = binaryFit(f => textRun(s.band.text, f, 0, tracking).width + 64 <= maxWidth, 68);
      const run = textRun(s.band.text, size, 0, tracking), w = Math.min(maxWidth, Math.max(320, run.width + 64));
      objects.set('band', { id: 'band', type: 'band', text: s.band.text, font: size, tracking, run, w, h: 126, x: s.logo.enabled && s.logo.side === 'left' ? W - w / 2 : w / 2, y: 63, rotation: 0, locked: true });
    }
    const imageLayer = (l, type) => {
      if (!l || !l.visible || !assets.has(l.asset)) return;
      const a = assets.get(l.asset), h = l.w * a.image.naturalHeight / a.image.naturalWidth;
      objects.set(l.id, { ...l, type, h });
    };
    imageLayer(s.character, 'character');
    s.overlays.forEach(l => imageLayer(l, 'image'));
    s.texts.forEach(l => {
      if (!l.visible || !l.text) return;
      const lines = l.text.split('\n').slice(0, 3).map(t => ({ text: t, start: 0 }));
      const ideal = Math.min(104, Math.max(52, mainFont * .48));
      const f = binaryFit(size => outlineBox(lines, size, l.doubleOutline, l.tracking).w <= l.boxWidth, ideal) * l.sizeScale;
      const box = outlineBox(lines, f, l.doubleOutline, l.tracking);
      const obj = { ...l, ...box, type: 'text', x: l.x, y: l.y };
      if (l.auto) {
        const right = s.logo.enabled && s.logo.side === 'left';
        obj.x = right ? W - 26 - box.w / 2 : 26 + box.w / 2;
        obj.y = (s.band.enabled ? 154 : 24) + box.h / 2;
      }
      objects.set(l.id, obj);
    });
    const ids = s.order.filter(id => objects.has(id));
    objects.forEach((_, id) => { if (!ids.includes(id)) ids.push(id); });
    return { objects, ids, mainFont, subFont, mainTop, subTop };
  }
  function backgroundRect(bg, image) {
    const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight) * bg.zoom;
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    return { x: (W - w) / 2 + bg.panX * Math.max(0, (w - W) / 2), y: (H - h) / 2 + bg.panY * Math.max(0, (h - H) / 2), w, h };
  }
  function drawOutlined(ctx, obj, s) {
    const { w, h, pad, font: f, runs, asc, lineHeight } = obj;
    font(ctx, f);
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    const double = obj.type === 'text' && obj.doubleOutline;
    const glyphs = [];
    runs.forEach((r, row) => r.glyphs.forEach(g => glyphs.push({ ...g, x: -w / 2 + pad - r.left + g.x, y: -h / 2 + pad + asc + row * lineHeight })));
    // Global outline passes prevent a later glyph's outline from covering an earlier fill.
    if (double) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = f * .30;
      glyphs.forEach(g => ctx.strokeText(g.text, g.x, g.y));
      ctx.strokeStyle = '#fff'; ctx.lineWidth = f * .235;
      glyphs.forEach(g => ctx.strokeText(g.text, g.x, g.y));
    }
    ctx.strokeStyle = '#000'; ctx.lineWidth = f * .18;
    ctx.shadowColor = '#000000'; ctx.shadowOffsetY = f * .018; ctx.shadowBlur = f * .028;
    glyphs.forEach(g => ctx.strokeText(g.text, g.x, g.y));
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    glyphs.forEach(g => {
      ctx.fillStyle = obj.type === 'subtitle' ? (s.subtitle.marks.some(m => g.index >= m.start && g.index < m.end) ? COLORS.yellow : COLORS.white) : COLORS[obj.color];
      ctx.fillText(g.text, g.x, g.y);
    });
  }
  function draw(ctx, s, assets, scene, scale = 1) {
    ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#182234'; ctx.fillRect(0, 0, W, H);
    const bg = assets.get(s.background.asset);
    if (bg) {
      const r = backgroundRect(s.background, bg.image);
      ctx.save();
      if (s.background.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      if (s.background.blur > 0) ctx.filter = `blur(${s.background.blur * scale}px)`;
      // Overdraw prevents transparent blur edges at the canvas boundary.
      const b = s.background.blur * 3;
      ctx.drawImage(bg.image, r.x - b, r.y - b, r.w + b * 2, r.h + b * 2);
      ctx.restore();
    } else {
      const gradient = ctx.createLinearGradient(0, 0, W, H);
      gradient.addColorStop(0, '#253c5a'); gradient.addColorStop(.6, '#1a2437'); gradient.addColorStop(1, '#101724');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    }
    if (s.background.shade > 0) {
      const g = ctx.createLinearGradient(0, 200, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.65, `rgba(0,0,0,${s.background.shade * .65})`); g.addColorStop(1, `rgba(0,0,0,${s.background.shade})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    scene.ids.forEach(id => {
      const o = scene.objects.get(id);
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate((o.rotation || 0) * Math.PI / 180);
      ctx.globalAlpha = o.opacity ?? 1;
      if (o.flip) ctx.scale(-1, 1);
      if (['image', 'character', 'logo'].includes(o.type)) {
        const a = assets.get(o.asset);
        if (a) {
          if (o.type === 'character') { ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 8 * scale; ctx.shadowOffsetY = 3 * scale; }
          ctx.drawImage(a.image, -o.w / 2, -o.h / 2, o.w, o.h);
        }
      } else if (o.type === 'headline') {
        font(ctx, o.font, SERIF); ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        const glyphs = o.run.glyphs.map(g => ({ text: g.text, x: -o.w / 2 + o.pad - o.run.left + g.x, y: -o.h / 2 + o.pad + o.run.asc }));
        ctx.strokeStyle = '#000'; ctx.lineWidth = o.font * .15;
        ctx.shadowColor = '#000'; ctx.shadowBlur = 1.5 * scale; ctx.shadowOffsetY = 3 * scale;
        glyphs.forEach(g => ctx.strokeText(g.text, g.x, g.y)); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = o.font * .086; glyphs.forEach(g => ctx.strokeText(g.text, g.x, g.y));
        ctx.fillStyle = COLORS.red; glyphs.forEach(g => ctx.fillText(g.text, g.x, g.y));
      } else if (o.type === 'band') {
        ctx.fillStyle = '#000'; ctx.fillRect(-o.w / 2, -63, o.w, 126);
        font(ctx, o.font);
        // Fitted from reference scanlines: G(y) = 287.868 − 1.0414 y; red=255, blue=0.
        // Coordinates stay fixed when the text gets smaller. No stroke, no shadow.
        const g = ctx.createLinearGradient(0, -63 + 32, 0, -63 + 100);
        g.addColorStop(0, '#fffe00'); g.addColorStop(1, '#ffb800');
        ctx.fillStyle = g;
        o.run.glyphs.forEach(glyph => ctx.fillText(glyph.text, -o.run.width / 2 - o.run.left + glyph.x, (o.run.asc - o.run.desc) / 2));
      } else if (o.type === 'subtitle' || o.type === 'text') drawOutlined(ctx, o, s);
      ctx.restore();
    });
    ctx.restore();
  }
  function bounds(o) {
    const a = (o.rotation || 0) * Math.PI / 180, w = Math.abs(Math.cos(a) * o.w) + Math.abs(Math.sin(a) * o.h), h = Math.abs(Math.sin(a) * o.w) + Math.abs(Math.cos(a) * o.h);
    return { x: o.x - w / 2, y: o.y - h / 2, w, h, right: o.x + w / 2, bottom: o.y + h / 2 };
  }
  function localPoint(o, p) {
    const a = -(o.rotation || 0) * Math.PI / 180, x = p.x - o.x, y = p.y - o.y;
    return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
  }
  function worldPoint(o, p) {
    const a = (o.rotation || 0) * Math.PI / 180;
    return { x: o.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: o.y + p.x * Math.sin(a) + p.y * Math.cos(a) };
  }
  function hitTest(o, p, assets) {
    if (o.opacity === 0) return false;
    const q = localPoint(o, p);
    if (Math.abs(q.x) > o.w / 2 || Math.abs(q.y) > o.h / 2) return false;
    if (o.asset && assets.get(o.asset)?.alpha) {
      const a = assets.get(o.asset).alpha;
      const u = (o.flip ? -q.x : q.x) / o.w + .5, v = q.y / o.h + .5;
      const x = Math.min(a.w - 1, Math.floor(u * a.w)), y = Math.min(a.h - 1, Math.floor(v * a.h));
      return a.data[(y * a.w + x) * 4 + 3] > 18;
    }
    return true;
  }
  function autoPlace(o, scene, preferRight = false) {
    const pad = 24;
    const candidates = [];
    const maxY = Math.max(pad, Math.min(410, scene.subTop - o.h - 16));
    [pad, Math.max(pad, (W - o.w) / 2), Math.max(pad, W - o.w - pad)].forEach((x, xi) => {
      [pad, 156, 250, maxY].forEach(y => candidates.push({ x: x + o.w / 2, y: y + o.h / 2, preference: (preferRight ? 2 - xi : xi) * 100 }));
    });
    let best;
    candidates.forEach(c => {
      let score = c.preference;
      const b = { x: c.x - o.w / 2, y: c.y - o.h / 2, right: c.x + o.w / 2, bottom: c.y + o.h / 2 };
      scene.objects.forEach(other => {
        if (other.id === o.id) return;
        const r = bounds(other), overlap = Math.max(0, Math.min(r.right, b.right) - Math.max(r.x, b.x)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.y, b.y));
        score += overlap * (other.type === 'character' || other.type === 'image' ? .4 : 3);
      });
      score += Math.max(0, b.bottom - H + pad) * W;
      if (!best || score < best.score) best = { x: c.x, y: c.y, score };
    });
    return best;
  }
  function remapMarks(oldText, newText, marks) {
    let prefix = 0;
    while (prefix < oldText.length && prefix < newText.length && oldText[prefix] === newText[prefix]) prefix++;
    let suffix = 0;
    while (suffix < oldText.length - prefix && suffix < newText.length - prefix && oldText[oldText.length - suffix - 1] === newText[newText.length - suffix - 1]) suffix++;
    const oldEnd = oldText.length - suffix, newEnd = newText.length - suffix;
    const delta = newText.length - oldText.length;
    const colors = new Array(newText.length).fill(false);
    const inherited = marks.some(m => prefix > m.start && prefix < m.end);
    marks.forEach(m => {
      for (let i = m.start; i < Math.min(m.end, prefix); i++) colors[i] = true;
      for (let i = Math.max(m.start, oldEnd); i < m.end; i++) if (i + delta >= 0 && i + delta < colors.length) colors[i + delta] = true;
    });
    if (inherited) for (let i = prefix; i < newEnd; i++) colors[i] = true;
    return marksFromFlags(colors);
  }
  function marksFromFlags(flags) {
    const out = []; let start = -1;
    for (let i = 0; i <= flags.length; i++) {
      if (flags[i] && start < 0) start = i;
      if (!flags[i] && start >= 0) { out.push({ start, end: i }); start = -1; }
    }
    return out;
  }
  function setMark(text, marks, start, end, on) {
    const flags = new Array(text.length).fill(false);
    marks.forEach(m => { for (let i = m.start; i < m.end; i++) flags[i] = true; });
    for (let i = start; i < end; i++) flags[i] = on;
    return marksFromFlags(flags);
  }
  // Whitelist validation used for both autosave recovery and imported projects.
  function validate(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.overlays) || !Array.isArray(input.texts)) throw new Error('このプロジェクト形式には対応していません。');
    if (input.overlays.length > 5) throw new Error('追加画像は最大5枚です。');
    if (input.texts.length > 20) throw new Error('自由文字は最大20個です。');
    const s = defaultState(), asset = v => typeof v === 'string' && v.length < 160 ? v : null;
    const b = input.background || {};
    s.background = { asset: asset(b.asset), name: clean(b.name, 140), zoom: clamp(b.zoom ?? 1, 1, 4), panX: clamp(b.panX ?? 0, -1, 1), panY: clamp(b.panY ?? 0, -1, 1), blur: clamp(b.blur ?? 0, 0, 14), shade: clamp(b.shade ?? .25, 0, .8), flip: !!b.flip };
    s.headline = clean(input.headline, 100);
    s.headlineTracking = headlineTrackingPercent(input.headlineTracking);
    s.headlineAlign = input.headlineAlign === 'left' ? 'left' : 'center';
    const sub = input.subtitle || {};
    s.subtitle.text = clean(sub.text, 160, 2); s.subtitle.wrap = sub.wrap === 'single' ? 'single' : 'auto'; s.subtitle.tracking = trackingPercent(sub.tracking);
    s.subtitle.marks = (Array.isArray(sub.marks) ? sub.marks : []).slice(0, 160).filter(m => m && typeof m === 'object').map(m => ({ start: Math.floor(clamp(m.start, 0, s.subtitle.text.length)), end: Math.floor(clamp(m.end, 0, s.subtitle.text.length)) })).filter(m => m.end > m.start);
    const flags = new Array(s.subtitle.text.length).fill(false);
    s.subtitle.marks.forEach(m => { for(let i=m.start;i<m.end;i++) flags[i]=true; });
    s.subtitle.marks = marksFromFlags(flags);
    s.band = { enabled: !!input.band?.enabled, text: clean(input.band?.text, 36), tracking: trackingPercent(input.band?.tracking) };
    const l = input.logo || {};
    s.logo = { enabled: l.enabled !== false, side: l.side === 'left' ? 'left' : 'right', size: clamp(l.size ?? 164, 100, 240), margin: clamp(l.margin ?? 0, 0, 40), asset: asset(l.asset) || 'builtin-logo' };
    const used = new Set(['headline', 'subtitle', 'band', 'logo', 'character', 'background']);
    function base(t, isCharacter) {
      if (!t || typeof t !== 'object') throw new Error('レイヤーの情報が不正です。');
      const id = isCharacter ? 'character' : typeof t.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(t.id) ? t.id : '';
      if (!id || (!isCharacter && used.has(id))) throw new Error('レイヤーIDが重複しているか、不正です。');
      used.add(id);
      return { id, x: clamp(t.x ?? 640, -1280, 2560), y: clamp(t.y ?? 360, -720, 1440), rotation: clamp(t.rotation ?? 0, -180, 180), opacity: clamp(t.opacity ?? 1, 0, 1), flip: !!t.flip, locked: !!t.locked, visible: t.visible !== false, name: clean(t.name, 100) };
    }
    function image(t, isCharacter) { return { ...base(t, isCharacter), asset: asset(t.asset), w: clamp(t.w ?? 400, 20, 2600) }; }
    s.character = input.character ? image(input.character, true) : null;
    s.overlays = input.overlays.map(t => image(t, false));
    s.texts = input.texts.map(t => ({ ...base(t, false), text: clean(t.text, 100, 3), color: Object.hasOwn(COLORS, t.color) ? t.color : 'yellow', boxWidth: clamp(t.boxWidth ?? 560, 100, 1200), sizeScale: clamp(t.sizeScale ?? 1, .15, 4), doubleOutline: !!t.doubleOutline, auto: !!t.auto, tracking: trackingPercent(t.tracking) }));
    const valid = ['character', ...s.texts.map(t => t.id), ...s.overlays.map(t => t.id), 'subtitle', 'headline', 'band', 'logo'];
    s.order = Array.isArray(input.order) ? [...new Set(input.order.filter(id => valid.includes(id)))] : [];
    valid.forEach(id => { if (!s.order.includes(id)) s.order.push(id); });
    s.visibility = { headline: input.visibility?.headline !== false, subtitle: input.visibility?.subtitle !== false };
    s.output = { width: [1280, 1920, 2560].includes(+input.output?.width) ? +input.output.width : 1280, format: input.output?.format === 'jpeg' ? 'jpeg' : 'png' };
    return s;
  }
  window.TFTCore = { W, H, COLORS, SERIF, SANS, clamp, clone, clean, graphemes, metric, invalidateMetrics, trackingPercent, trackingPx, defaultState, getLayer, layout, draw, backgroundRect, bounds, localPoint, worldPoint, hitTest, autoPlace, remapMarks, setMark, validate };
})();
