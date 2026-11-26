// @ts-check
/**
 * Pure matching logic. No DOM access, so it runs in the browser and in Node tests.
 *
 * @typedef {import('./data.js').TableType} TableType
 * @typedef {import('./data.js').NeedId} NeedId
 * @typedef {{ need: NeedId | null, why: string }} Reason
 * @typedef {'idle'|'fit'|'caveat'|'out'} VerdictLevel
 * @typedef {{ level: VerdictLevel, misses: Reason[], caveats: Reason[], notes: Reason[] }} Verdict
 * @typedef {{ type: string, needs: NeedId[], mode: 'write'|'read' }} ViewState
 */
(function (root) {
  const LEGACY_REASON = 'No longer recommended for most new work.';

  /**
   * How well one table type meets the selected needs.
   * @param {TableType} type
   * @param {NeedId[]} needs
   * @returns {Verdict}
   */
  function verdictFor(type, needs) {
    /** @type {Verdict} */
    const verdict = { level: 'idle', misses: [], caveats: [], notes: [] };
    if (needs.length === 0) return verdict;

    for (const need of needs) {
      const fit = type.fit[need];
      if (!fit) throw new Error(`Missing fit for "${need}" on "${type.id}"`);
      if (fit.level === 'no') verdict.misses.push({ need, why: fit.why ?? 'Not supported.' });
      else if (fit.level === 'partial') verdict.caveats.push({ need, why: fit.why ?? 'Partly supported.' });
      else if (fit.why) verdict.notes.push({ need, why: fit.why });
    }
    if (type.legacy) verdict.caveats.push({ need: null, why: LEGACY_REASON });

    verdict.level = verdict.misses.length > 0 ? 'out' : verdict.caveats.length > 0 ? 'caveat' : 'fit';
    return verdict;
  }

  /**
   * Verdicts for every type, plus the best one to show first.
   * @param {TableType[]} types
   * @param {NeedId[]} needs
   */
  function summarize(types, needs) {
    const rows = types.map((type) => ({ type, verdict: verdictFor(type, needs) }));
    // Only prefer open-lakehouse recommended types when the reader asked for open-engine access.
    const openEngineNeed = needs.some((n) => n === 'direct' || n === 'directread');
    /** @param {{ type: TableType }} a @param {{ type: TableType }} b */
    const byPreference = (a, b) => openEngineNeed
      ? Number(Boolean(b.type.preferred)) - Number(Boolean(a.type.preferred)) : 0;
    const fits = rows.filter((r) => r.verdict.level === 'fit').sort(byPreference);
    const caveats = rows.filter((r) => r.verdict.level === 'caveat').sort(byPreference);
    const outs = rows.filter((r) => r.verdict.level === 'out');
    const closest = outs.slice().sort((a, b) => a.verdict.misses.length - b.verdict.misses.length)[0] ?? null;
    const best = fits[0] ?? caveats[0] ?? null;
    /** Only crown a single winner when one type stands alone; ties stay ties. */
    const clearWinner = fits.length === 1 ? fits[0] : null;
    /** What to open when the needs change. Null when nothing fits: a wrong answer is worse than none. */
    const pick = best;
    return { rows, fits, caveats, outs, best, clearWinner, closest, pick };
  }

  /**
   * For each selected need: what would fit if that one need were dropped.
   * Only needs whose removal produces at least one match are returned.
   * @param {TableType[]} types
   * @param {NeedId[]} needs
   * @returns {{ need: NeedId, matches: TableType[] }[]}
   */
  function dropOptions(types, needs) {
    return needs
      .map((need) => {
        const s = summarize(types, needs.filter((n) => n !== need));
        return { need, matches: [...s.fits, ...s.caveats].map((r) => r.type) };
      })
      .filter((o) => o.matches.length > 0);
  }

  /**
   * The first tip whose needs are all selected.
   * @param {{ when: NeedId[], text: string }[]} tips
   * @param {NeedId[]} needs
   * @returns {string | null}
   */
  function tipFor(tips, needs) {
    const tip = tips.find((t) => t.when.every((id) => needs.includes(id)));
    return tip ? tip.text : null;
  }

  /**
   * @param {ViewState} state
   * @returns {string} query string without the leading "?"
   */
  function encodeState(state) {
    const params = new URLSearchParams();
    params.set('t', state.type);
    if (state.needs.length > 0) params.set('n', state.needs.join(','));
    if (state.mode !== 'write') params.set('m', state.mode);
    return params.toString();
  }

  /**
   * Reads a query string and drops anything it does not recognise.
   * @param {string} query
   * @param {{ typeIds: string[], needIds: NeedId[], fallbackType: string }} known
   * @returns {ViewState}
   */
  function decodeState(query, known) {
    const params = new URLSearchParams(query);
    const t = params.get('t') ?? '';
    const wanted = (params.get('n') ?? '').split(',');
    const needs = known.needIds.filter((id) => wanted.includes(id));
    return {
      type: known.typeIds.includes(t) ? t : known.fallbackType,
      needs,
      mode: params.get('m') === 'read' ? 'read' : 'write',
    };
  }

  const LOGIC = { verdictFor, summarize, dropOptions, tipFor, encodeState, decodeState, LEGACY_REASON };

  if (typeof module !== 'undefined' && module.exports) module.exports = LOGIC;
  else /** @type {any} */ (root).TABLE_LOGIC = LOGIC;
})(typeof globalThis !== 'undefined' ? globalThis : this);
