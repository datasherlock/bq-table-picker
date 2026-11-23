// @ts-check
/**
 * Rendering and events. Content lives in data.js, matching rules in logic.js.
 *
 * @typedef {import('./data.js').TableType} TableType
 * @typedef {import('./data.js').NeedId} NeedId
 * @typedef {import('./data.js').RouteKind} RouteKind
 * @typedef {import('./data.js').Route} Route
 * @typedef {import('./logic.js').Verdict} Verdict
 * @typedef {'write'|'read'} Mode
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */
(function () {
  const win = /** @type {any} */ (window);
  const { NEED_GROUPS, NEEDS, TYPES, TIPS, SOURCES, CHECKED_ON } = win.TABLE_DATA;
  const LOGIC = win.TABLE_LOGIC;

  /** @param {string} id */
  const el = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  /** @param {string} text */
  const esc = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const PATHS = {
    check: 'M3.5 8.5l3 3 6-7',
    cross: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
    via: 'M2.5 8h8M7.5 4.5L11 8l-3.5 3.5M13.5 3.5v9',
    preview: 'M8 4.5V8l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z',
    outside: 'M5 11l6-6M6.5 5H11v4.5',
    caveat: 'M8 3.5v5.5M8 12v.2',
    sun: 'M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9',
    moon: 'M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z',
    query: 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM10.3 10.3l3.2 3.2',
    engine: 'M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z',
    catalog: 'M3 4h10M3 8h10M3 12h6',
    storage: 'M3 4.5c0-1.1 2.2-2 5-2s5 .9 5 2v7c0 1.1-2.2 2-5 2s-5-.9-5-2zM3 4.5c0 1.1 2.2 2 5 2s5-.9 5-2M3 8c0 1.1 2.2 2 5 2s5-.9 5-2',
    arrow: 'M3 8h10M9 4l4 4-4 4',
  };
  /** @param {keyof typeof PATHS} name */
  const icon = (name) => `<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

  /** @type {Record<RouteKind, { icon: keyof typeof PATHS, word: string, legend: string, stage: Record<Mode, string>, speed: number }>} */
  const KIND = {
    direct: { icon: 'check', word: 'Yes', legend: 'Works on the table directly', stage: { write: 'writes directly', read: 'reads directly' }, speed: 2.8 },
    via: { icon: 'via', word: 'Yes, through BigQuery', legend: 'Goes through BigQuery', stage: { write: 'writes via BigQuery', read: 'reads via BigQuery' }, speed: 3.8 },
    preview: { icon: 'preview', word: 'Yes, in Preview', legend: 'Works, in Preview', stage: { write: 'SQL · Preview', read: 'reads · Preview' }, speed: 3.4 },
    outside: { icon: 'outside', word: 'Outside the table', legend: 'Works on the files, outside the table', stage: { write: 'writes files itself', read: 'reads files itself' }, speed: 3.4 },
    none: { icon: 'cross', word: 'No', legend: 'Not possible', stage: { write: 'can\'t write', read: 'can\'t read' }, speed: 0 },
  };

  const GROUPS = { bigquery: 'Defined in BigQuery', runtime: 'Runtime catalog endpoints' };

  /** Node boxes and route paths. Upright, so two diagrams fit side by side. */
  const LAYOUT = {
    w: 320, h: 380,
    bq: { x: 4, y: 6, w: 142, h: 60 }, other: { x: 174, y: 6, w: 142, h: 60 },
    cat: { x: 20, y: 150, w: 264, h: 74 }, sto: { x: 20, y: 300, w: 264, h: 74 },
    caps: [['Catalog', 20, 141], ['Storage', 20, 291]],
    route: {
      bq: 'M66,66 C66,115 154,105 154,150 L154,300',
      other: 'M245,66 C245,115 166,105 166,150 L166,300',
      via: 'M174,36 L86,36 L86,66 C86,115 166,105 166,150 L166,300',
      outside: 'M268,66 C318,140 318,270 284,337',
      stubBq: 'M66,66 C66,115 154,105 154,150',
      stubOther: 'M245,66 C245,115 166,105 166,150',
    },
  };

  const typeIds = TYPES.map((/** @type {TableType} */ t) => t.id);
  const needIds = NEEDS.map((/** @type {{ id: NeedId }} */ n) => n.id);
  /** @type {import('./logic.js').ViewState} */
  const state = LOGIC.decodeState(location.search.slice(1), { typeIds, needIds, fallbackType: 'standard' });

  const calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** True after the reader opens a table type by hand. Cleared when the needs change. */
  let pinned = false;
  /** Nothing fits and the reader has not opened a type by hand: show the no-match view, not a wrong answer. */
  const noMatch = () => state.needs.length > 0 && !pinned && !LOGIC.summarize(TYPES, state.needs).best;
  /** @param {NeedId} id */
  const needChip = (id) => NEEDS.find((/** @type {{ id: NeedId }} */ n) => n.id === id)?.chip ?? id;

  /** @returns {TableType} */
  const currentType = () => TYPES.find((/** @type {TableType} */ t) => t.id === state.type) ?? TYPES[0];
  /** @param {NeedId | null} id */
  const needLabel = (id) => NEEDS.find((/** @type {{ id: NeedId }} */ n) => n.id === id)?.label ?? 'In general';

  /* ---------- Needs ---------- */

  function buildNeeds() {
    el('needs').innerHTML = NEED_GROUPS.map((/** @type {{ id: string, label: string }} */ g) => `
      <div class="need-group"><p class="need-group-label">${esc(g.label)}</p><div class="chips">${NEEDS
        .filter((/** @type {{ group: string }} */ n) => n.group === g.id)
        .map((/** @type {{ id: NeedId, chip: string, label: string, hint: string }} */ n) => `
          <button class="need" type="button" data-need="${n.id}" aria-pressed="false" title="${esc(`${n.label}. ${n.hint}`)}">
            ${icon('check')}<span>${esc(n.chip)}</span></button>`).join('')}</div></div>`).join('');
  }

  function paintNeeds() {
    el('needs').querySelectorAll('.need').forEach((btn) => {
      const id = /** @type {NeedId} */ (/** @type {HTMLElement} */ (btn).dataset.need);
      btn.setAttribute('aria-pressed', String(state.needs.includes(id)));
    });
    /** @type {HTMLButtonElement} */ (el('clear')).disabled = state.needs.length === 0;
  }

  /* ---------- Summary ---------- */

  /** @param {{ type: TableType }[]} rows */
  const pickList = (rows) => `<div class="picks">${rows
    .map((r) => `<button class="pick" type="button" data-pick="${r.type.id}">${esc(r.type.short)}</button>`).join('')}</div>`;

  function paintSummary() {
    const s = LOGIC.summarize(TYPES, state.needs);
    const tip = LOGIC.tipFor(TIPS, state.needs);
    let html = '';
    if (state.needs.length === 0) {
      html = '<p class="tip">Tick what matters. The best match opens by itself.</p>';
    } else if (s.fits.length === 1) {
      html = `<p class="summary-count is-fit">${icon('check')}Best match</p>${pickList(s.fits)}`;
    } else if (s.fits.length > 1) {
      html = `<p class="summary-count is-fit">${icon('check')}${s.fits.length} fit</p>${pickList(s.fits)}`
        + (tip ? '' : '<p class="tip">Pick who writes or add a rule to narrow this down.</p>');
    } else if (s.caveats.length > 0) {
      html = `<p class="summary-count is-caveat">${icon('caveat')}Closest, with a catch</p>${pickList(s.caveats)}`;
    } else {
      html = `<p class="summary-count is-out">${icon('cross')}No single match</p>
        <p class="tip">These needs pull against each other. The detail view shows what to drop.</p>`;
    }
    el('summary').innerHTML = html + (tip && s.best ? `<p class="tip">${esc(tip)}</p>` : '');
  }

  /* ---------- Table type list ---------- */

  function buildRail() {
    let html = '';
    for (const group of /** @type {('bigquery'|'runtime')[]} */ (['bigquery', 'runtime'])) {
      html += `<p class="rail-group g-${group}">${GROUPS[group]}</p>`;
      for (const t of TYPES.filter((/** @type {TableType} */ x) => x.group === group)) {
        html += `<button class="rail-row" type="button" role="tab" id="tab-${t.id}" data-type="${t.id}" aria-controls="panel">
          <span class="rail-mark" aria-hidden="true"></span><span class="rail-name">${esc(t.short.replace(/ table$/, ''))}</span>
          <span class="rail-badge"></span></button>`;
      }
    }
    el('rail').innerHTML = html;
  }

  /** One sentence that says how a type did, for tooltips and screen readers. @param {Verdict} v */
  const verdictText = (v) => v.level === 'fit' ? 'Fits everything you picked'
    : v.level === 'caveat' ? `Fits, with a catch. ${v.caveats.map((r) => r.why).join(' ')}`
      : v.level === 'out' ? `Does not fit. ${v.misses.map((r) => r.why).join(' ')}` : '';

  function paintRail() {
    const bestId = LOGIC.summarize(TYPES, state.needs).clearWinner?.type.id;
    const empty = noMatch();
    for (const t of /** @type {TableType[]} */ (TYPES)) {
      const row = el(`tab-${t.id}`);
      const v = /** @type {Verdict} */ (LOGIC.verdictFor(t, state.needs));
      const selected = t.id === state.type && !empty;
      row.className = `rail-row g-${t.group} v-${v.level}${t.id === bestId ? ' is-best' : ''}`;
      /** @type {HTMLElement} */ (row.querySelector('.rail-badge')).textContent = t.id === bestId ? 'Best match' : t.badge ?? '';
      row.setAttribute('aria-selected', String(selected));
      row.tabIndex = selected || (empty && t.id === typeIds[0]) ? 0 : -1;
      row.title = verdictText(v);
      row.setAttribute('aria-label', v.level === 'idle' ? t.short : `${t.short}. ${verdictText(v)}`);
      /** @type {HTMLElement} */ (row.querySelector('.rail-mark')).innerHTML =
        v.level === 'fit' ? icon('check') : v.level === 'caveat' ? icon('caveat') : v.level === 'out' ? icon('cross') : '';
    }
    el('panel').setAttribute('aria-labelledby', `tab-${state.type}`);
  }

  /* ---------- Panel ---------- */

  /** Shown in place of a table type when the selected needs cannot all be met. */
  function buildNoMatch() {
    const s = LOGIC.summarize(TYPES, state.needs);
    const tip = LOGIC.tipFor(TIPS, state.needs);
    const options = /** @type {{ need: NeedId, matches: TableType[] }[]} */ (LOGIC.dropOptions(TYPES, state.needs));
    /** @param {TableType[]} types */
    const links = (types) => types.map((t) => `<button class="pick" type="button" data-pick="${t.id}">${esc(t.short)}</button>`).join('');
    const rows = options.map((o) => `<li class="drop">
        <button class="drop-btn" type="button" data-drop="${o.need}">${icon('cross')}<span>${esc(needChip(o.need))}</span></button>
        <span class="drop-then">then this fits</span><span class="picks">${links(o.matches)}</span></li>`).join('');
    const near = s.closest ? `<p class="near">Nearest single type: ${links([s.closest.type])}
        <span>It misses: ${esc(s.closest.verdict.misses.map((/** @type {{ need: NeedId }} */ m) => needChip(m.need)).join(', '))}.</span></p>` : '';
    el('panel').className = 'col panel owner-none';
    el('panel').innerHTML = `<div class="panel-in nomatch">
      <p class="eyebrow">No single match</p>
      <h1 class="type-name">No one table type does all of this</h1>
      <p class="type-summary">${esc(tip ?? 'Some of these needs pull against each other. Drop one, or keep the data in two table types.')}</p>
      ${rows ? `<h3>Drop one need</h3><ul class="drops">${rows}</ul>`
        : '<p class="near">Dropping any one need is not enough here. Remove a few and build back up.</p>'}
      ${near}
    </div>`;
  }

  function buildPanel() {
    if (noMatch()) { buildNoMatch(); return; }
    const t = currentType();
    /** @param {string} label @param {import('./data.js').Rule} rule */
    const sec = (label, rule) => `<li class="${rule.ok ? 'is-on' : ''}">${icon(rule.ok ? 'check' : 'cross')}${label}</li>`;
    el('panel').className = `col panel owner-${t.catalog.owner}`;
    el('panel').innerHTML = `<div class="panel-in">
      <div class="p-head">
        <div>
          <p class="eyebrow">${GROUPS[t.group]}${t.tag ? ` · ${esc(t.tag)}` : ''}</p>
          <h1 class="type-name">${esc(t.name)}</h1>
          <p class="type-summary">${esc(t.summary)}</p>
        </div>
        <div class="seg" id="seg" role="group" aria-label="Show writing or reading" data-mode="${state.mode}">
          <span class="seg-thumb" aria-hidden="true"></span>
          <button type="button" data-mode="write">Writing</button>
          <button type="button" data-mode="read">Reading</button>
        </div>
      </div>
      <div id="verdict"></div>
      <div class="stages" id="stages" data-mode="${state.mode}">
        <section class="half" data-half="write"><h3>Writing</h3><div class="stage" id="stage-write"></div></section>
        <section class="half" data-half="read"><h3>Reading</h3><div class="stage" id="stage-read"></div></section>
      </div>
      <div class="p-foot">
        <ul class="sec-inline" aria-label="Security rules">
          ${sec('Row filters', t.security.row)}${sec('Column security', t.security.column)}
          ${sec('Masking', t.security.masking)}${sec('Policy tags', t.security.tags)}
        </ul>
        <button class="more-btn" id="more" type="button">More details ${icon('arrow')}</button>
      </div>
    </div>`;
    paintVerdict();
    paintFlow();
  }

  function paintVerdict() {
    const box = document.getElementById('verdict');
    if (!box) return;
    const v = /** @type {Verdict} */ (LOGIC.verdictFor(currentType(), state.needs));
    if (v.level === 'idle') { box.innerHTML = ''; return; }
    const reasons = v.level === 'out' ? v.misses : v.level === 'caveat' ? v.caveats : v.notes;
    const head = v.level === 'fit' ? 'Fits everything you picked' : v.level === 'caveat' ? 'Fits, with a catch' : 'Does not fit';
    const mark = v.level === 'fit' ? 'check' : v.level === 'caveat' ? 'caveat' : 'cross';
    const why = reasons.map((r) => r.why).join(' ');
    box.innerHTML = `<p class="verdict v-${v.level}" title="${esc(why)}">${icon(mark)}<strong>${head}</strong><span>${esc(why)}</span></p>`;
  }

  /** @param {string} label @param {import('./data.js').Rule} rule */
  const secItem = (label, rule) => `
    <li class="sec-item${rule.ok ? ' is-on' : ''}">
      <span class="sec-label">${label}</span>
      <span class="sec-state">${icon(rule.ok ? 'check' : 'cross')}${rule.ok ? 'Yes' : 'No'}</span>
      ${rule.note ? `<span class="sec-detail">${esc(rule.note)}</span>` : ''}
    </li>`;

  function openMore() {
    const t = currentType();
    const v = /** @type {Verdict} */ (LOGIC.verdictFor(t, state.needs));
    const reasons = [...v.misses, ...v.caveats, ...v.notes];
    const other = t.otherEngine.replace(/ · /g, ', ');
    /** @param {string} name @param {Route} r */
    const engineLine = (name, r) => `<li><strong>${esc(name)}: ${KIND[r.kind].word}.</strong> ${esc(r.note)}</li>`;
    const dialog = /** @type {HTMLDialogElement} */ (el('more-dialog'));
    dialog.innerHTML = `
      <div class="sheet-head">
        <h2 id="more-title">${esc(t.name)}</h2>
        <button class="icon-btn" type="button" data-close aria-label="Close">${icon('cross')}</button>
      </div>
      ${reasons.length ? `<h3>Against what you picked</h3>
        <ul class="know-list">${reasons.map((r) => `<li><strong>${esc(needLabel(r.need))}.</strong> ${esc(r.why)}</li>`).join('')}</ul>` : ''}
      <h3>Writing</h3>
      <ul class="know-list">${engineLine('BigQuery', t.write.bq)}${engineLine(other, t.write.other)}</ul>
      <h3>Reading</h3>
      <ul class="know-list">${engineLine('BigQuery', t.read.bq)}${engineLine(other, t.read.other)}</ul>
      <h3>Security rules</h3>
      <ul class="sec-grid">
        ${secItem('Row-level security', t.security.row)}${secItem('Column-level security', t.security.column)}
        ${secItem('Data masking', t.security.masking)}${secItem('Policy tags', t.security.tags)}
      </ul>
      <p class="sheet-note">${esc(t.security.note)}</p>
      <h3>Good to know</h3>
      <ul class="know-list">${t.know.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <h3>Best for</h3>
      <p class="best">${esc(t.bestFor)}</p>
      <a class="doc" href="${t.doc}" target="_blank" rel="noopener">Read the Google Cloud docs ${icon('outside')}</a>`;
    dialog.showModal();
  }

  /* ---------- Stage ---------- */

  /**
   * A box on the stage. Wide boxes get a small picture on the left.
   * @param {Box} b @param {string} cls @param {string} title @param {string} sub
   * @param {boolean} small @param {keyof typeof PATHS} glyph @param {string} [hint]
   */
  const node = (b, cls, title, sub, small, glyph, hint) => {
    const tx = b.x + (small ? 10 : 50);
    const tile = small ? '' : `<g class="tile"><rect x="${b.x + 11}" y="${b.y + b.h / 2 - 14}" width="28" height="28" rx="8"/>
      <path transform="translate(${b.x + 17},${b.y + b.h / 2 - 8})" d="${PATHS[glyph]}"/></g>`;
    return `<g class="node ${cls}">${hint ? `<title>${esc(hint)}</title>` : ''}
      <rect class="box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="14"/>${tile}
      <text class="node-title" x="${tx}" y="${b.y + b.h / 2 - 4}"${small ? ' style="font-size:12px"' : ''}>${esc(title)}</text>
      <text class="node-sub" x="${tx}" y="${b.y + b.h / 2 + 14}"${small ? ' style="font-size:11px"' : ''}>${esc(sub)}</text>
    </g>`;
  };

  /** @param {Box} b @param {RouteKind} kind */
  const badge = (b, kind) => {
    const cx = b.x + b.w - 8;
    const cy = b.y + 8;
    return `<g class="badge k-${kind}"><circle cx="${cx}" cy="${cy}" r="11"/>
      <path transform="translate(${cx - 6.4},${cy - 6.4}) scale(.8)" d="${PATHS[KIND[kind].icon]}"/></g>`;
  };

  /** @param {string} d @param {RouteKind} kind @param {Mode} mode */
  const dots = (d, kind, mode) => {
    if (kind === 'none' || calmQuery.matches) return '';
    const dur = KIND[kind].speed;
    const back = mode === 'read' ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : '';
    return [0, 1, 2].map((i) => `<g class="dot dot-${kind}"><circle class="halo" r="9"/><circle r="4"/>
      <animateMotion dur="${dur}s" begin="${(-i * dur / 3).toFixed(2)}s" repeatCount="indefinite" path="${d}"${back}/></g>`).join('');
  };

  /** Draws one diagram: how the two engines write, or how they read. @param {Mode} mode */
  function paintStage(mode) {
    const host = document.getElementById(`stage-${mode}`);
    if (!host) return;
    const t = currentType();
    const L = LAYOUT;
    const bq = /** @type {Route} */ (t[mode].bq);
    const other = /** @type {Route} */ (t[mode].other);

    const bqPath = bq.kind === 'none' ? L.route.stubBq : L.route.bq;
    const otherPath = other.kind === 'none' ? L.route.stubOther
      : other.kind === 'via' ? L.route.via
        : other.kind === 'outside' ? L.route.outside : L.route.other;

    const verb = mode === 'write' ? 'Writing' : 'Reading';
    const label = `${verb}. BigQuery: ${KIND[bq.kind].word}. ${t.otherEngine}: ${KIND[other.kind].word}. `
      + `Catalog: ${t.catalog.title}. Storage: ${t.storage.title}.`;

    host.innerHTML = `<svg viewBox="0 0 ${L.w} ${L.h}" role="img" aria-label="${esc(label)}">
      ${L.caps.map(([text, x, y]) => `<text class="cap" x="${x}" y="${y}">${text}</text>`).join('')}
      <path class="track track-${bq.kind}" d="${bqPath}"/><path class="track track-${other.kind}" d="${otherPath}"/>
      <path class="route route-${bq.kind}" data-stop="${bq.kind === 'none'}" d="${bqPath}"/>
      <path class="route route-${other.kind}" data-stop="${other.kind === 'none'}" d="${otherPath}"/>
      ${dots(bqPath, bq.kind, mode)}${dots(otherPath, other.kind, mode)}
      ${node(L.cat, `owner-${t.catalog.owner}`, t.catalog.title, t.catalog.sub, false, 'catalog')}
      ${node(L.sto, `where-${t.storage.where}`, t.storage.title, t.storage.sub, false, 'storage')}
      ${node(L.bq, `engine k-${bq.kind}`, 'BigQuery', bq.label ?? KIND[bq.kind].stage[mode], true, 'query', bq.note)}
      ${node(L.other, `engine k-${other.kind}`, t.otherEngine, other.label ?? KIND[other.kind].stage[mode], true, 'engine', other.note)}
      ${badge(L.bq, bq.kind)}${badge(L.other, other.kind)}
    </svg>`;

    // A stop sign in the middle of each route that goes nowhere.
    host.querySelectorAll('path[data-stop="true"]').forEach((p) => {
      const path = /** @type {SVGPathElement} */ (p);
      const mid = path.getPointAtLength(path.getTotalLength() * 0.55);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'stop');
      g.setAttribute('transform', `translate(${mid.x.toFixed(1)},${mid.y.toFixed(1)})`);
      g.innerHTML = '<circle r="10"/><path d="M-3.5,-3.5L3.5,3.5M3.5,-3.5L-3.5,3.5"/>';
      path.after(g);
    });
  }

  /** Both diagrams at once. On a phone only one shows, picked with the switch. */
  function paintFlow() {
    paintStage('write');
    paintStage('read');
    paintMode();
  }

  function paintMode() {
    const stages = document.getElementById('stages');
    const seg = document.getElementById('seg');
    if (!stages || !seg) return;
    stages.dataset.mode = state.mode;
    seg.dataset.mode = state.mode;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  }

  /* ---------- State changes ---------- */

  function syncUrl() {
    // A link to a no-match view carries no table type, so it opens the same way for the next reader.
    const params = new URLSearchParams(LOGIC.encodeState(state));
    if (noMatch()) params.delete('t');
    history.replaceState(null, '', `${location.pathname}?${params}`);
  }

  /** Phone only: which of the three views is on screen. @param {string} view */
  function showView(view) {
    el('app').dataset.view = view;
    document.querySelectorAll('.views button').forEach((b) => {
      b.setAttribute('aria-current', String(/** @type {HTMLElement} */ (b).dataset.view === view));
    });
  }

  /** @param {string} id @param {boolean} reveal */
  function selectType(id, reveal) {
    if (!typeIds.includes(id)) return;
    const changed = id !== state.type || noMatch();
    pinned = true;
    state.type = id;
    paintRail();
    if (changed) buildPanel();
    syncUrl();
    if (reveal) showView('flow');
  }

  /** @param {NeedId[]} needs */
  function setNeeds(needs) {
    // Capture before mutating state.needs, or leaving a no-match view for the same table skips buildPanel().
    const wasEmpty = noMatch();
    state.needs = needIds.filter((/** @type {NeedId} */ id) => needs.includes(id));
    // Follow the needs: open the best match. When nothing fits, say so and do not show a wrong answer.
    pinned = false;
    const pick = LOGIC.summarize(TYPES, state.needs).pick;
    const moved = Boolean(pick) && pick.type.id !== state.type;
    if (moved) state.type = pick.type.id;
    paintNeeds();
    paintSummary();
    paintRail();
    if (moved || wasEmpty || noMatch()) buildPanel(); else paintVerdict();
    syncUrl();
  }

  /** @param {Mode} mode */
  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    paintMode();
    syncUrl();
  }

  function paintTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    el('theme').innerHTML = icon(dark ? 'sun' : 'moon');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D1015' : '#F6F7F9');
  }

  /* ---------- Events ---------- */

  /** @param {Event} e @param {string} selector */
  const hit = (e, selector) => /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest(selector));

  el('needs').addEventListener('click', (e) => {
    const btn = hit(e, '.need');
    if (!btn) return;
    const id = /** @type {NeedId} */ (btn.dataset.need);
    setNeeds(state.needs.includes(id) ? state.needs.filter((n) => n !== id) : [...state.needs, id]);
  });

  el('clear').addEventListener('click', () => setNeeds([]));

  el('share').addEventListener('click', async () => {
    const btn = el('share');
    try {
      await navigator.clipboard.writeText(location.href);
      btn.textContent = 'Link copied';
    } catch {
      btn.textContent = 'Copy from the address bar';
    }
    setTimeout(() => { btn.textContent = 'Copy link'; }, 1800);
  });

  el('summary').addEventListener('click', (e) => {
    const btn = hit(e, '[data-pick]');
    if (btn?.dataset.pick) selectType(btn.dataset.pick, true);
  });

  el('rail').addEventListener('click', (e) => {
    const btn = hit(e, '[data-type]');
    if (btn?.dataset.type) selectType(btn.dataset.type, true);
  });

  el('rail').addEventListener('keydown', (e) => {
    const i = typeIds.indexOf(state.type);
    const next = e.key === 'ArrowDown' ? (i + 1) % typeIds.length
      : e.key === 'ArrowUp' ? (i - 1 + typeIds.length) % typeIds.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? typeIds.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    selectType(typeIds[next], false);
    el(`tab-${typeIds[next]}`).focus();
  });

  el('panel').addEventListener('click', (e) => {
    const mode = hit(e, '#seg button')?.dataset.mode;
    const drop = hit(e, '[data-drop]')?.dataset.drop;
    const pick = hit(e, '[data-pick]')?.dataset.pick;
    if (mode) setMode(/** @type {Mode} */ (mode));
    else if (hit(e, '#more')) openMore();
    else if (drop) setNeeds(state.needs.filter((n) => n !== drop));
    else if (pick) selectType(pick, true);
  });

  document.querySelector('.views')?.addEventListener('click', (e) => {
    const view = hit(e, 'button')?.dataset.view;
    if (view) showView(view);
  });

  el('about').addEventListener('click', () => /** @type {HTMLDialogElement} */ (el('about-dialog')).showModal());

  // Close a dialog from its close button or by clicking the dimmed area around it.
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || hit(e, '[data-close]')) dialog.close();
    });
  });

  el('theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* private mode: keep it for this visit only */ }
    paintTheme();
  });

  calmQuery.addEventListener('change', paintFlow);

  /* ---------- Start ---------- */

  el('sources-note').textContent = `Every statement here was checked against the public Google Cloud documentation on ${CHECKED_ON}. `
    + 'Features marked Preview can change. For a real design, read the linked pages.';
  el('sources-list').innerHTML = SOURCES.map((/** @type {{ label: string, url: string }} */ s) =>
    `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
  /** @type {HTMLElement} */ (document.querySelector('#about-dialog [data-close]')).innerHTML = icon('cross');

  // A link that names a table type opens that type. Otherwise the needs decide.
  const opened = new URLSearchParams(location.search).has('t');
  pinned = opened;
  const first = LOGIC.summarize(TYPES, state.needs).pick;
  if (!opened && first) state.type = first.type.id;

  buildNeeds();
  buildRail();
  paintNeeds();
  paintSummary();
  paintRail();
  buildPanel();
  paintTheme();
  showView(state.needs.length > 0 || opened ? 'flow' : 'needs');
})();
