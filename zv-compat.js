/*!
 * ZingoVingo — Compatibility & Diagnostics Layer V1
 * ES5-safe | additive | does NOT replace zv-api.js
 * بارگذاری: BEFORE zv-api.js
 * تشخیص: افزودن ?zvdiag=1 به آدرس
 */
(function (w, d) {
  'use strict';
  if (w.__zvCompat) return;
  w.__zvCompat = true;

  var LOG = [];
  var GAS_RE = /script\.google\.com|script\.googleusercontent\.com|googleusercontent\.com\/macros/i;
  var DIAG = /[?&]zvdiag=1/i.test(w.location.search);

  function now() {
    try { return new Date().toLocaleTimeString('fa-IR'); } catch (e) { return String(new Date()); }
  }
  function rec(kind, msg, detail) {
    LOG.push({ t: now(), kind: kind, msg: String(msg == null ? '' : msg), detail: detail || '' });
    if (LOG.length > 120) LOG.shift();
    if (DIAG) renderDiag();
  }
  function isGas(url) { return GAS_RE.test(String(url || '')); }

  /* ---------- ۱) طبقه‌بندی خطا: منبع vs اجرا ---------- */
  function assetUrl(el) { return el && (el.src || el.href) || ''; }
  function isResource(ev) {
    var t = ev && ev.target;
    return !!(t && t !== w && t.tagName && /^(SCRIPT|LINK|IMG|IFRAME|SOURCE|VIDEO|AUDIO)$/.test(String(t.tagName).toUpperCase()));
  }

  w.addEventListener('error', function (ev) {
    if (isResource(ev)) {
      var el = ev.target, url = assetUrl(el);
      rec('asset', 'بارگذاری منبع ناموفق', url);
      if (String(el.tagName).toUpperCase() === 'SCRIPT') tryChartFallback(url);
      return;
    }
    rec('runtime', (ev && ev.message) || 'خطای اجرا',
      ((ev && ev.filename) || '') + ':' + ((ev && ev.lineno) || 0) + ':' + ((ev && ev.colno) || 0));
  }, true);

  w.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    rec('promise', (r && r.message) || String(r || 'Promise رد شد'), '');
  });

  /* ---------- ۲) سخت‌سازی fetch برای Apps Script ---------- */
  var nativeFetch = w.fetch ? w.fetch.bind(w) : null;

  function xhrPost(url, body, timeout, cb, err) {
    var x;
    try { x = new XMLHttpRequest(); } catch (e) { err(new Error('XHR در دسترس نیست')); return; }
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return; settled = true;
      try { x.abort(); } catch (e) {}
      err(new Error('timeout'));
    }, timeout);
    function done(fn, arg) { if (settled) return; settled = true; clearTimeout(timer); fn(arg); }
    try {
      x.open('POST', url, true);
      /* text/plain ⇒ درخواست ساده ⇒ بدون preflight OPTIONS */
      x.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      x.withCredentials = false;
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        if (x.status === 0) { done(err, new Error('network')); return; }
        if (x.status >= 200 && x.status < 400) done(cb, x.responseText);
        else done(err, new Error('HTTP ' + x.status));
      };
      x.onerror = function () { done(err, new Error('network')); };
      x.ontimeout = function () { done(err, new Error('timeout')); };
      x.send(body);
    } catch (e) { done(err, e); }
  }

  function fakeResponse(text) {
    return {
      ok: true, status: 200, statusText: 'OK', redirected: false, type: 'basic', url: '',
      headers: { get: function () { return 'application/json'; } },
      text: function () { return w.Promise ? w.Promise.resolve(text) : { then: function (f) { f(text); } }; },
      json: function () {
        var p = JSON.parse(text);
        return w.Promise ? w.Promise.resolve(p) : { then: function (f) { f(p); } };
      },
      clone: function () { return fakeResponse(text); }
    };
  }

  function gasFetch(url, opts) {
    opts = opts || {};
    var body = opts.body;
    if (body && typeof body !== 'string') {
      try { body = String(body); } catch (e) { body = ''; }
    }
    var timeout = Number(opts.__zvTimeout || 30000);
    var attempts = 2;

    function attempt(n) {
      return new w.Promise(function (resolve, reject) {
        /* تلاش ۱: fetch با تنظیمات سازگار — تلاش ۲: XHR */
        if (n === 0 && nativeFetch) {
          var settled = false;
          var to = setTimeout(function () { if (!settled) { settled = true; reject(new Error('timeout')); } }, timeout);
          nativeFetch(url, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-store',
            credentials: 'omit',      /* حیاتی: با include، redirect می‌شکند */
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: body || ''
          }).then(function (r) {
            if (settled) return; settled = true; clearTimeout(to); resolve(r);
          })['catch'](function (e) {
            if (settled) return; settled = true; clearTimeout(to); reject(e);
          });
        } else {
          xhrPost(url, body || '', timeout, function (txt) {
            rec('transport', 'XHR موفق بود (fetch شکست خورده بود)', url);
            resolve(fakeResponse(txt));
          }, reject);
        }
      })['catch'](function (e) {
        rec('transport', 'تلاش ' + (n + 1) + ' ناموفق: ' + (e && e.message || e), url);
        if (n + 1 < attempts) return attempt(n + 1);
        throw new Error(friendly(e));
      });
    }
    if (!w.Promise) {
      /* WebView بسیار قدیمی: فقط XHR */
      return {
        then: function (ok, bad) {
          xhrPost(url, body || '', timeout, function (t) { ok(fakeResponse(t)); },
            function (e) { if (bad) bad(new Error(friendly(e))); });
          return this;
        },
        'catch': function (f) { return this.then(null, f); }
      };
    }
    return attempt(0);
  }

  function friendly(e) {
    var m = String(e && e.message || e || '');
    if (/timeout/i.test(m)) return 'پاسخ سرور در زمان مقرر نرسید. اتصال اینترنت یا فیلترشکن را بررسی کنید.';
    if (/Failed to fetch|network|NetworkError|load failed/i.test(m))
      return 'ارتباط با سرور گوگل برقرار نشد. معمولاً به‌دلیل مسدود بودن script.google.com در این مرورگر است؛ لینک را در کروم باز کنید.';
    if (/HTTP 401|HTTP 403/.test(m)) return 'دسترسی وب‌اپ محدود است؛ در Deploy باید Access = Anyone باشد.';
    if (/HTTP 404/.test(m)) return 'آدرس وب‌اپ اشتباه است یا نسخه جدید Deploy نشده.';
    if (/HTTP 5\d\d/.test(m)) return 'خطای داخلی Apps Script؛ لاگ Executions را بررسی کنید.';
    return m || 'خطای نامشخص در ارتباط با سرور';
  }

  w.fetch = function (input, opts) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (isGas(url)) return gasFetch(url, opts);
    if (nativeFetch) return nativeFetch(input, opts);
    return new w.Promise(function (_, rej) { rej(new Error('fetch در این مرورگر پشتیبانی نمی‌شود')); });
  };
  try { w.fetch.__zvWrapped = true; } catch (e) {}

  /* ---------- ۳) Polyfill حداقلی برای WebView قدیمی ---------- */
  if (!w.Promise) {
    rec('polyfill', 'Promise موجود نیست — موتور JS قدیمی است', '');
  }
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (v) {
      for (var i = 0; i < this.length; i++) if (this[i] === v) return i;
      return -1;
    };
  }
  if (!String.prototype.trim) {
    String.prototype.trim = function () { return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ''); };
  }
  if (!Object.keys) {
    Object.keys = function (o) { var a = [], k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) a.push(k); return a; };
  }
  if (!w.console) w.console = { log: function () {}, warn: function () {}, error: function () {} };

  /* ---------- ۴) Chart.js با fallback چندنمونه‌ای ---------- */
  var CHART_URLS = [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
    'https://unpkg.com/chart.js@4.4.1/dist/chart.umd.min.js',
    'vendor/chart.umd.min.js'
  ];
  var chartTried = 0, chartLoading = false;

  function tryChartFallback(failedUrl) {
    if (w.Chart || chartLoading) return;
    if (failedUrl && !/chart/i.test(failedUrl)) return;
    chartLoading = true;
    (function next() {
      if (w.Chart) { chartLoading = false; fireChartReady(); return; }
      if (chartTried >= CHART_URLS.length) {
        chartLoading = false;
        rec('chart', 'Chart.js از هیچ منبعی بارگذاری نشد — نمودارها غیرفعال می‌مانند', '');
        fireChartReady();
        return;
      }
      var url = CHART_URLS[chartTried++];
      var s = d.createElement('script');
      s.src = url; s.async = true;
      s.onload = function () { chartLoading = false; rec('chart', 'Chart.js بارگذاری شد', url); fireChartReady(); };
      s.onerror = function () { rec('chart', 'منبع نمودار ناموفق', url); next(); };
      d.head.appendChild(s);
    })();
  }
  function fireChartReady() {
    try { w.dispatchEvent(new Event('zv:chart-ready')); }
    catch (e) { var ev = d.createEvent('Event'); ev.initEvent('zv:chart-ready', true, true); w.dispatchEvent(ev); }
    if (typeof w.onZvChartReady === 'function') { try { w.onZvChartReady(); } catch (e) {} }
  }
  w.zvEnsureChart = function () { if (!w.Chart) tryChartFallback('chart'); };

  /* ---------- ۵) تشخیص محیط ---------- */
  function env() {
    var ua = navigator.userAgent || '';
    var chrome = (ua.match(/Chrome\/(\d+)/) || [])[1];
    return {
      host: w.location.host,
      path: w.location.pathname,
      ua: ua,
      inAppBrowser: /Bale|Eitaa|Rubika|Telegram|Instagram|FBAN|FBAV|; wv\)/i.test(ua),
      chromeVersion: chrome ? Number(chrome) : null,
      isGasHost: /googleusercontent|script\.google/i.test(w.location.host),
      nativeRun: !!(w.google && w.google.script && w.google.script.run && !w.google.script.run.__zvBridge),
      bridgeLoaded: !!(w.google && w.google.script && w.google.script.run),
      fetchNative: !!nativeFetch,
      promise: !!w.Promise,
      proxy: typeof w.Proxy === 'function',
      optionalChaining: (function () { try { new Function('a', 'return a?.b'); return true; } catch (e) { return false; } })(),
      colorMix: !!(w.CSS && CSS.supports && CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')),
      hasSelector: !!(w.CSS && CSS.supports && CSS.supports('selector(:has(a))')),
      chart: !!w.Chart,
      online: navigator.onLine !== false,
      localStorage: (function () { try { localStorage.setItem('__zv', '1'); localStorage.removeItem('__zv'); return true; } catch (e) { return false; } })()
    };
  }

  function verdict(e) {
    var out = [];
    if (!e.optionalChaining) out.push('موتور JS قدیمی است: کدهای دارای ?. یا ?? اجرا نمی‌شوند. باید به سینتکس ES5 بازنویسی شوند.');
    if (!e.promise) out.push('Promise پشتیبانی نمی‌شود؛ کل ارتباط با سرور از کار می‌افتد.');
    if (e.isGasHost && !e.nativeRun) out.push('صفحه روی GAS باز شده اما google.script.run در دسترس نیست؛ صفحه در iframe سندباکس نیست.');
    if (!e.isGasHost && !e.bridgeLoaded) out.push('zv-api.js بارگذاری نشده؛ فایل را کنار HTML قرار دهید یا آدرس مطلق بدهید.');
    if (!e.localStorage) out.push('localStorage مسدود است؛ نشست ذخیره نمی‌شود و هر بار باید وارد شوید.');
    if (!e.chart) out.push('Chart.js بارگذاری نشده؛ نمودارها نمایش داده نمی‌شوند (بقیه پنل کار می‌کند).');
    if (!e.online) out.push('مرورگر آفلاین گزارش شده است.');
    if (e.inAppBrowser) out.push('مرورگر داخل پیام‌رسان تشخیص داده شد؛ برای عملکرد کامل، «باز کردن در مرورگر» را بزنید.');
    if (!out.length) out.push('محیط سالم است. اگر خطا ادامه دارد، لاگ زیر را بررسی کنید.');
    return out;
  }

  /* ---------- ۶) پینگ سرور ---------- */
  function ping(cb) {
    var url = '';
    var m = d.querySelector('meta[name="zv-api-url"]');
    if (m) url = m.getAttribute('content') || '';
    if (!url) { try { url = localStorage.getItem('zv_api_url') || ''; } catch (e) {} }
    if (!url && w.ZV_API_URL) url = w.ZV_API_URL;
    if (!url) { cb({ ok: false, msg: 'آدرس وب‌اپ تنظیم نشده (meta[name=zv-api-url])' }); return; }
    var t0 = Date.now();
    xhrPost(url, JSON.stringify({ action: 'codeVersion', args: [] }), 20000, function (txt) {
      var ok = false, ver = '';
      try { var j = JSON.parse(txt); ok = j && j.__ok === true; ver = ok ? String(j.result) : (j && j.error) || ''; } catch (e) {}
      cb({ ok: ok, ms: Date.now() - t0, msg: ok ? ('نسخه موتور: ' + ver) : ('پاسخ نامعتبر: ' + txt.slice(0, 160)) });
    }, function (e) { cb({ ok: false, ms: Date.now() - t0, msg: friendly(e) }); });
  }

  /* ---------- ۷) پنل تشخیص ---------- */
  var box = null;
  function renderDiag() {
    if (!DIAG) return;
    if (!d.body) { setTimeout(renderDiag, 120); return; }
    if (!box) {
      box = d.createElement('div');
      box.setAttribute('dir', 'rtl');
      box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0B1736;color:#E9EEFC;' +
        'font:12px/1.9 Tahoma,Arial,sans-serif;overflow:auto;padding:16px;-webkit-overflow-scrolling:touch';
      d.body.appendChild(box);
    }
    var e = env(), v = verdict(e);
    var h = '<div style="max-width:760px;margin:0 auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">' +
      '<b style="font-size:16px;color:#FF8A3D">تشخیص محیط ZingoVingo</b>' +
      '<button id="zvDiagX" style="background:#1B2F63;color:#fff;border:0;border-radius:9px;padding:8px 14px;font:inherit;cursor:pointer">بستن</button></div>';
    h += '<div style="background:#13234D;border-radius:12px;padding:12px;margin-bottom:12px">' +
      '<b style="color:#FFB25E">نتیجه بررسی</b><ul style="margin:8px 0 0;padding-right:18px">' +
      v.map(function (x) { return '<li style="margin:5px 0">' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '<div style="background:#13234D;border-radius:12px;padding:12px;margin-bottom:12px">' +
      '<b style="color:#FFB25E">مشخصات</b><table style="width:100%;margin-top:8px;border-collapse:collapse">';
    var keys = Object.keys(e);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], val = e[k];
      var col = (val === true || (k === 'chromeVersion' && val >= 90)) ? '#7EE2B8' :
        (val === false ? '#FF9A9A' : '#C9D4F2');
      h += '<tr><td style="padding:4px 0;color:#93A0C2;white-space:nowrap">' + esc(k) +
        '</td><td style="padding:4px 8px;color:' + col + ';word-break:break-all">' + esc(String(val)) + '</td></tr>';
    }
    h += '</table></div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '<button id="zvDiagPing" style="background:#FF6B1A;color:#fff;border:0;border-radius:9px;padding:10px 16px;font:inherit;font-weight:bold;cursor:pointer">تست اتصال به سرور</button>' +
      '<button id="zvDiagChart" style="background:#1B2F63;color:#fff;border:0;border-radius:9px;padding:10px 16px;font:inherit;cursor:pointer">تلاش مجدد نمودار</button>' +
      '<button id="zvDiagCopy" style="background:#1B2F63;color:#fff;border:0;border-radius:9px;padding:10px 16px;font:inherit;cursor:pointer">کپی گزارش</button></div>';
    h += '<div id="zvDiagPingOut" style="margin-bottom:12px"></div>';
    h += '<div style="background:#0E1830;border-radius:12px;padding:12px"><b style="color:#FFB25E">رویدادها (' + LOG.length + ')</b><div style="margin-top:8px">';
    if (!LOG.length) h += '<div style="color:#7E8DB1">رویدادی ثبت نشده است.</div>';
    for (var j = LOG.length - 1; j >= 0; j--) {
      var L = LOG[j];
      var c = L.kind === 'runtime' || L.kind === 'promise' ? '#FF9A9A' :
        L.kind === 'asset' || L.kind === 'chart' ? '#FFD08A' : '#9FD8FF';
      h += '<div style="border-bottom:1px solid #1D2B4F;padding:6px 0">' +
        '<span style="color:#7E8DB1">' + esc(L.t) + '</span> ' +
        '<b style="color:' + c + '">[' + esc(L.kind) + ']</b> ' + esc(L.msg) +
        (L.detail ? '<div style="color:#93A0C2;font-size:11px;word-break:break-all">' + esc(L.detail) + '</div>' : '') + '</div>';
    }
    h += '</div></div></div>';
    box.innerHTML = h;

    var x = d.getElementById('zvDiagX');
    if (x) x.onclick = function () { box.parentNode.removeChild(box); box = null; DIAG = false; };
    var pb = d.getElementById('zvDiagPing');
    if (pb) pb.onclick = function () {
      var o = d.getElementById('zvDiagPingOut');
      o.innerHTML = '<div style="background:#13234D;border-radius:10px;padding:10px">در حال تست…</div>';
      ping(function (r) {
        o.innerHTML = '<div style="background:' + (r.ok ? '#0E3B2C' : '#3B1418') + ';border-radius:10px;padding:10px;color:' +
          (r.ok ? '#7EE2B8' : '#FFB4B4') + '">' + (r.ok ? '✓ اتصال سالم' : '✕ اتصال ناموفق') +
          (r.ms ? ' — ' + r.ms + 'ms' : '') + '<div style="margin-top:5px;color:#C9D4F2">' + esc(r.msg) + '</div></div>';
      });
    };
    var cb = d.getElementById('zvDiagChart');
    if (cb) cb.onclick = function () { chartTried = 0; tryChartFallback('chart'); };
    var cp = d.getElementById('zvDiagCopy');
    if (cp) cp.onclick = function () {
      var txt = JSON.stringify({ env: env(), verdict: v, log: LOG }, null, 1);
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(txt);
        else { var ta = d.createElement('textarea'); ta.value = txt; d.body.appendChild(ta); ta.select(); d.execCommand('copy'); d.body.removeChild(ta); }
        cp.textContent = 'کپی شد ✓';
      } catch (e) { cp.textContent = 'کپی ناموفق'; }
    };
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- ۸) API عمومی ---------- */
  w.zvDiag = function () { DIAG = true; renderDiag(); };
  w.zvEnv = env;
  w.zvPing = ping;
  w.zvLog = LOG;

  rec('boot', 'لایه سازگاری فعال شد', w.location.href);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { if (DIAG) renderDiag(); });
  else if (DIAG) renderDiag();

  /* اگر تا ۴ ثانیه Chart نیامد، خودکار تلاش کن */
  setTimeout(function () { if (!w.Chart) tryChartFallback('chart'); }, 4000);

})(window, document);
