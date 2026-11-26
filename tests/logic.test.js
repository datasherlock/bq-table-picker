// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../data.js');
const LOGIC = require('../logic.js');

const { TYPES, NEEDS, TIPS, SOURCES } = DATA;
const needIds = NEEDS.map((n) => n.id);
const byId = (id) => TYPES.find((t) => t.id === id);
const fitIds = (needs) => LOGIC.summarize(TYPES, needs).fits.map((r) => r.type.id);

test('every type answers every need, and explains each "no" or "partly"', () => {
  for (const type of TYPES) {
    assert.deepEqual(Object.keys(type.fit).sort(), needIds.slice().sort(), type.id);
    for (const id of needIds) {
      const fit = type.fit[id];
      assert.ok(['yes', 'partial', 'no'].includes(fit.level), `${type.id}.${id}`);
      if (fit.level !== 'yes') assert.ok(fit.why && fit.why.length > 0, `${type.id}.${id} needs a reason`);
    }
  }
});

test('every route has a known kind and a plain note', () => {
  const kinds = ['direct', 'via', 'preview', 'none', 'outside'];
  for (const type of TYPES) {
    for (const mode of ['write', 'read']) {
      for (const engine of ['bq', 'other']) {
        const route = type[mode][engine];
        assert.ok(kinds.includes(route.kind), `${type.id}.${mode}.${engine}`);
        assert.ok(route.note.length > 0, `${type.id}.${mode}.${engine} note`);
      }
    }
  }
});

