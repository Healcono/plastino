/* =====================================================================
   PlastiWise | app.js
   وابسته به data.js. بدون هیچ کتابخانهٔ بیرونی.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     ابزارهای کوچک
     --------------------------------------------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const icon = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  /* ---------------------------------------------------------------
     ذخیره‌سازی امن (اگر مرورگر اجازه ندهد، فقط در حافظه می‌ماند)
     --------------------------------------------------------------- */
  const KEY = 'plastiwise.v1';
  let memoryStore = null;
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
    return memoryStore;
  }
  function save() {
    memoryStore = JSON.parse(JSON.stringify(state));
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  const PLOT_COUNT = 8;
  const PLOT_SPECIES = ['round', 'cypress', 'twin', 'round', 'cypress', 'round', 'twin', 'cypress'];
  function freshState() {
    return {
      assess: { answers: {}, result: null, rewarded: false },
      done: {},            // itemId -> true
      tips: {},            // tipId -> true
      seeds: 1, drops: 1, stars: 0,   // هدیهٔ شروع
      plots: new Array(PLOT_COUNT).fill(0),
      correct: {},         // questionId -> true (برای بذر)
      best: 0, kave: false, rounds: 0,
      badges: {}
    };
  }
  let state = Object.assign(freshState(), load() || {});
  state.assess = Object.assign({ answers: {}, result: null, rewarded: false }, state.assess || {});
  if (!Array.isArray(state.plots) || state.plots.length !== PLOT_COUNT) state.plots = new Array(PLOT_COUNT).fill(0);

  /* ---------------------------------------------------------------
     توست
     --------------------------------------------------------------- */
  function toast(msg, opts = {}) {
    const region = $('#toastRegion');
    const t = document.createElement('div');
    t.className = 'toast' + (opts.long ? ' long' : '');
    t.innerHTML = (opts.icon ? icon(opts.icon) : '') + `<span></span>`;
    t.lastChild.textContent = msg;
    region.appendChild(t);
    setTimeout(() => t.remove(), opts.long ? 6500 : 3200);
  }

  /* ---------------------------------------------------------------
     فهرست یکپارچهٔ محتوا
     --------------------------------------------------------------- */
  const TYPE_META = {
    info: { label: 'اینفوگرافیک', ic: 'image', cls: 't-info' },
    pod:  { label: 'پادکست',      ic: 'headphones', cls: 't-pod' },
    vid:  { label: 'ویدیو',        ic: 'play', cls: 't-vid' },
    art:  { label: 'متن',          ic: 'doc', cls: 't-art' }
  };
  const TOPIC_LABELS = Object.assign(
    Object.fromEntries(Object.entries(DIMENSIONS).map(([k, v]) => [k, v.label])),
    { basics: 'مبانی میکروپلاستیک', health: 'سلامت و شواهد', myths: 'باورهای رایج', actions: 'اقدام عملی' }
  );
  const ITEMS = [
    ...INFOGRAPHICS.map((x) => ({ ...x, type: 'info' })),
    ...PODCASTS.map((x) => ({ ...x, type: 'pod' })),
    ...VIDEOS.map((x) => ({ ...x, type: 'vid' })),
    ...ARTICLES.map((x) => ({ ...x, type: 'art' }))
  ];
  const itemById = (id) => ITEMS.find((i) => i.id === id);
  const dispTitle = (it) => (it.type === 'pod' ? 'پادکست پلاستی‌وایز، ' + it.title : it.title);
  const upload = (file, thumb) => encodeURI(UPLOAD_BASE + (thumb ? 'thumbs/' : '') + file);

  /* ---------------------------------------------------------------
     نشان‌ها، سطح، شمارنده‌ها
     --------------------------------------------------------------- */
  const treeCount = () => state.plots.filter((p) => p === 4).length;
  const BADGES = [
    { id: 'self',    n: 'خودشناس',      d: 'ارزیابی سبک زندگی را کامل کردید.', ic: 'check', test: () => !!state.assess.result },
    { id: 'seed',    n: 'اولین بذر',    d: 'یک پاسخ درست در آزمونک دادید.', ic: 'seed', test: () => Object.keys(state.correct).length >= 1 },
    { id: 'planter', n: 'باغبان نو',    d: 'اولین بذر را کاشتید.', ic: 'seed', test: () => state.plots.some((p) => p > 0) },
    { id: 'tree1',   n: 'اولین درخت',   d: 'یک درخت کامل شد.', ic: 'tree', test: () => treeCount() >= 1 },
    { id: 'multi',   n: 'چندرسانه‌ای',  d: 'از سه قالب مختلف محتوا استفاده کردید.', ic: 'headphones',
      test: () => new Set(Object.keys(state.done).filter((k) => state.done[k]).map((k) => (itemById(k) || {}).type)).size >= 3 },
    { id: 'star3',   n: 'دور سه‌ستاره', d: 'یک دور آزمونک را بدون خطا تمام کردید.', ic: 'star', test: () => state.best >= 3 },
    { id: 'kave',    n: 'همراه کاوه',   d: 'ماجرای کاوه را تا پایان رفتید.', ic: 'doc', test: () => !!state.kave },
    { id: 'forest',  n: 'جنگل‌بان',     d: 'شش درخت کامل دارید.', ic: 'tree', test: () => treeCount() >= 6 }
  ];
  function levelTitle() {
    const t = treeCount();
    if (t >= 8) return 'نگهبان جنگل';
    if (t >= 6) return 'جنگل‌بان';
    if (t >= 3) return 'باغبان';
    if (t >= 1) return 'نهال‌کار';
    return 'بذرکار';
  }
  function checkBadges() {
    BADGES.forEach((b) => {
      if (!state.badges[b.id] && b.test()) {
        state.badges[b.id] = true;
        toast(`نشان تازه: ${b.n}`, { icon: 'star' });
      }
    });
  }

  /* ---------------------------------------------------------------
     به‌روزرسانی شمارنده‌های هدر
     --------------------------------------------------------------- */
  let lastChip = { seeds: state.seeds, drops: state.drops, stars: state.stars };
  function updateChips() {
    const map = { seeds: '#chipSeeds', drops: '#chipDrops', stars: '#chipStars' };
    Object.keys(map).forEach((k) => {
      const el = $(map[k]);
      el.textContent = fa(state[k]);
      if (state[k] !== lastChip[k]) {
        const p = el.parentElement; p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump');
      }
    });
    lastChip = { seeds: state.seeds, drops: state.drops, stars: state.stars };
  }

  function commit() {
    checkBadges();
    save();
    updateChips();
    renderGarden();
    renderBadges();
    renderQuizIdleStats();
  }
  function addDrops(n, why) {
    state.drops += n;
    if (why) toast(`${fa(n)} قطرهٔ آب گرفتید: ${why}`, { icon: 'drop' });
  }

  /* ---------------------------------------------------------------
     پنجره (مودال)
     --------------------------------------------------------------- */
  const modal = $('#modal');
  const modalBox = $('.modal-box', modal);
  const modalBody = $('#modalBody');
  let lastFocus = null;
  function openModal(html, wide) {
    lastFocus = document.activeElement;
    modalBody.innerHTML = html;
    modalBox.classList.toggle('wide', !!wide);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalBox.scrollTop = 0;
    modalBox.focus();
  }
  function closeModal() {
    modal.hidden = true;
    modalBody.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------------------------------------------------------------
     ۱) ارزیابی
     --------------------------------------------------------------- */
  const assessCard = $('#assessCard');
  let wiz = null; // { i, answers }

  function renderAssess() {
    if (wiz) return renderQuestion();
    if (state.assess.result) return renderAssessDone();
    assessCard.innerHTML = `
      <div class="assess-intro">
        <div>
          <h3>آماده‌اید خودتان را بسنجید؟</h3>
          <ul class="check-list">
            <li>۱۳ پرسش کوتاه، حدود ۴ دقیقه</li>
            <li>نتیجه: نقاط پرمواجهه و نقاط قوت شما</li>
            <li>برنامهٔ شخصی: چه بشنوید، ببینید و بخوانید</li>
            <li>اطلاعات شما فقط در مرورگر خودتان می‌ماند</li>
          </ul>
          <button class="btn btn-primary btn-lg" id="startAssess" type="button">شروع</button>
        </div>
        <div class="assess-art" aria-hidden="true"><img src="logo-plastiwise.png" alt="" width="200" height="200"></div>
      </div>`;
    $('#startAssess').addEventListener('click', startAssess);
  }

  function startAssess() {
    wiz = { i: 0, answers: {} };
    renderQuestion();
    assessCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderQuestion() {
    const q = ASSESS[wiz.i];
    const total = ASSESS.length;
    const sel = wiz.answers[q.id];
    const multi = q.type === 'multi';
    const optional = q.dim === null;
    const dimTag = q.dim ? DIMENSIONS[q.dim].label : 'دربارهٔ شما';
    const answered = multi ? Array.isArray(sel) && sel.length > 0 : sel !== undefined;
    assessCard.innerHTML = `
      <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${wiz.i + 1}">
        <div class="progress-track"><div class="progress-fill" style="width:${((wiz.i + 1) / total) * 100}%"></div></div>
        <span class="progress-label">سؤال ${fa(wiz.i + 1)} از ${fa(total)}</span>
      </div>
      <span class="dim-tag">${dimTag}</span>
      <h3 class="q-title" id="qTitle">${q.title}</h3>
      <p class="q-hint">${q.hint || ''}</p>
      <div class="options" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="qTitle">
        ${q.options.map((o, idx) => {
          const on = multi ? (sel || []).includes(o.k) : sel === idx;
          return `<button type="button" class="option ${multi ? 'multi' : ''} ${on ? 'sel' : ''}" data-idx="${idx}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${on}"><span class="mark"></span><span>${o.t}</span></button>`;
        }).join('')}
      </div>
      <div class="q-nav">
        <button class="btn-text" type="button" id="qPrev" ${wiz.i === 0 ? 'disabled' : ''}>قبلی</button>
        <button class="btn btn-primary" type="button" id="qNext" ${(answered || optional) ? '' : 'disabled'}>${wiz.i === total - 1 ? 'مشاهدهٔ نتیجه' : 'بعدی'}</button>
      </div>`;

    $$('.option', assessCard).forEach((b) => b.addEventListener('click', () => {
      const idx = Number(b.dataset.idx);
      if (multi) {
        const opt = q.options[idx];
        let arr = Array.isArray(wiz.answers[q.id]) ? wiz.answers[q.id].slice() : [];
        if (arr.includes(opt.k)) arr = arr.filter((k) => k !== opt.k);
        else {
          if (opt.exclusive) arr = [opt.k];
          else arr = arr.filter((k) => k !== 'none').concat(opt.k);
        }
        wiz.answers[q.id] = arr;
      } else {
        wiz.answers[q.id] = idx;
      }
      renderQuestion();
      const first = $('.option.sel', assessCard); if (first) first.focus({ preventScroll: true });
    }));
    $('#qPrev').addEventListener('click', () => { wiz.i--; renderQuestion(); });
    $('#qNext').addEventListener('click', () => {
      if (wiz.i < total - 1) { wiz.i++; renderQuestion(); }
      else finishAssess();
    });
  }

  function computeResult(ans) {
    const sums = {}, counts = {};
    ASSESS.forEach((q) => {
      if (!q.dim) return;
      const idx = ans[q.id];
      if (idx === undefined) return;
      sums[q.dim] = (sums[q.dim] || 0) + q.options[idx].s;
      counts[q.dim] = (counts[q.dim] || 0) + 1;
    });
    const dims = {};
    Object.keys(DIMENSIONS).forEach((d) => {
      dims[d] = counts[d] ? Math.round((sums[d] / (counts[d] * 3)) * 100) : 0;
    });
    let wsum = 0, wtot = 0;
    Object.keys(dims).forEach((d) => { wsum += dims[d] * DIM_WEIGHTS[d]; wtot += DIM_WEIGHTS[d]; });
    const overall = Math.round(wsum / wtot);
    const level = overall < 34 ? 'low' : overall < 62 ? 'mid' : 'high';
    const profile = Array.isArray(ans.q_profile) ? ans.q_profile.filter((k) => k !== 'none') : [];
    const kq = ASSESS.find((q) => q.id === 'q_know');
    const know = ans.q_know !== undefined ? kq.options[ans.q_know].k : 'new';
    return { dims, overall, level, profile, know, date: Date.now() };
  }

  function finishAssess() {
    const res = computeResult(wiz.answers);
    state.assess.answers = wiz.answers;
    state.assess.result = res;
    wiz = null;
    if (!state.assess.rewarded) { state.assess.rewarded = true; addDrops(2, 'ارزیابی را کامل کردید'); }
    commit();
    renderAssess();
    renderPlan();
    renderLibrary();
    $('#plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function levelInfo(level) {
    return {
      low:  { t: 'کم',    c: 'lvl-low',  note: 'عادت‌های شما در بیشتر محورها مواجههٔ پایینی نشان می‌دهد. چند اقدام کوچک، آن را حتی کمتر می‌کند.' },
      mid:  { t: 'متوسط', c: 'lvl-mid',  note: 'در چند محور مواجههٔ قابل‌توجه دارید. تمرکز روی همان‌ها بیشترین اثر را می‌گذارد.' },
      high: { t: 'بالا',  c: 'lvl-high', note: 'چند عادت پرتکرار مواجههٔ شما را بالا برده است. از محور اول برنامه شروع کنید؛ لازم نیست همه‌چیز را یک‌شبه عوض کنید.' }
    }[level];
  }

  function renderAssessDone() {
    const r = state.assess.result; const li = levelInfo(r.level);
    assessCard.innerHTML = `
      <div style="text-align:center">
        <h3 class="q-title">ارزیابی شما ثبت شده است</h3>
        <p class="q-hint">شاخص مواجههٔ سبک زندگی: <b class="${li.c}" style="filter:brightness(.7)">${li.t}</b> (${fa(r.overall)} از ۱۰۰)</p>
        <div class="plan-cta" style="justify-content:center">
          <a class="btn btn-primary" href="#plan">مشاهدهٔ برنامهٔ من</a>
          <button class="btn btn-ghost" type="button" id="redoAssess">ارزیابی دوباره</button>
        </div>
      </div>`;
    $('#redoAssess').addEventListener('click', () => { state.assess.answers = {}; state.assess.result = null; save(); renderPlan(); renderLibrary(); startAssess(); });
  }

  /* ---------------------------------------------------------------
     ۲) برنامهٔ من
     --------------------------------------------------------------- */
  function buildRoadmap(r) {
    const used = new Set();
    const steps = [];
    const take = (ids) => ids.filter((id) => itemById(id) && !used.has(id) && (used.add(id), true));

    // پایه
    const base = r.know === 'new' ? ['info1', 'pod1', 'art3'] : r.know === 'some' ? ['info2', 'art3'] : ['art3'];
    steps.push({ title: 'پایه: بدانید با چه چیزی روبه‌رو هستید', why: r.know === 'good' ? 'برای مرور سریع شواهد.' : 'کوتاه و قدم اول مناسب.', items: take(base) });

    // محورهای اولویت
    const ranked = Object.entries(r.dims).sort((a, b) => b[1] - a[1]);
    let top = ranked.filter(([, v]) => v >= 34).slice(0, 3);
    if (!top.length && ranked[0][1] > 0) top = [ranked[0]];
    top.forEach(([d, v]) => {
      const pick = (type) => ITEMS.filter((i) => i.type === type && i.topics.includes(d) && !used.has(i.id)).sort((a, b) => a.topics.length - b.topics.length)[0];
      const ids = [pick('pod'), pick('vid'), pick('art')].filter(Boolean).map((i) => i.id);
      if (ids.length < 2) { const x = ITEMS.find((i) => i.type === 'info' && i.topics.includes(d) && !used.has(i.id) && i.id !== 'info2'); if (x) ids.push(x.id); }
      steps.push({ dim: d, title: `اولویت: ${DIMENSIONS[d].label}`, why: `امتیاز مواجههٔ این محور: ${fa(v)}٪`, items: take(ids) });
    });

    // اقدام
    steps.push({ title: 'اقدام و مرور', why: 'جمع‌بندی راهکارها و پاسخ به باورهای رایج.', items: take(['info4', 'info5']) });
    return { steps: steps.filter((s) => s.items.length), top };
  }

  function planItemIds() {
    if (!state.assess.result) return new Set();
    const set = new Set();
    buildRoadmap(state.assess.result).steps.forEach((s) => s.items.forEach((i) => set.add(i)));
    return set;
  }

  function tipsFor(r, topDims) {
    const out = [];
    const prof = new Set(r.profile);
    // اقدام‌های ویژهٔ شرایط فرد
    Object.keys(TIPS).forEach((d) => TIPS[d].forEach((t) => { if (t.only && prof.has(t.only)) out.push({ ...t, dim: d, special: true }); }));
    const order = { strong: 0, moderate: 1, precaution: 2 };
    topDims.forEach(([d]) => {
      TIPS[d].filter((t) => !t.only).sort((a, b) => order[a.lvl] - order[b.lvl]).slice(0, 3).forEach((t) => out.push({ ...t, dim: d }));
    });
    // اگر هیچ محور اولویتی نبود، چند اقدام کلی نشان بده
    if (!topDims.length) ['w1', 'k1', 't1'].forEach((id) => { Object.keys(TIPS).forEach((d) => TIPS[d].forEach((t) => { if (t.id === id) out.push({ ...t, dim: d }); })); });
    return out;
  }

  function renderPlan() {
    const root = $('#planRoot'); const lead = $('#planLead');
    const r = state.assess.result;
    if (!r) {
      lead.textContent = 'پس از ارزیابی، نتیجه و برنامهٔ شخصی شما اینجا نمایش داده می‌شود.';
      root.innerHTML = `<div class="empty-plan"><p>هنوز ارزیابی نکرده‌اید. با ۱۳ پرسش کوتاه، برنامهٔ شخصی خودتان را بگیرید.</p><a class="btn btn-primary" href="#assess">شروع ارزیابی</a></div>`;
      return;
    }
    lead.textContent = 'این برنامه بر پایهٔ پاسخ‌های شما ساخته شده و در هر زمان می‌توانید دوباره ارزیابی کنید.';
    const li = levelInfo(r.level);
    const C = 2 * Math.PI * 80;
    const color = r.level === 'low' ? '#7FD1AA' : r.level === 'mid' ? '#F5B840' : '#FF9C88';
    const ranked = Object.entries(r.dims).sort((a, b) => b[1] - a[1]);
    const strengths = ranked.filter(([, v]) => v <= 25).map(([d]) => DIMENSIONS[d].label);
    const road = buildRoadmap(r);
    const tips = tipsFor(r, road.top);

    root.innerHTML = `
      <div class="plan-top">
        <div class="gauge-card">
          <div class="gauge" role="img" aria-label="شاخص مواجهه ${fa(r.overall)} از صد، سطح ${li.t}">
            <svg viewBox="0 0 200 200"><circle class="g-bg" cx="100" cy="100" r="80"/><circle class="g-fg" id="gFg" cx="100" cy="100" r="80" stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
            <div class="gauge-num"><b>${fa(r.overall)}</b><span>از ۱۰۰</span></div>
          </div>
          <div class="gauge-level ${li.c}">مواجههٔ ${li.t}</div>
          <p class="gauge-note">${li.note}</p>
        </div>
        <div class="dims-card">
          <h3>امتیاز هر محور</h3>
          ${ranked.map(([d, v]) => `
            <div class="dim-row">
              <span class="dn">${DIMENSIONS[d].label}</span>
              <div class="dim-bar" aria-hidden="true"><i class="${v < 34 ? 'b-low' : v < 62 ? 'b-mid' : 'b-high'}" data-w="${v}"></i></div>
              <span class="dv">${fa(v)}٪</span>
            </div>`).join('')}
          ${strengths.length ? `<div class="strengths"><b>نقاط قوت شما:</b> ${strengths.join('، ')}. همین عادت‌ها را حفظ کنید.</div>` : ''}
          <p class="muted" style="font-size:.88rem;margin:12px 0 0">این شاخص عادت‌های شما را می‌سنجد، نه ذرات موجود در بدن‌تان را.</p>
        </div>
      </div>

      <div class="plan-block">
        <h3>مسیر پیشنهادی برای یادگیری</h3>
        <p class="sub">از بالا به پایین پیش بروید. هر مورد را که تمام کردید «انجام شد» را بزنید تا قطرهٔ آب بگیرید.</p>
        <div class="roadmap">
          ${road.steps.map((s, i) => `
            <div class="road-step">
              <div class="road-head"><span class="road-num">${fa(i + 1)}</span><div><h4>${s.title}</h4><p class="why">${s.why}</p></div></div>
              <div class="road-items">
                ${s.items.map((id) => { const it = itemById(id); const m = TYPE_META[it.type]; const dn = !!state.done[id];
                  return `<div class="road-item ${dn ? 'done' : ''}">
                    <span class="ri-icon ${m.cls}">${icon(m.ic)}</span>
                    <div class="ri-main"><b>${dispTitle(it)}</b><span>${it.type === 'pod' ? it.sub : m.label}${it.dur ? ' | ' + it.dur : ''}${it.mins ? ' | ' + fa(it.mins) + ' دقیقه' : ''}</span></div>
                    <button class="ri-open" type="button" data-open="${id}">${dn ? 'دوباره' : 'باز کن'}</button>
                  </div>`; }).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="plan-block">
        <h3>اقدام‌های پیشنهادی</h3>
        <p class="sub">هر هفته فقط یکی را انتخاب کنید. روی «می‌کنم» بزنید تا ثبت شود و قطرهٔ آب بگیرید.</p>
        <div class="tips-list">
          ${tips.map((t) => { const on = !!state.tips[t.id]; const ev = EVIDENCE[t.lvl];
            return `<div class="tip ${on ? 'done' : ''}">
              <div class="tip-row">
                <button class="tick" type="button" aria-pressed="${on}" aria-label="این اقدام را انجام می‌دهم" data-tip="${t.id}">${icon('check')}</button>
                <div class="tip-text">
                  <p>${t.t}</p>
                  <div class="tip-meta"><span class="ev-tag ev-${t.lvl}" title="${ev.desc}">${ev.label}</span><span class="tip-dim">${t.special ? 'متناسب با شرایط شما' : DIMENSIONS[t.dim].label}</span></div>
                  <details class="tip-why"><summary>چرا؟</summary><p>${t.why}</p></details>
                </div>
              </div>
            </div>`; }).join('')}
        </div>
      </div>

      <div class="plan-block">
        <div class="noneed">
          <h4>چیزهایی که لازم نیست نگرانشان باشید</h4>
          <ul>${NO_NEED.map((n) => `<li>${n}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="plan-cta">
        <a class="btn btn-sun btn-lg" href="#garden">آزمونک را شروع کنم</a>
        <a class="btn btn-ghost" href="#library">همهٔ کتابخانه</a>
      </div>`;

    // انیمیشن نمودارها
    requestAnimationFrame(() => {
      const fg = $('#gFg'); if (fg) fg.style.strokeDashoffset = String(C * (1 - r.overall / 100));
      $$('.dim-bar i', root).forEach((b) => { b.style.width = b.dataset.w + '%'; });
    });
    $$('[data-open]', root).forEach((b) => b.addEventListener('click', () => openItem(b.dataset.open)));
    $$('[data-tip]', root).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.tip; const was = !!state.tips[id];
      state.tips[id] = !was;
      if (!was && !state['tipPaid_' + id]) { state['tipPaid_' + id] = true; addDrops(1, 'یک اقدام را پذیرفتید'); }
      commit(); renderPlan();
    }));
  }

  /* ---------------------------------------------------------------
     ۳) کتابخانه
     --------------------------------------------------------------- */
  const lib = { type: 'all', topic: 'all', q: '' };
  const TYPE_CHIPS = [['all', 'همه'], ['info', 'اینفوگرافیک'], ['pod', 'پادکست'], ['vid', 'ویدیو'], ['art', 'متن']];
  const TOPIC_ORDER = ['all', 'basics', 'water', 'kitchen', 'food', 'textile', 'cosmetics', 'air', 'health', 'myths', 'actions'];

  function renderChips() {
    $('#typeChips').innerHTML = TYPE_CHIPS.map(([k, l]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${lib.type === k}">${l}</button>`).join('');
    $('#topicChips').innerHTML = TOPIC_ORDER.map((k) => `<button type="button" class="chip" data-topic="${k}" aria-pressed="${lib.topic === k}">${k === 'all' ? 'همهٔ موضوع‌ها' : TOPIC_LABELS[k]}</button>`).join('');
    $$('[data-type]', $('#typeChips')).forEach((b) => b.addEventListener('click', () => { lib.type = b.dataset.type; renderChips(); renderLibrary(); }));
    $$('[data-topic]', $('#topicChips')).forEach((b) => b.addEventListener('click', () => { lib.topic = b.dataset.topic; renderChips(); renderLibrary(); }));
  }

  function coverClass(it) {
    const d = it.topics.find((t) => DIMENSIONS[t]);
    const c = d ? DIMENSIONS[d].color : 'forest';
    return 'c-' + c;
  }

  function cardHTML(it, rec) {
    const m = TYPE_META[it.type];
    const done = !!state.done[it.id];
    const recCls = rec.has(it.id) ? ' rec' : '';
    let top = '';
    if (it.type === 'info') {
      top = `<div class="thumb"><img src="${upload(it.file, true)}" alt="اینفوگرافیک: ${it.title}" loading="lazy" width="300" height="375" onerror="this.closest('.thumb').classList.add('noimg');this.replaceWith(document.createTextNode('تصویر بارگذاری نشد'))"></div>`;
    } else if (it.type === 'vid') {
      top = `<div class="cover ${coverClass(it)}"><span class="big">${icon('play')}</span><span class="tag">${it.dur}</span></div>`;
    } else if (it.type === 'pod') {
      top = `<div class="cover ${coverClass(it)}"><span class="ep">${it.title}</span><span class="big">${icon('headphones')}</span></div>`;
    } else {
      top = `<div class="art-top"><span class="art-ic">${icon('doc')}</span></div>`;
    }
    const title = it.title;
    const sub = it.sub;
    const extra = it.type === 'pod' ? `<span class="card-sub" style="font-size:.84rem;color:var(--ink-500)">${PODCAST_CREDIT}</span>` : (it.mins ? `<span class="card-sub" style="font-size:.84rem;color:var(--ink-500)">زمان مطالعه: ${fa(it.mins)} دقیقه</span>` : '');
    return `
      <article class="card card-${it.type}${done ? ' done' : ''}${recCls}${it.type === 'art' ? ' card-art' : ''}">
        <button class="card-open" type="button" data-open="${it.id}" aria-label="${m.label}: ${dispTitle(it)}">
          ${top}
          <div class="card-body">
            <span class="card-type">${icon(m.ic)} ${m.label}</span>
            <span class="card-title">${it.type === 'pod' ? 'پادکست پلاستی‌وایز' : title}</span>
            <span class="card-sub">${sub}</span>
            ${extra}
          </div>
        </button>
        <div class="card-foot">
          <button class="done-btn" type="button" data-done="${it.id}" aria-pressed="${done}">${icon('check')} ${done ? 'انجام شد' : 'انجام شد؟'}</button>
        </div>
      </article>`;
  }

  function renderLibrary() {
    const rec = planItemIds();
    const q = lib.q.trim().toLowerCase();
    const list = ITEMS.filter((it) => {
      if (lib.type !== 'all' && it.type !== lib.type) return false;
      if (lib.topic !== 'all' && !it.topics.includes(lib.topic)) return false;
      if (q) {
        const hay = (it.title + ' ' + it.sub + ' ' + it.topics.map((t) => TOPIC_LABELS[t] || '').join(' ') + ' ' + TYPE_META[it.type].label).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // پیشنهادها اول
    list.sort((a, b) => (rec.has(b.id) ? 1 : 0) - (rec.has(a.id) ? 1 : 0));
    const doneCount = ITEMS.filter((i) => state.done[i.id]).length;
    $('#libMeta').textContent = `${fa(list.length)} مورد نمایش داده می‌شود. ${fa(doneCount)} از ${fa(ITEMS.length)} مورد را انجام داده‌اید.`;
    $('#libGrid').innerHTML = list.length ? list.map((it) => cardHTML(it, rec)).join('')
      : `<div class="lib-empty"><p>موردی با این فیلتر پیدا نشد.</p><button class="btn btn-ghost" type="button" id="clearFilters">پاک‌کردن فیلترها</button></div>`;
    const cf = $('#clearFilters'); if (cf) cf.addEventListener('click', () => { lib.type = 'all'; lib.topic = 'all'; lib.q = ''; $('#libSearch').value = ''; renderChips(); renderLibrary(); });
  }

  $('#libGrid').addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); const d = e.target.closest('[data-done]');
    if (d) toggleDone(d.dataset.done);
    else if (o) openItem(o.dataset.open);
  });
  $('#libSearch').addEventListener('input', (e) => { lib.q = e.target.value; renderLibrary(); });

  function toggleDone(id, silent) {
    const was = !!state.done[id];
    state.done[id] = !was;
    if (!was && !state['paid_' + id]) { state['paid_' + id] = true; addDrops(1, 'یک مورد را انجام دادید'); }
    commit();
    renderLibrary();
    if (state.assess.result) renderPlan();
    return !was;
  }

  /* ---------------------------------------------------------------
     باز کردن محتوا (ویدیو/پادکست/اینفوگرافیک/متن)
     --------------------------------------------------------------- */
  function doneButtonHTML(id) {
    const on = !!state.done[id];
    return `<button class="done-btn" type="button" id="mDone" data-id="${id}" aria-pressed="${on}">${icon('check')} ${on ? 'انجام شد' : 'انجام شد؟'}</button>`;
  }
  function bindModalDone() {
    const b = $('#mDone'); if (!b) return;
    b.addEventListener('click', () => { const on = toggleDone(b.dataset.id); b.setAttribute('aria-pressed', on); b.innerHTML = icon('check') + ' ' + (on ? 'انجام شد' : 'انجام شد؟'); });
  }

  function openItem(id) {
    const it = itemById(id); if (!it) return;
    if (it.type === 'vid' || it.type === 'pod') return openPlayer(it);
    if (it.type === 'info') return openInfographic(it);
    return openArticle(it);
  }

  function openPlayer(it) {
    const url = `https://www.aparat.com/v/${it.aparat}`;
    const isPod = it.type === 'pod';
    openModal(`
      <h3 id="modalTitle">${isPod ? 'پادکست پلاستی‌وایز، ' + it.title : it.title}</h3>
      <p class="meta">${it.sub}${isPod ? '<br>' + PODCAST_CREDIT : ''}${it.dur ? ' | ' + it.dur : ''}</p>
      <div class="player ${isPod ? 'audio' : ''}" id="playerBox">
        <div class="player-fallback" id="playerWait">در حال بارگذاری پخش‌کننده...</div>
      </div>
      <div class="modal-actions">
        ${doneButtonHTML(it.id)}
        <a class="btn btn-ghost" href="${url}" target="_blank" rel="noopener noreferrer">${icon('external')} باز کردن در آپارات</a>
      </div>`, true);
    bindModalDone();
    mountAparat($('#playerBox'), it.aparat, url);
  }

  /* همان کد embed رسمی آپارات که در فایل شما بود؛ فقط هنگام باز شدن پنجره بارگذاری می‌شود */
  function mountAparat(host, vid, fallbackUrl) {
    const rid = String(Math.floor(1e10 + Math.random() * 9e10));
    const box = document.createElement('div');
    box.id = rid; box.className = 'embed-host';
    host.appendChild(box);
    const s = document.createElement('script');
    s.type = 'text/JavaScript';
    s.src = `https://www.aparat.com/embed/${vid}?data[rnddiv]=${rid}&data[responsive]=yes&muted=true&titleShow=true`;
    box.appendChild(s);
    setTimeout(() => {
      if (!host.isConnected) return;
      if (!host.querySelector('iframe')) {
        const w = $('#playerWait');
        if (w) w.innerHTML = `پخش‌کنندهٔ آپارات در این صفحه بارگذاری نشد.<br><a class="btn btn-sun" style="margin-top:10px" href="${fallbackUrl}" target="_blank" rel="noopener noreferrer">پخش در آپارات</a>`;
      }
    }, 9000);
  }

  function openInfographic(it) {
    const full = upload(it.file, false);
    openModal(`
      <h3 id="modalTitle">${it.title}</h3>
      <p class="meta">${it.sub}</p>
      <img class="lightbox-img" src="${full}" alt="اینفوگرافیک: ${it.title}">
      <div class="modal-actions" style="margin-top:16px">
        ${doneButtonHTML(it.id)}
        <a class="btn btn-ghost" href="${full}" target="_blank" rel="noopener noreferrer">${icon('external')} باز کردن تصویر اصلی</a>
      </div>`, true);
    bindModalDone();
  }

  function openArticle(it) {
    openModal(`
      <h3 id="modalTitle">${it.title}</h3>
      <p class="meta">${it.sub} | زمان مطالعه: ${fa(it.mins)} دقیقه</p>
      <div class="article-body">${it.body.map((p) => `<p>${p}</p>`).join('')}</div>
      <div class="article-src"><b>منابع این متن</b><ul>${it.src.map((s) => `<li>${s}</li>`).join('')}</ul></div>
      <div class="modal-actions" style="margin-top:18px">${doneButtonHTML(it.id)}</div>`);
    bindModalDone();
  }

  /* ---------------------------------------------------------------
     ۴) باغ
     --------------------------------------------------------------- */
  const STAGE_NAMES = ['خانهٔ خالی', 'بذر', 'جوانه', 'نهال', 'درخت کامل'];

  function plotSVG(stage, species) {
    const soil = `<ellipse cx="50" cy="90" rx="33" ry="8" fill="#6B5440"/><ellipse cx="50" cy="88.5" rx="27" ry="5.5" fill="#8A6F55"/>`;
    let plant = '';
    if (stage === 1) plant = `<ellipse cx="50" cy="84" rx="5.5" ry="3.8" fill="#D9B26A"/><path d="M47 83.5q3-2 6 0" stroke="#8A6F55" stroke-width="1" fill="none"/>`;
    if (stage === 2) plant = `<path d="M50 87V66" stroke="#1E7552" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="42" cy="66" rx="8" ry="4.6" transform="rotate(-28 42 66)" fill="#40A477"/><ellipse cx="58" cy="62" rx="8" ry="4.6" transform="rotate(28 58 62)" fill="#7FD1AA"/>`;
    if (stage === 3) plant = `<rect x="47" y="56" width="6" height="32" rx="3" fill="#6B5440"/><circle cx="50" cy="50" r="15" fill="#40A477"/><circle cx="44" cy="45" r="8" fill="#7FD1AA" opacity=".8"/><circle cx="58" cy="54" r="8" fill="#1E7552" opacity=".55"/>`;
    if (stage === 4) {
      if (species === 'cypress') plant = `<rect x="47.5" y="70" width="5" height="19" rx="2.5" fill="#6B5440"/><path d="M50 6C62 24 66 50 63 72H37C34 50 38 24 50 6z" fill="#175C41"/><path d="M50 12C57 28 58 50 56 70H46C44 50 45 28 50 12z" fill="#2C8B64" opacity=".85"/>`;
      else if (species === 'twin') plant = `<rect x="35" y="56" width="5" height="33" rx="2.5" fill="#6B5440"/><rect x="62" y="48" width="5" height="41" rx="2.5" fill="#6B5440"/><circle cx="37" cy="44" r="19" fill="#2C8B64"/><circle cx="64" cy="34" r="22" fill="#1E7552"/><circle cx="30" cy="38" r="8" fill="#7FD1AA" opacity=".7"/><circle cx="58" cy="26" r="9" fill="#40A477" opacity=".8"/>`;
      else plant = `<rect x="46.5" y="50" width="7" height="39" rx="3.5" fill="#6B5440"/><circle cx="50" cy="34" r="25" fill="#2C8B64"/><circle cx="31" cy="48" r="16" fill="#1E7552"/><circle cx="69" cy="48" r="16" fill="#1E7552"/><circle cx="42" cy="26" r="10" fill="#7FD1AA" opacity=".75"/><circle cx="60" cy="40" r="9" fill="#40A477" opacity=".85"/>`;
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true">${soil}${plant}</svg>`;
  }

  function renderGarden() {
    const trees = treeCount();
    $('#gardenStats').innerHTML = `
      <div class="gstat g-seed">${icon('seed')}<b>${fa(state.seeds)}</b><span>بذر</span></div>
      <div class="gstat g-drop">${icon('drop')}<b>${fa(state.drops)}</b><span>قطرهٔ آب</span></div>
      <div class="gstat g-tree">${icon('tree')}<b>${fa(trees)}</b><span>درخت کامل</span></div>
      <div class="gstat g-star">${icon('star')}<b>${fa(state.stars)}</b><span>ستاره</span></div>`;
    $('#gardenScene').innerHTML = `<div class="plots">${state.plots.map((st, i) => {
      const act = st === 0 ? 'بکار' : st < 4 ? 'آب بده' : 'یادداشت';
      const label = `خانهٔ ${fa(i + 1)}: ${STAGE_NAMES[st]}. ${st === 0 ? 'برای کاشتن یک بذر لازم است.' : st < 4 ? 'برای رشد یک قطرهٔ آب لازم است.' : 'برای دیدن یادداشت محیط‌زیستی بزنید.'}`;
      return `<button type="button" class="plot${st === 0 && state.seeds > 0 ? ' empty can-plant' : ''}" data-plot="${i}" aria-label="${label}">${plotSVG(st, PLOT_SPECIES[i])}${st === 4 ? icon('star', 'star-float') : ''}<span class="plot-act">${act}</span></button>`;
    }).join('')}</div>`;
    $$('.plot').forEach((b) => b.addEventListener('click', () => onPlot(Number(b.dataset.plot), b)));
    $('#levelPill').textContent = `مقام شما: ${levelTitle()}`;
    const hasEmpty = state.plots.includes(0);
    const growing = state.plots.some((p) => p > 0 && p < 4);
    let help;
    if (trees >= PLOT_COUNT) help = 'همهٔ باغ شما درخت شد. دست‌مریزاد! با تکرار آزمونک، دانسته‌هایتان را تازه نگه دارید.';
    else if (state.seeds > 0 && hasEmpty) help = 'بذر دارید. یک خانهٔ خالی را انتخاب کنید و بکارید.';
    else if (state.drops > 0 && growing) help = 'قطرهٔ آب دارید. یک نهال یا جوانه را انتخاب کنید تا رشد کند.';
    else if (state.seeds === 0 && state.drops === 0) help = 'بذر را از پاسخ درست آزمونک می‌گیرید و قطرهٔ آب را از دیدن، شنیدن یا خواندن محتوای کتابخانه.';
    else if (state.seeds === 0) help = 'بذر ندارید. آزمونک بدهید و با هر پاسخ درست یک بذر بگیرید.';
    else help = 'قطرهٔ آب ندارید. یک مورد از کتابخانه را انجام دهید تا قطرهٔ آب بگیرید.';
    $('#gardenHelp').textContent = help;
  }

  function onPlot(i, btn) {
    const st = state.plots[i];
    if (st === 0) {
      if (state.seeds < 1) { toast('بذر ندارید. با پاسخ درست در آزمونک بذر بگیرید.', { icon: 'seed' }); return; }
      state.seeds--; state.plots[i] = 1;
      toast('بذر کاشته شد. حالا آبش بدهید.', { icon: 'seed' });
    } else if (st < 4) {
      if (state.drops < 1) { toast('قطرهٔ آب ندارید. یک مورد از کتابخانه را انجام دهید.', { icon: 'drop' }); return; }
      state.drops--; state.plots[i] = st + 1;
      if (state.plots[i] === 4) {
        state.stars += 1;
        toast('یک درخت کامل شد و یک ستاره گرفتید.', { icon: 'star' });
        toast(TREE_NOTES[i % TREE_NOTES.length], { long: true, icon: 'tree' });
      } else toast(`رشد کرد: ${STAGE_NAMES[state.plots[i]]}`, { icon: 'drop' });
    } else {
      toast(TREE_NOTES[i % TREE_NOTES.length], { long: true, icon: 'tree' });
      return;
    }
    commit();
    const nb = $(`.plot[data-plot="${i}"]`); if (nb) { nb.classList.add('grow'); nb.focus({ preventScroll: true }); }
  }

  function renderBadges() {
    $('#badgeList').innerHTML = BADGES.map((b) => {
      const on = !!state.badges[b.id];
      return `<li class="badge ${on ? 'on' : ''}"><span class="bi">${icon(b.ic)}</span><span><b>${b.n}</b><span class="d">${on ? b.d : 'قفل. ' + b.d}</span></span></li>`;
    }).join('');
  }

  $('#resetBtn').addEventListener('click', () => {
    openModal(`
      <h3 id="modalTitle">پیشرفت پاک شود؟</h3>
      <p>ارزیابی، برنامه، باغ، بذر و ستاره‌ها و نشان‌ها از این مرورگر پاک می‌شوند و قابل بازگشت نیستند.</p>
      <div class="modal-actions"><button class="btn btn-primary" id="confirmReset" type="button">بله، پاک کن</button><button class="btn btn-ghost" data-close type="button">انصراف</button></div>`);
    $('#confirmReset').addEventListener('click', () => {
      state = freshState(); wiz = null; quiz = null; quizView = 'idle';
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      memoryStore = null;
      closeModal(); renderAll(); toast('همه‌چیز پاک شد. می‌توانید از نو شروع کنید.');
    });
  });

  /* ---------------------------------------------------------------
     ۵) آزمونک
     --------------------------------------------------------------- */
  const quizPanel = $('#quizPanel');
  let quiz = null; // { mode, list, i, right, seeds, answered, order }
  let quizView = 'idle'; // idle | running | result

  function renderQuizIdleStats() { if (quizView === 'idle') renderQuizIdle(); }

  function renderQuizIdle() {
    quizView = 'idle';
    const knowTotal = QUIZ.length;
    const rightCount = Object.keys(state.correct).length;
    const hasPlan = !!state.assess.result;
    quizPanel.innerHTML = `
      <h3>آزمونک</h3>
      <p class="sub">${fa(rightCount)} از ${fa(knowTotal)} پرسش را تاکنون درست پاسخ داده‌اید. هر پاسخ درست برای بار اول یک بذر می‌دهد و هر دور کامل یک قطرهٔ آب و تا سه ستاره.</p>
      <div class="mode-list">
        <button class="mode" type="button" data-mode="quick"><span class="mi">${icon('star')}</span><span><b>دور سریع</b><span class="d">پنج پرسش از موضوع‌های مختلف، با اولویت پرسش‌هایی که هنوز درست پاسخ نداده‌اید.</span></span></button>
        <button class="mode m-kave" type="button" data-mode="kave"><span class="mi">${icon('doc')}</span><span><b>ماجرای کاوه</b><span class="d">کاوه یک کارمند ۳۵ ساله است. در یک روز معمولی همراهش شوید و تصمیم بگیرید.</span></span></button>
        <button class="mode m-plan" type="button" data-mode="plan" ${hasPlan ? '' : 'disabled'}><span class="mi">${icon('tree')}</span><span><b>بر اساس برنامهٔ من</b><span class="d">${hasPlan ? 'پرسش‌هایی از محورهای اولویت شما.' : 'ابتدا ارزیابی را کامل کنید تا این دور باز شود.'}</span></span></button>
      </div>`;
    $$('.mode', quizPanel).forEach((b) => b.addEventListener('click', () => startQuiz(b.dataset.mode)));
  }

  function pickQuestions(mode) {
    if (mode === 'kave') return QUIZ.filter((q) => q.kind === 'scenario');
    const unseen = (q) => !state.correct[q.id];
    if (mode === 'plan' && state.assess.result) {
      const r = state.assess.result;
      const tops = Object.entries(r.dims).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d);
      const inTop = shuffle(QUIZ.filter((q) => tops.includes(q.topic)));
      const rest = shuffle(QUIZ.filter((q) => !tops.includes(q.topic)));
      return inTop.sort((a, b) => unseen(b) - unseen(a)).concat(rest).slice(0, 5);
    }
    const a = shuffle(QUIZ.filter(unseen)); const b = shuffle(QUIZ.filter((q) => !unseen(q)));
    return a.concat(b).slice(0, 5);
  }

  function startQuiz(mode) {
    quiz = { mode, list: pickQuestions(mode), i: 0, right: 0, seeds: 0, answered: false, order: [] };
    quizView = 'running';
    renderQuizQuestion();
    quizPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderQuizQuestion() {
    const q = quiz.list[quiz.i];
    quiz.answered = false;
    quiz.order = shuffle(q.o.map((_, i) => i));
    const total = quiz.list.length;
    quizPanel.innerHTML = `
      <div class="qz-top">
        <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${quiz.i + 1}">
          <div class="progress-track"><div class="progress-fill" style="width:${((quiz.i + 1) / total) * 100}%"></div></div>
          <span class="progress-label">${fa(quiz.i + 1)} از ${fa(total)}</span>
        </div>
        <button class="exit" type="button" id="qzExit">خروج</button>
      </div>
      <span class="q-kind ${q.kind === 'scenario' ? 'scn' : ''}">${q.kind === 'scenario' ? 'ماجرای کاوه' : 'پرسش علمی'}</span>
      <p class="qz-q" id="qzQ">${q.q}</p>
      <div class="options" role="radiogroup" aria-labelledby="qzQ">
        ${quiz.order.map((oi) => `<button type="button" class="option" data-oi="${oi}" role="radio" aria-checked="false"><span class="mark"></span><span>${q.o[oi]}</span></button>`).join('')}
      </div>
      <div id="qzFeedback"></div>`;
    $$('.option', quizPanel).forEach((b) => b.addEventListener('click', () => answerQuiz(Number(b.dataset.oi))));
    $('#qzExit').addEventListener('click', () => { quiz = null; renderQuizIdle(); });
  }

  function answerQuiz(oi) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = quiz.list[quiz.i];
    const ok = oi === q.a;
    let gain = '';
    if (ok) {
      quiz.right++;
      if (!state.correct[q.id]) { state.correct[q.id] = true; state.seeds++; quiz.seeds++; gain = `<span class="gain">${icon('seed')} یک بذر گرفتید</span>`; }
      else gain = `<span class="gain">پاسخ درست؛ بذر این پرسش را قبلاً گرفته بودید.</span>`;
    }
    $$('.option', quizPanel).forEach((b) => {
      const i = Number(b.dataset.oi); b.disabled = true;
      if (i === q.a) b.classList.add('right');
      else if (i === oi) b.classList.add('wrong');
    });
    const review = !ok && q.review ? q.review.filter(itemById) : [];
    const last = quiz.i === quiz.list.length - 1;
    $('#qzFeedback').innerHTML = `
      <div class="explain ${ok ? '' : 'bad'}" tabindex="-1" id="qzExplain">
        <h4>${ok ? 'درست است.' : 'پاسخ درست این بود.'}</h4>
        <p>${q.e}</p>
        <p class="src">منبع: ${q.src}</p>
        ${gain}
        ${review.length ? `<div class="review-links"><span style="font-size:.88rem;color:var(--ink-600)">برای مرور:</span>${review.map((id) => `<button type="button" data-review="${id}">${TYPE_META[itemById(id).type].label}: ${itemById(id).type === 'pod' ? 'پادکست ' + itemById(id).title : itemById(id).title}</button>`).join('')}</div>` : ''}
      </div>
      <div class="q-nav"><span></span><button class="btn btn-primary" type="button" id="qzNext">${last ? 'پایان دور' : 'پرسش بعدی'}</button></div>`;
    $$('[data-review]', quizPanel).forEach((b) => b.addEventListener('click', () => openItem(b.dataset.review)));
    $('#qzNext').addEventListener('click', () => { if (last) finishQuiz(); else { quiz.i++; renderQuizQuestion(); } });
    $('#qzNext').focus({ preventScroll: false });
    commit();
  }

  function finishQuiz() {
    const total = quiz.list.length; const pct = Math.round((quiz.right / total) * 100);
    const earned = pct === 100 ? 3 : pct >= 80 ? 2 : pct >= 60 ? 1 : 0;
    state.stars += earned; state.drops += 1; state.rounds++;
    if (earned > state.best) state.best = earned;
    if (quiz.mode === 'kave') state.kave = true;
    commit();
    quizView = 'result';
    const msg = pct === 100 ? 'عالی بود! بدون خطا.' : pct >= 60 ? 'خوب بود. چند مورد را مرور کنید.' : 'مشکلی نیست. پاسخ‌ها را بخوانید و دوباره امتحان کنید.';
    quizPanel.innerHTML = `
      <div class="qz-result">
        <h3>${msg}</h3>
        <p class="sub">${fa(quiz.right)} پاسخ درست از ${fa(total)} پرسش</p>
        <div class="stars-row" role="img" aria-label="${fa(earned)} ستاره از سه">${[1, 2, 3].map((n) => `<svg class="ic ${n <= earned ? 'on' : ''}"><use href="#i-star"/></svg>`).join('')}</div>
        <div class="res-gains">
          <span>${icon('seed')} ${fa(quiz.seeds)} بذر</span>
          <span>${icon('drop')} ۱ قطرهٔ آب</span>
          <span>${icon('star')} ${fa(earned)} ستاره</span>
        </div>
        <div class="res-actions">
          <a class="btn btn-sun" href="#gardenScene" id="toGarden">برو به باغ</a>
          <button class="btn btn-ghost" type="button" id="againQuiz">دور تازه</button>
        </div>
      </div>`;
    quiz = null;
    $('#againQuiz').addEventListener('click', renderQuizIdle);
    $('#toGarden').addEventListener('click', (e) => { e.preventDefault(); $('#gardenScene').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }

  /* ---------------------------------------------------------------
     منابع، منو، راه‌اندازی
     --------------------------------------------------------------- */
  function renderRefs() { $('#refList').innerHTML = REFERENCES.map((r) => `<li>${r.t}</li>`).join(''); }

  const menuBtn = $('#menuBtn'); const nav = $('#mainNav');
  menuBtn.addEventListener('click', () => { const o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(o)); });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });

  function renderAll() {
    renderAssess(); renderPlan(); renderChips(); renderLibrary(); renderGarden(); renderBadges(); renderQuizIdle(); renderRefs(); updateChips();
  }
  renderAll();
  checkBadges(); save(); renderBadges();
})();
