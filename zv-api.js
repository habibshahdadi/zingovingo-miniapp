/* ZingoVingo API Shim V1 — جایگزین google.script.run روی هاست استاتیک */
(function () {
  var API_URL = 'https://script.google.com/macros/s/AKfycbwjFAiqfPiLijKT5sF63GQocU7tWvrlfFbZCY9CQ39_R_tMT9xq_dZFVSkR-mCaPhgh/exec';

  function defaultFail(e) {
    console.error('[ZV-API]', e && e.message ? e.message : e);
    if (window.showAlert) { try { window.showAlert((e && e.message) || 'خطا در ارتباط با سرور', 'error'); } catch (_) {} }
  }

  function callServer(action, args, ok, fail) {
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, args: args })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (env) {
      if (env && env.__ok) { if (ok) ok(env.result); }
      else { (fail || defaultFail)({ message: (env && env.error) || 'پاسخ نامعتبر از سرور' }); }
    }).catch(function (err) {
      (fail || defaultFail)({ message: 'خطای ارتباط با سرور: ' + (err && err.message ? err.message : err) });
    });
  }

  function makeRun() {
    var ok = null, fail = null;
    var proxy = new Proxy({
      withSuccessHandler: function (fn) { ok = fn; return proxy; },
      withFailureHandler: function (fn) { fail = fn; return proxy; }
    }, {
      get: function (t, prop) {
        if (prop in t) return t[prop];
        return function () {
          callServer(String(prop), Array.prototype.slice.call(arguments), ok, fail);
        };
      }
    });
    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', { get: function () { return makeRun(); }, configurable: true });
  window.ZV_API_URL = API_URL;
})();