test('ids are unique and links are public https docs', () => {
  assert.equal(new Set(TYPES.map((t) => t.id)).size, TYPES.length);
  for (const url of [...TYPES.map((t) => t.doc), ...SOURCES.map((s) => s.url)]) {
    assert.match(url, /^https:\/\/docs\.cloud\.google\.com\//);
  }
});

test('BigQuery-owned tables take engine writes through BigQuery, not directly', () => {
  for (const id of ['standard', 'managed']) {
    assert.equal(byId(id).write.other.kind, 'via');
    assert.equal(byId(id).fit.direct.level, 'no');
    assert.equal(byId(id).fit.stream.level, 'yes');
  }
});

test('runtime Iceberg: engines write directly, BigQuery SQL is Preview, no Storage Write API', () => {
  const t = byId('runtime');
  assert.equal(t.write.other.kind, 'direct');
  assert.equal(t.write.bq.kind, 'preview');
  assert.equal(t.fit.stream.level, 'no');
  assert.equal(t.security.tags.ok, false);
  assert.equal(t.security.masking.ok, true);
});

test('no needs selected leaves every type idle', () => {
  const s = LOGIC.summarize(TYPES, []);
  assert.ok(s.rows.every((r) => r.verdict.level === 'idle'));
  assert.equal(s.best, null);
});

test('known answers', () => {
  assert.deepEqual(fitIds(['direct']), ['runtime']);
  assert.deepEqual(fitIds(['bqsql', 'stream']), ['standard', 'managed']);
  assert.deepEqual(fitIds(['stream', 'openfiles', 'policytags']), ['managed']);
  assert.deepEqual(fitIds(['unstructured']), ['object']);
  assert.deepEqual(fitIds(['othercloud']), ['biglake', 'federated']);
  assert.deepEqual(fitIds(['direct', 'finegrained', 'openfiles']), ['runtime']);
});

test('the type to show follows the needs: clear winner gets crowned, ties stay ties', () => {
  assert.equal(LOGIC.summarize(TYPES, []).pick, null);
  const openOnly = LOGIC.summarize(TYPES, ['openfiles']);
  assert.equal(openOnly.pick.type.id, 'managed');
  assert.equal(openOnly.clearWinner, null);
  assert.equal(LOGIC.summarize(TYPES, ['finegrained']).pick.type.id, 'standard');
  assert.equal(LOGIC.summarize(TYPES, ['bqsql']).pick.type.id, 'standard');
  assert.equal(LOGIC.summarize(TYPES, ['openfiles', 'policytags']).pick.type.id, 'managed');
  assert.equal(LOGIC.summarize(TYPES, ['openfiles', 'policytags']).clearWinner, null);
  assert.equal(LOGIC.summarize(TYPES, ['openfiles', 'bqsql']).clearWinner.type.id, 'managed');
  assert.equal(LOGIC.summarize(TYPES, ['direct', 'stream']).pick, null);
});

test('a need that only partly holds is a caveat, not a fit', () => {
  const v = LOGIC.verdictFor(byId('runtime'), ['bqsql']);
  assert.equal(v.level, 'caveat');
  assert.equal(v.caveats[0].need, 'bqsql');
});

test('the legacy type never shows as a clean fit', () => {
  const v = LOGIC.verdictFor(byId('external'), ['openfiles']);
  assert.equal(v.level, 'caveat');
  assert.equal(v.caveats.at(-1).why, LOGIC.LEGACY_REASON);
});

test('impossible combinations report the closest type', () => {
  const s = LOGIC.summarize(TYPES, ['direct', 'stream']);
  assert.equal(s.fits.length + s.caveats.length, 0);
  assert.ok(s.closest);
  assert.equal(s.closest.verdict.misses.length, 1);
  assert.ok(LOGIC.tipFor(TIPS, ['direct', 'stream']));
});

test('new inputs lead to the types built for them', () => {
  assert.deepEqual(fitIds(['remotecatalog']), ['federated']);
  assert.deepEqual(fitIds(['hivemigrate']), ['hive']);
  assert.equal(LOGIC.summarize(TYPES, ['rawfiles']).clearWinner.type.id, 'biglake');
  assert.equal(LOGIC.summarize(TYPES, ['rawfiles', 'finegrained']).clearWinner.type.id, 'biglake');
  assert.equal(LOGIC.summarize(TYPES, ['iceberg', 'remotecatalog']).clearWinner.type.id, 'federated');
  const plainDeltaRemote = LOGIC.summarize(TYPES, ['rawfiles', 'remotecatalog']);
  assert.equal(plainDeltaRemote.fits.length, 0);
  assert.deepEqual(plainDeltaRemote.caveats.map((r) => r.type.id), ['biglake']);
  assert.match(LOGIC.tipFor(TIPS, ['rawfiles', 'remotecatalog']) ?? '', /UniForm/);
  assert.match(LOGIC.tipFor(TIPS, ['iceberg', 'rawfiles']) ?? '', /different formats/);
  assert.equal(LOGIC.summarize(TYPES, ['directread', 'bqsql', 'stream']).pick.type.id, 'managed');
  assert.equal(LOGIC.verdictFor(byId('managed'), ['directread']).level, 'caveat');
  assert.equal(LOGIC.summarize(TYPES, ['directread']).pick.type.id, 'runtime');
});

test('when nothing fits, dropping one need says what would', () => {
  const needs = ['bqsql', 'stream', 'openfiles', 'othercloud'];
  assert.equal(LOGIC.summarize(TYPES, needs).best, null);
  const options = LOGIC.dropOptions(TYPES, needs);
  assert.deepEqual(options.map((o) => o.need), ['othercloud']);
  assert.deepEqual(options[0].matches.map((t) => t.id), ['managed']);
  assert.deepEqual(LOGIC.dropOptions(TYPES, ['unstructured', 'bqsql', 'othercloud']), []);
});

test('every need belongs to a known group with a valid control kind', () => {
  const groups = DATA.NEED_GROUPS.map((g) => g.id);
  for (const g of DATA.NEED_GROUPS) {
    assert.ok(g.kind === 'select' || g.kind === 'multi', g.id);
    if (g.kind === 'select') assert.ok(g.any && g.any.length > 0, `${g.id} needs an "any" label`);
  }
  for (const n of NEEDS) assert.ok(groups.includes(n.group) && n.chip.length > 0, n.id);
});

test('tips only fire when all of their needs are selected', () => {
  assert.equal(LOGIC.tipFor(TIPS, ['direct']), null);
  assert.match(LOGIC.tipFor(TIPS, ['finegrained', 'direct']) ?? '', /masks and row filters/);
});

test('view state survives a round trip and ignores junk', () => {
  const known = { typeIds: TYPES.map((t) => t.id), needIds, fallbackType: 'standard' };
  const state = { type: 'runtime', needs: ['direct', 'finegrained'], mode: 'read' };
  assert.deepEqual(LOGIC.decodeState(LOGIC.encodeState(state), known), state);
  assert.deepEqual(LOGIC.decodeState('t=nope&n=x,direct,<script>&m=??', known), {
    type: 'standard', needs: ['direct'], mode: 'write',
  });
});
