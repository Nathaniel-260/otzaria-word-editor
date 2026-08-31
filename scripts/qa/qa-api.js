/**
 * ה-API שבתוך הדף לשערי ה-QA של הרצועה: „מצא את הפקד הזה, אמור לי מה מצבו,
 * ותן לי את המלבן שלו כדי שהלחיצה תהיה לחיצה אמיתית”.
 *
 * למה מלבן ולא `element.click()`: כל פקד ברצועה עושה `@pointerdown.prevent`
 * כדי לא לגזול את המיקוד מהעורך, ו-`click()` תכנותי מדלג בדיוק על השלב הזה —
 * כלומר בודק מסלול שהמשתמש לעולם אינו עובר בו. הלחיצות נשלחות מ-Node דרך
 * `Input.dispatchMouseEvent`.
 */
(function () {
  var Q = (window.__qa = {});

  Q.log = [];
  ['error', 'warn'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      try {
        Q.log.push(level + ': ' + Array.prototype.map.call(arguments, String).join(' ').slice(0, 400));
      } catch (e) {}
      return original.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    Q.log.push('uncaught: ' + (e && e.message));
  });
  window.addEventListener('unhandledrejection', function (e) {
    Q.log.push('rejected: ' + String((e && e.reason && e.reason.message) || (e && e.reason)));
  });

  Q.ready = function () {
    return !!window.__otzariaEditor && !document.getElementById('otzaria-splash');
  };

  Q.ribbon = function () {
    return document.querySelector('.word-ribbon-container');
  };

  /**
   * שם הפקד כפי שהשער מזהה אותו.
   *
   * `data-tip-title` הוא המקור: תכונת `title` הוסרה מכל התוסף, כדי שמערכת
   * ההפעלה לא תצייר טולטיפ שני מעל הכרטיס המעוצב. הנפילה אליה נשארת כאן כדי
   * שהשער יוכל לרוץ גם על dist ארוז ישן.
   */
  function nameOf(el) {
    var tip = el.getAttribute('data-tip-title');
    if (tip) return tip;
    var title = el.getAttribute('title') || '';
    // ה-title נושא את הקיצור בסוגריים; השם הוא מה שלפניו.
    return title.replace(/\s*\([^)]*\)\s*$/, '') || el.getAttribute('aria-label') || (el.textContent || '').trim();
  }
  Q.nameOf = nameOf;

  /** הלשוניות של הרצועה: המזהה שלהן הוא התווית שמופיעה על הכפתור. */
  Q.tabs = function () {
    return Array.prototype.map.call(document.querySelectorAll('.word-tab-btn'), function (b) {
      return { label: (b.textContent || '').trim(), active: b.classList.contains('active') };
    });
  };

  Q.tabRect = function (label) {
    var found = null;
    Array.prototype.forEach.call(document.querySelectorAll('.word-tab-btn'), function (b) {
      if (!found && (b.textContent || '').trim() === label) found = b;
    });
    return found ? Q.rectOf(found) : null;
  };

  Q.activeTab = function () {
    var b = document.querySelector('.word-tab-btn.active');
    return b ? (b.textContent || '').trim() : null;
  };

  Q.rectOf = function (el) {
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  };

  /** כל הפקדים בגוף הלשונית הפעילה. `scope` מאפשר לחפש גם בתפריט פתוח. */
  Q.controls = function (scope) {
    var root = document.querySelector(scope || '.word-ribbon-body');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll('button, select, input'), function (el) {
      return {
        tag: el.tagName.toLowerCase(),
        name: nameOf(el),
        text: (el.textContent || '').trim().slice(0, 40),
        disabled: !!el.disabled,
        active: el.classList.contains('active'),
        pressed: el.getAttribute('aria-pressed'),
        // גם בורר החיפוש מדווח ערך: הוא `<input>`, וה-`value` שלו הוא הגופן
      // הנוכחי כל עוד לא מקלידים בו (ראו RibbonCombo).
      value: el.tagName === 'SELECT' || el.getAttribute('role') === 'combobox' ? el.value : undefined,
        cls: el.className,
      };
    });
  };

  function match(el, name, exact) {
    var n = nameOf(el);
    return exact ? n === name : n.indexOf(name) === 0;
  }

  /** מאתר פקד לפי שם. מחפש בכל הדף — תפריטים נפתחים מחוץ לגוף הלשונית. */
  Q.el = function (name, opts) {
    opts = opts || {};
    var scope = document.querySelector(opts.scope || 'body');
    if (!scope) return null;
    var nodes = scope.querySelectorAll(opts.selector || 'button, select, input, [role="menuitem"], [role="option"]');
    var hits = [];
    Array.prototype.forEach.call(nodes, function (el) {
      if (match(el, name, opts.exact)) hits.push(el);
    });
    if (!hits.length) return null;
    return hits[opts.index || 0];
  };

  Q.state = function (name, opts) {
    var el = Q.el(name, opts);
    if (!el) return { found: false };
    return {
      found: true,
      tag: el.tagName.toLowerCase(),
      name: nameOf(el),
      disabled: !!el.disabled,
      active: el.classList.contains('active'),
      pressed: el.getAttribute('aria-pressed'),
      value: el.tagName === 'SELECT' ? el.value : undefined,
      rect: Q.rectOf(el),
      visible: !!Q.rectOf(el),
    };
  };

  /** המלבן ללחיצה. `null` כשהפקד לא נמצא או אינו מוצג. */
  Q.rect = function (name, opts) {
    var el = Q.el(name, opts);
    return el ? Q.rectOf(el) : null;
  };

  /** שני סוגי בוררים: `<select>` נייטיב, ובורר החיפוש (RibbonCombo). */
  var PICKER = 'select, input[role="combobox"]';

  /**
   * פותח את בורר החיפוש ומחזיר את האפשרויות שברשימה שלו.
   *
   * הרשימה קיימת ב-DOM רק כשהבורר פתוח — בניגוד ל-`<select>`, שאפשרויותיו שם
   * תמיד. לכן כל קריאה כאן פותחת בפועל, ומי שקורא אחראי לסגור.
   */
  function comboOpen(el) {
    el.focus();
    // ניקוי השאילתה: פתיחה אחרי הקלדה קודמת הייתה מחזירה רשימה מסוננת.
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));

    /*
      ההמתנה אינה נימוס — בלעדיה זה פשוט לא עובד. Vue מרנדר במיקרו-משימה,
      ולכן מיד אחרי `focus` הרשימה עוד אינה ב-DOM ו-`getElementById` מחזיר
      null. נמדד: `Q.el` מצא את הפקד ו-`Q.options` החזיר null באותה נשימה.

      שלושה סבבים ולא אחד: הפתיחה מעדכנת גם את `activeIndex`, ויש `watch`
      עם `nextTick` משלו. `Runtime.evaluate` נשלח עם `awaitPromise`, ולכן
      החזרת Promise מכאן תקינה לגמרי.
    */
    var listId = el.getAttribute('aria-controls');
    return Promise.resolve()
      .then(function () { return null; })
      .then(function () { return null; })
      .then(function () {
        return listId ? document.getElementById(listId) : null;
      });
  }

  function comboClose(el) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    el.blur();
  }

  function comboOptions(list) {
    return Array.prototype.map.call(list.querySelectorAll('[role="option"]'), function (o) {
      return {
        value: o.getAttribute('data-value') || '',
        label: (o.textContent || '').trim(),
        group: o.getAttribute('data-group') || ''
      };
    });
  }

  /**
   * בחירה בבורר. ב-`<select>` — הצבה ואירוע; ב-RibbonCombo — פתיחה ולחיצה
   * אמיתית על השורה, כי הקומפוננטה מקשיבה ל-`mousedown` ולא ל-`change`.
   */
  Q.selectValue = function (name, value) {
    var el = Q.el(name, { selector: PICKER });
    if (!el) return 'not-found';

    if (el.tagName === 'SELECT') {
      var found = Array.prototype.some.call(el.options, function (o) {
        return o.value === value;
      });
      if (!found) {
        return 'no-option:' + Array.prototype.map.call(el.options, function (o) { return o.value; }).join(',');
      }
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    }

    return comboOpen(el).then(function (list) {
      if (!list) { comboClose(el); return 'no-list'; }
      var hit = list.querySelector('[role="option"][data-value="' + String(value).replace(/"/g, '\\"') + '"]');
      if (!hit) {
        var all = comboOptions(list).map(function (o) { return o.value; });
        comboClose(el);
        return 'no-option:' + all.slice(0, 40).join(',');
      }
      hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      return 'ok';
    });
  };

  Q.options = function (name) {
    var el = Q.el(name, { selector: PICKER });
    if (!el) return null;

    if (el.tagName !== 'SELECT') {
      return comboOpen(el).then(function (list) {
        var rows = list ? comboOptions(list) : null;
        comboClose(el);
        return rows;
      });
    }

    return Array.prototype.map.call(el.options, function (o) {
      return {
        value: o.value,
        label: o.textContent.trim(),
        // כותרת ה-`<optgroup>` שהאפשרות יושבת בו, או '' לאפשרות חשופה. בורר
        // הגופן מקבץ מרגע שהמכונה נמנתה (src/engine/system-fonts.ts), ובלי
        // הקבוצה אי אפשר לדעת מהרשימה השטוחה אם הקיבוץ בכלל קרה.
        group: o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : ''
      };
    });
  };

  /** שורת המצב: ההודעה שהתוסף הראה, ואם היא שגיאה. */
  Q.status = function () {
    var el = document.querySelector('.status-message');
    return {
      text: el ? (el.textContent || '').trim() : null,
      error: el ? el.classList.contains('error') : false,
    };
  };

  /** מה שהוצג דרך המאחז מאז ה-reset האחרון. */
  Q.messages = function () {
    return (window.__qaHost && window.__qaHost.messages) || [];
  };
  Q.hostCalls = function () {
    return (window.__qaHost && window.__qaHost.calls) || [];
  };
  Q.reset = function () {
    if (window.__qaHost) window.__qaHost.reset();
    Q.log.length = 0;
    return true;
  };


  /* -------------------- תפריטים, פופאוברים ודיאלוגים -------------------- */

  /** התוויות בתפריט שנפתח מ-RibbonMenuButton. */
  Q.menuItems = function () {
    return Array.prototype.map.call(document.querySelectorAll('.ribbon-menu__popover .ribbon-menu__item'), function (b) {
      var label = b.querySelector('.ribbon-menu__item-label');
      var hint = b.querySelector('.ribbon-menu__item-hint');
      return {
        label: label ? label.textContent.trim() : b.textContent.trim(),
        hint: hint ? hint.textContent.trim() : '',
      };
    });
  };

  Q.menuRect = function (label) {
    var found = null;
    Array.prototype.forEach.call(document.querySelectorAll('.ribbon-menu__popover .ribbon-menu__item'), function (b) {
      if (found) return;
      var el = b.querySelector('.ribbon-menu__item-label');
      var text = el ? el.textContent.trim() : b.textContent.trim();
      if (text === label) found = b;
    });
    return found ? Q.rectOf(found) : null;
  };

  Q.menuOpen = function () {
    return !!document.querySelector('.ribbon-menu__popover');
  };

  /** הפופאובר של הצבעים: כפתור החץ פותח, והמשבצות הן `.color-swatch` וכד'. */
  Q.paletteOpen = function () {
    return !!document.querySelector('.color-palette-popover');
  };
  Q.paletteSwatches = function () {
    return Array.prototype.map.call(
      document.querySelectorAll('.color-palette-popover button'),
      function (b) {
        return { title: nameOf(b), cls: b.className };
      },
    );
  };
  Q.paletteRect = function (index) {
    var nodes = document.querySelectorAll('.color-palette-popover button');
    return nodes[index] ? Q.rectOf(nodes[index]) : null;
  };
  Q.paletteRectByTitle = function (title) {
    var found = null;
    Array.prototype.forEach.call(document.querySelectorAll('.color-palette-popover button'), function (b) {
      if (!found && nameOf(b) === title) found = b;
    });
    return found ? Q.rectOf(found) : null;
  };

  /** גלריית הסגנונות. */
  Q.galleryItems = function () {
    return Array.prototype.map.call(document.querySelectorAll('.style-card'), function (b) {
      return { label: nameOf(b), active: b.classList.contains('active'), disabled: !!b.disabled };
    });
  };
  Q.galleryRect = function (label) {
    var found = null;
    Array.prototype.forEach.call(document.querySelectorAll('.style-card'), function (b) {
      if (!found && nameOf(b) === label) found = b;
    });
    return found ? Q.rectOf(found) : null;
  };

  /** בורר הטבלה: תא לפי שורה ועמודה (1-מבוסס). */
  Q.tableCellRect = function (row, col) {
    var rows = document.querySelectorAll('.table-picker-popover .grid-row');
    var r = rows[row - 1];
    if (!r) return null;
    var cells = r.querySelectorAll('[role="gridcell"], .grid-cell');
    return cells[col - 1] ? Q.rectOf(cells[col - 1]) : null;
  };

  /** הדיאלוג הפתוח: שמו, והפקדים שבו. */
  Q.dialog = function () {
    var el = document.querySelector('[role="dialog"]');
    if (!el) return null;
    return {
      label: el.getAttribute('aria-label') || '',
      cls: el.className,
      controls: Array.prototype.map.call(el.querySelectorAll('button, input, select, textarea'), function (c) {
        return {
          tag: c.tagName.toLowerCase(),
          type: c.type,
          name: nameOf(c),
          text: (c.textContent || '').trim().slice(0, 40),
          id: c.id,
          value: c.value,
          disabled: !!c.disabled,
          checked: c.type === 'checkbox' || c.type === 'radio' ? !!c.checked : undefined,
        };
      }),
    };
  };

  Q.dialogRect = function (name) {
    var root = document.querySelector('[role="dialog"]');
    if (!root) return null;
    var found = null;
    Array.prototype.forEach.call(root.querySelectorAll('button, input, select, textarea'), function (c) {
      if (found) return;
      if (nameOf(c) === name || (c.textContent || '').trim() === name || c.id === name) found = c;
    });
    return found ? Q.rectOf(found) : null;
  };

  /** כתיבה לשדה בדיאלוג — `input` ו-`change` כדי ש-v-model יראה. */
  Q.dialogFill = function (idOrName, value) {
    var root = document.querySelector('[role="dialog"]');
    if (!root) return 'no-dialog';
    var found = null;
    Array.prototype.forEach.call(root.querySelectorAll('input, select, textarea'), function (c) {
      if (found) return;
      if (c.id === idOrName || nameOf(c) === idOrName) found = c;
    });
    if (!found) return 'not-found';
    if (found.type === 'checkbox' || found.type === 'radio') {
      found.checked = !!value;
    } else {
      found.value = String(value);
    }
    found.dispatchEvent(new Event('input', { bubbles: true }));
    found.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  };

  /** מלבן לפי בורר CSS, לכל מה שאין לו עזר ייעודי. */
  Q.rectSel = function (selector, index) {
    var nodes = document.querySelectorAll(selector);
    var el = nodes[index || 0];
    return el ? Q.rectOf(el) : null;
  };

  Q.exists = function (selector) {
    return !!document.querySelector(selector);
  };

  /* -------------------- המסמך -------------------- */

  Q.sd = function () {
    return window.__otzariaEditor && window.__otzariaEditor.superdoc;
  };
  Q.doc = function () {
    var sd = Q.sd();
    return sd && sd.activeEditor && sd.activeEditor.doc;
  };
  Q.ui = function () {
    return window.__otzariaEditor && window.__otzariaEditor.ui;
  };

  /** מצב פקודה כפי שהמנוע מדווח אותו — לא כפי שהרצועה מציירת. */
  Q.cmd = function (id) {
    var ui = Q.ui();
    if (!ui) return { error: 'no-ui' };
    if (!ui.commands.has(id)) return { has: false };
    var s = ui.commands.get(id).getState();
    return { has: true, supported: s.supported, enabled: s.enabled, active: s.active, value: s.value, reason: s.reason };
  };

  /** שורה ראשונה של טקסט במסמך — יעד ללחיצה שממקמת סמן. */
  Q.lineRect = function (index) {
    var lines = document.querySelectorAll('.superdoc-line, .superdoc-fragment');
    var el = lines[index || 0];
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x + Math.min(20, r.width / 2)),
      y: Math.round(r.y + r.height / 2),
      right: Math.round(r.x + r.width - 4),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  };

  Q.lineCount = function () {
    return document.querySelectorAll('.superdoc-line, .superdoc-fragment').length;
  };

  /** הטקסט שהמנוע צייר על המסך. גס, אבל מספיק כדי לראות שמשהו נכנס. */
  Q.screenText = function () {
    var stack = document.querySelector('.editor-stack');
    return stack ? (stack.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000) : null;
  };

  Q.selection = function () {
    var ui = Q.ui();
    if (!ui) return { error: 'no-ui' };
    try {
      var s = ui.selection.get();
      return { status: s.status, empty: s.empty, text: s.text };
    } catch (e) {
      return { error: String(e && e.message) };
    }
  };

  /** מייצא docx ומחזיר base64. זו ההוכחה היחידה שמשהו נכתב למסמך. */
  Q.exportBase64 = function () {
    var sd = Q.sd();
    if (!sd) return Promise.resolve(null);
    return sd.export({ exportType: ['docx'], triggerDownload: false }).then(function (blob) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          var s = String(reader.result);
          resolve(s.slice(s.indexOf(',') + 1));
        };
        reader.readAsDataURL(blob);
      });
    });
  };
})();
