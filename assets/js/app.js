/* 谱线 · 应用主逻辑 */

(() => {
  "use strict";

  /* ========================================================================
     基础工具
     ======================================================================== */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORE = {
    theme: "spx.theme",
    read: "spx.read",
    mistakes: "spx.mistakes",
    activity: "spx.activity",
    attempts: "spx.attempts",
    size: "spx.readingSize",
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 隐私模式下忽略 */
    }
  }

  const state = {
    cleanup: [],
    read: load(STORE.read, {}),
    mistakes: load(STORE.mistakes, []),
    activity: load(STORE.activity, []),
    attempts: load(STORE.attempts, []),
    readingSize: Number(load(STORE.size, 15.5)) || 15.5,
    quiz: null,
    paletteIndex: [],
    paletteItems: [],
    paletteActive: 0,
    currentNote: null,
  };

  const NOTE_MAP = new Map(NOTES.map((n) => [n.slug, n]));
  const CHAPTER_MAP = new Map(CHAPTERS.map((c) => [c.id, c]));
  const NOTES_BY_CHAPTER = new Map(CHAPTERS.map((c) => [c.id, NOTES.filter((n) => n.chapter === c.id)]));
  const QUIZ_MAP = new Map(QUIZ_BANK.map((q) => [q.id, q]));

  const chapterStyle = (ch) =>
    `--chapter-color:${ch.color};--chapter-soft:color-mix(in srgb, ${ch.color} 12%, transparent);`;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function dayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function isToday(ts) {
    return dayKey(ts) === dayKey();
  }

  function relTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60e3) return "刚刚";
    if (diff < 3600e3) return Math.floor(diff / 60e3) + " 分钟前";
    if (diff < 86400e3) return Math.floor(diff / 3600e3) + " 小时前";
    if (diff < 172800e3) return "昨天";
    if (diff < 7 * 86400e3) return Math.floor(diff / 86400e3) + " 天前";
    return fmtDate(ts);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function logActivity(type, payload = {}) {
    state.activity.push({ type, at: Date.now(), ...payload });
    if (state.activity.length > 300) state.activity = state.activity.slice(-300);
    save(STORE.activity, state.activity);
  }

  function markRead(slug, value = true) {
    if (value) {
      if (state.read[slug]) return false;
      state.read[slug] = Date.now();
      logActivity("read", { slug });
      save(STORE.read, state.read);
      updateSidebar();
      toast("已标记为已读");
      return true;
    }
    delete state.read[slug];
    save(STORE.read, state.read);
    updateSidebar();
    toast("已取消已读标记");
    return false;
  }

  function readCount() {
    return Object.keys(state.read).filter((slug) => NOTE_MAP.has(slug)).length;
  }

  function addMistake(q, chosen) {
    let m = state.mistakes.find((x) => x.id === q.id);
    if (m) {
      m.count += 1;
      m.lastAt = Date.now();
      m.lastChoice = chosen;
    } else {
      state.mistakes.push({ id: q.id, count: 1, lastAt: Date.now(), lastChoice: chosen });
    }
    save(STORE.mistakes, state.mistakes);
    updateSidebar();
  }

  function toast(message, kind = "ok") {
    const el = $("#toast");
    if (!el) return;
    const ic = kind === "err" ? "alert" : kind === "info" ? "info" : "check";
    el.innerHTML = icon(ic) + "<span>" + esc(message) + "</span>";
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  /* ========================================================================
     图标
     ======================================================================== */

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/>',
    sigma: '<path d="M18 4H6l6 8-6 8h12"/>',
    flask: '<path d="M9 3h6M10 3v6l-5.6 9.4A2 2 0 0 0 6.1 21h11.8a2 2 0 0 0 1.7-3.6L14 9V3"/><path d="M7.5 15h9"/>',
    quiz: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="m8.5 9 1.7 1.7L13.5 7.5"/><path d="M8 15h8M8 18h5"/>',
    bookmark: '<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    auto: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M8.5 9.5 10 13h-3l1.5-3.5ZM13.5 9.5 15 13h-3l1.5-3.5Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    "arrow-left": '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    x: '<path d="m7 7 10 10M17 7 7 17"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6.5 7l.8 13h9.4l.8-13"/><path d="M10 11v5M14 11v5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tag: '<path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
    printer: '<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 16.5 19.8 19l2.2.8-2.2.8L19 23l-.8-2.4L16 19.8l2.2-.8.8-2.5Z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    flame: '<path d="M12 22c4 0 6.5-2.5 6.5-6.2 0-2.6-1.4-4.6-3.3-6.6-.7 2-1.8 3.3-3.2 4.2.2-3.5-1.4-6.4-3.8-8.4.2 3.5-2.7 5.1-2.7 9.1C5.5 18.9 8 22 12 22Z"/>',
    "chevron-right": '<path d="m9 5 7 7-7 7"/>',
    "chevron-down": '<path d="m5 9 7 7 7-7"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    wave: '<path d="M2 12h4l3-8 5 16 4-11 2 3h2"/>',
    sampling: '<path d="M2 12c2.5 0 2.5-7 5-7s2.5 14 5 14 2.5-7 5-7 2.5 7 5 7"/><path d="M4 20h16"/>',
    spectrum: '<path d="M3 20V10M7 20V4M11 20v-7M15 20V7M19 20v-5M23 20V3"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><rect x="10" y="10" width="4" height="4" rx="1"/>',
    zplane: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><path d="M4 12h16M12 4v16"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="8" cy="12" r="1.4" fill="currentColor"/><path d="m8 12 7.5-3.5"/>',
    "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "log-out": '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  };

  function icon(name, cls = "") {
    return `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
      ICONS[name] || ICONS.info
    }</svg>`;
  }

  function hydrateIcons(root = document) {
    $$("[data-icon]", root).forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
    });
  }

  /* ========================================================================
     主题 & 侧栏
     ======================================================================== */

  function themePref() {
    return load(STORE.theme, "auto");
  }

  function applyTheme(pref, persist = true) {
    if (persist) save(STORE.theme, pref);
    const dark = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePref = pref;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#080e1b" : "#1d4ed8");
    const label = $("#theme-label");
    if (label) label.textContent = pref === "auto" ? "跟随系统" : pref === "light" ? "浅色模式" : "深色模式";
    const themeBtn = $("#theme-btn [data-icon]");
    if (themeBtn) themeBtn.innerHTML = icon(pref === "auto" ? "auto" : dark ? "sun" : "moon");
    const topIcon = $("#theme-btn-top [data-icon]");
    if (topIcon) topIcon.innerHTML = icon(dark ? "sun" : "moon");
    window.dispatchEvent(new Event("spx:theme"));
  }

  function cycleTheme() {
    const cur = themePref();
    const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
    applyTheme(next);
    toast(next === "auto" ? "主题：跟随系统" : next === "light" ? "主题：浅色" : "主题：深色", "info");
  }

  function unreadCount() {
    return NOTES.length - readCount();
  }

  function updateSidebar() {
    const total = NOTES.length;
    const read = readCount();
    const percent = Math.round((read / total) * 100);
    const p = $("#sp-percent");
    if (p) p.textContent = percent + "%";
    const fill = $("#sp-fill");
    if (fill) fill.style.width = percent + "%";
    const cap = $("#sp-caption");
    if (cap) {
      cap.textContent = read === 0 ? "从第一节笔记开始吧" : read >= total ? "全部笔记已读完，去题库检验一下" : `已读 ${read} / ${total} 篇笔记`;
    }
    const navCount = $("#nav-note-count");
    if (navCount) navCount.textContent = unreadCount() > 0 ? String(unreadCount()) : "";
    const mCount = $("#nav-mistake-count");
    if (mCount) mCount.textContent = state.mistakes.length ? String(state.mistakes.length) : "";
  }

  /* ========================================================================
     路由
     ======================================================================== */

  function parseHash() {
    const raw = (location.hash || "#/home").replace(/^#/, "");
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return { path, parts, query: new URLSearchParams(qs || "") };
  }

  function go(hash) {
    if (location.hash === hash) renderRoute();
    else location.hash = hash;
  }

  const ROUTE_LABEL = {
    home: "概览",
    notes: "笔记",
    cheatsheet: "公式速查",
    lab: "交互实验室",
    quiz: "题库",
    mistakes: "错题本",
  };

  function updateChrome(route) {
    const key = route.parts[0] || "home";
    const navKey = key === "notes" ? "notes" : key;
    $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === navKey));
    const label = ROUTE_LABEL[navKey] || "页面";
    const crumb = $("#crumb");
    if (crumb) {
      let text = label;
      if (navKey === "notes" && route.parts[1]) {
        const n = NOTE_MAP.get(route.parts[1]);
        if (n) text = `笔记 / ${n.title}`;
      }
      if (navKey === "lab" && route.parts[1]) {
        const l = LABS.find((x) => x.id === route.parts[1]);
        if (l) text = `实验室 / ${l.title}`;
      }
      if (navKey === "quiz" && route.parts[1] === "play") text = "题库 / 练习中";
      if (navKey === "quiz" && route.parts[1] === "result") text = "题库 / 结果";
      crumb.innerHTML = `<span>学习</span><span class="crumb-sep">/</span><strong>${esc(text)}</strong>`;
    }
  }

  function renderRoute() {
    state.cleanup.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
    state.cleanup = [];
    state.currentNote = null;

    const route = parseHash();
    const main = $("#main");
    const scrollBar = $("#scroll-progress");
    if (scrollBar) scrollBar.hidden = true;

    $$(".reveal-delay").forEach((el) => el.classList.remove("reveal-delay"));

    let view = null;
    const key = route.parts[0] || "home";

    if (key === "home") view = viewHome();
    else if (key === "notes") view = route.parts[1] ? viewNote(route.parts[1]) : viewNotes(route.query);
    else if (key === "cheatsheet") view = viewCheatsheet(route.query);
    else if (key === "lab") view = route.parts[1] ? viewLab(route.parts[1]) : viewLabList();
    else if (key === "quiz") {
      if (route.parts[1] === "play") view = viewQuizPlay();
      else if (route.parts[1] === "result") view = viewQuizResult();
      else view = viewQuizHome();
    } else if (key === "mistakes") view = viewMistakes();
    else view = viewNotFound();

    if (!view) return;

    document.title = `${view.title || "谱线"} · 谱线 DSP 学习台`;
    main.innerHTML = view.html;
    hydrateIcons(main);
    renderMathIn(main);
    if (view.init) {
      const cleanup = view.init();
      if (typeof cleanup === "function") state.cleanup.push(cleanup);
    }
    renderMathIn(main);
    updateChrome(route);
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    closeMenu();
  }

  /* ========================================================================
     首页
     ======================================================================== */

  function streakDays() {
    const days = new Set(state.activity.map((a) => dayKey(a.at)));
    if (!days.size) return 0;
    const d = new Date();
    if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(dayKey(d.getTime()))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function todayStats() {
    const readToday = Object.values(state.read).filter((ts) => isToday(ts)).length;
    const attemptsToday = state.attempts.filter((a) => isToday(a.at));
    const total = attemptsToday.reduce((s, a) => s + a.total, 0);
    const correct = attemptsToday.reduce((s, a) => s + a.correct, 0);
    return { readToday, total, correct, accuracy: total ? Math.round((correct / total) * 100) : null };
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return "夜深了";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }

  function heroVisual() {
    return `
    <div class="hero-visual">
      <div class="scope">
        <div class="scope-bar">
          <span class="scope-dots"><i></i><i></i><i></i></span>
          <span>spectrum.desk / channel 01</span>
          <span class="scope-live">LIVE</span>
        </div>
        <div class="scope-body">
          <svg viewBox="0 0 520 268" role="img" aria-label="信号波形与频谱示意">
            <defs>
              <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#60a5fa"/><stop offset="0.55" stop-color="#7dd3fc"/><stop offset="1" stop-color="#5eead4"/>
              </linearGradient>
              <linearGradient id="barFill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stop-color="#22d3ee" stop-opacity=".08"/><stop offset="1" stop-color="#22d3ee" stop-opacity=".55"/>
              </linearGradient>
              <linearGradient id="glowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#3b82f6" stop-opacity=".25"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <g stroke="rgba(148,190,255,.14)" stroke-width="1">
              <path d="M16 16H504M16 70H504M16 124H504M16 178H504M16 232H504"/>
              <path d="M16 16V232M100 16V232M184 16V232M268 16V232M352 16V232M436 16V232M504 16V232"/>
            </g>
            <path d="M16 124 C40 62 56 62 80 124 C104 186 120 186 144 124 C168 62 184 62 208 124 C232 186 248 186 272 124 C296 62 312 62 336 124 C360 186 376 186 400 124" fill="none" stroke="url(#heroLine)" stroke-width="2.4"/>
            <path d="M16 124 C40 62 56 62 80 124 C104 186 120 186 144 124 C168 62 184 62 208 124 C232 186 248 186 272 124 C296 62 312 62 336 124 C360 186 376 186 400 124" fill="none" stroke="#93c5fd" stroke-width="1" opacity=".5" class="wave-anim"/>
            <g fill="#fb7185">
              <circle cx="16" cy="124" r="3.4"/><circle cx="58" cy="74" r="3.4"/><circle cx="100" cy="173" r="3.4"/><circle cx="142" cy="82" r="3.4"/><circle cx="184" cy="167" r="3.4"/><circle cx="226" cy="96" r="3.4"/><circle cx="268" cy="151" r="3.4"/><circle cx="310" cy="83" r="3.4"/><circle cx="352" cy="158" r="3.4"/><circle cx="394" cy="88" r="3.4"/>
            </g>
            <g opacity=".22" stroke="#7dd3fc" stroke-width="1" stroke-dasharray="2 5">
              <path d="M16 124H400"/>
            </g>
            <g transform="translate(0 236)">
              <path d="M16 46V20M32 46V34M48 46V10M64 46V28M80 46V16M96 46V38M112 46V24M128 46V6M144 46V31M160 46V19M176 46V40M192 46V26M208 46V12M224 46V33M240 46V21M256 46V37M272 46V15M288 46V28M304 46V9M320 46V34M336 46V22M352 46V39M368 46V17M384 46V30M400 46V11M416 46V36M432 46V25M448 46V14M464 46V41M480 46V29" stroke="url(#barFill)" stroke-width="7"/>
            </g>
            <g font-family="monospace" font-size="9.5" fill="rgba(191,219,254,.62)">
              <text x="406" y="34">x[n]</text>
              <text x="406" y="82">|X[k]|</text>
              <text x="18" y="250">0</text>
              <text x="470" y="250">f</text>
            </g>
          </svg>
        </div>
        <div class="scope-foot">
          <span class="scope-chip">fs = 48 kHz</span>
          <span class="scope-chip">N = 1024</span>
          <span class="scope-chip">Hann</span>
          <span class="scope-chip">SNR 74 dB</span>
        </div>
      </div>
      <div class="float-note"><strong>+6.02 dB / bit</strong>量化精度与动态范围</div>
    </div>`;
  }

  function viewHome() {
    const read = readCount();
    const unread = NOTES.length - read;
    const lastSlug = Object.entries(state.read)
      .filter(([slug]) => NOTE_MAP.has(slug))
      .sort((a, b) => b[1] - a[1])[0];
    const lastNote = lastSlug ? NOTE_MAP.get(lastSlug[0]) : NOTES[0];
    const lastChapter = CHAPTER_MAP.get(lastNote.chapter);
    const chRead = NOTES_BY_CHAPTER.get(lastNote.chapter).filter((n) => state.read[n.slug]).length;
    const chTotal = NOTES_BY_CHAPTER.get(lastNote.chapter).length;
    const stats = todayStats();
    const streak = streakDays();
    const percent = Math.round((read / NOTES.length) * 100);

    const allFormulas = FORMULA_GROUPS.flatMap((g) => g.items.map((f) => ({ ...f, group: g.title })));
    const dayIdx = Math.floor(Date.now() / 86400000);
    const formula = allFormulas[dayIdx % allFormulas.length];

    const chapterCards = CHAPTERS.map((ch) => {
      const list = NOTES_BY_CHAPTER.get(ch.id);
      const done = list.filter((n) => state.read[n.slug]).length;
      const pct = Math.round((done / list.length) * 100);
      return `
        <a class="chapter-card" href="#/notes?chapter=${ch.id}" style="${chapterStyle(ch)}" data-chapter="${ch.id}">
          <span class="chapter-num">${ch.num}</span>
          <div class="chapter-body">
            <h3>${esc(ch.title)} <span class="tag" style="color:${ch.color};background:var(--chapter-soft)">${done}/${list.length}</span></h3>
            <p>${esc(ch.desc)}</p>
            <div class="chapter-meta">
              <div class="progress-bar"><i style="width:${pct}%"></i></div>
              <span class="chapter-progress-val">${pct}%</span>
            </div>
          </div>
        </a>`;
    }).join("");

    const activity = state.activity
      .slice()
      .sort((a, b) => b.at - a.at)
      .slice(0, 5);
    const activityHtml = activity.length
      ? activity
          .map((a) => {
            if (a.type === "read") {
              const n = NOTE_MAP.get(a.slug);
              return `<div class="activity-item"><span class="activity-dot">${icon("book")}</span><div class="ai-main"><strong>读完《${esc(n ? n.title : "一篇笔记")}》</strong></div><time>${relTime(a.at)}</time></div>`;
            }
            return `<div class="activity-item"><span class="activity-dot" style="color:var(--green);background:var(--green-soft)">${icon("quiz")}</span><div class="ai-main"><strong>完成一组练习 · ${a.correct}/${a.total} 题</strong></div><time>${relTime(a.at)}</time></div>`;
          })
          .join("")
      : `<div class="activity-item"><span class="activity-dot">${icon("spark")}</span><div class="ai-main"><strong>还没有学习记录</strong><small style="color:var(--faint)">读一篇笔记或做一组题，这里会留下足迹。</small></div></div>`;

    const dateStr = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());

    return {
      title: "概览",
      html: `
      <section class="page-head" style="margin-bottom:18px">
        <div>
          <span class="eyebrow">${dateStr}</span>
          <h1 class="page-title" style="margin-top:10px">${greeting()}，继续把信号看透。</h1>
          <p class="page-sub">从离散序列到数字滤波器，沿着一条完整的 DSP 链路学习、实验与练习。</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${streak > 0 ? `<span class="streak-pill">${icon("flame")} 连续 ${streak} 天</span>` : ""}
          <span class="tag tag-blue">已读 ${read}/${NOTES.length}</span>
        </div>
      </section>

      <section class="hero">
        <div class="hero-body">
          <span class="eyebrow">DSP STUDY DESK</span>
          <h1 class="hero-title">看见信号，<br /><span class="grad">理解变换。</span></h1>
          <p class="hero-sub">31 篇系统笔记、9 组公式速查、5 个可交互实验和 48 道练习题。把采样、z 变换、DFT 与滤波器串成一条真正能用的知识链路。</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#/notes/${lastNote.slug}">${read === 0 ? "从第一节开始" : "继续学习"} ${icon("arrow-right")}</a>
            <a class="btn btn-ghost btn-lg" href="#/lab">${icon("flask")} 打开实验室</a>
          </div>
          <div class="hero-stats">
            <div class="hero-stat"><strong>${NOTES.length}</strong><span>篇系统笔记</span></div>
            <div class="hero-stat"><strong>${QUIZ_BANK.length}</strong><span>道练习题</span></div>
            <div class="hero-stat"><strong>${LABS.length}</strong><span>个交互实验</span></div>
            <div class="hero-stat"><strong>${percent}<em style="font-family:var(--font);font-size:12px;font-style:normal;color:var(--faint)">%</em></strong><span>整体进度</span></div>
          </div>
        </div>
        ${heroVisual()}
      </section>

      <div class="today-grid">
        <div class="today-stat hot"><strong>${stats.readToday}<em>篇</em></strong><span>今日已读</span></div>
        <div class="today-stat green"><strong>${stats.total}<em>题</em></strong><span>今日答题</span></div>
        <div class="today-stat amber"><strong>${stats.accuracy === null ? "—" : stats.accuracy + "<em>%</em>"}</strong><span>今日正确率</span></div>
        <div class="today-stat"><strong>${unread}<em>篇</em></strong><span>待读笔记</span></div>
      </div>

      <a class="continue-card" href="#/notes/${lastNote.slug}">
        <div class="continue-main">
          <div class="continue-kicker"><span>${read === 0 ? "开始学习" : "继续学习"}</span><span>·</span><span>第 ${lastChapter.num} 章 ${esc(lastChapter.title)}</span></div>
          <h2 class="continue-title">${esc(lastNote.title)}</h2>
          <div class="continue-sub">${read === 0 ? "从离散时间信号开始建立直觉" : `上次读到这里 · 本章已读 ${chRead}/${chTotal}`} · 约 ${lastNote.minutes} 分钟</div>
        </div>
        <div class="continue-actions">
          <span class="btn btn-white">${read === 0 ? "开始阅读" : "接着读"} ${icon("arrow-right")}</span>
          <span class="btn btn-ghost-white">查看目录</span>
        </div>
      </a>

      <div class="section-head">
        <h2 class="section-title">章节地图 <small>6 个章节 · ${NOTES.length} 篇笔记</small></h2>
        <a class="link-arrow" href="#/notes">全部笔记 ${icon("arrow-right")}</a>
      </div>
      <div class="chapter-grid">${chapterCards}</div>

      <div class="section-head">
        <h2 class="section-title">今日一公式</h2>
        <a class="link-arrow" href="#/cheatsheet">公式速查 ${icon("arrow-right")}</a>
      </div>
      <div class="split-grid">
        <div class="formula-spotlight">
          <div class="spot-head">
            <h3>${esc(formula.group)} · ${esc(formula.name)}</h3>
            <button class="copy-btn" type="button" data-copy="${encodeURIComponent(formula.tex)}" aria-label="复制公式" style="opacity:1">${icon("copy")}</button>
          </div>
          <div class="spot-formula">$$${esc(formula.tex)}$$</div>
          <p class="spot-note">${esc(formula.note)}</p>
          <div class="spot-foot">
            <span class="tag tag-cyan">${dayIdx % 2 ? "每日轮换" : "今日推荐"}</span>
            <a class="btn btn-soft btn-sm" href="#/cheatsheet">查看全部 ${icon("arrow-right")}</a>
          </div>
        </div>
        <div class="card activity-card">
          <div class="section-head" style="margin:0 0 6px">
            <h2 class="section-title" style="font-size:15px">最近学习</h2>
            <span class="tag">本地记录</span>
          </div>
          <div class="activity-list">${activityHtml}</div>
        </div>
      </div>

      <div class="section-head">
        <h2 class="section-title">快速开始</h2>
        <span class="tag tag-green">建议顺序：采样 → DFT → FIR</span>
      </div>
      <div class="quick-grid">
        <a class="quick-card" href="#/quiz">
          <span class="quick-ico">${icon("quiz")}</span>
          <div><h3>10 题热身</h3><p>从 48 道题中随机抽一组，即时查看解析，错题自动收进错题本。</p><span class="tag tag-blue">题库</span></div>
        </a>
        <a class="quick-card" href="#/lab/sampling">
          <span class="quick-ico cyan">${icon("sampling")}</span>
          <div><h3>看一次混叠</h3><p>把 7 Hz 信号用 10 Hz 采样，亲眼看它变成 3 Hz。</p><span class="tag tag-cyan">交互实验</span></div>
        </a>
        <a class="quick-card" href="#/mistakes">
          <span class="quick-ico amber">${icon("bookmark")}</span>
          <div><h3>复习错题</h3><p>${state.mistakes.length ? `有 ${state.mistakes.length} 道错题等待重做，趁热打铁。` : "做几道题后，错题会自动汇总到这里。"}</p><span class="tag tag-amber">错题本</span></div>
        </a>
      </div>
      `,
    };
  }

  /* ========================================================================
     笔记列表
     ======================================================================== */

  function noteCard(note) {
    const ch = CHAPTER_MAP.get(note.chapter);
    const isRead = !!state.read[note.slug];
    return `
    <article class="note-card" data-note="${note.slug}" style="${chapterStyle(ch)}">
      <div class="note-card-top">
        <span class="note-chapter">${ch.num} · ${esc(ch.short)}</span>
        ${isRead ? `<span class="read-mark" title="已读">${icon("check")}</span>` : ""}
      </div>
      <h3><a href="#/notes/${note.slug}">${esc(note.title)}</a></h3>
      <p>${esc(note.summary)}</p>
      <div class="note-card-foot">
        <span>${icon("clock")}</span><span>${note.minutes} 分钟</span>
        <span class="meta-dot">${esc(note.level)}</span>
        <span class="tags">${note.tags.slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</span>
      </div>
    </article>`;
  }

  function viewNotes(query) {
    const chapterFilter = query.get("chapter") || "all";
    const filtered = chapterFilter === "all" ? NOTES : NOTES.filter((n) => n.chapter === chapterFilter);

    const chips = [
      `<button class="chip ${chapterFilter === "all" ? "active" : ""}" data-filter="all" type="button">全部 <span class="count">${NOTES.length}</span></button>`,
      ...CHAPTERS.map(
        (ch) =>
          `<button class="chip ${chapterFilter === ch.id ? "active" : ""}" data-filter="${ch.id}" type="button">${esc(ch.short)} <span class="count">${NOTES_BY_CHAPTER.get(ch.id).length}</span></button>`
      ),
    ].join("");

    return {
      title: "笔记",
      html: `
      <section class="page-head">
        <div>
          <span class="eyebrow">NOTES · ${NOTES.length} 篇</span>
          <h1 class="page-title">系统笔记</h1>
          <p class="page-sub">从离散序列到多速率处理，按章节循序推进。每篇都配有公式、直觉解释与工程提醒。</p>
        </div>
        <span class="tag tag-blue">已读 ${readCount()} / ${NOTES.length}</span>
      </section>

      <div class="toolbar">
        <div class="field" id="notes-field">
          ${icon("search")}
          <input id="note-search" type="search" placeholder="搜索标题、摘要或标签…" autocomplete="off" />
          <button class="clear-input" type="button" data-clear="note-search" aria-label="清除">${icon("x")}</button>
        </div>
        <div class="chip-row" id="chapter-chips">${chips}</div>
      </div>
      <p class="result-line" id="notes-result">共 <strong>${filtered.length}</strong> 篇笔记</p>
      <div class="note-grid" id="note-grid">${filtered.map(noteCard).join("")}</div>
      `,
      init() {
        const input = $("#note-search");
        const grid = $("#note-grid");
        const result = $("#notes-result");
        const field = $("#notes-field");
        let active = chapterFilter;

        function apply() {
          const q = input.value.trim().toLowerCase();
          const list = NOTES.filter((n) => {
            if (active !== "all" && n.chapter !== active) return false;
            if (!q) return true;
            const ch = CHAPTER_MAP.get(n.chapter);
            return (n.title + n.summary + n.tags.join(" ") + ch.title).toLowerCase().includes(q);
          });
          grid.innerHTML = list.length
            ? list.map(noteCard).join("")
            : `<div class="empty" style="grid-column:1/-1"><div class="empty-ico">${icon("search")}</div><h3>没有找到匹配的笔记</h3><p>试试更短的关键词，或切换到其他章节。</p></div>`;
          result.innerHTML = `共 <strong>${list.length}</strong> 篇笔记${q ? ` · 搜索“${esc(input.value.trim())}”` : ""}`;
          field.classList.toggle("has-value", !!input.value);
          hydrateIcons(grid);
        }

        input.addEventListener("input", apply);
        $("#chapter-chips").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-filter]");
          if (!btn) return;
          active = btn.dataset.filter;
          $$("#chapter-chips .chip").forEach((c) => c.classList.toggle("active", c === btn));
          apply();
        });
        const clearBtn = $('[data-clear="note-search"]');
        if (clearBtn)
          clearBtn.addEventListener("click", () => {
            input.value = "";
            apply();
            input.focus();
          });
        apply();
      },
    };
  }

  /* ========================================================================
     笔记详情
     ======================================================================== */

  function renderReadButton(note) {
    const isRead = !!state.read[note.slug];
    return `<button class="btn ${isRead ? "btn-soft" : "btn-ghost"} btn-sm" type="button" data-action="toggle-read" data-slug="${note.slug}">
      ${icon(isRead ? "check-circle" : "check")} ${isRead ? "已读" : "标记已读"}
    </button>`;
  }

  function viewNote(slug) {
    const note = NOTE_MAP.get(slug);
    if (!note) return viewNotFound();
    const ch = CHAPTER_MAP.get(note.chapter);
    const list = NOTES_BY_CHAPTER.get(note.chapter);
    const idx = NOTES.findIndex((n) => n.slug === slug);
    const prev = NOTES[idx - 1];
    const next = NOTES[idx + 1];
    const related = list.filter((n) => n.slug !== slug).slice(0, 3);
    const labs = LABS.filter((l) => l.chapter === note.chapter);
    const isRead = !!state.read[slug];

    const pager = `
      <div class="note-pager">
        ${
          prev
            ? `<a class="pager-link prev" href="#/notes/${prev.slug}"><span>← 上一篇</span><strong>${esc(prev.title)}</strong></a>`
            : `<div class="pager-link prev empty"><span>← 上一篇</span><strong>已经是第一篇</strong></div>`
        }
        ${
          next
            ? `<a class="pager-link next" href="#/notes/${next.slug}"><span>下一篇 →</span><strong>${esc(next.title)}</strong></a>`
            : `<div class="pager-link next empty"><span>下一篇 →</span><strong>已经读到最后一篇</strong></div>`
        }
      </div>`;

    const relatedHtml = related.length
      ? `<div class="section-head" style="margin-top:38px"><h2 class="section-title" style="font-size:16px">同章继续</h2><a class="link-arrow" href="#/notes?chapter=${ch.id}">本章目录 ${icon("arrow-right")}</a></div>
         <div class="related-grid">${related
           .map(
             (n) => `<a class="related-card" href="#/notes/${n.slug}"><small>${n.minutes} 分钟 · ${esc(n.level)}</small><strong>${esc(n.title)}</strong></a>`
           )
           .join("")}</div>`
      : "";

    const labHtml = labs.length
      ? `<div class="section-head" style="margin-top:34px"><h2 class="section-title" style="font-size:16px">动手验证</h2></div>
         <div class="explain-card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
           <span class="quick-ico" style="color:${labs[0].color};background:color-mix(in srgb, ${labs[0].color} 12%, transparent)">${icon(labs[0].icon)}</span>
           <div style="flex:1;min-width:220px"><h3 style="margin:0">${esc(labs[0].title)}</h3><p style="margin-top:3px">${esc(labs[0].short)}</p></div>
           <a class="btn btn-soft btn-sm" href="#/lab/${labs[0].id}">打开实验 ${icon("arrow-right")}</a>
         </div>`
      : "";

    return {
      title: note.title,
      html: `
      <div class="note-hero" style="${chapterStyle(ch)}">
        <span class="eyebrow" style="color:${ch.color}">${ch.num} · ${esc(ch.title)}</span>
        <h1>${esc(note.title)}</h1>
        <p class="note-lead">${esc(note.summary)}</p>
        <div class="note-hero-meta">
          <span class="meta-row">${icon("clock")} ${note.minutes} 分钟</span>
          <span class="tag tag-blue">${esc(note.level)}</span>
          ${note.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          <span class="note-hero-actions">
            <span class="reading-size" aria-label="字号调整">
              <button type="button" data-action="font-dec" aria-label="减小字号">A−</button>
              <button type="button" data-action="font-inc" aria-label="增大字号">A+</button>
            </span>
            <button class="btn btn-ghost btn-sm" type="button" data-action="copy-link">${icon("copy")} 链接</button>
            <button class="btn btn-ghost btn-sm" type="button" data-action="print">${icon("printer")} 打印</button>
            ${renderReadButton(note)}
          </span>
        </div>
      </div>

      <div class="note-layout">
        <article class="article" id="article" style="font-size:${state.readingSize}px">${MD.parse(note.body)}</article>
        <aside class="toc" aria-label="本文目录">
          <div class="toc-title">本文目录</div>
          <nav class="toc-list" id="toc-list"></nav>
          <div class="toc-read">
            <div class="toc-read-label"><span>阅读进度</span><b id="toc-percent">0%</b></div>
            <div class="progress-bar" style="margin-top:8px"><i id="toc-fill" style="width:0%"></i></div>
            <p style="margin-top:9px;font-size:10.5px;line-height:1.6;color:var(--faint)">滚动到 85% 会自动标记已读</p>
          </div>
        </aside>
      </div>

      <div class="note-foot">
        <span class="meta-row">${icon("book")} 第 ${ch.num} 章 · 共 ${list.length} 篇</span>
        <span style="display:flex;gap:8px;align-items:center">${renderReadButton(note)}</span>
      </div>
      ${pager}
      ${relatedHtml}
      ${labHtml}
      `,
      init() {
        state.currentNote = note;
        const article = $("#article");
        const tocList = $("#toc-list");
        const headings = $$("h2, h3", article);
        tocList.innerHTML = headings
          .map((h) => `<a href="#${h.id}" data-scroll="${h.id}" class="depth-${h.tagName === "H3" ? 3 : 2}">${esc(h.textContent)}</a>`)
          .join("");

        const links = $$("a", tocList);
        const linkMap = new Map();
        links.forEach((a) => linkMap.set(a.dataset.scroll, a));
        let activeId = null;

        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (en.isIntersecting) {
                const id = en.target.id;
                if (id !== activeId) {
                  activeId = id;
                  links.forEach((a) => a.classList.toggle("active", a.dataset.scroll === id));
                }
              }
            });
          },
          { rootMargin: "-84px 0px -68% 0px", threshold: 0 }
        );
        headings.forEach((h) => io.observe(h));

        const bar = $("#scroll-progress");
        const barFill = bar ? $("i", bar) : null;
        const tocFill = $("#toc-fill");
        const tocPercent = $("#toc-percent");
        if (bar) bar.hidden = false;

        let ticking = false;
        function onScroll() {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            const doc = document.documentElement;
            const max = doc.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
            if (barFill) barFill.style.width = p * 100 + "%";
            if (tocFill) tocFill.style.width = p * 100 + "%";
            if (tocPercent) tocPercent.textContent = Math.round(p * 100) + "%";
            if (p > 0.85 && !state.read[note.slug]) {
              markRead(note.slug);
              updateReadButtons(note.slug);
            }
          });
        }
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();

        function updateReadButtons(slug) {
          $$('[data-action="toggle-read"]').forEach((btn) => {
            if (btn.dataset.slug !== slug) return;
            const read = !!state.read[slug];
            btn.className = `btn ${read ? "btn-soft" : "btn-ghost"} btn-sm`;
            btn.innerHTML = `${icon(read ? "check-circle" : "check")} ${read ? "已读" : "标记已读"}`;
          });
        }

        const layout = $("#article").closest(".note-layout");
        function onLayoutClick(e) {
          const a = e.target.closest("a[data-scroll]");
          if (a) {
            e.preventDefault();
            const target = document.getElementById(a.dataset.scroll);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        layout.addEventListener("click", onLayoutClick);

        function onDocClick(e) {
          const btn = e.target.closest('[data-action="toggle-read"]');
          if (btn) {
            const slug2 = btn.dataset.slug;
            if (!slug2) return;
            if (state.read[slug2]) markRead(slug2, false);
            else markRead(slug2, true);
            updateReadButtons(slug2);
          }
          const fInc = e.target.closest('[data-action="font-inc"]');
          if (fInc) {
            state.readingSize = Math.min(19, state.readingSize + 0.5);
            save(STORE.size, state.readingSize);
            $("#article").style.fontSize = state.readingSize + "px";
          }
          const fDec = e.target.closest('[data-action="font-dec"]');
          if (fDec) {
            state.readingSize = Math.max(13, state.readingSize - 0.5);
            save(STORE.size, state.readingSize);
            $("#article").style.fontSize = state.readingSize + "px";
          }
          const printBtn = e.target.closest('[data-action="print"]');
          if (printBtn) window.print();
          const copyLink = e.target.closest('[data-action="copy-link"]');
          if (copyLink) {
            copyText(location.href).then((ok) => toast(ok ? "笔记链接已复制" : "复制失败，请手动复制地址栏", ok ? "ok" : "err"));
          }
        }
        document.addEventListener("click", onDocClick);

        // 首次进入时，若已读则直接显示状态；否则保持，滚动触发。
        updateReadButtons(slug);
        return () => {
          io.disconnect();
          window.removeEventListener("scroll", onScroll);
          layout.removeEventListener("click", onLayoutClick);
          document.removeEventListener("click", onDocClick);
        };
      },
    };
  }

  function viewNotFound() {
    return {
      title: "页面不存在",
      html: `
      <div class="empty" style="margin-top:60px;padding:80px 22px">
        <div class="empty-ico">${icon("search")}</div>
        <h3>没有找到这个页面</h3>
        <p>它可能已经被移动，或者链接里有一个小笔误。</p>
        <div style="margin-top:18px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <a class="btn btn-primary" href="#/home">回到概览</a>
          <a class="btn btn-ghost" href="#/notes">浏览笔记</a>
        </div>
      </div>`,
    };
  }

  /* ========================================================================
     公式速查
     ======================================================================== */

  function viewCheatsheet() {
    const total = FORMULA_GROUPS.reduce((s, g) => s + g.items.length, 0);
    const groupsHtml = FORMULA_GROUPS.map(
      (g) => `
      <section class="cheat-group" id="cheat-${g.id}" data-group="${g.id}">
        <div class="cheat-group-head">
          <h2>${esc(g.title)}</h2>
          <p>${esc(g.desc)}</p>
        </div>
        <div class="formula-grid">
          ${g.items
            .map(
              (f) => `
            <article class="formula-card" data-search="${esc((f.name + " " + f.note + " " + g.title + " " + f.tex).toLowerCase())}">
              <div class="formula-card-top">
                <h3>${esc(f.name)}</h3>
                <button class="copy-btn" type="button" data-copy="${encodeURIComponent(f.tex)}" aria-label="复制 ${esc(f.name)} 的 LaTeX">${icon("copy")}</button>
              </div>
              <div class="formula-body">$$${esc(f.tex)}$$</div>
              <p class="formula-note">${esc(f.note)}</p>
            </article>`
            )
            .join("")}
        </div>
      </section>`
    ).join("");

    const nav = FORMULA_GROUPS.map((g) => `<a href="#cheat-${g.id}" data-scroll="cheat-${g.id}">${esc(g.title)}<span class="cheat-nav-count">${g.items.length}</span></a>`).join("");

    return {
      title: "公式速查",
      html: `
      <section class="page-head">
        <div>
          <span class="eyebrow">CHEATSHEET · ${total} 条</span>
          <h1 class="page-title">公式速查</h1>
          <p class="page-sub">按主题整理的高频公式与结论。搜索关键词，或直接跳到某一组；每张卡片都可以复制 LaTeX。</p>
        </div>
        <span class="tag tag-green">KaTeX 排版</span>
      </section>
      <div class="toolbar">
        <div class="field" id="cheat-field">
          ${icon("search")}
          <input id="cheat-search" type="search" placeholder="搜索公式，例如：卷积、SQNR、Kaiser…" autocomplete="off" />
          <button class="clear-input" type="button" data-clear="cheat-search" aria-label="清除">${icon("x")}</button>
        </div>
        <span class="result-line" id="cheat-result" style="margin:0">共 <strong>${total}</strong> 条公式</span>
      </div>
      <div class="cheat-layout">
        <nav class="cheat-nav" aria-label="公式分组">${nav}</nav>
        <div class="cheat-groups" id="cheat-groups">
          ${groupsHtml}
          <div class="empty" id="cheat-empty" hidden><div class="empty-ico">${icon("search")}</div><h3>没有匹配的公式</h3><p>换一个关键词试试，例如“窗”“分辨率”“LMS”。</p></div>
        </div>
      </div>
      `,
      init() {
        const input = $("#cheat-search");
        const field = $("#cheat-field");
        const result = $("#cheat-result");
        const empty = $("#cheat-empty");

        function apply() {
          const q = input.value.trim().toLowerCase();
          let visible = 0;
          $$(".cheat-group").forEach((group) => {
            let count = 0;
            $$(".formula-card", group).forEach((card) => {
              const hit = !q || card.dataset.search.includes(q);
              card.hidden = !hit;
              if (hit) count++;
            });
            group.hidden = count === 0;
            visible += count;
          });
          const navs = $$(".cheat-nav a");
          navs.forEach((a) => {
            const g = a.dataset.scroll.replace("cheat-", "");
            const group = document.getElementById("cheat-" + g);
            a.hidden = group ? group.hidden : false;
          });
          empty.hidden = visible > 0;
          result.innerHTML = q ? `找到 <strong>${visible}</strong> 条公式` : `共 <strong>${total}</strong> 条公式`;
          field.classList.toggle("has-value", !!input.value);
        }

        input.addEventListener("input", apply);
        const clearBtn = $('[data-clear="cheat-search"]');
        if (clearBtn)
          clearBtn.addEventListener("click", () => {
            input.value = "";
            apply();
            input.focus();
          });

        // 滚动高亮
        const links = $$(".cheat-nav a");
        const map = new Map(links.map((a) => [a.dataset.scroll, a]));
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (en.isIntersecting) {
                links.forEach((a) => a.classList.remove("active"));
                const a = map.get(en.target.id);
                if (a) a.classList.add("active");
              }
            });
          },
          { rootMargin: "-90px 0px -70% 0px" }
        );
        $$(".cheat-group").forEach((g) => io.observe(g));
        return () => io.disconnect();
      },
    };
  }

  /* ========================================================================
     实验室
     ======================================================================== */

  function viewLabList() {
    const cards = LABS.map(
      (lab) => `
      <a class="lab-card" href="#/lab/${lab.id}" style="--lab-color:${lab.color};--lab-soft:color-mix(in srgb, ${lab.color} 12%, transparent)">
        <span class="lab-ico">${icon(lab.icon)}</span>
        <h3>${esc(lab.title)}</h3>
        <p>${esc(lab.short)}</p>
        <div class="lab-card-foot">
          ${lab.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          <span class="arrow">${icon("arrow-right")}</span>
        </div>
      </a>`
    ).join("");

    return {
      title: "交互实验室",
      html: `
      <section class="page-head">
        <div>
          <span class="eyebrow">INTERACTIVE LAB · ${LABS.length} 个实验</span>
          <h1 class="page-title">交互实验室</h1>
          <p class="page-sub">公式看十遍，不如亲手拖一次。这里用 Canvas 实时计算，参数一改，波形与频谱立刻响应。</p>
        </div>
        <span class="tag tag-cyan">无需登录 · 本地计算</span>
      </section>
      <div class="lab-grid">${cards}</div>
      <div class="section-head">
        <h2 class="section-title">建议探索顺序</h2>
        <span class="tag">约 25 分钟</span>
      </div>
      <div class="explain-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px">
        <div><h3>01 · 先看采样</h3><p>把信号频率推过 fs/2，观察混叠；这是数字世界的第一道门槛。</p></div>
        <div><h3>02 · 再看频谱</h3><p>切换窗函数，理解主瓣与旁瓣的取舍，以及泄漏从哪里来。</p></div>
        <div><h3>03 · 设计滤波器</h3><p>调阶数与截止频率，观察过渡带、阻带和群延迟如何变化。</p></div>
        <div><h3>04 · 理解卷积</h3><p>拖动 n₀，看翻转后的 h 滑过 x，逐步累积出输出。</p></div>
      </div>
      `,
    };
  }

  function viewLab(id) {
    const lab = LABS.find((l) => l.id === id);
    if (!lab) return viewNotFound();
    const ch = CHAPTER_MAP.get(lab.chapter);
    const chapterNotes = NOTES_BY_CHAPTER.get(lab.chapter) || [];

    return {
      title: lab.title,
      html: `
      <div class="demo-head" style="--lab-color:${lab.color}">
        <div class="demo-head-main">
          <a class="link-arrow" href="#/lab" style="margin-bottom:8px;display:inline-flex">${icon("arrow-left")} 返回实验室</a>
          <h1>${esc(lab.title)}</h1>
          <p>${esc(lab.desc)}</p>
          <div class="chip-row" style="margin-top:12px">
            ${lab.tags.map((t) => `<span class="tag tag-blue">${esc(t)}</span>`).join("")}
            <a class="tag" href="#/notes?chapter=${ch.id}" style="color:${ch.color};background:color-mix(in srgb, ${ch.color} 10%, transparent)">关联：${esc(ch.title)}</a>
          </div>
        </div>
      </div>

      <div id="lab-root">${lab.render()}</div>

      <div class="demo-explain">
        <div class="explain-card">
          <h3>背后的公式</h3>
          <div class="formula-body" style="background:var(--surface-2);padding:10px 12px;border-radius:10px;margin-top:10px">$$${esc(lab.formula)}$$</div>
          <p style="margin-top:12px">${esc(lab.desc)}</p>
        </div>
        <div class="explain-card">
          <h3>观察要点</h3>
          <ul>${lab.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <a class="btn btn-soft btn-sm" href="#/notes?chapter=${ch.id}">阅读本章笔记 ${icon("arrow-right")}</a>
            <a class="btn btn-ghost btn-sm" href="#/lab">换个实验</a>
          </div>
        </div>
      </div>

      <div class="section-head">
        <h2 class="section-title">相关笔记</h2>
      </div>
      <div class="related-grid">
        ${chapterNotes
          .slice(0, 3)
          .map(
            (n) => `<a class="related-card" href="#/notes/${n.slug}"><small>${n.minutes} 分钟 · ${esc(n.level)}</small><strong>${esc(n.title)}</strong></a>`
          )
          .join("")}
      </div>
      `,
      init() {
        const root = $("#lab-root");
        if (root && typeof lab.init === "function") {
          return lab.init(root);
        }
      },
    };
  }

  /* ========================================================================
     题库
     ======================================================================== */

  function startQuiz(config) {
    let pool;
    if (config.mode === "mistakes") {
      pool = (config.ids || []).map((id) => QUIZ_MAP.get(id)).filter(Boolean);
    } else {
      pool = QUIZ_BANK.filter((q) => {
        if (config.chapter && config.chapter !== "all" && q.chapter !== config.chapter) return false;
        if (config.difficulty && config.difficulty !== "all" && q.difficulty !== config.difficulty) return false;
        return true;
      });
    }
    if (!pool.length) {
      toast("没有符合条件的题目，换个筛选条件吧", "err");
      return;
    }
    pool = shuffle(pool);
    if (typeof config.count === "number") pool = pool.slice(0, config.count);
    state.quiz = {
      questions: pool,
      idx: 0,
      answers: [],
      config,
      startedAt: Date.now(),
      answered: false,
      chosen: null,
      finished: false,
      score: 0,
    };
    go("#/quiz/play");
  }

  function quizAccuracy(answers) {
    const total = answers.length;
    const correct = answers.filter((a) => a.correct).length;
    return { total, correct, pct: total ? Math.round((correct / total) * 100) : 0 };
  }

  function viewQuizHome() {
    const allAnswers = state.attempts.flatMap((a) => a.answers || []);
    const overall = quizAccuracy(allAnswers);
    const totalAnswered = state.attempts.reduce((s, a) => s + a.total, 0);
    const totalCorrect = state.attempts.reduce((s, a) => s + a.correct, 0);
    const overallPct = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : null;

    const config = { chapter: "all", count: 10, difficulty: "all" };

    const chapterChips = [
      `<button class="chip active" data-quiz-chapter="all" type="button">全部章节</button>`,
      ...CHAPTERS.map(
        (ch) => `<button class="chip" data-quiz-chapter="${ch.id}" type="button">${esc(ch.short)} <span class="count">${QUIZ_BANK.filter((q) => q.chapter === ch.id).length}</span></button>`
      ),
    ].join("");

    const chapterStats = CHAPTERS.map((ch) => {
      const qs = QUIZ_BANK.filter((q) => q.chapter === ch.id);
      const answers = allAnswers.filter((a) => {
        const q = QUIZ_MAP.get(a.qid);
        return q && q.chapter === ch.id;
      });
      const acc = quizAccuracy(answers);
      return `
        <div class="chapter-stat" style="${chapterStyle(ch)}">
          <span class="cs-name"><span style="color:${ch.color};font-weight:600">${ch.num}</span> ${esc(ch.title)}</span>
          <span class="cs-bar"><i style="width:${acc.pct}%"></i></span>
          <span class="cs-val">${acc.total ? acc.correct + "/" + acc.total : "—"}</span>
        </div>`;
    }).join("");

    const attempts = state.attempts
      .slice()
      .sort((a, b) => b.at - a.at)
      .slice(0, 6);
    const attemptHtml = attempts.length
      ? attempts
          .map((a) => {
            const pct = Math.round((a.correct / a.total) * 100);
            const cls = pct >= 80 ? "" : pct >= 60 ? "mid" : "low";
            const ch = a.chapter && a.chapter !== "all" ? CHAPTER_MAP.get(a.chapter) : null;
            return `<div class="attempt-item"><span class="attempt-score ${cls}">${pct}%</span><span>${a.correct}/${a.total} 题${ch ? " · " + esc(ch.short) : ""}</span><time>${relTime(a.at)}</time></div>`;
          })
          .join("")
      : `<div class="attempt-item" style="color:var(--faint)">还没有练习记录，先来一组 10 题。</div>`;

    return {
      title: "题库",
      html: `
      <section class="quiz-hero">
        <div>
          <span class="eyebrow">PRACTICE · ${QUIZ_BANK.length} 道题</span>
          <h1>把理解变成分数。</h1>
          <p>按章节、题量和难度自由组合。答错立即看解析，并自动收进错题本；所有记录只保存在本地浏览器。</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <span class="tag tag-blue">即时解析</span>
            <span class="tag tag-green">错题自动收集</span>
            <span class="tag tag-violet">快捷键 1–4</span>
          </div>
        </div>
        <div class="quiz-hero-stats">
          <div class="qstat"><strong>${QUIZ_BANK.length}</strong><span>题库总数</span></div>
          <div class="qstat"><strong>${totalCorrect}</strong><span>累计答对</span></div>
          <div class="qstat"><strong>${overallPct === null ? "—" : overallPct + "%"}</strong><span>累计正确率</span></div>
        </div>
      </section>

      <div class="quiz-setup">
        <div class="card setup-card">
          <div class="setup-group">
            <span class="setup-label">选择章节</span>
            <div class="chip-row" id="quiz-chapters">${chapterChips}</div>
          </div>
          <div class="setup-group">
            <span class="setup-label">题目数量</span>
            <div class="chip-row" id="quiz-counts">
              <button class="chip" data-count="5" type="button">5 题</button>
              <button class="chip active" data-count="10" type="button">10 题</button>
              <button class="chip" data-count="20" type="button">20 题</button>
              <button class="chip" data-count="all" type="button">全部</button>
            </div>
          </div>
          <div class="setup-group">
            <span class="setup-label">难度</span>
            <div class="chip-row" id="quiz-diffs">
              <button class="chip active" data-diff="all" type="button">混合</button>
              <button class="chip" data-diff="基础" type="button">基础</button>
              <button class="chip" data-diff="进阶" type="button">进阶</button>
            </div>
          </div>
        </div>
        <div class="card start-card">
          <span class="tag tag-cyan" style="align-self:flex-start">本次练习</span>
          <h3 style="margin-top:10px" id="quiz-summary">全部章节 · 10 题 · 混合难度</h3>
          <p>答完每题立即显示解析，最后给出得分与逐题回顾。错题会自动加入错题本。</p>
          <button class="btn btn-primary" id="start-quiz" type="button">开始练习 ${icon("arrow-right")}</button>
          ${
            state.mistakes.length
              ? `<button class="btn btn-ghost btn-sm" id="start-mistakes" type="button" style="margin-top:8px">重练 ${state.mistakes.length} 道错题</button>`
              : `<p class="start-hint">提示：按 1–4 选择答案，Enter 进入下一题</p>`
          }
        </div>
      </div>

      <div class="section-head">
        <h2 class="section-title">章节掌握度</h2>
        <span class="tag">基于本地答题记录</span>
      </div>
      <div class="chapter-stat-list">${chapterStats}</div>

      <div class="section-head">
        <h2 class="section-title">最近练习</h2>
        ${state.mistakes.length ? `<a class="link-arrow" href="#/mistakes">错题本 (${state.mistakes.length}) ${icon("arrow-right")}</a>` : ""}
      </div>
      <div class="card activity-card"><div class="attempt-list">${attemptHtml}</div></div>
      `,
      init() {
        const summary = $("#quiz-summary");
        function refresh() {
          const chapterLabel = config.chapter === "all" ? "全部章节" : CHAPTER_MAP.get(config.chapter).short;
          const countLabel = config.count === "all" ? "全部题目" : config.count + " 题";
          const diffLabel = config.difficulty === "all" ? "混合难度" : config.difficulty;
          const pool = QUIZ_BANK.filter((q) => {
            if (config.chapter !== "all" && q.chapter !== config.chapter) return false;
            if (config.difficulty !== "all" && q.difficulty !== config.difficulty) return false;
            return true;
          }).length;
          summary.innerHTML = `${chapterLabel} · ${config.count === "all" ? "最多 " + pool + " 题" : Math.min(config.count, pool) + " 题"} · ${diffLabel}`;
        }
        $("#quiz-chapters").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-quiz-chapter]");
          if (!btn) return;
          config.chapter = btn.dataset.quizChapter;
          $$("#quiz-chapters .chip").forEach((c) => c.classList.toggle("active", c === btn));
          refresh();
        });
        $("#quiz-counts").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-count]");
          if (!btn) return;
          config.count = btn.dataset.count === "all" ? "all" : Number(btn.dataset.count);
          $$("#quiz-counts .chip").forEach((c) => c.classList.toggle("active", c === btn));
          refresh();
        });
        $("#quiz-diffs").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-diff]");
          if (!btn) return;
          config.difficulty = btn.dataset.diff;
          $$("#quiz-diffs .chip").forEach((c) => c.classList.toggle("active", c === btn));
          refresh();
        });
        $("#start-quiz").addEventListener("click", () => startQuiz({ ...config, mode: "normal" }));
        const sm = $("#start-mistakes");
        if (sm)
          sm.addEventListener("click", () =>
            startQuiz({ mode: "mistakes", ids: state.mistakes.map((m) => m.id), count: "all", chapter: "all", difficulty: "all" })
          );
        refresh();
      },
    };
  }

  function viewQuizPlay() {
    if (!state.quiz || state.quiz.finished) {
      return {
        title: "题库",
        html: "",
        init() {
          go("#/quiz");
        },
      };
    }
    const sess = state.quiz;
    const q = sess.questions[sess.idx];
    if (!q) {
      finishQuiz();
      return { title: "题库", html: "" };
    }
    const ch = CHAPTER_MAP.get(q.chapter);
    const total = sess.questions.length;
    const answered = sess.answered;
    const chosen = sess.chosen;
    const correctCount = sess.answers.filter((a) => a.correct).length;
    const pct = Math.round(((sess.idx + (answered ? 1 : 0)) / total) * 100);
    const isLast = sess.idx === total - 1;

    const options = q.options
      .map((opt, i) => {
        let cls = "option";
        if (answered) {
          cls += " locked";
          if (i === q.answer) cls += " correct";
          else if (i === chosen) cls += " wrong";
          else cls += " dim";
        }
        return `<button class="${cls}" type="button" data-option="${i}" ${answered ? "disabled" : ""}>
          <span class="option-key">${String.fromCharCode(65 + i)}</span>
          <span class="option-text">${MD.inline(opt)}</span>
          <span class="option-mark">${answered ? (i === q.answer ? "正确答案" : i === chosen ? "你的选择" : "") : ""}</span>
        </button>`;
      })
      .join("");

    const explainHtml = answered
      ? `<div class="explain-box ${chosen === q.answer ? "is-right" : "is-wrong"}" id="q-explain">
          <div class="explain-head">${icon(chosen === q.answer ? "check-circle" : "alert")} ${chosen === q.answer ? "回答正确" : "再看一下解析"}</div>
          <div class="explain-body">${MD.inline(q.explain)}</div>
        </div>`
      : `<div class="explain-box" id="q-explain" hidden></div>`;

    return {
      title: "练习中",
      html: `
      <div class="quiz-play">
        <div class="quiz-top">
          <a class="quiz-back" href="#/quiz" id="quit-quiz">${icon("arrow-left")} 退出</a>
          <div class="quiz-progress-wrap">
            <div class="quiz-progress-meta"><span>第 <strong>${sess.idx + 1}</strong> / ${total} 题</span><span id="quiz-live">答对 ${correctCount} 题</span></div>
            <div class="quiz-progress"><i style="width:${pct}%"></i></div>
          </div>
          <span class="quiz-score-live">${ch.num} · ${esc(ch.short)}</span>
        </div>

        <div class="question-card">
          <div class="question-meta">
            <span class="qnum">QUESTION ${String(sess.idx + 1).padStart(2, "0")}</span>
            <span class="tag ${q.difficulty === "进阶" ? "tag-violet" : "tag-green"}">${esc(q.difficulty)}</span>
            <span class="tag">${esc(ch.title)}</span>
          </div>
          <div class="question-stem">${MD.inline(q.question)}</div>
          <p class="question-hint">选择一个答案 ${answered ? "" : "· 快捷键 1–4"}</p>
          <div class="options" id="options">${options}</div>
          ${explainHtml}
          <div class="quiz-foot">
            <span class="hint">${answered ? "按 Enter 继续" : "选定答案后显示解析"}</span>
            <div class="quiz-foot-right">
              <button class="btn btn-primary" id="next-question" type="button" ${answered ? "" : "disabled"}>
                ${isLast ? "查看结果" : "下一题"} ${icon("arrow-right")}
              </button>
            </div>
          </div>
        </div>
      </div>
      `,
      init() {
        const optionsEl = $("#options");
        const nextBtn = $("#next-question");
        const explain = $("#q-explain");
        const live = $("#quiz-live");

        function choose(i) {
          if (sess.answered) return;
          sess.answered = true;
          sess.chosen = i;
          const isCorrect = i === q.answer;
          sess.answers.push({ qid: q.id, chosen: i, correct: isCorrect });
          if (!isCorrect) addMistake(q, i);

          $$(".option", optionsEl).forEach((btn, idx) => {
            btn.disabled = true;
            btn.classList.add("locked");
            if (idx === q.answer) btn.classList.add("correct");
            else if (idx === i) btn.classList.add("wrong");
            else btn.classList.add("dim");
            const mark = $(".option-mark", btn);
            if (mark) mark.textContent = idx === q.answer ? "正确答案" : idx === i ? "你的选择" : "";
          });
          if (explain) {
            explain.hidden = false;
            explain.className = `explain-box ${isCorrect ? "is-right" : "is-wrong"}`;
            explain.innerHTML = `<div class="explain-head">${icon(isCorrect ? "check-circle" : "alert")} ${isCorrect ? "回答正确" : "再看一下解析"}</div><div class="explain-body">${MD.inline(q.explain)}</div>`;
            renderMathIn(explain);
          }
          nextBtn.disabled = false;
          nextBtn.focus({ preventScroll: true });
          if (live) live.textContent = `答对 ${sess.answers.filter((a) => a.correct).length} 题`;
        }

        optionsEl.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-option]");
          if (!btn) return;
          choose(Number(btn.dataset.option));
        });

        function next() {
          if (!sess.answered) return;
          sess.idx += 1;
          sess.answered = false;
          sess.chosen = null;
          if (sess.idx >= sess.questions.length) finishQuiz();
          else renderRoute();
        }
        nextBtn.addEventListener("click", next);

        function onKey(e) {
          if (e.altKey || e.ctrlKey || e.metaKey) return;
          const tag = (e.target.tagName || "").toLowerCase();
          if (tag === "input" || tag === "textarea" || tag === "select") return;
          if (!sess.answered && /^[1-4]$/.test(e.key)) {
            e.preventDefault();
            choose(Number(e.key) - 1);
          } else if (sess.answered && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            next();
          }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      },
    };
  }

  function finishQuiz() {
    const sess = state.quiz;
    if (!sess || sess.finished) return;
    const correct = sess.answers.filter((a) => a.correct).length;
    sess.score = correct;
    sess.finished = true;
    sess.finishedAt = Date.now();
    const attempt = {
      at: Date.now(),
      total: sess.questions.length,
      correct,
      chapter: sess.config.chapter || "all",
      mode: sess.config.mode || "normal",
      answers: sess.answers.slice(),
    };
    state.attempts.push(attempt);
    if (state.attempts.length > 100) state.attempts = state.attempts.slice(-100);
    save(STORE.attempts, state.attempts);
    logActivity("quiz", { total: attempt.total, correct, chapter: attempt.chapter, mode: attempt.mode });
    go("#/quiz/result");
  }

  function viewQuizResult() {
    const sess = state.quiz;
    if (!sess || !sess.finished) {
      return {
        title: "题库",
        html: "",
        init() {
          go("#/quiz");
        },
      };
    }
    const total = sess.questions.length;
    const correct = sess.score;
    const wrong = total - correct;
    const pct = Math.round((correct / total) * 100);
    const C = 2 * Math.PI * 64;
    const config = sess.config;
    let title = "";
    let sub = "";
    if (pct >= 90) {
      title = "漂亮，主干已经很稳了。";
      sub = "可以尝试更难的章节组合，或者去实验室把结论亲手验证一遍。";
    } else if (pct >= 70) {
      title = "不错，再补齐几个薄弱点。";
      sub = "翻一翻错题解析，找到对应的笔记小节，比重复刷题更有效。";
    } else if (pct >= 50) {
      title = "基础有了，建议回看错题。";
      sub = "先看采样、DFT 与 z 变换三章的核心结论，再回来重做这一组。";
    } else {
      title = "别急，先把概念串起来。";
      sub = "建议按「基础 → 采样 → z 变换 → 傅里叶」的顺序读几篇笔记，再开始练习。";
    }

    const review = sess.questions
      .map((q, i) => {
        const ans = sess.answers[i];
        const ok = ans && ans.correct;
        return `<div class="review-item">
          <span class="ri-ico ${ok ? "" : "bad"}">${icon(ok ? "check" : "x")}</span>
          <div class="ri-q">${MD.inline(q.question)}<small>${ok ? "回答正确" : "正确答案：" + MD.inline(q.options[q.answer])}</small></div>
        </div>`;
      })
      .join("");

    return {
      title: "练习结果",
      html: `
      <div class="result-card">
        <div class="result-ring">
          <svg viewBox="0 0 148 148">
            <circle class="ring-bg" cx="74" cy="74" r="64"></circle>
            <circle class="ring-fg" id="ring-fg" cx="74" cy="74" r="64" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"></circle>
          </svg>
          <div class="result-ring-inner"><strong>${pct}<span style="font-size:15px">%</span></strong><span>本次正确率</span></div>
        </div>
        <h2>${title}</h2>
        <p>${sub}</p>
        <div class="result-stats">
          <div class="result-stat good"><strong>${correct}</strong><span>答对</span></div>
          <div class="result-stat bad"><strong>${wrong}</strong><span>答错</span></div>
          <div class="result-stat"><strong>${total}</strong><span>总题数</span></div>
        </div>
        <div class="result-actions">
          <button class="btn btn-primary" id="retry-quiz" type="button">${icon("refresh")} 再来一组</button>
          <a class="btn btn-ghost" href="#/mistakes">查看错题本</a>
          <a class="btn btn-ghost" href="#/quiz">返回题库</a>
        </div>
        <div class="review-list">
          <div class="section-head" style="margin:26px 0 6px"><h2 class="section-title" style="font-size:15px">逐题回顾</h2><span class="tag">${wrong ? wrong + " 道待复习" : "全部正确"}</span></div>
          ${review}
        </div>
      </div>
      `,
      init() {
        const ring = $("#ring-fg");
        if (ring) {
          const target = C * (1 - pct / 100);
          requestAnimationFrame(() => {
            ring.style.strokeDashoffset = target.toFixed(1);
          });
        }
        const retry = $("#retry-quiz");
        if (retry)
          retry.addEventListener("click", () => {
            const cfg = { ...config };
            if (cfg.mode === "mistakes") {
              cfg.ids = state.mistakes.map((m) => m.id);
              cfg.count = "all";
            }
            startQuiz(cfg);
          });
      },
    };
  }

  /* ========================================================================
     错题本
     ======================================================================== */

  function viewMistakes() {
    const items = state.mistakes
      .map((m) => ({ m, q: QUIZ_MAP.get(m.id) }))
      .filter((x) => x.q)
      .sort((a, b) => b.m.lastAt - a.m.lastAt);

    const cards = items
      .map(({ m, q }) => {
        const ch = CHAPTER_MAP.get(q.chapter);
        const last = m.lastChoice !== undefined && m.lastChoice !== null ? q.options[m.lastChoice] : null;
        return `
        <article class="mistake-card" data-mistake="${q.id}" style="${chapterStyle(ch)}">
          <div class="mistake-card-top">
            <span class="tag" style="color:${ch.color};background:var(--chapter-soft)">${ch.num} · ${esc(ch.short)}</span>
            <span class="tag ${q.difficulty === "进阶" ? "tag-violet" : "tag-green"}">${esc(q.difficulty)}</span>
            ${m.count > 1 ? `<span class="tag tag-amber">错过 ${m.count} 次</span>` : ""}
            <time>${relTime(m.lastAt)}</time>
          </div>
          <div class="q-text">${MD.inline(q.question)}</div>
          <div class="mistake-answer">
            ${last ? `<div class="answer-chip bad"><span>你的选择</span>${MD.inline(last)}</div>` : ""}
            <div class="answer-chip good"><span>正确答案</span>${MD.inline(q.options[q.answer])}</div>
          </div>
          <p class="mistake-explain">${MD.inline(q.explain)}</p>
          <div class="mistake-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-remove="${q.id}">${icon("trash")} 移除</button>
            <a class="btn btn-soft btn-sm" href="#/notes?chapter=${q.chapter}">复习本章 ${icon("arrow-right")}</a>
          </div>
        </article>`;
      })
      .join("");

    return {
      title: "错题本",
      html: `
      <section class="page-head">
        <div>
          <span class="eyebrow">MISTAKES · ${items.length} 道</span>
          <h1 class="page-title">错题本</h1>
          <p class="page-sub">错题不是失败，而是最精确的复习清单。每道题都保留了你上次的选择与解析。</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${items.length ? `<button class="btn btn-primary btn-sm" id="redo-all" type="button">${icon("refresh")} 重练全部</button>` : ""}
          ${items.length ? `<button class="btn btn-ghost btn-sm" id="clear-all" type="button">${icon("trash")} 清空</button>` : ""}
        </div>
      </section>
      ${
        items.length
          ? `<div class="mistake-list">${cards}</div>`
          : `<div class="empty" style="padding:70px 22px">
              <div class="empty-ico">${icon("bookmark")}</div>
              <h3>错题本是空的</h3>
              <p>做一组练习，答错的题会自动出现在这里，方便集中复习。</p>
              <div style="margin-top:18px"><a class="btn btn-primary" href="#/quiz">去题库练习 ${icon("arrow-right")}</a></div>
            </div>`
      }
      `,
      init() {
        const list = $(".mistake-list");
        if (list) {
          list.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-remove]");
            if (!btn) return;
            state.mistakes = state.mistakes.filter((m) => m.id !== btn.dataset.remove);
            save(STORE.mistakes, state.mistakes);
            updateSidebar();
            const card = btn.closest(".mistake-card");
            if (card) card.remove();
            toast("已从错题本移除");
            const left = $$(".mistake-card").length;
            if (!left) renderRoute();
          });
        }
        const redo = $("#redo-all");
        if (redo)
          redo.addEventListener("click", () =>
            startQuiz({ mode: "mistakes", ids: items.map((x) => x.q.id), count: "all", chapter: "all", difficulty: "all" })
          );
        const clear = $("#clear-all");
        if (clear)
          clear.addEventListener("click", () => {
            if (!window.confirm("确定清空全部错题吗？此操作不可撤销。")) return;
            state.mistakes = [];
            save(STORE.mistakes, state.mistakes);
            updateSidebar();
            toast("错题本已清空");
            renderRoute();
          });
      },
    };
  }

  /* ========================================================================
     站内搜索
     ======================================================================== */

  function buildPaletteIndex() {
    const items = [];
    NOTES.forEach((n) => {
      const ch = CHAPTER_MAP.get(n.chapter);
      items.push({
        type: "笔记",
        icon: "book",
        title: n.title,
        sub: `${ch.num} · ${ch.title}`,
        href: `#/notes/${n.slug}`,
        search: (n.title + " " + n.summary + " " + n.tags.join(" ") + " " + ch.title).toLowerCase(),
      });
    });
    FORMULA_GROUPS.forEach((g) => {
      g.items.forEach((f) => {
        items.push({
          type: "公式",
          icon: "sigma",
          title: f.name,
          sub: g.title,
          href: "#/cheatsheet",
          search: (f.name + " " + f.note + " " + g.title).toLowerCase(),
        });
      });
    });
    LABS.forEach((l) => {
      items.push({
        type: "实验",
        icon: "flask",
        title: l.title,
        sub: l.tags.join(" · "),
        href: `#/lab/${l.id}`,
        search: (l.title + " " + l.short + " " + l.desc + " " + l.tags.join(" ")).toLowerCase(),
      });
    });
    [
      { title: "概览", sub: "学习面板", href: "#/home", icon: "home" },
      { title: "题库", sub: "48 道练习题", href: "#/quiz", icon: "quiz" },
      { title: "错题本", sub: "集中复习", href: "#/mistakes", icon: "bookmark" },
    ].forEach((p) => items.push({ type: "页面", ...p, search: (p.title + " " + p.sub).toLowerCase() }));
    state.paletteIndex = items;
  }

  function openPalette() {
    const palette = $("#palette");
    if (!palette) return;
    palette.hidden = false;
    document.body.style.overflow = "hidden";
    const input = $("#palette-input");
    input.value = "";
    renderPalette("");
    input.focus();
  }

  function closePalette() {
    const palette = $("#palette");
    if (!palette) return;
    palette.hidden = true;
    document.body.style.overflow = "";
  }

  function renderPalette(query) {
    const q = query.trim().toLowerCase();
    let list;
    if (!q) {
      list = state.paletteIndex.filter((x) => x.type === "笔记").slice(0, 6);
    } else {
      list = state.paletteIndex
        .map((x) => {
          let score = 0;
          if (x.title.toLowerCase().startsWith(q)) score += 4;
          else if (x.title.toLowerCase().includes(q)) score += 3;
          if (x.search.includes(q)) score += 1;
          return { x, score };
        })
        .filter((v) => v.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 14)
        .map((v) => v.x);
    }
    state.paletteItems = list;
    state.paletteActive = 0;

    const box = $("#palette-results");
    if (!list.length) {
      box.innerHTML = `<div class="palette-empty">没有找到“${esc(query)}”。试试“采样”“DFT”“滤波器”。</div>`;
      return;
    }
    let html = "";
    let lastType = "";
    list.forEach((item, i) => {
      if (item.type !== lastType) {
        if (lastType) html += "";
        html += `<div class="palette-group-label">${esc(item.type)}</div>`;
        lastType = item.type;
      }
      html += `<button class="palette-item ${i === 0 ? "active" : ""}" type="button" data-palette-idx="${i}">
        <span class="palette-item-ico">${icon(item.icon)}</span>
        <span class="palette-item-main"><strong>${esc(item.title)}</strong><small>${esc(item.sub)}</small></span>
        <span class="tag">${esc(item.type)}</span>
      </button>`;
    });
    box.innerHTML = html;
  }

  function movePalette(delta) {
    if (!state.paletteItems.length) return;
    state.paletteActive = (state.paletteActive + delta + state.paletteItems.length) % state.paletteItems.length;
    $$(".palette-item").forEach((el, i) => {
      el.classList.toggle("active", i === state.paletteActive);
      if (i === state.paletteActive) el.scrollIntoView({ block: "nearest" });
    });
  }

  function activatePalette() {
    const item = state.paletteItems[state.paletteActive];
    if (!item) return;
    closePalette();
    go(item.href);
  }

  /* ========================================================================
     菜单 / 全局事件 / 启动
     ======================================================================== */

  function openMenu() {
    $("#sidebar").classList.add("open");
    $("#scrim").hidden = false;
    $("#menu-btn").setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    const sidebar = $("#sidebar");
    if (!sidebar) return;
    sidebar.classList.remove("open");
    const scrim = $("#scrim");
    if (scrim) scrim.hidden = true;
    const btn = $("#menu-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function bindGlobal() {
    $("#theme-btn").addEventListener("click", cycleTheme);
    $("#theme-btn-top").addEventListener("click", cycleTheme);
    $("#menu-btn").addEventListener("click", () => {
      if ($("#sidebar").classList.contains("open")) closeMenu();
      else openMenu();
    });
    $("#scrim").addEventListener("click", closeMenu);
    $("#sidebar").addEventListener("click", (e) => {
      if (e.target.closest(".nav-link")) closeMenu();
    });
    $("#search-btn").addEventListener("click", openPalette);
    $("#search-btn-side").addEventListener("click", openPalette);

    $("#palette").addEventListener("click", (e) => {
      if (e.target.closest("[data-close-palette]")) {
        closePalette();
        return;
      }
      const item = e.target.closest("[data-palette-idx]");
      if (item) {
        state.paletteActive = Number(item.dataset.paletteIdx);
        activatePalette();
      }
    });

    $("#palette-input").addEventListener("input", (e) => renderPalette(e.target.value));
    $("#palette-input").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        movePalette(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        movePalette(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        activatePalette();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
      }
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if ($("#palette").hidden) openPalette();
        else closePalette();
        return;
      }
      if (e.key === "Escape") {
        if (!$("#palette").hidden) closePalette();
        closeMenu();
        return;
      }
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea" && !e.target.isContentEditable) {
        e.preventDefault();
        openPalette();
      }
    });

    window.addEventListener("hashchange", renderRoute);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (themePref() === "auto") applyTheme("auto", false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
    else if (mq.addListener) mq.addListener(onScheme);

    // 全局：复制公式、目录滚动
    document.addEventListener("click", (e) => {
      const copyBtn = e.target.closest("[data-copy]");
      if (copyBtn) {
        e.preventDefault();
        let tex = copyBtn.dataset.copy;
        try {
          tex = decodeURIComponent(tex);
        } catch (err) {}
        copyText(tex).then((ok) => toast(ok ? "LaTeX 已复制到剪贴板" : "复制失败，请手动选择", ok ? "ok" : "err"));
        return;
      }
      const scrollEl = e.target.closest("[data-scroll]");
      if (scrollEl) {
        e.preventDefault();
        const target = document.getElementById(scrollEl.dataset.scroll);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function boot() {
    hydrateIcons();
    applyTheme(themePref(), false);
    updateSidebar();
    buildPaletteIndex();
    bindGlobal();
    if (!location.hash) {
      try {
        history.replaceState(null, "", "#/home");
      } catch (e) {
        location.hash = "#/home";
      }
    }
    renderRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();