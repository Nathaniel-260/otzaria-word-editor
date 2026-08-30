/**
 * פס הכותרת ושורת המצב.
 *
 * שתי השורות האלה היו הריכוז הגדול ביותר של פקדים שנראים כמו פקדים ואינם:
 * תיבת חיפוש שהיא `input readonly` וה-`@click` שלה על ה-div העוטף, מתג שמירה
 * אוטומטית שהוא `div` בלי `role` ובלי מיקוד, כפתור „פריסת הדפסה” עם
 * `class="active"` קבוע ובלי מטפל, „עמוד 1 מתוך 1” על כל מסמך, ו-„0 מילים” על
 * מסמך מלא. כל אלה HTML תקין, ולכן שום typecheck לא התלונן.
 *
 * הבדיקות ב-tests/unit/shell-*.test.ts מודדות את הפונקציות הטהורות
 * (`pageLabel`, `docTitleWidthCh`) ואת החלטות ה-CSS. מה שנמדד כאן הוא מה
 * שדורש רינדור: שהפקד הוא באמת כפתור שמקבל מיקוד, שהתווית באמת נעלמת כשאין
 * מדידה, ושגבולות הזום באמת באים מה-props ולא ממספר קשיח.
 */
import { describe, expect, it } from 'vitest';
import TitleBar from '../../src/ui/shell/TitleBar.vue';
import StatusBar from '../../src/ui/shell/StatusBar.vue';
import { docTitleWidthCh } from '../../src/composables/shell-format';
import { FALLBACK_ZOOM } from '../../src/engine/zoom';
import { autoUnmount, emittedCount, mountUi, settle, tipMessage } from './harness';

autoUnmount();

describe('מתג השמירה האוטומטית', () => {
  it('הוא switch נגיש שמקבל מיקוד — ולא div שאיש אינו יכול להפעיל במקלדת', async () => {
    const harness = mountUi(TitleBar, { props: { autosaveEnabled: true } });
    await settle();

    const toggle = harness.wrapper.find('.autosave-toggle');
    expect(toggle.element.tagName).toBe('BUTTON');
    expect(toggle.attributes('role')).toBe('switch');
    expect(toggle.attributes('aria-checked')).toBe('true');

    // jsdom אינו מממש את הפעלת ה-Enter/רווח שהדפדפן נותן לכפתור, ולכן מה
    // שנמדד הוא התכונה שמעניקה אותה: אלמנט שהוא כפתור ונמצא ב-tab order.
    // `div` — מה שהיה כאן — נכשל בשתיהן.
    (toggle.element as HTMLElement).focus();
    expect(document.activeElement).toBe(toggle.element);

    await toggle.trigger('click');
    expect(harness.wrapper.emitted('toggle-autosave')).toHaveLength(1);
  });

  it('מדווח את מצבו — קורא מסך אומר אם היא פועלת', async () => {
    const harness = mountUi(TitleBar, { props: { autosaveEnabled: false } });
    await settle();

    const toggle = harness.wrapper.find('.autosave-toggle');
    expect(toggle.attributes('aria-checked')).toBe('false');
    expect(tipMessage(toggle)).toContain('כבויה');

    await harness.wrapper.setProps({ autosaveEnabled: true });
    expect(harness.wrapper.find('.autosave-toggle').attributes('aria-checked')).toBe('true');
  });
});

