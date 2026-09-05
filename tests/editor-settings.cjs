// Run: node tests/editor-settings.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
// Deterministic glyph metrics isolate spacing/alignment from installed fonts.
const context = vm.createContext({ window: {}, Intl, URL, document: { createElement: () => ({ getContext: () => ({ measureText() {
  const size = Number(this.font.match(/900 ([\d.]+)px/)[1]);
  return { width: size, actualBoundingBoxLeft: 0, actualBoundingBoxRight: size, actualBoundingBoxAscent: size * .8, actualBoundingBoxDescent: size * .1 };
} }) }) } });
for (const file of ['core.js', 'catalog.js', 'sources.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
const C = context.window.TFTCore;
const state = C.defaultState();
assert.equal(state.headlineTracking, 0);
assert.equal(state.headlineAlign, 'center');
state.headline = '最強';
const objects = [-100, 0, 100].map(value => { state.headlineTracking = value; return C.layout(C.validate(state), new Map()).objects.get('headline'); });
assert(objects[0].w < objects[1].w && objects[1].w < objects[2].w);
assert.equal(objects[1].x, 640);
state.headlineAlign = 'left';
state.headlineTracking = -100;
const restored = C.validate(JSON.parse(JSON.stringify(state)));
assert.equal(restored.headlineTracking, -100);
assert.equal(restored.headlineAlign, 'left');
const left = C.layout(restored, new Map()).objects.get('headline');
assert.equal(left.x - left.w / 2, 14);
for (const [input, expected] of [[-200, -100], [200, 100], [undefined, 0]]) {
  state.headlineTracking = input;
  assert.equal(C.validate(state).headlineTracking, expected);
}
delete state.headlineAlign;
assert.equal(C.validate(state).headlineAlign, 'center');
assert.equal(C.validate(state).subtitle.tracking, 25);
for (const text of ['最強', 'W'.repeat(100), '攻略'.repeat(50)]) {
  for (const tracking of [-100, 0, 100]) {
    state.headline = text; state.headlineTracking = tracking;
    const o = C.layout(state, new Map()).objects.get('headline');
    assert(o.w <= 1252.1 && o.h <= 244.1);
  }
}
(async () => {
  // No fetch or network exists in this context: file:// and offline catalog work.
  const items = await context.window.TFTSources.fetchCatalog();
  assert(items.length > 4000);
  assert(items.every(item => item.name && new URL(item.url).hostname === 'raw.githubusercontent.com'));
  const S = context.window.TFTSources;
  const champions = S.filterCatalog(items);
  assert.equal(champions.length, 323);
  assert(champions.every(item => item.url.includes('/img/champion/')));
  const groups = Object.keys(S.CATEGORIES).map(category => S.filterCatalog(items, category));
  assert.equal(groups.filter(group => group.length).length, 14);
  assert.equal(groups.reduce((total, group) => total + group.length, 0), items.length);
  assert.equal(S.filterCatalog(items, 'champion', '  ' + champions[0].name + '  ').length > 0, true);
  assert.equal(S.filterCatalog(items, 'champion', 'no-such-image-123456789').length, 0);
  const custom = { url: 'https://example.com/image.png', name: 'Custom' };
  assert.equal(S.filterCatalog([custom], 'other', 'CUSTOM').length, 1);
  assert.equal(S.categoryOf({ url: 'invalid' }), 'other');
  const original = items[0].name;
  items[0].name = 'changed';
  assert.equal((await context.window.TFTSources.fetchCatalog())[0].name, original);
  console.log('PASS: tracking, alignment, restoration, fit, offline catalog, categories and search');
})().catch(error => { console.error(error); process.exitCode = 1; });
