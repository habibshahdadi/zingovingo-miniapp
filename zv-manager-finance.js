/* ═══════════════════════════════════════════════════════════════════════════════
   ZingoVingo — Manager · Finance Repair & Ledger Module  v1.0
   فایل: zv-manager-finance.js

   نصب (یک خط): در Manager.html دقیقاً پیش از </body> و پس از اسکریپت اصلی:
       <script src="zv-manager-finance.js"></script>

   کارهایی که انجام می‌دهد:
   ۱) رفع ریشه‌ای خطای «(DB[e] || []).slice is not a function» برای همهٔ بخش‌ها
      (هر مجموعه‌ای که آبجکت/JSON/null باشد به آرایهٔ معتبر تبدیل می‌شود).
   ۲) بازسازی کامل «دفتر مالی»: ثبت/ویرایش/حذف/بازگردانی، جستجو، فیلتر، مرتب‌سازی،
      انتخاب گروهی، کشوی جزئیات، جابه‌جایی دستی، نماهای ذخیره‌شده، خروجی CSV، چاپ،
      نمودارهای SVG، تقویم شمسی و ذخیره‌سازی پایدار (سرور در صورت وجود، وگرنه محلی).
   ═══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__ZV_FINANCE_V1__) return;
  window.__ZV_FINANCE_V1__ = true;

  /* ═══════════ 0) پل دسترسی به متغیرهای سراسری پنل ═══════════ */
  function G(name) {
    try { if (name in window) return window[name]; } catch (e) {}
    try { return (0, eval)(name); } catch (e) { return undefined; }
  }
  function host(name) { var v = G(name); return typeof v === 'function' ? v : null; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pageBox() { return $('#page') || $('#pageContent') || null; }

  /* ═══════════ 1) نرمال‌ساز آرایه + تعمیر سراسری DB ═══════════ */
  var NEST = ['items', 'rows', 'data', 'list', 'records', 'entries', 'results', 'values', 'docs'];
  function zvArr(v, depth) {
    depth = depth || 0;
    if (Array.isArray(v)) return v;
    if (v == null || v === '' || typeof v === 'number' || typeof v === 'boolean') return [];
    if (typeof v === 'string') {
      var t = v.trim();
      if (t.charAt(0) === '[' || t.charAt(0) === '{') { try { return zvArr(JSON.parse(t), depth + 1); } catch (e) { return []; } }
      return [];
    }
    if (typeof v === 'object' && depth < 4) {
      var i, k;
      for (i = 0; i < NEST.length; i++) { k = NEST[i]; if (Array.isArray(v[k])) return v[k]; }
      for (i = 0; i < NEST.length; i++) { k = NEST[i]; if (v[k] && typeof v[k] === 'object') { var r = zvArr(v[k], depth + 1); if (r.length) return r; } }
      var keys = Object.keys(v), vals = keys.map(function (x) { return v[x]; });
      if (vals.length && vals.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })) return vals;
      return [];
    }
    return [];
  }
  window.zvArr = zvArr;

  var PRESERVE = { settings: 1, rules: 1, views: 1, nextIds: 1, messageStats: 1, meta: 1, user: 1, stats: 1, totals: 1, permissions: 1, health: 1 };
  var COLLECTIONS = ('orders cards cardHistory customers employees workers bnms branchManagers branches groups members groupMembers ' +
    'services sides questions offers redemptions tasks logs applicants support threads adminSupport levels notifications ' +
    'contracts contractCapacity capacity contractUsage usage projects projectTasks milestones finance financeEntries ledger ' +
    'investments equity equityHolders holders targets kpiTargets notes decisions devRequests developmentRequests').split(' ');

  var REPAIR = [];
  function repairDB() {
    var db = G('DB');
    if (!db || typeof db !== 'object') return;
    REPAIR = [];
    Object.keys(db).forEach(function (k) {
      if (PRESERVE[k]) return;
      var v = db[k];
      if (Array.isArray(v)) return;
      var isCol = COLLECTIONS.indexOf(k) >= 0;
      var looksCol = v && typeof v === 'object' && NEST.some(function (n) { return Array.isArray(v[n]); });
      if (!isCol && !looksCol) return;
      var arr = zvArr(v);
      db[k] = arr;
      REPAIR.push({ key: k, was: (v === null ? 'null' : typeof v), n: arr.length });
    });
    COLLECTIONS.forEach(function (k) { if (!(k in db)) db[k] = []; });
  }

  /* ═══════════ 2) ابزارها ═══════════ */
  function esc(v) { var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return m[c]; }); }
  function fa(v) { return String(v == null ? '' : v).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function en(v) { return String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }).replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }); }
  function num(v) { var n = Number(en(v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; }
  function grp(n) { return Math.round(num(n)).toLocaleString('en-US'); }
  function moneyC(n) {
    n = num(n); var a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e9) return s + fa((a / 1e9).toFixed(1)) + ' میلیارد';
    if (a >= 1e6) return s + fa((a / 1e6).toFixed(1)) + ' میلیون';
    if (a >= 1e3) return s + fa(Math.round(a / 1e3)) + ' هزار';
    return s + fa(Math.round(a));
  }
  function unitDiv() { return S.ctrl.unit === 'تومان' ? 10 : S.ctrl.unit === 'میلیون ریال' ? 1e6 : 1; }
  function unitName() { return S.ctrl.unit === 'میلیون ریال' ? 'م.ریال' : S.ctrl.unit; }
  function amt(n) {
    var d = unitDiv(), v = num(n) / d;
    if (d === 1e6) return fa(v.toFixed(1));
    return fa(grp(v));
  }
  function pct(n) { return fa((num(n)).toFixed(1)) + '٪'; }

  /* ── تقویم شمسی ── */
  function g2j(gy, gm, gd) {
    var leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
    var gdm = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd;
    for (var i = 1; i < gm; i++) days += gdm[i];
    var jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + days % 31; }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + (days - 186) % 30; }
    return [jy, jm, jd];
  }
  function j2g(jy, jm, jd) {
    jy += 1595;
    var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    var gy = 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var gd = days + 1, leap = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
    var ms = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], gm = 1;
    while (gm <= 12 && gd > ms[gm]) { gd -= ms[gm]; gm++; }
    return [gy, gm, gd];
  }
  function jLeap(y) { var g = j2g(y, 12, 30), j = g2j(g[0], g[1], g[2]); return j[0] === y && j[1] === 12 && j[2] === 30; }
  function jDays(y, m) { return m <= 6 ? 31 : (m <= 11 ? 30 : (jLeap(y) ? 30 : 29)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function parseJ(s) {
    var m = en(s).trim().replace(/[.\-]/g, '/').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1300 || y > 1500 || mo < 1 || mo > 12 || d < 1 || d > jDays(y, mo)) return null;
    return [y, mo, d];
  }
  function jStore(s) { var p = parseJ(s); if (!p) return ''; var g = j2g(p[0], p[1], p[2]); return g[0] + '-' + pad(g[1]) + '-' + pad(g[2]); }
  function gKey(v) { var d = v instanceof Date ? v : new Date(v); if (isNaN(d.getTime())) return ''; return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function jDisp(v) { if (!v) return '—'; var d = new Date(v); if (isNaN(d.getTime())) return esc(v); var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate()); return fa(j[0] + '/' + pad(j[1]) + '/' + pad(j[2])); }
  function jInput(v) { if (!v) return ''; var d = new Date(v); if (isNaN(d.getTime())) return ''; var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate()); return j[0] + '/' + pad(j[1]) + '/' + pad(j[2]); }
  var JM = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  function jMonthKey(v) { var d = new Date(v); if (isNaN(d.getTime())) return ''; var j = g2j(d.getFullYear(), d.getMonth() + 1, 1); return j[0] + '-' + pad(j[1]); }
  function today() { return gKey(new Date()); }
  function shiftDays(k, n) { var d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return gKey(d); }
  function daySpan(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }

  /* ═══════════ 3) شناسایی صفحه و کلید داده ═══════════ */
  var PAGE_ID = (function () {
    var menu = G('MENU') || [];
    for (var i = 0; i < menu.length; i++) {
      var l = String(menu[i] && (menu[i].l || menu[i].label || ''));
      if (/دفتر\s*مالی/.test(l) && menu[i].id) return menu[i].id;
    }
    return 'finance';
  })();
  var ALIAS = {}; ALIAS[PAGE_ID] = 1; ALIAS.finance = 1; ALIAS.ledger = 1; ALIAS.financeEntries = 1;
  function dataKey() {
    var db = G('DB') || {};
    var c = ['finance', 'financeEntries', 'ledger', 'finEntries', 'financeLedger'];
    for (var i = 0; i < c.length; i++) if (Array.isArray(db[c[i]]) && db[c[i]].length) return c[i];
    for (var j = 0; j < c.length; j++) if (c[j] in db) return c[j];
    return 'finance';
  }
  function isFinanceActive() { var ps = G('PS'); return !!(ps && ALIAS[ps.page]); }

  /* ═══════════ 4) وضعیت و ذخیره‌سازی ═══════════ */
  var LSK = 'zv_mgr_finance_v1';
  var TYPES = ['درآمد', 'هزینه'];
  var CATS = {
    'درآمد': ['فروش خدمت', 'قرارداد', 'ظرفیت قرارداد', 'سرمایه‌گذاری', 'فروش دارایی', 'سایر درآمد'],
    'هزینه': ['حقوق و دستمزد', 'اجاره', 'حمل و نقل', 'مواد و مصرفی', 'بازاریابی', 'تجهیزات', 'اداری', 'مالیات و عوارض', 'سایر هزینه']
  };
  var NATURES = ['ثابت', 'متغیر', 'سرمایه‌ای'];
  var STATUSES = ['پرداخت شده', 'در انتظار', 'معوق', 'لغو شده'];
  var METHODS = ['نقد', 'کارت', 'انتقال', 'چک'];
  var REFTYPES = ['دستی', 'سفارش', 'قرارداد', 'پروژه', 'حقوق'];
  var AUTO_NATURE = { 'حقوق و دستمزد': 'ثابت', 'اجاره': 'ثابت', 'اداری': 'ثابت', 'مالیات و عوارض': 'ثابت', 'حمل و نقل': 'متغیر', 'مواد و مصرفی': 'متغیر', 'بازاریابی': 'متغیر', 'تجهیزات': 'سرمایه‌ای', 'سایر هزینه': 'متغیر' };
  var HUE = { inc: '#FF6B1A', exp: '#E02D3C', net: '#0FA3A3', cap: '#7C4DFF', due: '#2E63E7', tax: '#D97706', ok: '#0E9F6E', mut: '#64748B', pink: '#E0447C' };
  var PAL = [HUE.inc, HUE.due, HUE.net, HUE.cap, HUE.pink, HUE.tax, HUE.ok, HUE.mut];

  var S = {
    q: '', f: { type: '', cat: '', status: '', branch: '', method: '' },
    sort: 'date_desc', pn: 1, sel: {},
    ctrl: { period: '180', from: '', to: '', unit: 'ریال', chart: 'bar', group: 'cat', cols: 'full', dense: false, tax: true, per: 12 },
    views: [], mode: 'local', seeded: false, backend: null, lastDeleted: null
  };

  function persist() {
    try {
      localStorage.setItem(LSK, JSON.stringify({ rows: ROWS, views: S.views, ctrl: S.ctrl, seeded: S.seeded, mode: S.mode }));
    } catch (e) {}
  }
  function restore() {
    try {
      var o = JSON.parse(localStorage.getItem(LSK) || '{}');
      if (Array.isArray(o.rows)) ROWS = o.rows;
      if (Array.isArray(o.views)) S.views = o.views;
      if (o.ctrl) Object.keys(S.ctrl).forEach(function (k) { if (o.ctrl[k] !== undefined) S.ctrl[k] = o.ctrl[k]; });
      S.seeded = !!o.seeded;
    } catch (e) {}
  }

  var ROWS = [];
  function nextId() {
    var mx = 0;
    ROWS.forEach(function (r) { var m = String(r.id || '').match(/FIN-(\d+)/); if (m) mx = Math.max(mx, +m[1]); });
    return 'FIN-' + String(mx + 1).padStart(6, '0');
  }
  function branches() {
    var b = zvArr((G('DB') || {}).branches);
    if (b.length) return b.map(function (x) { return { id: x.branchId || x.id, name: x.name || x.branchId }; });
    return [{ id: 'BR-001', name: 'شعبه مرکزی تهران' }, { id: 'BR-002', name: 'شعبه اصفهان' }, { id: 'BR-003', name: 'شعبه مشهد' }];
  }
  function branchName(id) { var b = branches().filter(function (x) { return x.id === id; })[0]; return b ? b.name : (id || '—'); }

  /* ── دادهٔ نمونهٔ باورپذیر ── */
  function seed() {
    var rs = 20261116;
    function rnd() { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    var bs = branches().map(function (b) { return b.id; });
    var incTitles = ['تسویه سفارش نظافت مجتمع مسکونی', 'قرارداد خدمات ماهانه شرکت آرمان', 'مصرف ظرفیت قرارداد پیمانکاری', 'سود سهام صندوق درآمد ثابت', 'فروش تجهیزات مازاد انبار', 'پیش‌دریافت پروژه راه‌اندازی شعبه'];
    var expTitles = { 'حقوق و دستمزد': 'حقوق آبان نیروهای عملیاتی', 'اجاره': 'اجاره دفتر مرکزی', 'حمل و نقل': 'هزینه سوخت و ایاب‌وذهاب ناوگان', 'مواد و مصرفی': 'خرید مواد شوینده و مصرفی', 'بازاریابی': 'کمپین تبلیغات محلی دیوار', 'تجهیزات': 'خرید جاروبرقی صنعتی', 'اداری': 'قبوض آب و برق و اینترنت', 'مالیات و عوارض': 'مالیات بر ارزش افزوده فصل پاییز', 'سایر هزینه': 'هزینه تعمیر و نگهداری' };
    var out = [], base = today();
    for (var i = 0; i < 30; i++) {
      var isInc = i % 3 !== 2;
      var type = isInc ? 'درآمد' : 'هزینه';
      var cat = isInc ? pick(CATS['درآمد']) : pick(CATS['هزینه']);
      var d = shiftDays(base, -Math.floor(rnd() * 175));
      var amount = isInc ? (18 + Math.floor(rnd() * 160)) * 1e6 : (4 + Math.floor(rnd() * 70)) * 1e6;
      if (cat === 'حقوق و دستمزد') amount = (320 + Math.floor(rnd() * 90)) * 1e6;
      if (cat === 'اجاره') amount = 180e6;
      var st = rnd() < .74 ? 'پرداخت شده' : (rnd() < .55 ? 'در انتظار' : 'معوق');
      out.push({
        id: 'FIN-' + String(i + 1).padStart(6, '0'),
        date: d, type: type, nature: isInc ? '' : (AUTO_NATURE[cat] || 'متغیر'), cat: cat,
        title: isInc ? pick(incTitles) : expTitles[cat],
        amount: amount, tax: isInc ? Math.round(amount * 0.09) : 0,
        status: st, method: pick(METHODS), branchId: pick(bs),
        party: isInc ? 'مشتری ' + fa(1000 + i) : 'تأمین‌کننده ' + fa(200 + i),
        refType: isInc ? pick(['سفارش', 'قرارداد', 'دستی']) : 'دستی',
        refId: isInc ? 'ZV-' + fa(40000 + i) : '',
        note: '', order: i, createdAt: d + 'T09:00:00.000Z', updatedAt: d + 'T09:00:00.000Z', demo: true
      });
    }
    out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    out.forEach(function (r, i) { r.order = i; });
    return out;
  }

  function syncFromDB() {
    repairDB();
    var db = G('DB') || {}, k = dataKey();
    var srv = zvArr(db[k]);
    if (srv.length) {
      ROWS = srv.map(function (r, i) { return normalizeRow(r, i); });
      S.seeded = ROWS.every(function (r) { return r.demo; });
      S.mode = 'server';
    } else if (!ROWS.length) {
      restore();
      if (!ROWS.length) { ROWS = seed(); S.seeded = true; S.mode = 'local'; persist(); }
    }
    if (db[k] !== ROWS) { try { db[k] = ROWS; } catch (e) {} }
    restoreViewsOnly();
  }
  function restoreViewsOnly() {
    try { var o = JSON.parse(localStorage.getItem(LSK) || '{}'); if (Array.isArray(o.views) && o.views.length) S.views = o.views; } catch (e) {}
  }
  function normalizeRow(r, i) {
    r = r || {};
    var type = r.type || (num(r.amount) < 0 ? 'هزینه' : 'درآمد');
    if (TYPES.indexOf(type) < 0) type = /درآمد|income|revenue/i.test(String(r.kind || r.type || '')) ? 'درآمد' : 'هزینه';
    var cat = r.cat || r.category || (type === 'درآمد' ? 'فروش خدمت' : 'سایر هزینه');
    var d = r.date || r.entryDate || r.createdAt || today();
    var dk = /^\d{4}-\d{2}-\d{2}/.test(String(d)) ? String(d).slice(0, 10) : (parseJ(d) ? jStore(d) : gKey(d) || today());
    return {
      id: r.id || r.entryId || r.financeId || ('FIN-' + String(i + 1).padStart(6, '0')),
      date: dk, type: type,
      nature: type === 'هزینه' ? (r.nature || AUTO_NATURE[cat] || 'متغیر') : '',
      cat: cat, title: r.title || r.desc || r.description || 'تراکنش بدون شرح',
      amount: Math.abs(num(r.amount)), tax: num(r.tax),
      status: STATUSES.indexOf(r.status) >= 0 ? r.status : 'پرداخت شده',
      method: METHODS.indexOf(r.method) >= 0 ? r.method : 'انتقال',
      branchId: r.branchId || '', party: r.party || r.counterparty || '',
      refType: REFTYPES.indexOf(r.refType) >= 0 ? r.refType : 'دستی', refId: r.refId || '',
      note: r.note || r.notes || '', order: r.order == null ? i : num(r.order),
      createdAt: r.createdAt || dk, updatedAt: r.updatedAt || dk, demo: !!r.demo
    };
  }

  /* ═══════════ 5) سبک بصری ═══════════ */
  var CSS = [
    '#zvfRoot{--zi:', HUE.inc, ';--ze:', HUE.exp, ';--zn:', HUE.net, ';--zc:', HUE.cap, ';--zd:', HUE.due, ';--zt:', HUE.tax, ';--zk:', HUE.ok, ';--zm:', HUE.mut, ';',
    '--surf:var(--surface,#fff);--surf2:var(--surface2,#F6F8FD);--ink:var(--ink,#101A33);--mut:var(--muted,#5C6784);--ln:var(--line,#E2E7F3);--ln2:var(--line2,#D3DAEC);--br:var(--brand,#FF6B1A);',
    'color:var(--ink);font-family:Vazirmatn,Tahoma,sans-serif;font-size:13px;line-height:1.85}',
    '#zvfRoot *{box-sizing:border-box}',
    '#zvfRoot ::-webkit-scrollbar,.zvfOv ::-webkit-scrollbar{width:10px;height:10px}',
    '#zvfRoot ::-webkit-scrollbar-track,.zvfOv ::-webkit-scrollbar-track{background:color-mix(in srgb,var(--surf2,#F6F8FD) 80%,transparent);border-radius:9px}',
    '#zvfRoot ::-webkit-scrollbar-thumb,.zvfOv ::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#FF8A3D,#E4570B);border-radius:9px;border:2px solid var(--surf,#fff)}',
    '#zvfRoot ::-webkit-scrollbar-thumb:hover,.zvfOv ::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#FFB25E,#FF6B1A)}',
    '.zvfHero{position:relative;overflow:hidden;border-radius:20px;padding:24px 26px;color:#fff;margin-bottom:14px;',
    'background:radial-gradient(720px 300px at 92% -20%,rgba(255,107,26,.42),transparent 62%),radial-gradient(520px 260px at 4% 120%,rgba(15,163,163,.38),transparent 62%),linear-gradient(120deg,#0B1736,#16295B 44%,#3B2E7E 78%,#0E2E4A 120%)}',
    '.zvfHero:after{content:"";position:absolute;inset:0;opacity:.15;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.9) 1px,transparent 1px);background-size:22px 22px}',
    '.zvfHero>*{position:relative;z-index:1}',
    '.zvfHeroTop{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}',
    '.zvfHero h2{font-size:14px;font-weight:800;color:#C9D4F2;margin:0 0 4px}',
    '.zvfBig{font-size:34px;font-weight:900;line-height:1.35;font-variant-numeric:tabular-nums;letter-spacing:-.5px}',
    '.zvfBig small{font-size:14px;font-weight:800;color:#C9D4F2;margin-right:6px}',
    '.zvfHeroSide{margin-right:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '.zvfChip{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:20px;font-size:11px;font-weight:800;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);color:#fff}',
    '.zvfChip i{width:7px;height:7px;border-radius:50%;background:currentColor}',
    '.zvfChip.ok{background:rgba(14,159,110,.24);border-color:rgba(14,159,110,.5);color:#9CF3D0}',
    '.zvfChip.warn{background:rgba(217,119,6,.24);border-color:rgba(217,119,6,.5);color:#FFD79E}',
    '.zvfHeroSpark{margin-top:12px;height:44px}',
    '.zvfRail{position:sticky;top:64px;z-index:20;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:11px 13px;border-radius:15px;margin-bottom:14px;',
    'background:color-mix(in srgb,var(--surf) 90%,transparent);backdrop-filter:blur(14px);border:1px solid var(--ln);box-shadow:0 6px 22px rgba(11,23,54,.07)}',
    '.zvfF{display:flex;flex-direction:column;gap:3px;min-width:0}',
    '.zvfF>span{font-size:9.5px;font-weight:800;color:var(--mut);padding-right:2px}',
    '.zvfSel,.zvfInp{min-height:34px;padding:6px 10px;border:1px solid var(--ln2);border-radius:9px;background:var(--surf2);color:var(--ink);font:inherit;font-size:11.5px;font-weight:700;outline:none;transition:border-color .16s,box-shadow .16s}',
    '.zvfSel{cursor:pointer;min-width:104px}',
    '.zvfSel:focus,.zvfInp:focus{border-color:var(--br);box-shadow:0 0 0 3px rgba(255,107,26,.14)}',
    '.zvfTg{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 11px;border-radius:9px;border:1px solid var(--ln2);background:var(--surf2);color:var(--mut);font-size:11px;font-weight:800;cursor:pointer;transition:all .16s}',
    '.zvfTg i{width:22px;height:13px;border-radius:8px;background:var(--ln2);position:relative;flex:0 0 22px;transition:background .16s}',
    '.zvfTg i:after{content:"";position:absolute;top:2px;right:2px;width:9px;height:9px;border-radius:50%;background:var(--mut);transition:all .16s}',
    '.zvfTg.on{border-color:var(--br);color:#E4570B;background:rgba(255,107,26,.1)}',
    '.zvfTg.on i{background:rgba(255,107,26,.45)}.zvfTg.on i:after{right:11px;background:var(--br)}',
    '.zvfBtn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:7px 14px;border-radius:10px;border:1px solid transparent;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer;transition:all .16s;white-space:nowrap}',
    '.zvfBtn:hover{transform:translateY(-1px)}.zvfBtn:active{transform:none}.zvfBtn:disabled{opacity:.5;cursor:not-allowed;transform:none}',
    '.zvfBtn.p{background:linear-gradient(135deg,#FF6B1A,#FF8A3D 55%,#FFB25E);color:#fff;box-shadow:0 6px 18px rgba(255,107,26,.34)}',
    '.zvfBtn.s{background:var(--surf2);border-color:var(--ln);color:var(--ink)}.zvfBtn.s:hover{border-color:var(--br);color:#E4570B}',
    '.zvfBtn.d{background:rgba(224,45,60,.12);color:#E02D3C;border-color:rgba(224,45,60,.28)}',
    '.zvfBtn.i{width:31px;min-height:31px;padding:0;border-radius:8px}',
    '.zvfRailSep{width:1px;align-self:stretch;background:var(--ln);margin:0 3px}',
    '.zvfKpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:11px;margin-bottom:14px}',
    '.zvfK{position:relative;overflow:hidden;background:var(--surf);border:1px solid var(--ln);border-radius:15px;padding:13px 14px;box-shadow:0 4px 16px rgba(11,23,54,.05);transition:transform .18s,box-shadow .18s}',
    '.zvfK:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(11,23,54,.11)}',
    '.zvfK:before{content:"";position:absolute;top:0;right:0;left:0;height:3px;background:var(--c)}',
    '.zvfK .kl{font-size:10.5px;color:var(--mut);font-weight:800;display:flex;align-items:center;gap:6px}',
    '.zvfK .kl b{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 15%,transparent);color:var(--c);font-size:11px}',
    '.zvfK .kv{font-size:21px;font-weight:900;font-variant-numeric:tabular-nums;margin-top:5px;color:var(--c)}',
    '.zvfK .ku{font-size:10px;color:var(--mut);font-weight:700}',
    '.zvfK .kd{position:absolute;top:12px;left:12px;font-size:10px;font-weight:900;padding:2px 8px;border-radius:12px}',
    '.zvfK .kd.up{background:rgba(14,159,110,.13);color:#0E9F6E}.zvfK .kd.dn{background:rgba(224,45,60,.12);color:#E02D3C}',
    '.zvfK svg{display:block;width:100%;height:26px;margin-top:6px;opacity:.85}',
    '.zvfCharts{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;margin-bottom:14px}',
    '.zvfCbox{background:var(--surf);border:1px solid var(--ln);border-radius:16px;padding:15px 16px;box-shadow:0 4px 16px rgba(11,23,54,.05)}',
    '.zvfCbox h3{margin:0 0 10px;font-size:12.5px;font-weight:900;display:flex;align-items:center;gap:8px}',
    '.zvfCbox h3 em{margin-right:auto;font-style:normal;font-size:10.5px;color:var(--mut);font-weight:700}',
    '.zvfLeg{display:flex;gap:12px;flex-wrap:wrap;margin-top:9px;font-size:10.5px;font-weight:800;color:var(--mut)}',
    '.zvfLeg span{display:inline-flex;align-items:center;gap:5px}',
    '.zvfLeg i{width:10px;height:10px;border-radius:3px}',
    '.zvfSvg{width:100%;height:auto;display:block;overflow:visible}',
    '.zvfBar{transform-box:fill-box;transform-origin:bottom;animation:zvfGrow .55s cubic-bezier(.2,.8,.3,1) both}',
    '.zvfHBar{transform-box:fill-box;transform-origin:right;animation:zvfGrowX .55s cubic-bezier(.2,.8,.3,1) both}',
    '.zvfLine{stroke-dasharray:2200;stroke-dashoffset:2200;animation:zvfDraw 1.1s cubic-bezier(.3,.9,.3,1) .18s forwards}',
    '.zvfArea{opacity:0;animation:zvfFade .6s ease .5s forwards}',
    '@keyframes zvfGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
    '@keyframes zvfGrowX{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
    '@keyframes zvfDraw{to{stroke-dashoffset:0}}@keyframes zvfFade{to{opacity:1}}',
    '.zvfViews{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:11px}',
    '.zvfVChip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:20px;background:var(--surf2);border:1px solid var(--ln);font-size:11px;font-weight:800;cursor:pointer;color:var(--ink)}',
    '.zvfVChip:hover{border-color:var(--br);color:#E4570B}',
    '.zvfVChip b{cursor:pointer;color:var(--mut);font-weight:900}.zvfVChip b:hover{color:#E02D3C}',
    '.zvfSearch{position:relative;flex:1;min-width:200px;max-width:330px}',
    '.zvfSearch input{width:100%;padding-right:32px}',
    '.zvfSearch svg{position:absolute;right:9px;top:9px;width:15px;height:15px;color:var(--mut);pointer-events:none}',
    '.zvfBulk{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:9px 13px;border-radius:12px;margin-bottom:11px;font-size:11.5px;font-weight:700;',
    'background:linear-gradient(90deg,rgba(255,107,26,.12),rgba(124,77,255,.08));border:1px solid rgba(255,107,26,.3)}',
    '.zvfTw{overflow:auto;border:1px solid var(--ln);border-radius:15px;background:var(--surf)}',
    '.zvfT{width:100%;border-collapse:collapse;font-size:12px;min-width:940px}',
    '.zvfT th{position:sticky;top:0;z-index:2;background:var(--surf2);color:var(--mut);font-size:10.5px;font-weight:900;text-align:right;padding:10px 11px;border-bottom:1px solid var(--ln);white-space:nowrap;cursor:pointer;user-select:none}',
    '.zvfT th:hover{color:#E4570B}',
    '.zvfT td{padding:9px 11px;border-bottom:1px solid var(--ln);vertical-align:middle;white-space:nowrap}',
    '.zvfT.dense td{padding:5px 11px;font-size:11.5px}',
    '.zvfT tbody tr{transition:background .14s}',
    '.zvfT tbody tr:hover{background:color-mix(in srgb,var(--br) 5%,transparent)}',
    '.zvfT tbody tr.sel{background:color-mix(in srgb,var(--br) 9%,transparent)}',
    '.zvfT tbody tr.drag{opacity:.4}',
    '.zvfT tbody tr.over td{border-top:2px solid var(--br)}',
    '.zvfT tbody tr:last-child td{border-bottom:0}',
    '.zvfId{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:var(--mut);direction:ltr}',
    '.zvfTitle{font-weight:800;color:var(--ink);max-width:270px;overflow:hidden;text-overflow:ellipsis;display:block}',
    '.zvfSub{font-size:10px;color:var(--mut)}',
    '.zvfNum{font-variant-numeric:tabular-nums;font-weight:900}',
    '.zvfPill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:800;white-space:nowrap}',
    '.zvfPill:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}',
    '.zvfRa{display:flex;gap:4px;justify-content:flex-end}',
    '.zvfDrag{cursor:grab;color:var(--mut);font-size:14px;user-select:none}',
    '.zvfPager{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px 3px 0;font-size:11px;color:var(--mut);font-weight:700}',
    '.zvfEmpty{text-align:center;padding:46px 20px;color:var(--mut)}',
    '.zvfEmpty .ei{width:70px;height:70px;margin:0 auto 13px;border-radius:21px;display:grid;place-items:center;font-size:26px;background:linear-gradient(135deg,rgba(255,107,26,.16),rgba(124,77,255,.13));color:var(--br)}',
    '.zvfEmpty h4{color:var(--ink);font-size:14px;margin:0 0 5px}',
    '.zvfOv{position:fixed;inset:0;z-index:300;display:none;font-family:Vazirmatn,Tahoma,sans-serif}',
    '.zvfOv.show{display:block}',
    '.zvfScrim{position:absolute;inset:0;background:rgba(7,13,31,.6);backdrop-filter:blur(5px);animation:zvfFade .2s ease both;opacity:1}',
    '.zvfModal{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(760px,calc(100vw - 24px));max-height:92vh;display:flex;flex-direction:column;',
    'background:var(--surface,#fff);color:var(--ink,#101A33);border:1px solid var(--line,#E2E7F3);border-radius:20px;box-shadow:0 30px 70px rgba(3,7,20,.5);overflow:hidden;animation:zvfPop .24s cubic-bezier(.2,.9,.3,1) both}',
    '@keyframes zvfPop{from{opacity:0;transform:translate(-50%,-46%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
    '.zvfDrawer{position:absolute;top:0;left:0;height:100%;width:min(520px,100vw);display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#101A33);',
    'border-right:1px solid var(--line,#E2E7F3);box-shadow:0 0 60px rgba(3,7,20,.45);animation:zvfSlide .26s cubic-bezier(.3,.9,.3,1) both}',
    '@keyframes zvfSlide{from{transform:translateX(-102%)}to{transform:none}}',
    '.zvfOh{display:flex;align-items:center;gap:10px;padding:15px 19px;border-bottom:1px solid var(--line,#E2E7F3);flex:0 0 auto}',
    '.zvfOh h3{margin:0;font-size:14.5px;font-weight:900;flex:1}',
    '.zvfOb{padding:17px 19px;overflow-y:auto;flex:1 1 auto;min-height:0}',
    '.zvfOf{padding:12px 19px;border-top:1px solid var(--line,#E2E7F3);display:flex;gap:8px;flex-wrap:wrap;align-items:center;flex:0 0 auto}',
    '.zvfGrid{display:grid;grid-template-columns:1fr 1fr;gap:11px}',
    '.zvfGrid .full{grid-column:1/-1}',
    '.zvfFld{display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.zvfFld label{font-size:11px;font-weight:800;color:var(--muted,#5C6784)}',
    '.zvfFld .req{color:#E02D3C}',
    '.zvfFld input,.zvfFld select,.zvfFld textarea{min-height:38px;padding:8px 11px;border:1px solid var(--line,#E2E7F3);border-radius:10px;background:var(--surface2,#F6F8FD);color:inherit;font:inherit;font-size:12.5px;width:100%;outline:none;transition:border-color .16s,box-shadow .16s}',
    '.zvfFld textarea{min-height:70px;resize:vertical}',
    '.zvfFld input:focus,.zvfFld select:focus,.zvfFld textarea:focus{border-color:#FF6B1A;box-shadow:0 0 0 3px rgba(255,107,26,.14)}',
    '.zvfHint{font-size:10.5px;color:var(--muted,#5C6784)}',
    '.zvfSeg{display:flex;gap:6px}',
    '.zvfSeg button{flex:1;min-height:38px;border-radius:10px;border:1px solid var(--line,#E2E7F3);background:var(--surface2,#F6F8FD);color:inherit;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:all .16s}',
    '.zvfSeg button.on{color:#fff;border-color:transparent}',
    '.zvfSeg button.on[data-v="درآمد"]{background:linear-gradient(135deg,#FF6B1A,#FF8A3D)}',
    '.zvfSeg button.on[data-v="هزینه"]{background:linear-gradient(135deg,#E02D3C,#F2606C)}',
    '.zvfKv{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
    '.zvfKv .it{background:var(--surface2,#F6F8FD);border:1px solid var(--line,#E2E7F3);border-radius:11px;padding:9px 11px;min-width:0}',
    '.zvfKv .it.full{grid-column:1/-1}',
    '.zvfKv small{display:block;font-size:10px;color:var(--muted,#5C6784);font-weight:700}',
    '.zvfKv b{font-size:12.5px;font-weight:800;word-break:break-word}',
    '.zvfSecT{font-size:11.5px;font-weight:900;color:#E4570B;margin:15px 0 9px}',
    '.zvfAmtPreview{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:rgba(255,107,26,.09);border:1px solid rgba(255,107,26,.28);font-size:11.5px;font-weight:800}',
    '.zvfCal{position:fixed;z-index:400;display:none;width:min(310px,calc(100vw - 24px));background:var(--surface,#fff);color:var(--ink,#101A33);border:1px solid var(--line,#E2E7F3);border-radius:14px;padding:11px;box-shadow:0 20px 50px rgba(3,7,20,.35)}',
    '.zvfCal.show{display:block;animation:zvfPop2 .15s ease both}',
    '@keyframes zvfPop2{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}',
    '.zvfCalH{display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:12.5px;font-weight:900}',
    '.zvfCalH button{border:0;background:var(--surface2,#F6F8FD);color:inherit;border-radius:8px;padding:4px 9px;cursor:pointer;font:inherit;font-size:13px}',
    '.zvfCalH button:hover{background:#FF6B1A;color:#fff}',
    '.zvfCalH .yr{flex:1;text-align:center;cursor:pointer;border-radius:7px;padding:2px 6px}',
    '.zvfCalH .yr:hover{background:rgba(255,107,26,.14)}',
    '.zvfCalG{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}',
    '.zvfCalG button{border:0;border-radius:7px;padding:6px 0;background:var(--surface2,#F6F8FD);color:inherit;font:inherit;font-size:11.5px;cursor:pointer}',
    '.zvfCalG button:hover{background:rgba(255,107,26,.2)}',
    '.zvfCalG .dl{background:transparent;color:var(--muted,#5C6784);font-weight:800;cursor:default}',
    '.zvfCalG .td{outline:2px solid #FF6B1A;outline-offset:-2px}',
    '.zvfDateWrap{position:relative}',
    '.zvfDateWrap input{padding-left:40px!important;direction:ltr;text-align:right}',
    '.zvfDateBtn{position:absolute;left:5px;top:50%;transform:translateY(-50%);border:0;border-radius:8px;background:rgba(255,107,26,.14);color:#E4570B;padding:6px 8px;cursor:pointer;display:grid;place-items:center}',
    '#zvfToasts{position:fixed;bottom:18px;left:18px;z-index:500;display:flex;flex-direction:column-reverse;gap:9px;max-width:min(380px,92vw)}',
    '.zvfToast{display:flex;align-items:center;gap:10px;background:#0B1736;color:#fff;padding:11px 15px;border-radius:13px;font-size:12.5px;font-family:Vazirmatn,Tahoma,sans-serif;box-shadow:0 16px 40px rgba(3,7,20,.45);border-right:4px solid #2E63E7;animation:zvfTin .26s cubic-bezier(.2,.9,.3,1) both}',
    '@keyframes zvfTin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
    '.zvfToast.ok{border-right-color:#0E9F6E}.zvfToast.err{border-right-color:#E02D3C}.zvfToast.warn{border-right-color:#D97706}',
    '.zvfToast button{margin-right:auto;background:rgba(255,255,255,.16);border:0;color:#fff;font:inherit;font-weight:900;font-size:11.5px;padding:5px 12px;border-radius:8px;cursor:pointer}',
    '.zvfToast button:hover{background:rgba(255,255,255,.3)}',
    '.zvfNote{display:flex;gap:10px;align-items:flex-start;padding:10px 13px;border-radius:12px;font-size:11.5px;line-height:1.9;margin-bottom:12px;background:rgba(46,99,231,.09);border:1px solid rgba(46,99,231,.26);color:var(--ink)}',
    '.zvfNote.warn{background:rgba(217,119,6,.1);border-color:rgba(217,119,6,.3)}',
    '@media(max-width:1000px){.zvfCharts{grid-template-columns:1fr}.zvfRail{position:static}}',
    '@media(max-width:640px){.zvfGrid,.zvfKv{grid-template-columns:1fr}.zvfBig{font-size:26px}.zvfHero{padding:18px}.zvfSearch{max-width:none}.zvfDrawer{width:100vw}}',
    '@media(prefers-reduced-motion:reduce){#zvfRoot *,.zvfOv *,#zvfToasts *{animation:none!important;transition:none!important}.zvfLine{stroke-dashoffset:0}.zvfArea{opacity:1}}',
    '@media print{body>*{display:none!important}#printArea{display:block!important;font-family:Vazirmatn,Tahoma,sans-serif;color:#000}}'
  ].join('');
  var st = document.createElement('style'); st.id = 'zvfCss'; st.textContent = CSS; document.head.appendChild(st);

  /* ═══════════ 6) محاسبات ═══════════ */
  function range() {
    var c = S.ctrl, to = today(), from;
    if (c.period === 'custom') {
      from = c.from ? jStore(c.from) : ''; to = c.to ? jStore(c.to) : today();
      if (!from) from = shiftDays(to, -180);
      if (from > to) { var t = from; from = to; to = t; }
      return { from: from, to: to };
    }
    if (c.period === 'all') {
      var mn = today();
      ROWS.forEach(function (r) { if (r.date && r.date < mn) mn = r.date; });
      return { from: mn, to: today() };
    }
    return { from: shiftDays(to, -(num(c.period) || 180)), to: to };
  }
  function inRange(r, rg) { return r.date >= rg.from && r.date <= rg.to; }
  function filtered() {
    var rg = range(), q = en(S.q).trim().toLowerCase(), f = S.f;
    var out = ROWS.filter(function (r) {
      if (!inRange(r, rg)) return false;
      if (f.type && r.type !== f.type) return false;
      if (f.cat && r.cat !== f.cat) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.branch && r.branchId !== f.branch) return false;
      if (f.method && r.method !== f.method) return false;
      if (q) {
        var hay = en([r.id, r.title, r.cat, r.party, r.refId, r.note, r.branchId, branchName(r.branchId)].join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var s = S.sort;
    out.sort(function (a, b) {
      if (s === 'manual') return num(a.order) - num(b.order);
      if (s === 'amount_desc') return b.amount - a.amount;
      if (s === 'amount_asc') return a.amount - b.amount;
      if (s === 'date_asc') return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
    });
    return out;
  }
  function totals(rows) {
    var t = { inc: 0, fix: 0, vari: 0, cap: 0, tax: 0, due: 0, pend: 0, net: 0, margin: 0, cash: 0, n: rows.length };
    rows.forEach(function (r) {
      if (r.status === 'لغو شده') return;
      t.tax += num(r.tax);
      if (r.type === 'درآمد') {
        if (r.status === 'پرداخت شده') { t.inc += r.amount; t.cash += r.amount; }
        else if (r.status === 'معوق') t.due += r.amount;
        else t.pend += r.amount;
      } else {
        if (r.status === 'پرداخت شده') {
          if (r.nature === 'سرمایه‌ای') t.cap += r.amount;
          else if (r.nature === 'ثابت') t.fix += r.amount;
          else t.vari += r.amount;
          t.cash -= r.amount;
        } else if (r.status === 'معوق') t.due += r.amount;
        else t.pend += r.amount;
      }
    });
    t.net = t.inc - t.fix - t.vari;
    t.margin = t.inc ? (t.net / t.inc * 100) : 0;
    return t;
  }
  function buckets(rows) {
    var rg = range(), span = Math.max(1, daySpan(rg.from, rg.to)), weekly = span <= 45, map = {}, order = [];
    function keyOf(d) {
      if (weekly) { var i = Math.floor(daySpan(rg.from, d) / 7); return { k: 'w' + i, l: 'هفته ' + fa(i + 1) }; }
      var mk = jMonthKey(d); return { k: mk, l: JM[(+mk.slice(5, 7)) - 1] };
    }
    if (!weekly) {
      var cur = rg.from.slice(0, 7);
      var d0 = new Date(rg.from + 'T12:00:00');
      for (var i = 0; i < 24; i++) {
        var dd = new Date(d0.getFullYear(), d0.getMonth() + i, 1), mk = jMonthKey(dd);
        if (mk > jMonthKey(rg.to)) break;
        if (!map[mk]) { map[mk] = { k: mk, l: JM[(+mk.slice(5, 7)) - 1], inc: 0, exp: 0, net: 0 }; order.push(mk); }
      }
    }
    rows.forEach(function (r) {
      if (r.status === 'لغو شده' || r.status !== 'پرداخت شده') return;
      var kk = keyOf(r.date);
      if (!map[kk.k]) { map[kk.k] = { k: kk.k, l: kk.l, inc: 0, exp: 0, net: 0 }; order.push(kk.k); }
      var b = map[kk.k];
      if (r.type === 'درآمد') b.inc += r.amount;
      else if (r.nature !== 'سرمایه‌ای') b.exp += r.amount;
    });
    order.sort();
    return order.map(function (k) { var b = map[k]; b.net = b.inc - b.exp; return b; });
  }
  function groupBy(rows, dim) {
    var m = {};
    rows.forEach(function (r) {
      if (r.status === 'لغو شده') return;
      var k = dim === 'cat' ? r.cat : dim === 'branch' ? branchName(r.branchId) : dim === 'method' ? r.method : dim === 'status' ? r.status : r.type;
      m[k] = (m[k] || 0) + r.amount;
    });
    return Object.keys(m).map(function (k) { return { l: k, v: m[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
  }
  function prevTotals() {
    var rg = range(), span = Math.max(1, daySpan(rg.from, rg.to));
    var p = { from: shiftDays(rg.from, -span - 1), to: shiftDays(rg.from, -1) };
    return totals(ROWS.filter(function (r) { return inRange(r, p); }));
  }

  /* ═══════════ 7) نمودارهای SVG ═══════════ */
  function spark(vals, color) {
    vals = vals && vals.length ? vals : [0, 0];
    var w = 120, h = 26, n = Math.max(1, vals.length - 1);
    var mx = Math.max.apply(null, vals.concat([1])), mn = Math.min.apply(null, vals.concat([0]));
    var pts = vals.map(function (v, i) { return [(i / n) * w, h - 3 - ((v - mn) / ((mx - mn) || 1)) * (h - 7)]; });
    var line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polygon points="0,' + h + ' ' + line + ' ' + w + ',' + h + '" fill="' + color + '" opacity=".14"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function chartMain(bs) {
    var mode = S.ctrl.chart, W = 720, H = 250, PL = 54, PR = 12, PT = 16, PB = 34;
    var iw = W - PL - PR, ih = H - PT - PB;
    if (!bs.length) bs = [{ l: '—', inc: 0, exp: 0, net: 0 }];
    var maxV = 1;
    bs.forEach(function (b) { maxV = Math.max(maxV, mode === 'stack' ? b.inc + b.exp : Math.max(b.inc, b.exp), Math.abs(b.net)); });
    var top = maxV * 1.15, n = bs.length, step = iw / n;
    function y(v) { return PT + ih - (v / top) * ih; }
    var s = '<svg class="zvfSvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="روند درآمد و هزینه">';
    s += '<defs><linearGradient id="zvfNetG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + HUE.net + '" stop-opacity=".34"/><stop offset="1" stop-color="' + HUE.net + '" stop-opacity="0"/></linearGradient>';
    s += '<pattern id="zvfExpP" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" stroke-width="2.4" opacity=".38"/></pattern></defs>';
    for (var g = 0; g <= 4; g++) {
      var vv = top * g / 4, yy = y(vv);
      s += '<line x1="' + PL + ' y1="' + yy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + yy.toFixed(1) + '" stroke="currentColor" stroke-opacity=".1" stroke-width="1"/>';
      s += '<text x="' + (PL - 7) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity=".55" font-family="Vazirmatn">' + moneyC(vv / unitDiv()) + '</text>';
    }
    var netPts = [];
    bs.forEach(function (b, i) {
      var cx = PL + step * i + step / 2;
      netPts.push([cx, y(Math.max(0, b.net))]);
      if (mode === 'bar' || mode === 'stack') {
        var bw = Math.min(26, step * 0.3);
        if (mode === 'stack') {
          var h1 = (b.inc / top) * ih, h2 = (b.exp / top) * ih;
          s += '<rect class="zvfBar" x="' + (cx - bw / 2) + '" y="' + y(b.inc) + '" width="' + bw + '" height="' + Math.max(0, h1) + '" rx="4" fill="' + HUE.inc + '"><title>' + esc(b.l) + ' · درآمد ' + amt(b.inc) + '</title></rect>';
          s += '<rect class="zvfBar" x="' + (cx - bw / 2) + '" y="' + y(b.inc + b.exp) + '" width="' + bw + '" height="' + Math.max(0, h2) + '" rx="4" fill="' + HUE.exp + '"><title>' + esc(b.l) + ' · هزینه ' + amt(b.exp) + '</title></rect>';
          s += '<rect x="' + (cx - bw / 2) + '" y="' + y(b.inc + b.exp) + '" width="' + bw + '" height="' + Math.max(0, h2) + '" rx="4" fill="url(#zvfExpP)" pointer-events="none"/>';
        } else {
          s += '<rect class="zvfBar" x="' + (cx - bw - 2) + '" y="' + y(b.inc) + '" width="' + bw + '" height="' + Math.max(0, (b.inc / top) * ih) + '" rx="4" fill="' + HUE.inc + '"><title>' + esc(b.l) + ' · درآمد ' + amt(b.inc) + '</title></rect>';
          s += '<rect class="zvfBar" x="' + (cx + 2) + '" y="' + y(b.exp) + '" width="' + bw + '" height="' + Math.max(0, (b.exp / top) * ih) + '" rx="4" fill="' + HUE.exp + '"><title>' + esc(b.l) + ' · هزینه ' + amt(b.exp) + '</title></rect>';
          s += '<rect x="' + (cx + 2) + '" y="' + y(b.exp) + '" width="' + bw + '" height="' + Math.max(0, (b.exp / top) * ih) + '" rx="4" fill="url(#zvfExpP)" pointer-events="none"/>';
        }
        if (n <= 7) {
          s += '<text x="' + cx + '" y="' + (y(mode === 'stack' ? b.inc + b.exp : Math.max(b.inc, b.exp)) - 6) + '" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" fill-opacity=".7" font-family="Vazirmatn">' + moneyC((mode === 'stack' ? b.inc + b.exp : Math.max(b.inc, b.exp)) / unitDiv()) + '</text>';
        }
      }
      s += '<text x="' + cx + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" fill-opacity=".65" font-family="Vazirmatn">' + esc(b.l) + '</text>';
    });
    if (mode === 'line') {
      [['inc', HUE.inc], ['exp', HUE.exp]].forEach(function (p) {
        var pts = bs.map(function (b, i) { return [PL + step * i + step / 2, y(b[p[0]])]; });
        s += '<polyline class="zvfLine" points="' + pts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '" fill="none" stroke="' + p[1] + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
        pts.forEach(function (q, i) { s += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.4" fill="' + p[1] + '"><title>' + esc(bs[i].l) + ' ' + amt(bs[i][p[0]]) + '</title></circle>'; });
      });
    }
    if (mode !== 'stack') {
      var np = netPts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
      s += '<polygon class="zvfArea" points="' + PL + ',' + (PT + ih) + ' ' + np + ' ' + (W - PR) + ',' + (PT + ih) + '" fill="url(#zvfNetG)"/>';
      s += '<polyline class="zvfLine" points="' + np + '" fill="none" stroke="' + HUE.net + '" stroke-width="2.6" stroke-dasharray="6 4" stroke-linejoin="round"/>';
      netPts.forEach(function (q, i) { s += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.6" fill="' + HUE.net + '" stroke="#fff" stroke-width="1.4"><title>' + esc(bs[i].l) + ' · سود ' + amt(bs[i].net) + '</title></circle>'; });
    }
    s += '</svg>';
    return s;
  }
  function chartBreak(gs) {
    if (!gs.length) return '<div class="zvfEmpty" style="padding:26px"><p>داده‌ای برای گروه‌بندی نیست.</p></div>';
    var total = gs.reduce(function (a, b) { return a + b.v; }, 0) || 1;
    var W = 420, rowH = 34, H = gs.length * rowH + 8, LW = 118, BW = W - LW - 78;
    var s = '<svg class="zvfSvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="تفکیک بر اساس گروه">';
    s += '<defs>';
    for (var p = 0; p < 3; p++) s += '<pattern id="zvfp' + p + '" width="' + (5 + p * 2) + '" height="' + (5 + p * 2) + '" patternTransform="rotate(' + (45 + p * 30) + ')" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="' + (5 + p * 2) + '" stroke="#fff" stroke-width="2" opacity=".4"/></pattern>';
    s += '</defs>';
    gs.forEach(function (g, i) {
      var yy = i * rowH + 6, w = Math.max(2, (g.v / total) * BW * (total / (gs[0].v || 1)));
      w = Math.max(2, (g.v / (gs[0].v || 1)) * BW);
      var c = PAL[i % PAL.length];
      s += '<text x="' + (W - 4) + '" y="' + (yy + 15) + '" text-anchor="end" font-size="11" font-weight="700" fill="currentColor" font-family="Vazirmatn">' + esc(g.l.length > 16 ? g.l.slice(0, 15) + '…' : g.l) + '</text>';
      s += '<rect x="' + (W - LW - BW) + '" y="' + (yy + 4) + '" width="' + BW + '" height="15" rx="7.5" fill="currentColor" fill-opacity=".07"/>';
      s += '<rect class="zvfHBar" x="' + (W - LW - w) + '" y="' + (yy + 4) + '" width="' + w + '" height="15" rx="7.5" fill="' + c + '"><title>' + esc(g.l) + ' · ' + amt(g.v) + ' ' + unitName() + '</title></rect>';
      if (i < 3) s += '<rect x="' + (W - LW - w) + '" y="' + (yy + 4) + '" width="' + w + '" height="15" rx="7.5" fill="url(#zvfp' + i + ')" pointer-events="none"/>';
      s += '<text x="' + (W - LW - BW - 8) + '" y="' + (yy + 16) + '" text-anchor="end" font-size="10.5" font-weight="800" fill="' + c + '" font-family="Vazirmatn">' + moneyC(g.v / unitDiv()) + '</text>';
      s += '<text x="' + (W - LW - BW - 8) + '" y="' + (yy + 27) + '" text-anchor="end" font-size="9" fill="currentColor" fill-opacity=".5" font-family="Vazirmatn">' + fa((g.v / total * 100).toFixed(0)) + '٪</text>';
    });
    s += '</svg>';
    return s;
  }

  /* ═══════════ 8) رندر صفحه ═══════════ */
  function ico(n) {
    var m = {
      plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
      edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
      dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
      print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>', cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
      tool: '<path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7z"/>'
    };
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto">' + (m[n] || m.plus) + '</svg>';
  }
  function pill(text, color) { return '<span class="zvfPill" style="background:color-mix(in srgb,' + color + ' 14%,transparent);color:' + color + '">' + esc(text) + '</span>'; }
  function statusColor(s) { return s === 'پرداخت شده' ? HUE.ok : s === 'در انتظار' ? HUE.tax : s === 'معوق' ? HUE.exp : HUE.mut; }

  function sel(key, val, opts, label) {
    return '<label class="zvfF"><span>' + esc(label) + '</span><select class="zvfSel" data-zvf-ctrl="' + key + '">' +
      opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') +
      '</select></label>';
  }
  function fsel(key, val, opts, label) {
    return '<label class="zvfF"><span>' + esc(label) + '</span><select class="zvfSel" data-zvf-filter="' + key + '"><option value="">همه</option>' +
      opts.map(function (o) { var v = typeof o === 'string' ? o : o.id, l = typeof o === 'string' ? o : o.name; return '<option value="' + esc(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') +
      '</select></label>';
  }

  function render() {
    var box = pageBox(); if (!box) return;
    var focus = document.activeElement, fk = focus && focus.getAttribute && focus.getAttribute('data-zvf-key'), fs = null, fe = null;
    try { fs = focus.selectionStart; fe = focus.selectionEnd; } catch (e) {}

    syncFromDB();
    var rows = filtered(), t = totals(rows), pt = prevTotals(), bs = buckets(rows), gs = groupBy(rows, S.ctrl.group);
    var rg = range(), per = num(S.ctrl.per) || 12, pages = Math.max(1, Math.ceil(rows.length / per));
    S.pn = Math.min(Math.max(1, S.pn), pages);
    var page = rows.slice((S.pn - 1) * per, S.pn * per);
    var selN = Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).length;
    var ttl = (G('TITLES') || {})[PAGE_ID] || ['دفتر مالی', 'درآمد، هزینه و مطالبات'];
    var tb = $('#tbTitle'); if (tb) tb.textContent = ttl[0];
    var tc = $('#tbCrumb'); if (tc) tc.textContent = 'ZingoVingo · ' + ttl[1];

    var h = [];
    h.push('<div id="zvfRoot">');

    /* hero */
    var netColor = t.net >= 0 ? '#9CF3D0' : '#FFB4B4';
    h.push('<section class="zvfHero"><div class="zvfHeroTop"><div>',
      '<h2>سود خالص عملیاتی · ' + esc(jDisp(rg.from)) + ' تا ' + esc(jDisp(rg.to)) + '</h2>',
      '<div class="zvfBig" style="color:' + netColor + '">' + amt(t.net) + '<small>' + esc(unitName()) + '</small></div>',
      '<div style="font-size:11.5px;color:#C9D4F2;margin-top:2px">حاشیه سود ' + pct(t.margin) + ' · درآمد ' + amt(t.inc) + ' · هزینه عملیاتی ' + amt(t.fix + t.vari) + '</div>',
      '</div><div class="zvfHeroSide">',
      '<span class="zvfChip"><i></i>' + fa(rows.length) + ' تراکنش در بازه</span>',
      S.seeded ? '<span class="zvfChip warn"><i></i>داده نمونه</span>' : '',
      '<span class="zvfChip ' + (S.mode === 'server' ? 'ok' : 'warn') + '"><i></i>' + (S.mode === 'server' ? 'همگام با سرور' : 'ذخیره محلی') + '</span>',
      '<button class="zvfBtn p" data-zvf="new">' + ico('plus') + ' ثبت تراکنش</button>',
      '<button class="zvfBtn s" data-zvf="diag" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.24);color:#fff">' + ico('tool') + ' تشخیص</button>',
      '</div></div>',
      '<div class="zvfHeroSpark">' + spark(bs.map(function (b) { return b.net; }), '#9CF3D0') + '</div>',
      '</section>');

    /* rail */
    h.push('<div class="zvfRail">');
    h.push(sel('period', S.ctrl.period, [['30', '۳۰ روز'], ['90', '۹۰ روز'], ['180', '۶ ماه'], ['365', '۱۲ ماه'], ['all', 'همه'], ['custom', 'بازه دلخواه']], 'بازه'));
    if (S.ctrl.period === 'custom') {
      h.push('<label class="zvfF"><span>از</span><input class="zvfInp" style="width:112px" data-zvf-ctrl="from" data-zvf-key="from" value="' + esc(S.ctrl.from) + '" placeholder="۱۴۰۵/۰۱/۰۱"></label>');
      h.push('<label class="zvfF"><span>تا</span><input class="zvfInp" style="width:112px" data-zvf-ctrl="to" data-zvf-key="to" value="' + esc(S.ctrl.to) + '" placeholder="۱۴۰۵/۱۲/۲۹"></label>');
    }
    h.push(sel('unit', S.ctrl.unit, ['ریال', 'تومان', 'میلیون ریال'], 'واحد'));
    h.push(sel('chart', S.ctrl.chart, [['bar', 'ستونی'], ['line', 'خطی'], ['stack', 'انباشته']], 'نمودار'));
    h.push(sel('group', S.ctrl.group, [['cat', 'دسته'], ['branch', 'شعبه'], ['method', 'روش'], ['type', 'نوع'], ['status', 'وضعیت']], 'گروه‌بندی'));
    h.push(sel('sort', S.sort, [['date_desc', 'تاریخ ↓'], ['date_asc', 'تاریخ ↑'], ['amount_desc', 'مبلغ ↓'], ['amount_asc', 'مبلغ ↑'], ['manual', 'دستی (کشیدنی)']], 'مرتب‌سازی'), '');
    h.push(sel('cols', S.ctrl.cols, [['full', 'کامل'], ['brief', 'خلاصه']], 'ستون‌ها'));
    h.push(sel('per', S.ctrl.per, [[12, '۱۲'], [25, '۲۵'], [50, '۵۰'], [100, '۱۰۰']], 'در صفحه'));
    h.push('<label class="zvfF"><span>نمایش</span><span style="display:flex;gap:6px">',
      '<button class="zvfTg' + (S.ctrl.dense ? ' on' : '') + '" data-zvf-tg="dense"><i></i>فشرده</button>',
      '<button class="zvfTg' + (S.ctrl.tax ? ' on' : '') + '" data-zvf-tg="tax"><i></i>مالیات</button>',
      '</span></label>');
    h.push('<span class="zvfRailSep"></span>');
    h.push('<label class="zvfF"><span>&nbsp;</span><span style="display:flex;gap:6px">',
      '<button class="zvfBtn s" data-zvf="reset">' + ico('undo') + ' بازنشانی</button>',
      '<button class="zvfBtn s" data-zvf="csv">' + ico('dl') + ' CSV</button>',
      '<button class="zvfBtn s" data-zvf="print">' + ico('print') + ' چاپ</button>',
      '</span></label>');
    h.push('</div>');

    /* kpis */
    function delta(cur, prev) { if (!prev) return ''; var d = Math.round((cur - prev) / Math.abs(prev) * 100); return '<span class="kd ' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '▲' : '▼') + ' ' + fa(Math.abs(d)) + '٪</span>'; }
    var kp = [
      ['درآمد تحقق‌یافته', t.inc, HUE.inc, 'د', bs.map(function (b) { return b.inc; }), delta(t.inc, pt.inc)],
      ['هزینه ثابت', t.fix, HUE.exp, 'ث', bs.map(function (b) { return b.exp; }), delta(t.fix, pt.fix)],
      ['هزینه متغیر', t.vari, HUE.pink, 'م', bs.map(function (b) { return b.exp; }), delta(t.vari, pt.vari)],
      ['سرمایه‌ای (خارج از سود)', t.cap, HUE.cap, 'س', bs.map(function () { return t.cap; }), ''],
      ['مطالبات معوق', t.due, HUE.due, 'ع', bs.map(function (b) { return b.inc; }), ''],
      ['مالیات ثبت‌شده', t.tax, HUE.tax, 'م', bs.map(function (b) { return b.inc; }), '']
    ];
    h.push('<div class="zvfKpis">' + kp.map(function (k) {
      return '<div class="zvfK" style="--c:' + k[2] + '">' + k[5] + '<div class="kl"><b>' + k[3] + '</b>' + esc(k[0]) + '</div>' +
        '<div class="kv">' + amt(k[1]) + '</div><div class="ku">' + esc(unitName()) + '</div>' + spark(k[4], k[2]) + '</div>';
    }).join('') + '</div>');

    /* charts */
    var gl = { cat: 'دسته', branch: 'شعبه', method: 'روش پرداخت', type: 'نوع', status: 'وضعیت' }[S.ctrl.group];
    h.push('<div class="zvfCharts">',
      '<div class="zvfCbox"><h3>روند درآمد، هزینه و سود<em>' + esc(unitName()) + ' · ' + fa(bs.length) + ' بازه</em></h3>' + chartMain(bs) +
      '<div class="zvfLeg"><span><i style="background:' + HUE.inc + '"></i>درآمد</span><span><i style="background:' + HUE.exp + '"></i>هزینه عملیاتی</span><span><i style="background:' + HUE.net + '"></i>سود خالص</span><span>هزینه سرمایه‌ای در سود لحاظ نمی‌شود</span></div></div>',
      '<div class="zvfCbox"><h3>تفکیک بر اساس ' + esc(gl) + '<em>۸ گروه برتر</em></h3>' + chartBreak(gs) + '</div>',
      '</div>');

    /* views + search + filters */
    h.push('<div class="zvfViews">',
      '<button class="zvfBtn s" data-zvf="saveview">' + ico('star') + ' ذخیره نما</button>',
      S.views.map(function (v) { return '<span class="zvfVChip" data-zvf="applyview" data-id="' + esc(v.id) + '">' + esc(v.name) + ' <b data-zvf="delview" data-id="' + esc(v.id) + '">✕</b></span>'; }).join(''),
      '</div>');

    var allCats = CATS['درآمد'].concat(CATS['هزینه']);
    h.push('<div class="zvfRail" style="position:static;top:auto">',
      '<div class="zvfSearch">' + ico('search') + '<input class="zvfInp" data-zvf-q data-zvf-key="q" placeholder="جستجو در شرح، دسته، شناسه، طرف حساب…" value="' + esc(S.q) + '"></div>',
      fsel('type', S.f.type, TYPES, 'نوع'),
      fsel('cat', S.f.cat, allCats, 'دسته'),
      fsel('status', S.f.status, STATUSES, 'وضعیت'),
      fsel('branch', S.f.branch, branches(), 'شعبه'),
      fsel('method', S.f.method, METHODS, 'روش'),
      '<label class="zvfF"><span>&nbsp;</span><button class="zvfBtn s" data-zvf="clearf">پاک کردن فیلترها</button></label>',
      '</div>');

    /* bulk */
    if (selN) {
      h.push('<div class="zvfBulk"><b>' + fa(selN) + '</b> مورد انتخاب شده',
        '<select class="zvfSel" id="zvfBulkStatus"><option value="">تغییر وضعیت…</option>' + STATUSES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select>',
        '<button class="zvfBtn s" data-zvf="bulkstatus">اعمال</button>',
        '<button class="zvfBtn s" data-zvf="csvsel">' + ico('dl') + ' خروجی انتخاب</button>',
        '<button class="zvfBtn d" data-zvf="bulkdel">' + ico('trash') + ' حذف گروهی</button>',
        '<button class="zvfBtn s" data-zvf="selclear">انصراف</button></div>');
    }

    /* table */
    if (!page.length) {
      h.push('<div class="zvfCbox"><div class="zvfEmpty"><div class="ei">＋</div><h4>تراکنشی در این بازه یافت نشد</h4>',
        '<p>فیلترها را تغییر دهید یا اولین تراکنش را ثبت کنید.</p>',
        '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center"><button class="zvfBtn p" data-zvf="new">' + ico('plus') + ' ثبت تراکنش</button>',
        '<button class="zvfBtn s" data-zvf="reset">بازنشانی فیلترها</button></div></div></div>');
    } else {
      var full = S.ctrl.cols === 'full';
      h.push('<div class="zvfTw"><table class="zvfT' + (S.ctrl.dense ? ' dense' : '') + '"><thead><tr>',
        '<th style="width:34px"><input type="checkbox" data-zvf="selall"' + (page.every(function (r) { return S.sel[r.id]; }) ? ' checked' : '') + '></th>',
        S.sort === 'manual' ? '<th style="width:28px"></th>' : '',
        '<th data-zvf-sort="date_desc">تاریخ' + (S.sort.indexOf('date') === 0 ? (S.sort === 'date_desc' ? ' ↓' : ' ↑') : '') + '</th>',
        '<th>شناسه</th><th>نوع</th><th>شرح</th><th>دسته</th>',
        full ? '<th>شعبه</th>' : '',
        '<th data-zvf-sort="amount_desc">مبلغ (' + esc(unitName()) + ')' + (S.sort.indexOf('amount') === 0 ? (S.sort === 'amount_desc' ? ' ↓' : ' ↑') : '') + '</th>',
        S.ctrl.tax ? '<th>مالیات</th>' : '',
        '<th>وضعیت</th>',
        full ? '<th>روش</th>' : '',
        '<th style="text-align:left">عملیات</th></tr></thead><tbody id="zvfBody">');
      page.forEach(function (r) {
        var c = r.type === 'درآمد' ? HUE.inc : HUE.exp;
        h.push('<tr data-zvf-row="' + esc(r.id) + '"' + (S.sel[r.id] ? ' class="sel"' : '') + '>',
          '<td><input type="checkbox" data-zvf-sel="' + esc(r.id) + '"' + (S.sel[r.id] ? ' checked' : '') + '></td>',
          S.sort === 'manual' ? '<td><span class="zvfDrag" draggable="true" data-zvf-drag="' + esc(r.id) + '" title="جابه‌جایی">⠿</span></td>' : '',
          '<td>' + jDisp(r.date) + '</td>',
          '<td><span class="zvfId">' + esc(r.id) + '</span></td>',
          '<td>' + pill(r.type, c) + '</td>',
          '<td><span class="zvfTitle" title="' + esc(r.title) + '">' + esc(r.title) + '</span>' +
          (r.refId || r.party ? '<span class="zvfSub">' + esc([r.refType !== 'دستی' ? r.refType + ' ' + r.refId : '', r.party].filter(Boolean).join(' · ')) + '</span>' : '') + '</td>',
          '<td>' + esc(r.cat) + (r.nature ? '<span class="zvfSub"> · ' + esc(r.nature) + '</span>' : '') + '</td>',
          full ? '<td>' + esc(branchName(r.branchId)) + '</td>' : '',
          '<td class="zvfNum" style="color:' + c + '">' + (r.type === 'هزینه' ? '−' : '+') + amt(r.amount) + '</td>',
          S.ctrl.tax ? '<td class="zvfNum" style="color:' + HUE.tax + '">' + (r.tax ? amt(r.tax) : '—') + '</td>' : '',
          '<td>' + pill(r.status, statusColor(r.status)) + '</td>',
          full ? '<td>' + esc(r.method) + '</td>' : '',
          '<td><div class="zvfRa">',
          '<button class="zvfBtn s i" data-zvf="view" data-id="' + esc(r.id) + '" title="جزئیات">' + ico('eye') + '</button>',
          '<button class="zvfBtn s i" data-zvf="edit" data-id="' + esc(r.id) + '" title="ویرایش">' + ico('edit') + '</button>',
          '<button class="zvfBtn d i" data-zvf="del" data-id="' + esc(r.id) + '" title="حذف">' + ico('trash') + '</button>',
          '</div></td></tr>');
      });
      h.push('</tbody></table></div>');
      h.push('<div class="zvfPager"><span>صفحه ' + fa(S.pn) + ' از ' + fa(pages) + ' · ' + fa(rows.length) + ' تراکنش · جمع صفحه ' + amt(page.reduce(function (a, r) { return a + (r.type === 'درآمد' ? r.amount : -r.amount); }, 0)) + ' ' + esc(unitName()) + '</span>',
        '<span style="display:flex;gap:6px"><button class="zvfBtn s" data-zvf="pg" data-d="-1"' + (S.pn <= 1 ? ' disabled' : '') + '>قبلی</button>',
        '<button class="zvfBtn s" data-zvf="pg" data-d="1"' + (S.pn >= pages ? ' disabled' : '') + '>بعدی</button></span></div>');
    }

    if (REPAIR.length) {
      h.push('<div class="zvfNote" style="margin-top:14px">' + ico('tool') + '<div><b>تعمیر خودکار داده انجام شد.</b> ' +
        fa(REPAIR.length) + ' مجموعه که به‌جای آرایه، آبجکت بودند نرمال‌سازی شدند (' + esc(REPAIR.slice(0, 6).map(function (x) { return x.key; }).join('، ')) +
        (REPAIR.length > 6 ? ' و …' : '') + '). خطای «slice is not a function» برطرف است.</div></div>');
    }
    h.push('</div>');

    box.innerHTML = h.join('');
    var rn = host('renderNav'); if (rn) { try { rn(); } catch (e) {} }
    if (fk) {
      var el = $('[data-zvf-key="' + fk + '"]', box);
      if (el) { try { el.focus(); if (fs != null && el.setSelectionRange) el.setSelectionRange(fs, fe); } catch (e) {} }
    }
  }

  /* ═══════════ 9) اعلان ═══════════ */
  function toastBox() {
    var b = $('#zvfToasts');
    if (!b) { b = document.createElement('div'); b.id = 'zvfToasts'; document.body.appendChild(b); }
    return b;
  }
  function toast(msg, type, action) {
    var t = document.createElement('div');
    t.className = 'zvfToast ' + (type || '');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    if (action) t.querySelector('button').onclick = function () { action.fn(); t.remove(); };
    toastBox().appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s,transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(function () { t.remove(); }, 320); }, action ? 8000 : 3600);
  }

  /* ═══════════ 10) لایه‌های شناور ═══════════ */
  var ovId = 'zvfOv';
  function overlay(html, kind) {
    closeOverlay();
    var d = document.createElement('div');
    d.className = 'zvfOv show'; d.id = ovId;
    d.innerHTML = '<div class="zvfScrim" data-zvf="ovclose"></div><div class="' + (kind === 'drawer' ? 'zvfDrawer' : 'zvfModal') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(d);
    document.body.style.overflow = 'hidden';
    var f = d.querySelector('input,select,textarea,button');
    if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60);
    return d;
  }
  function closeOverlay() {
    var d = $('#' + ovId); if (d) d.remove();
    closeCal();
    if (!$('#zvfOv')) document.body.style.overflow = '';
  }

  /* ── تقویم ── */
  var CAL = { el: null, y: 0, m: 0, input: null };
  function calBox() {
    var c = $('#zvfCal');
    if (!c) { c = document.createElement('div'); c.id = 'zvfCal'; c.className = 'zvfCal'; document.body.appendChild(c); }
    return c;
  }
  function closeCal() { var c = $('#zvfCal'); if (c) c.classList.remove('show'); CAL.input = null; }
  function placeCal(inp, c) {
    var r = inp.getBoundingClientRect(), w = c.offsetWidth || 300, h = c.offsetHeight || 300;
    var L = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var T = r.bottom + 6; if (T + h > window.innerHeight - 8) T = Math.max(8, r.top - h - 6);
    c.style.left = L + 'px'; c.style.top = T + 'px';
  }
  function drawCal() {
    var c = calBox(), t = g2j(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    var max = jDays(CAL.y, CAL.m), first = j2g(CAL.y, CAL.m, 1);
    var wd = (new Date(first[0], first[1] - 1, first[2]).getDay() + 1) % 7;
    var s = '<div class="zvfCalH"><button type="button" data-cal="py">«</button><button type="button" data-cal="pm">‹</button>' +
      '<span class="yr" data-cal="yr">' + JM[CAL.m - 1] + ' ' + fa(CAL.y) + '</span>' +
      '<button type="button" data-cal="nm">›</button><button type="button" data-cal="ny">»</button></div><div class="zvfCalG">';
    ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].forEach(function (x) { s += '<button type="button" class="dl" disabled>' + x + '</button>'; });
    for (var i = 0; i < wd; i++) s += '<span></span>';
    for (var d = 1; d <= max; d++) s += '<button type="button" data-day="' + d + '" class="' + (t[0] === CAL.y && t[1] === CAL.m && t[2] === d ? 'td' : '') + '">' + fa(d) + '</button>';
    s += '</div>';
    c.innerHTML = s;
  }
  function openCal(inp) {
    CAL.input = inp;
    var p = parseJ(inp.value), n = g2j(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    CAL.y = p ? p[0] : n[0]; CAL.m = p ? p[1] : n[1];
    drawCal();
    var c = calBox(); c.classList.add('show');
    requestAnimationFrame(function () { placeCal(inp, c); });
  }
  document.addEventListener('click', function (e) {
    var c = $('#zvfCal'); if (!c || !c.classList.contains('show')) return;
    var nav = e.target.closest && e.target.closest('[data-cal]');
    if (nav) {
      e.preventDefault(); e.stopPropagation();
      var k = nav.getAttribute('data-cal');
      if (k === 'py') CAL.y--; else if (k === 'ny') CAL.y++;
      else if (k === 'pm') { CAL.m--; if (CAL.m < 1) { CAL.m = 12; CAL.y--; } }
      else if (k === 'nm') { CAL.m++; if (CAL.m > 12) { CAL.m = 1; CAL.y++; } }
      else if (k === 'yr') {
        var i = document.createElement('input');
        i.type = 'number'; i.min = 1300; i.max = 1500; i.value = CAL.y;
        i.style.cssText = 'width:74px;text-align:center;font-weight:800;border:1px solid #FF6B1A;border-radius:6px;padding:2px;font-size:12px';
        nav.replaceWith(i); i.focus(); i.select();
        var done = function () { var v = parseInt(i.value, 10); if (v >= 1300 && v <= 1500) CAL.y = v; drawCal(); };
        i.addEventListener('blur', done);
        i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); done(); } if (ev.key === 'Escape') drawCal(); });
        return;
      }
      drawCal(); placeCal(CAL.input, c); return;
    }
    var day = e.target.closest && e.target.closest('[data-day]');
    if (day && CAL.input) {
      e.preventDefault(); e.stopPropagation();
      CAL.input.value = CAL.y + '/' + pad(CAL.m) + '/' + pad(+day.getAttribute('data-day'));
      CAL.input.dispatchEvent(new Event('input', { bubbles: true }));
      closeCal(); return;
    }
    if (!e.target.closest || (!e.target.closest('#zvfCal') && !e.target.closest('[data-zvf-cal]'))) closeCal();
  }, true);
  window.addEventListener('scroll', function () { var c = $('#zvfCal'); if (c && c.classList.contains('show') && CAL.input) placeCal(CAL.input, c); }, true);
  window.addEventListener('resize', function () { var c = $('#zvfCal'); if (c && c.classList.contains('show') && CAL.input) placeCal(CAL.input, c); });

  /* ═══════════ 11) فرم تراکنش ═══════════ */
  function fld(label, inner, req, full, hint) {
    return '<div class="zvfFld' + (full ? ' full' : '') + '"><label>' + esc(label) + (req ? ' <span class="req">*</span>' : '') + '</label>' + inner + (hint ? '<span class="zvfHint">' + esc(hint) + '</span>' : '') + '</div>';
  }
  function opts(list, val) { return list.map(function (x) { return '<option value="' + esc(x) + '"' + (String(x) === String(val) ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
  function openEntry(id) {
    var r = id ? ROWS.filter(function (x) { return x.id === id; })[0] : null;
    var isNew = !r;
    r = r || { id: '', date: today(), type: 'درآمد', nature: '', cat: CATS['درآمد'][0], title: '', amount: 0, tax: 0, status: 'پرداخت شده', method: 'انتقال', branchId: (branches()[0] || {}).id || '', party: '', refType: 'دستی', refId: '', note: '' };
    var bs = branches();
    var h = [];
    h.push('<div class="zvfOh"><h3>' + (isNew ? 'ثبت تراکنش جدید' : 'ویرایش ' + esc(r.id)) + '</h3>',
      '<span class="zvfId">' + (isNew ? esc(nextId()) : '') + '</span>',
      '<button class="zvfBtn s i" data-zvf="ovclose" title="بستن">' + ico('x') + '</button></div>');
    h.push('<div class="zvfOb"><form id="zvfForm" autocomplete="off"><div class="zvfGrid">');
    h.push(fld('نوع تراکنش', '<div class="zvfSeg" id="zvfTypeSeg">' + TYPES.map(function (t) { return '<button type="button" data-v="' + esc(t) + '" class="' + (r.type === t ? 'on' : '') + '">' + esc(t) + '</button>'; }).join('') + '</div><input type="hidden" name="type" value="' + esc(r.type) + '">', true, true));
    h.push(fld('تاریخ (شمسی)', '<div class="zvfDateWrap"><input name="date" data-zvf-cal value="' + esc(jInput(r.date)) + '" placeholder="۱۴۰۵/۰۸/۲۵" required><button type="button" class="zvfDateBtn" data-zvf-calbtn>' + ico('cal') + '</button></div>', true));
    h.push(fld('دسته', '<select name="cat" id="zvfCat">' + opts(CATS[r.type], r.cat) + '</select>', true));
    h.push(fld('شرح تراکنش', '<input name="title" value="' + esc(r.title) + '" placeholder="مثلاً تسویه سفارش نظافت مجتمع…" required>', true, true));
    h.push(fld('مبلغ (' + 'ریال' + ')', '<input name="amount" id="zvfAmount" inputmode="numeric" value="' + (r.amount ? grp(r.amount) : '') + '" placeholder="۰" required>', true, false, 'مبلغ را به ریال وارد کنید؛ جداکننده خودکار درج می‌شود.'));
    h.push(fld('مالیات (ریال)', '<input name="tax" id="zvfTax" inputmode="numeric" value="' + (r.tax ? grp(r.tax) : '') + '" placeholder="۰">'));
    h.push('<div class="zvfFld full"><div class="zvfAmtPreview"><span>معادل مبلغ</span><b id="zvfAmtPv">—</b></div></div>');
    h.push('<div class="zvfFld full" id="zvfNatureWrap"' + (r.type === 'هزینه' ? '' : ' style="display:none"') + '>' +
      '<label>ماهیت هزینه</label><select name="nature" id="zvfNature">' + opts(NATURES, r.nature || 'متغیر') + '</select>' +
      '<span class="zvfHint">هزینه «سرمایه‌ای» در سود و زیان لحاظ نمی‌شود و جداگانه گزارش می‌گردد.</span></div>');
    h.push(fld('وضعیت', '<select name="status">' + opts(STATUSES, r.status) + '</select>', true));
    h.push(fld('روش پرداخت', '<select name="method">' + opts(METHODS, r.method) + '</select>'));
    h.push(fld('شعبه', '<select name="branchId"><option value="">— بدون شعبه —</option>' + bs.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === r.branchId ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select>'));
    h.push(fld('طرف حساب', '<input name="party" value="' + esc(r.party) + '" placeholder="نام مشتری / تأمین‌کننده">'));
    h.push(fld('نوع مرجع', '<select name="refType">' + opts(REFTYPES, r.refType) + '</select>'));
    h.push(fld('شناسه مرجع', '<input name="refId" value="' + esc(r.refId) + '" placeholder="ZV-… / CON-… / PRJ-…">'));
    h.push(fld('یادداشت', '<textarea name="note" placeholder="توضیحات تکمیلی…">' + esc(r.note) + '</textarea>', false, true));
    h.push('</div></form></div>');
    h.push('<div class="zvfOf"><button class="zvfBtn p" data-zvf="submit" data-id="' + esc(id || '') + '">' + ico('plus') + ' ' + (isNew ? 'ثبت تراکنش' : 'ذخیره تغییرات') + '</button>',
      '<button class="zvfBtn s" data-zvf="ovclose">انصراف</button>',
      !isNew ? '<button class="zvfBtn s" data-zvf="dup" data-id="' + esc(id) + '" style="margin-right:auto">' + ico('copy') + ' ثبت مشابه</button>' : '',
      '</div>');
    var d = overlay(h.join(''), 'modal');
    d.setAttribute('data-entry', id || '');
    updateAmtPreview();

    var seg = $('#zvfTypeSeg', d);
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]'); if (!b) return;
      var v = b.getAttribute('data-v');
      $$('button', seg).forEach(function (x) { x.classList.toggle('on', x === b); });
      d.querySelector('[name="type"]').value = v;
      var cat = $('#zvfCat', d); cat.innerHTML = opts(CATS[v], CATS[v][0]);
      $('#zvfNatureWrap', d).style.display = v === 'هزینه' ? '' : 'none';
      autoNature(d);
    });
    $('#zvfCat', d).addEventListener('change', function () { autoNature(d); });
    ['zvfAmount', 'zvfTax'].forEach(function (nid) {
      var el = $('#' + nid, d);
      el.addEventListener('input', function () { fmtAmount(el); updateAmtPreview(); });
    });
    var dateInp = d.querySelector('[name="date"]');
    d.querySelector('[data-zvf-calbtn]').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCal(dateInp); });
    dateInp.addEventListener('input', function () {
      var v = en(dateInp.value).replace(/\D/g, '').slice(0, 8);
      if (v.length > 4) v = v.slice(0, 4) + '/' + v.slice(4);
      if (v.length > 7) v = v.slice(0, 7) + '/' + v.slice(7);
      dateInp.value = v;
    });
    $('#zvfForm', d).addEventListener('submit', function (e) { e.preventDefault(); submitEntry(id); });
  }
  function autoNature(d) {
    var type = d.querySelector('[name="type"]').value;
    if (type !== 'هزینه') return;
    var c = $('#zvfCat', d).value, n = AUTO_NATURE[c];
    if (n) $('#zvfNature', d).value = n;
  }
  function fmtAmount(el) {
    var raw = en(el.value).replace(/[^\d]/g, '');
    var before = en(el.value.slice(0, el.selectionStart || 0)).replace(/[^\d]/g, '').length;
    var out = raw ? Number(raw).toLocaleString('en-US') : '';
    el.value = out;
    var i = 0, c = 0;
    for (; i < out.length; i++) { if (/\d/.test(out[i])) c++; if (c >= before) { i++; break; } }
    try { el.setSelectionRange(i, i); } catch (e) {}
  }
  function updateAmtPreview() {
    var d = $('#zvfOv'); if (!d) return;
    var a = num(($('#zvfAmount', d) || {}).value), tx = num(($('#zvfTax', d) || {}).value);
    var pv = $('#zvfAmtPv', d); if (!pv) return;
    pv.textContent = a ? (fa(grp(a)) + ' ریال  ·  ' + fa(grp(a / 10)) + ' تومان  ·  ' + moneyC(a) + (tx ? '  +  مالیات ' + moneyC(tx) : '')) : '—';
  }
  function submitEntry(id) {
    var d = $('#zvfOv'); if (!d) return;
    var f = $('#zvfForm', d), g = function (n) { var e = f.elements[n]; return e ? String(e.value).trim() : ''; };
    var type = g('type'), title = g('title'), amount = num(g('amount')), dateJ = g('date');
    if (TYPES.indexOf(type) < 0) return toast('نوع تراکنش معتبر نیست.', 'err');
    if (!title) return toast('شرح تراکنش الزامی است.', 'err');
    if (!(amount > 0)) return toast('مبلغ باید بزرگ‌تر از صفر باشد.', 'err');
    if (!parseJ(dateJ)) return toast('تاریخ شمسی معتبر نیست؛ قالب ۱۴۰۵/۰۸/۲۵.', 'err');
    var rec = {
      id: id || nextId(), date: jStore(dateJ), type: type,
      nature: type === 'هزینه' ? g('nature') : '', cat: g('cat'), title: title,
      amount: amount, tax: num(g('tax')), status: g('status'), method: g('method'),
      branchId: g('branchId'), party: g('party'), refType: g('refType'), refId: g('refId'),
      note: g('note'), updatedAt: new Date().toISOString(), demo: false
    };
    if (id) {
      var i = ROWS.findIndex(function (x) { return x.id === id; });
      if (i < 0) return toast('رکورد یافت نشد.', 'err');
      rec.createdAt = ROWS[i].createdAt; rec.order = ROWS[i].order;
      ROWS[i] = rec;
    } else {
      rec.createdAt = rec.updatedAt;
      rec.order = -1;
      ROWS.unshift(rec);
      ROWS.forEach(function (r, i2) { if (r.order == null || r.order < 0) r.order = i2; });
    }
    S.seeded = ROWS.length > 0 && ROWS.every(function (r) { return r.demo; });
    persist(); pushServer(rec);
    closeOverlay(); render();
    toast(id ? 'تراکنش ' + rec.id + ' به‌روزرسانی شد.' : 'تراکنش ' + rec.id + ' ثبت شد.', 'ok');
  }

  /* ═══════════ 12) کشوی جزئیات ═══════════ */
  function openDetail(id) {
    var r = ROWS.filter(function (x) { return x.id === id; })[0];
    if (!r) return toast('رکورد یافت نشد.', 'err');
    var c = r.type === 'درآمد' ? HUE.inc : HUE.exp;
    var kv = [
      ['شناسه', '<span class="zvfId">' + esc(r.id) + '</span>'], ['تاریخ', jDisp(r.date)],
      ['نوع', pill(r.type, c)], ['وضعیت', pill(r.status, statusColor(r.status))],
      ['دسته', esc(r.cat)], ['ماهیت', esc(r.nature || '—')],
      ['مبلغ', '<b style="color:' + c + '">' + fa(grp(r.amount)) + ' ریال</b>'], ['مالیات', r.tax ? fa(grp(r.tax)) + ' ریال' : '—'],
      ['معادل تومان', fa(grp(r.amount / 10))], ['روش پرداخت', esc(r.method)],
      ['شعبه', esc(branchName(r.branchId))], ['طرف حساب', esc(r.party || '—')],
      ['مرجع', esc(r.refType + (r.refId ? ' · ' + r.refId : ''))], ['خالص پس از مالیات', fa(grp(r.amount - r.tax)) + ' ریال'],
      ['شرح', esc(r.title), 1], ['یادداشت', esc(r.note || '—'), 1]
    ];
    var h = '<div class="zvfOh"><h3>جزئیات تراکنش</h3>' + pill(r.status, statusColor(r.status)) +
      '<button class="zvfBtn s i" data-zvf="ovclose">' + ico('x') + '</button></div>' +
      '<div class="zvfOb">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;margin-bottom:14px;background:linear-gradient(120deg,rgba(255,107,26,.1),rgba(124,77,255,.07));border:1px solid var(--line,#E2E7F3)">' +
      '<div style="width:44px;height:44px;border-radius:13px;display:grid;place-items:center;font-size:19px;font-weight:900;color:#fff;background:' + c + '">' + (r.type === 'درآمد' ? '+' : '−') + '</div>' +
      '<div><div style="font-size:19px;font-weight:900;color:' + c + '">' + fa(grp(r.amount)) + ' <span style="font-size:12px">ریال</span></div>' +
      '<div style="font-size:11px;color:var(--muted,#5C6784)">' + esc(r.title) + '</div></div></div>' +
      '<div class="zvfKv">' + kv.map(function (x) { return '<div class="it' + (x[2] ? ' full' : '') + '"><small>' + esc(x[0]) + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="zvfSecT">فراترینش</div><div class="zvfKv">' +
      '<div class="it"><small>ایجاد</small><b>' + jDisp(r.createdAt) + '</b></div>' +
      '<div class="it"><small>آخرین تغییر</small><b>' + jDisp(r.updatedAt) + '</b></div>' +
      '<div class="it full"><small>منبع ذخیره</small><b>' + (r.demo ? 'داده نمونه — با ویرایش، واقعی می‌شود' : (S.mode === 'server' ? 'همگام با سرور' : 'ذخیره محلی مرورگر')) + '</b></div></div>' +
      '</div>' +
      '<div class="zvfOf"><button class="zvfBtn p" data-zvf="edit" data-id="' + esc(r.id) + '">' + ico('edit') + ' ویرایش</button>' +
      '<button class="zvfBtn s" data-zvf="dup" data-id="' + esc(r.id) + '">' + ico('copy') + ' ثبت مشابه</button>' +
      '<button class="zvfBtn s" data-zvf="receipt" data-id="' + esc(r.id) + '">' + ico('print') + ' چاپ رسید</button>' +
      '<button class="zvfBtn d" data-zvf="del" data-id="' + esc(r.id) + '" style="margin-right:auto">' + ico('trash') + ' حذف</button></div>';
    overlay(h, 'drawer');
  }

  /* ═══════════ 13) حذف / بازگردانی / گروهی ═══════════ */
  function removeIds(ids, silent) {
    var snap = ROWS.filter(function (r) { return ids.indexOf(r.id) >= 0; });
    if (!snap.length) return;
    S.lastDeleted = snap;
    ROWS = ROWS.filter(function (r) { return ids.indexOf(r.id) < 0; });
    ids.forEach(function (i) { delete S.sel[i]; });
    var db = G('DB'); if (db) { try { db[dataKey()] = ROWS; } catch (e) {} }
    persist(); ids.forEach(deleteServer);
    closeOverlay(); render();
    if (!silent) toast(fa(snap.length) + ' تراکنش حذف شد.', 'warn', {
      label: 'بازگردانی', fn: function () {
        ROWS = ROWS.concat(S.lastDeleted).sort(function (a, b) { return num(a.order) - num(b.order); });
        var db2 = G('DB'); if (db2) { try { db2[dataKey()] = ROWS; } catch (e) {} }
        S.lastDeleted = null; persist(); render(); toast('بازگردانی شد.', 'ok');
      }
    });
  }
  function confirmDel(ids) {
    overlay('<div class="zvfOh"><h3>حذف تراکنش</h3><button class="zvfBtn s i" data-zvf="ovclose">' + ico('x') + '</button></div>' +
      '<div class="zvfOb"><p style="font-size:13px;line-height:2">آیا از حذف <b>' + fa(ids.length) + '</b> تراکنش مطمئن هستید؟<br>' +
      '<span class="zvfHint">بلافاصله پس از حذف، دکمهٔ «بازگردانی» در اعلان ظاهر می‌شود.</span></p></div>' +
      '<div class="zvfOf"><button class="zvfBtn d" data-zvf="delok" data-ids="' + esc(ids.join(',')) + '">' + ico('trash') + ' بله، حذف شود</button>' +
      '<button class="zvfBtn s" data-zvf="ovclose">انصراف</button></div>', 'modal');
  }
  function bulkStatus() {
    var v = ($('#zvfBulkStatus') || {}).value;
    if (!v) return toast('یک وضعیت انتخاب کنید.', 'err');
    var ids = Object.keys(S.sel).filter(function (k) { return S.sel[k]; });
    if (!ids.length) return;
    ROWS.forEach(function (r) { if (ids.indexOf(r.id) >= 0) { r.status = v; r.updatedAt = new Date().toISOString(); r.demo = false; pushServer(r); } });
    S.sel = {}; persist(); render(); toast('وضعیت ' + fa(ids.length) + ' تراکنش به «' + v + '» تغییر کرد.', 'ok');
  }
  function duplicate(id) {
    var r = ROWS.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var c = JSON.parse(JSON.stringify(r));
    c.id = nextId(); c.date = today(); c.createdAt = c.updatedAt = new Date().toISOString(); c.demo = false; c.order = -1;
    ROWS.unshift(c); ROWS.forEach(function (x, i) { if (x.order < 0) x.order = i; });
    persist(); pushServer(c); closeOverlay(); render(); toast('تراکنش مشابه با شناسه ' + c.id + ' ثبت شد.', 'ok');
  }

  /* ═══════════ 14) خروجی و چاپ ═══════════ */
  function download(name, text, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: mime || 'text/csv;charset=utf-8' }));
    a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function csv(rows) {
    var head = ['شناسه', 'تاریخ', 'نوع', 'ماهیت', 'دسته', 'شرح', 'مبلغ (ریال)', 'مالیات', 'وضعیت', 'روش', 'شعبه', 'طرف حساب', 'مرجع', 'یادداشت'];
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [head.map(q).join(',')];
    rows.forEach(function (r) {
      lines.push([r.id, jDisp(r.date), r.type, r.nature, r.cat, r.title, r.amount, r.tax, r.status, r.method, branchName(r.branchId), r.party, r.refType + ' ' + r.refId, r.note].map(q).join(','));
    });
    download('zingovingo-finance-' + en(jDisp(today())).replace(/\//g, '-') + '.csv', lines.join('\n'));
    toast('فایل CSV با ' + fa(rows.length) + ' ردیف دانلود شد.', 'ok');
  }
  function printArea() {
    var p = $('#printArea');
    if (!p) { p = document.createElement('div'); p.id = 'printArea'; p.style.display = 'none'; document.body.appendChild(p); }
    return p;
  }
  function printLedger() {
    var rows = filtered(), t = totals(rows), rg = range();
    var h = '<div style="padding:22px;font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl">' +
      '<div style="display:flex;justify-content:space-between;border-bottom:3px solid #0B1736;padding-bottom:10px;margin-bottom:14px">' +
      '<div><h1 style="margin:0;font-size:20px;color:#0B1736">Zingo<span style="color:#FF6B1A">Vingo</span></h1>' +
      '<div style="font-size:12px;color:#5C6784">گزارش دفتر مالی · ' + jDisp(rg.from) + ' تا ' + jDisp(rg.to) + '</div></div>' +
      '<div style="font-size:11px;color:#5C6784;text-align:left">تاریخ چاپ: ' + jDisp(today()) + '<br>تعداد: ' + fa(rows.length) + '</div></div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px"><tr>' +
      [['درآمد', t.inc], ['هزینه ثابت', t.fix], ['هزینه متغیر', t.vari], ['سرمایه‌ای', t.cap], ['سود خالص', t.net], ['حاشیه', t.margin]]
        .map(function (x) { return '<td style="border:1px solid #ddd;padding:8px;text-align:center"><div style="font-size:10px;color:#5C6784">' + x[0] + '</div><b>' + (x[0] === 'حاشیه' ? pct(x[1]) : fa(grp(x[1]))) + '</b></td>'; }).join('') +
      '</tr></table>' +
      '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f2f4fb">' +
      ['تاریخ', 'شناسه', 'نوع', 'شرح', 'دسته', 'مبلغ', 'وضعیت'].map(function (x) { return '<th style="border:1px solid #ddd;padding:7px;text-align:right">' + x + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + [jDisp(r.date), r.id, r.type, r.title, r.cat, (r.type === 'هزینه' ? '−' : '+') + fa(grp(r.amount)), r.status]
          .map(function (x) { return '<td style="border:1px solid #ddd;padding:6px">' + esc(x) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    printArea().innerHTML = h; window.print();
  }
  function printReceipt(id) {
    var r = ROWS.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    printArea().innerHTML = '<div style="padding:26px;font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl;max-width:640px;margin:0 auto">' +
      '<div style="text-align:center;border-bottom:2px solid #0B1736;padding-bottom:10px;margin-bottom:16px">' +
      '<h1 style="margin:0;color:#0B1736">Zingo<span style="color:#FF6B1A">Vingo</span></h1>' +
      '<div style="font-size:12px;color:#5C6784">رسید تراکنش مالی · ' + esc(r.id) + '</div></div>' +
      [['تاریخ', jDisp(r.date)], ['نوع', r.type], ['دسته', r.cat], ['شرح', r.title], ['مبلغ', fa(grp(r.amount)) + ' ریال'],
      ['مالیات', fa(grp(r.tax)) + ' ریال'], ['وضعیت', r.status], ['روش', r.method], ['شعبه', branchName(r.branchId)], ['طرف حساب', r.party || '—']]
        .map(function (x) { return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed #ddd"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') +
      '<div style="display:flex;justify-content:space-between;font-size:17px;font-weight:900;color:#E4570B;border-top:2px solid #0B1736;margin-top:12px;padding-top:10px"><span>مبلغ نهایی</span><span>' + fa(grp(r.amount)) + ' ریال</span></div>' +
      '<div style="margin-top:34px;display:flex;justify-content:space-between;font-size:11px;color:#5C6784"><span>امضای ثبت‌کننده</span><span>امضای تأییدکننده</span></div></div>';
    window.print();
  }

  /* ═══════════ 15) نماها ═══════════ */
  function saveView() {
    overlay('<div class="zvfOh"><h3>ذخیره نمای فعلی</h3><button class="zvfBtn s i" data-zvf="ovclose">' + ico('x') + '</button></div>' +
      '<div class="zvfOb"><div class="zvfFld"><label>نام نما <span class="req">*</span></label>' +
      '<input id="zvfViewName" placeholder="مثلاً هزینه‌های معوق پاییز"></div>' +
      '<p class="zvfHint" style="margin-top:9px">جستجو، فیلترها، مرتب‌سازی و همهٔ تنظیمات نمایش ذخیره می‌شود.</p></div>' +
      '<div class="zvfOf"><button class="zvfBtn p" data-zvf="saveviewok">' + ico('star') + ' ذخیره</button>' +
      '<button class="zvfBtn s" data-zvf="ovclose">انصراف</button></div>', 'modal');
  }
  function applyView(id) {
    var v = S.views.filter(function (x) { return x.id === id; })[0]; if (!v) return;
    S.q = v.s.q; S.f = JSON.parse(JSON.stringify(v.s.f)); S.sort = v.s.sort;
    S.ctrl = JSON.parse(JSON.stringify(v.s.ctrl)); S.pn = 1; S.sel = {};
    persist(); render(); toast('نما «' + v.name + '» اعمال شد.', 'ok');
  }

  /* ═══════════ 16) تشخیص و همگام‌سازی ═══════════ */
  function token() { return G('TOKEN') || localStorage.getItem('zv_manager_token') || localStorage.getItem('zv_admin_token') || ''; }
  function apiCall(fn, args) {
    return new Promise(function (res, rej) {
      var g = G('google');
      if (!g || !g.script || !g.script.run) return rej(new Error('پل ارتباطی در دسترس نیست.'));
      var r = g.script.run.withSuccessHandler(res).withFailureHandler(function (e) { rej(new Error(e && e.message ? e.message : String(e))); });
      try { r[fn].apply(r, args); } catch (e) { rej(e); }
    });
  }
  var SAVE_FNS = ['mgrCCSaveFinance', 'mgrCCFinanceSave', 'mgrSaveFinance', 'admCCSave'];
  var DEL_FNS = ['mgrCCDeleteFinance', 'mgrCCFinanceDelete', 'mgrDeleteFinance'];
  function pushServer(rec) {
    var tk = token(); if (!tk) { S.mode = 'local'; return; }
    var tryAt = function (i) {
      if (i >= SAVE_FNS.length) { S.mode = 'local'; return; }
      var fn = SAVE_FNS[i], args = fn === 'admCCSave' ? ['finance', rec, tk] : [rec, tk];
      apiCall(fn, args).then(function () { S.mode = 'server'; S.backend = fn; persist(); })
        .catch(function (e) {
          if (/No such|not a function|is not defined|Unknown/i.test(e.message)) tryAt(i + 1);
          else { S.mode = 'local'; }
        });
    };
    tryAt(0);
  }
  function deleteServer(id) {
    var tk = token(); if (!tk || !S.backend) return;
    DEL_FNS.some(function (fn) {
      apiCall(fn, [id, tk]).then(function () {}).catch(function () {});
      return false;
    });
  }
  function syncAll() {
    var tk = token();
    if (!tk) return toast('برای همگام‌سازی ابتدا وارد پنل شوید.', 'err');
    var real = ROWS.filter(function (r) { return !r.demo; });
    if (!real.length) return toast('تراکنش واقعی برای ارسال وجود ندارد.', 'warn');
    toast('در حال ارسال ' + fa(real.length) + ' تراکنش…');
    var ok = 0, done = 0;
    real.forEach(function (r) {
      var tryAt = function (i) {
        if (i >= SAVE_FNS.length) { done++; finish(); return; }
        var fn = SAVE_FNS[i], args = fn === 'admCCSave' ? ['finance', r, tk] : [r, tk];
        apiCall(fn, args).then(function () { ok++; S.backend = fn; done++; finish(); })
          .catch(function (e) { if (/No such|not a function|is not defined/i.test(e.message)) tryAt(i + 1); else { done++; finish(); } });
      };
      tryAt(0);
    });
    function finish() {
      if (done < real.length) return;
      S.mode = ok ? 'server' : 'local'; persist(); render();
      toast(ok ? fa(ok) + ' تراکنش با سرور همگام شد.' : 'سرور تابع ذخیرهٔ مالی ندارد؛ داده‌ها محلی نگه داشته شدند.', ok ? 'ok' : 'warn');
    }
  }
  function diagnostics() {
    repairDB();
    var db = G('DB') || {}, k = dataKey();
    var nonArr = Object.keys(db).filter(function (x) { return !PRESERVE[x] && COLLECTIONS.indexOf(x) >= 0 && !Array.isArray(db[x]); });
    var h = '<div class="zvfOh"><h3>تشخیص و تعمیر داده</h3><button class="zvfBtn s i" data-zvf="ovclose">' + ico('x') + '</button></div><div class="zvfOb">' +
      '<div class="zvfNote' + (nonArr.length ? ' warn' : '') + '">' + ico('tool') + '<div>' +
      (nonArr.length ? 'هنوز ' + fa(nonArr.length) + ' مجموعه نرمال نشده است؛ دکمهٔ تعمیر را بزنید.' : 'همهٔ مجموعه‌های داده آرایهٔ معتبر هستند. خطای «slice is not a function» برطرف است.') +
      '</div></div>' +
      '<div class="zvfKv">' +
      '<div class="it"><small>صفحه</small><b>' + esc(PAGE_ID) + '</b></div>' +
      '<div class="it"><small>کلید داده</small><b>DB.' + esc(k) + '</b></div>' +
      '<div class="it"><small>رکوردها</small><b>' + fa(ROWS.length) + '</b></div>' +
      '<div class="it"><small>حالت ذخیره</small><b>' + (S.mode === 'server' ? 'سرور · ' + esc(S.backend || '—') : 'محلی (localStorage)') + '</b></div>' +
      '<div class="it"><small>داده نمونه</small><b>' + (S.seeded ? 'بله' : 'خیر') + '</b></div>' +
      '<div class="it"><small>نماهای ذخیره‌شده</small><b>' + fa(S.views.length) + '</b></div>' +
      '</div>' +
      '<div class="zvfSecT">مجموعه‌های تعمیرشده در این نشست</div>' +
      (REPAIR.length ? '<div class="zvfTw"><table class="zvfT" style="min-width:0"><thead><tr><th>کلید</th><th>نوع قبلی</th><th>رکورد پس از تعمیر</th></tr></thead><tbody>' +
        REPAIR.map(function (x) { return '<tr><td>' + esc(x.key) + '</td><td>' + esc(x.was) + '</td><td>' + fa(x.n) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="zvfHint">موردی ثبت نشده است.</p>') +
      '</div><div class="zvfOf">' +
      '<button class="zvfBtn p" data-zvf="repair">' + ico('tool') + ' تعمیر مجدد داده‌ها</button>' +
      '<button class="zvfBtn s" data-zvf="sync">همگام‌سازی با سرور</button>' +
      (S.seeded ? '<button class="zvfBtn d" data-zvf="cleandemo" style="margin-right:auto">پاک کردن داده نمونه</button>' : '') +
      '</div>';
    overlay(h, 'drawer');
  }

  /* ═══════════ 17) رویدادها ═══════════ */
  function rerender() { S.pn = 1; render(); }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-zvf],[data-zvf-sort],[data-zvf-tg],[data-zvf-sel]');
    if (!el) return;
    if (el.hasAttribute('data-zvf-sel')) {
      var sid = el.getAttribute('data-zvf-sel');
      if (el.checked) S.sel[sid] = true; else delete S.sel[sid];
      render(); return;
    }
    if (el.hasAttribute('data-zvf-sort')) {
      var s = el.getAttribute('data-zvf-sort');
      S.sort = S.sort === s ? (s === 'date_desc' ? 'date_asc' : 'amount_asc') : s;
      persist(); rerender(); return;
    }
    if (el.hasAttribute('data-zvf-tg')) {
      var t = el.getAttribute('data-zvf-tg'); S.ctrl[t] = !S.ctrl[t]; persist(); render(); return;
    }
    var a = el.getAttribute('data-zvf'); if (!a) return;
    e.preventDefault();
    var id = el.getAttribute('data-id');
    switch (a) {
      case 'new': openEntry(''); break;
      case 'edit': closeOverlay(); openEntry(id); break;
      case 'view': openDetail(id); break;
      case 'dup': duplicate(id); break;
      case 'del': closeOverlay(); confirmDel([id]); break;
      case 'delok': removeIds(String(el.getAttribute('data-ids') || '').split(',').filter(Boolean)); break;
      case 'bulkdel': confirmDel(Object.keys(S.sel).filter(function (k) { return S.sel[k]; })); break;
      case 'bulkstatus': bulkStatus(); break;
      case 'selclear': S.sel = {}; render(); break;
      case 'selall': {
        var per = num(S.ctrl.per) || 12, rows = filtered().slice((S.pn - 1) * per, S.pn * per);
        rows.forEach(function (r) { if (el.checked) S.sel[r.id] = true; else delete S.sel[r.id]; });
        render(); break;
      }
      case 'pg': S.pn += num(el.getAttribute('data-d')); render(); break;
      case 'csv': csv(filtered()); break;
      case 'csvsel': csv(ROWS.filter(function (r) { return S.sel[r.id]; })); break;
      case 'print': printLedger(); break;
      case 'receipt': printReceipt(id); break;
      case 'submit': submitEntry(el.getAttribute('data-id')); break;
      case 'ovclose': closeOverlay(); break;
      case 'clearf': S.f = { type: '', cat: '', status: '', branch: '', method: '' }; S.q = ''; rerender(); toast('فیلترها پاک شد.'); break;
      case 'reset':
        S.q = ''; S.f = { type: '', cat: '', status: '', branch: '', method: '' }; S.sort = 'date_desc'; S.sel = {}; S.pn = 1;
        S.ctrl = { period: '180', from: '', to: '', unit: 'ریال', chart: 'bar', group: 'cat', cols: 'full', dense: false, tax: true, per: 12 };
        persist(); render(); toast('تنظیمات دفتر مالی بازنشانی شد.', 'ok'); break;
      case 'saveview': saveView(); break;
      case 'saveviewok': {
        var n = ($('#zvfViewName') || {}).value; if (!n || !n.trim()) return toast('نام نما الزامی است.', 'err');
        S.views.push({ id: 'V' + Date.now(), name: n.trim(), s: { q: S.q, f: JSON.parse(JSON.stringify(S.f)), sort: S.sort, ctrl: JSON.parse(JSON.stringify(S.ctrl)) } });
        persist(); closeOverlay(); render(); toast('نما ذخیره شد.', 'ok'); break;
      }
      case 'applyview': applyView(id); break;
      case 'delview': e.stopPropagation(); S.views = S.views.filter(function (x) { return x.id !== id; }); persist(); render(); toast('نما حذف شد.', 'warn'); break;
      case 'diag': diagnostics(); break;
      case 'repair': repairDB(); render(); closeOverlay(); toast('داده‌ها بازبینی و تعمیر شدند.', 'ok'); break;
      case 'sync': syncAll(); break;
      case 'cleandemo':
        ROWS = ROWS.filter(function (r) { return !r.demo; }); S.seeded = false;
        var db = G('DB'); if (db) { try { db[dataKey()] = ROWS; } catch (er) {} }
        persist(); closeOverlay(); render(); toast('دادهٔ نمونه پاک شد. دفتر آمادهٔ ثبت واقعی است.', 'ok'); break;
    }
  });

  var qTimer = null;
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute('data-zvf-q')) {
      S.q = t.value; clearTimeout(qTimer); qTimer = setTimeout(function () { S.pn = 1; render(); }, 240); return;
    }
    if (t.hasAttribute && t.hasAttribute('data-zvf-ctrl')) {
      var k = t.getAttribute('data-zvf-ctrl');
      if (k === 'from' || k === 'to') {
        var v = en(t.value).replace(/\D/g, '').slice(0, 8);
        if (v.length > 4) v = v.slice(0, 4) + '/' + v.slice(4);
        if (v.length > 7) v = v.slice(0, 7) + '/' + v.slice(7);
        t.value = v; S.ctrl[k] = v;
        clearTimeout(qTimer); qTimer = setTimeout(function () { if (!v || parseJ(v)) { S.pn = 1; render(); } }, 420);
      }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute('data-zvf-ctrl')) {
      var k = t.getAttribute('data-zvf-ctrl');
      if (k === 'sort') S.sort = t.value; else S.ctrl[k] = t.value;
      S.pn = 1; persist(); render(); return;
    }
    if (t.hasAttribute && t.hasAttribute('data-zvf-filter')) {
      S.f[t.getAttribute('data-zvf-filter')] = t.value; S.pn = 1; render(); return;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var c = $('#zvfCal');
      if (c && c.classList.contains('show')) { closeCal(); return; }
      if ($('#zvfOv')) { closeOverlay(); return; }
    }
    if (e.altKey && String(e.key).toLowerCase() === 'n' && isFinanceActive()) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault(); openEntry('');
    }
    if (e.key === 'Enter' && $('#zvfOv') && (e.target.tagName || '').toLowerCase() === 'input' && $('#zvfForm')) {
      e.preventDefault(); submitEntry($('#zvfOv').getAttribute('data-entry') || '');
    }
  });

  /* ── کشیدن و رها کردن در حالت مرتب‌سازی دستی ── */
  var dragId = null;
  document.addEventListener('dragstart', function (e) {
    var h = e.target.closest && e.target.closest('[data-zvf-drag]'); if (!h) return;
    dragId = h.getAttribute('data-zvf-drag');
    var tr = h.closest('tr'); if (tr) tr.classList.add('drag');
    try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
  });
  document.addEventListener('dragover', function (e) {
    if (!dragId) return;
    var tr = e.target.closest && e.target.closest('[data-zvf-row]'); if (!tr) return;
    e.preventDefault();
    $$('#zvfBody tr.over').forEach(function (x) { x.classList.remove('over'); });
    tr.classList.add('over');
  });
  document.addEventListener('drop', function (e) {
    if (!dragId) return;
    var tr = e.target.closest && e.target.closest('[data-zvf-row]');
    e.preventDefault();
    $$('#zvfBody tr.over').forEach(function (x) { x.classList.remove('over'); });
    if (!tr) { dragId = null; return; }
    var target = tr.getAttribute('data-zvf-row');
    if (target !== dragId) {
      var from = ROWS.findIndex(function (r) { return r.id === dragId; });
      var to = ROWS.findIndex(function (r) { return r.id === target; });
      if (from >= 0 && to >= 0) {
        var m = ROWS.splice(from, 1)[0]; ROWS.splice(to, 0, m);
        ROWS.forEach(function (r, i) { r.order = i; });
        persist(); render(); toast('ترتیب دفتر تغییر کرد.', 'ok');
      }
    }
    dragId = null;
  });
  document.addEventListener('dragend', function () {
    dragId = null;
    $$('#zvfBody tr.drag').forEach(function (x) { x.classList.remove('drag'); });
    $$('#zvfBody tr.over').forEach(function (x) { x.classList.remove('over'); });
  });

  /* ═══════════ 18) اتصال به چرخهٔ پنل ═══════════ */
  function wrap(name, maker) {
    var orig = window[name];
    if (typeof orig !== 'function') return false;
    try { window[name] = maker(orig); return true; } catch (e) { return false; }
  }
  wrap('loadData', function (orig) {
    return function () {
      var p = orig.apply(this, arguments);
      if (p && typeof p.then === 'function') return p.then(function (r) { repairDB(); syncFromDB(); return r; });
      repairDB(); syncFromDB(); return p;
    };
  });
  wrap('rowsFor', function (orig) {
    return function (e) {
      var db = G('DB');
      if (db && e in db && !Array.isArray(db[e])) db[e] = zvArr(db[e]);
      return orig.apply(this, arguments);
    };
  });
  wrap('entityPage', function (orig) {
    return function (e) {
      var db = G('DB');
      if (db && e in db && !Array.isArray(db[e])) db[e] = zvArr(db[e]);
      return orig.apply(this, arguments);
    };
  });
  var wrappedRender = wrap('render', function (orig) {
    return function () {
      repairDB();
      if (isFinanceActive()) { try { render(); } catch (e) { console.error('[ZV Finance]', e); orig.apply(this, arguments); } return; }
      return orig.apply(this, arguments);
    };
  });

  /* fallback: اگر render قابل بازنویسی نبود، ناظر DOM صفحه را می‌گیرد */
  function watch() {
    var box = pageBox(); if (!box || !window.MutationObserver) return;
    var busy = false;
    new MutationObserver(function () {
      if (busy) return;
      if (!isFinanceActive()) return;
      if (box.querySelector('#zvfRoot')) return;
      busy = true;
      requestAnimationFrame(function () {
        busy = false;
        if (isFinanceActive() && !box.querySelector('#zvfRoot')) { try { render(); } catch (e) { console.error('[ZV Finance]', e); } }
      });
    }).observe(box, { childList: true });
  }

  /* دکمهٔ «ثبت سریع» نوار بالا در صفحهٔ مالی */
  var ACT = G('ACT');
  if (ACT && typeof ACT === 'object') {
    ['new', 'quick-add', 'new-entry', 'new-finance'].forEach(function (k) {
      var o = ACT[k];
      ACT[k] = function () {
        if (isFinanceActive()) { openEntry(''); return; }
        if (typeof o === 'function') return o.apply(this, arguments);
      };
    });
    ACT['zvf-new'] = function () { openEntry(''); };
    ACT['zvf-diag'] = function () { diagnostics(); };
  }

  /* ═══════════ 19) راه‌اندازی ═══════════ */
  restore();
  repairDB();
  syncFromDB();
  watch();
  if (isFinanceActive()) { try { render(); } catch (e) { console.error('[ZV Finance]', e); } }
  else {
    var boot = setInterval(function () {
      var box = pageBox();
      if (box && isFinanceActive() && !box.querySelector('#zvfRoot')) { try { render(); } catch (e) {} }
      if (box && G('PS')) clearInterval(boot);
    }, 400);
    setTimeout(function () { clearInterval(boot); }, 20000);
  }

  window.ZVFinance = {
    render: render, rows: function () { return ROWS; }, repair: repairDB,
    open: openEntry, detail: openDetail, export: function () { csv(filtered()); },
    sync: syncAll, state: S, page: PAGE_ID
  };
})();