describe('פקדי פס הכותרת', () => {
  it('החיפוש הוא כפתור עם שם נגיש', async () => {
    // מה שהיה: `input readonly` שנראה כמו מקום להקליד בו, וה-`@click` על ה-div
    // העוטף — כלומר המקלדת לא הגיעה אליו בכלל.
    const harness = mountUi(TitleBar);
    await settle();

    const search = harness.wrapper.find('.search-box');
    expect(search.element.tagName).toBe('BUTTON');
    expect(search.attributes('aria-label')).toBe('חיפוש והחלפה במסמך');
    expect(harness.wrapper.find('input[readonly]').exists()).toBe(false);

    await search.trigger('click');
    expect(harness.wrapper.emitted('open-find')).toHaveLength(1);
  });

  it('לכל כפתור בסרגל הגישה המהירה יש מטפל', async () => {
    const harness = mountUi(TitleBar, { props: { canUndo: true, canRedo: true } });
    await settle();

    for (const button of harness.wrapper.findAll('.qa-btn')) {
      await button.trigger('click');
    }

    expect(harness.wrapper.emitted('save')).toHaveLength(1);
    expect(harness.wrapper.emitted('undo')).toHaveLength(1);
    expect(harness.wrapper.emitted('redo')).toHaveLength(1);
  });

  it('היסטוריה ריקה מנטרלת „בטל” ו„חזור”', async () => {
    const harness = mountUi(TitleBar, { props: { canUndo: false, canRedo: false } });
    await settle();

    const buttons = harness.wrapper.findAll('.qa-btn');
    expect(buttons[1].attributes('disabled')).toBeDefined();
    expect(buttons[2].attributes('disabled')).toBeDefined();
  });

  it('שמירה בתהליך מנטרלת את „שמור”, ושינויים לא שמורים מסומנים', async () => {
    const harness = mountUi(TitleBar, { props: { isSaving: true, isDirty: true } });
    await settle();

    expect(harness.wrapper.findAll('.qa-btn')[0].attributes('disabled')).toBeDefined();
    expect(harness.wrapper.find('.dirty-badge').exists()).toBe(true);
    expect(harness.wrapper.find('.dirty-indicator').exists()).toBe(true);
  });

  it('שינוי שם המסמך נפלט, והרוחב נגזר מהשם', async () => {
    const long = 'חידושים על מסכת בבא מציעא';
    const harness = mountUi(TitleBar, { props: { title: long } });
    await settle();

    const input = harness.wrapper.find('.doc-title-input');
    expect(input.attributes('style')).toContain(`${docTitleWidthCh(long)}ch`);

    // הקלדה אינה פולטת: השם נמסר ב-`change`, כלומר כשהמשתמש סיים.
    (input.element as HTMLInputElement).value = 'מסמך אחר';
    await input.trigger('change');
    expect(harness.wrapper.emitted('update-title')).toEqual([['מסמך אחר']]);
  });

  it('מצב השמירה מוצג רק כשיש מה לומר', async () => {
    const harness = mountUi(TitleBar, { props: { saveStateText: '' } });
    await settle();
    expect(harness.wrapper.find('.save-state-pill').exists()).toBe(false);

    await harness.wrapper.setProps({ saveStateText: 'שגיאה בשמירה', isSaveError: true });
    const pill = harness.wrapper.find('.save-state-pill');
    expect(pill.text()).toBe('שגיאה בשמירה');
    expect(pill.classes()).toContain('error');
  });
});

describe('נתוני שורת המצב', () => {
  it('מה שלא נמדד אינו מוצג', async () => {
    const harness = mountUi(StatusBar, {
      props: { currentPage: null, totalPages: null, wordCount: null, statusText: '' },
    });
    await settle();

    // „עמוד 1 מתוך 1” ו-„0 מילים” היו מוצגים כאן על כל מסמך.
    expect(harness.wrapper.find('.statusbar-start').text()).toBe('');
  });

  it('מה שנמדד מוצג בנוסח של הפונקציות', async () => {
    const harness = mountUi(StatusBar, {
      props: { currentPage: 4, totalPages: 12, wordCount: 1, statusText: 'נשמר' },
    });
    await settle();

    const text = harness.wrapper.find('.statusbar-start').text();
    expect(text).toContain('עמוד 4 מתוך 12');
    expect(text).toContain('מילה אחת');
    expect(text).toContain('נשמר');
  });

  it('כפתור מצב המיקוד מדווח את מצבו ואינו „דלוק תמיד”', async () => {
    const harness = mountUi(StatusBar, { props: { isFocusMode: false } });
    await settle();

    const button = harness.wrapper.find('.sb-icon-btn');
    expect(button.attributes('aria-pressed')).toBe('false');
    expect(button.classes()).not.toContain('active');

    await button.trigger('click');
    expect(harness.wrapper.emitted('toggle-focus')).toHaveLength(1);

    await harness.wrapper.setProps({ isFocusMode: true });
    expect(harness.wrapper.find('.sb-icon-btn').attributes('aria-pressed')).toBe('true');
    expect(harness.wrapper.find('.sb-icon-btn').classes()).toContain('active');
  });
});

