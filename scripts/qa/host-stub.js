/**
 * דמה של מאחז אוצריא, בשביל שערי ה-QA שרצים על ה-dist הארוז ב-file://.
 *
 * זה אינו `src/host/dev-stub.ts`: הדמה ההוא נטען בתוך הבאנדל של הפיתוח, וכאן
 * צריך משהו שיושב **לפני** הבאנדל, בדף עצמו, כמו שאוצריא מזריקה בפועל. הוא גם
 * מקליט: כל קריאה נשמרת ב-`window.__qaHost.calls`, וכך שער יכול לשאול „האם
 * הכפתור הזה באמת פנה למאחז”.
 */
(function () {
  var BOOT = {
    plugin: { id: 'otzaria-word-qa', version: '0' },
    app: { version: '9.9.9', platform: 'qa', language: 'he' },
    theme: { mode: 'light', colorScheme: {}, typography: {} },
    connectivity: { isOnline: false },
    permissions: ['storage', 'clipboard.read', 'fs.read', 'fs.write'],
  };

  var H = (window.__qaHost = {
    calls: [],
    storage: {},
    /** מה שהמאחז יענה על מתודה מסוימת. שער יכול לדרוס לפני שהוא לוחץ. */
    replies: {},
    /** מה שהוצג למשתמש דרך המאחז — showError / showMessage / showConfirm. */
    messages: [],
    confirmAnswer: true,
    reset: function () {
      H.calls.length = 0;
      H.messages.length = 0;
    },
  });

  function ok(data) {
    return Promise.resolve({ success: true, data: data === undefined ? null : data, error: null });
  }
  function fail(message, code) {
    return Promise.resolve({
      success: false,
      data: null,
      error: { message: message, code: code || 'error.not_supported' },
    });
  }

  var listeners = {};

  window.Otzaria = {
    call: function (method, payload) {
      H.calls.push({ method: method, payload: payload, t: Math.round(performance.now()) });

      if (Object.prototype.hasOwnProperty.call(H.replies, method)) {
        var custom = H.replies[method];
        return typeof custom === 'function' ? custom(payload) : ok(custom);
      }

      switch (method) {
        case 'app.getInfo':
          return ok(BOOT.app);
        case 'app.getTheme':
          return ok(BOOT.theme);
        case 'app.getGrantedPermissions':
          return ok({ permissions: BOOT.permissions });
        case 'storage.get':
          return ok({ value: H.storage[payload && payload.key] });
        case 'storage.set':
          H.storage[payload.key] = payload.value;
          return ok({});
        case 'storage.remove':
          delete H.storage[payload.key];
          return ok({});
        case 'ui.showError':
        case 'ui.showMessage':
        case 'ui.showSuccess':
          H.messages.push({ method: method, text: payload && payload.message });
          return ok({});
        case 'ui.showConfirm':
          H.messages.push({ method: method, text: payload && (payload.content || payload.title) });
          return ok({ confirmed: H.confirmAnswer });
        default:
          return fail('אין תמיכה בדמה: ' + method);
      }
    },
    on: function (event, handler) {
      (listeners[event] = listeners[event] || []).push(handler);
    },
    off: function (event, handler) {
      var list = listeners[event] || [];
      var i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    },
  };

  window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));
})();