describe('בקרת הזום', () => {
  it('הגבולות מגיעים מהמנוע ולא ממספר קשיח', async () => {
    // 50/200 היו מקודדים גם בסרגל וגם ב-stepZoom. כאן נמסרים גבולות אחרים
    // לגמרי, וכל הפקדים חייבים לכבד אותם.
    const harness = mountUi(StatusBar, {
      props: { zoomLevel: 25, zoomMin: 25, zoomMax: 400 },
    });
    await settle();

    const slider = harness.wrapper.find('input[type="range"]');
    expect(slider.attributes('min')).toBe('25');
    expect(slider.attributes('max')).toBe('400');

    const [minus, plus] = harness.wrapper.findAll('.zoom-step-btn');
    expect(minus.attributes('disabled'), 'ברצפה — הקטנה חסומה').toBeDefined();
    expect(plus.attributes('disabled'), 'ורחוק מהתקרה — הגדלה פתוחה').toBeUndefined();
  });

  it('הצעד נחתך לתקרה שהמנוע דיווח, ולא ל-200 מקודד', async () => {
    // 200 היה מקודד גם ב-`stepZoom` וגם בסרגל. מנוע שמדווח תקרה של 400 חושף
    // את זה מיד: צעד מ-395 היה נחתך ל-200, כלומר **הקטנה** במקום הגדלה.
    const wide = mountUi(StatusBar, { props: { zoomLevel: 395, zoomMin: 50, zoomMax: 400 } });
    await settle();
    await wide.wrapper.findAll('.zoom-step-btn')[1].trigger('click');
    expect(wide.wrapper.emitted('update:zoomLevel')).toEqual([[400]]);

    const narrow = mountUi(StatusBar, { props: { zoomLevel: 195, zoomMin: 50, zoomMax: 200 } });
    await settle();
    await narrow.wrapper.findAll('.zoom-step-btn')[1].trigger('click');
    expect(narrow.wrapper.emitted('update:zoomLevel')).toEqual([[200]]);
  });

  it('הסרגל פולט את הערך שנבחר, וכפתור האחוזים מאפס', async () => {
    const harness = mountUi(StatusBar, { props: { zoomLevel: 150 } });
    await settle();

    expect(harness.wrapper.find('.zoom-pct-btn').text()).toBe('150%');

    await harness.wrapper.find('input[type="range"]').setValue('120');
    await harness.wrapper.find('.zoom-pct-btn').trigger('click');

    expect(harness.wrapper.emitted('update:zoomLevel')).toEqual([[120], [FALLBACK_ZOOM.value]]);
  });

  it('כל כפתור בשורת המצב עושה משהו', async () => {
    // „פריסת הדפסה” היה כפתור בלי מטפל שנראה דלוק תמיד.
    const harness = mountUi(StatusBar, { props: { zoomLevel: 100 } });
    await settle();

    const buttons = harness.wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      expect(button.attributes('disabled'), tipMessage(button)).toBeUndefined();
      await button.trigger('click');
    }

    // כל כפתור פלט event אחד: מצב מיקוד, ושלושה שמזיזים את הזום.
    expect(emittedCount(harness.wrapper)).toBe(buttons.length);
  });
});
