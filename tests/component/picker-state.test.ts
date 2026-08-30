/**
 * הבוררים ב„בית” מציגים את **המסמך**, לא את מה שהמשתמש ביקש.
 *
 * זו אותה משפחת באגים שתוקנה בזום: הסרגל הזיז את התווית ל-„150%” ורוחב העמוד
 * נשאר זהה, מפני שמישהו כתב את הערך המקומי בלי לחכות לתשובה — ולא החזיר אותו
 * כשהתשובה הייתה „לא”. שלושת הבוררים כאן עשו בדיוק את זה: `lastFamily`,
 * `lastSize` ו-`lastLineHeight` נכתבו לפני `run()` ולא הוחזרו בכשל.
 *
 * הגרוע מכולם היה „הגדל גופן”, מפני שהוא **מחשב מהערך המקומי**: שלוש לחיצות
 * על מסמך שדוחה שלחו 14, 16, 18 — כלומר הפקד התרחק מהמסמך בכל לחיצה, ולחיצה
 * רביעית הייתה מבקשת גודל שאין לו שום קשר לטקסט שהסמן עומד בו.
 *
 * מה שנשמר כאן במקביל הוא ההתנהגות שהבוררים נבנו בשבילה: המנוע מדווח
 * `undefined` גם על בחירה מעורבת, ואז הבורר מציג את „האחרון שידענו” ולא
 * מתרוקן.
 */
import { describe, expect, it } from 'vitest';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import { autoUnmount, buttonByTip, createCommandDouble, mountUi, settle } from './harness';

autoUnmount();

/** מה שהבורר מציג בפועל ב-DOM. */
function shown(harness: ReturnType<typeof mountUi>, title: string): string {
  const select = harness.wrapper.find(`select[data-tip-title="${title}"]`);
  return (select.element as HTMLSelectElement).value;
}

const READONLY = {
  'font-family': 'document-readonly',
  'font-size': 'document-readonly',
  'line-height': 'document-readonly',
};

describe('מסמך שדוחה את הפקודה', () => {
  it('בורר הגופן חוזר לגופן שבמסמך', async () => {
    const harness = mountUi(HomeTab, { adapter: createCommandDouble({ failures: READONLY }) });
    await settle();
    expect(shown(harness, 'גופן')).toBe('Assistant');

    await harness.wrapper.find('select[data-tip-title="גופן"]').setValue('TaameyDavidCLM');
    await settle();

    // הכשל דווח למשתמש (זה עבד), אבל התיבה הציגה גופן שלא הוחל על כלום.
    expect(harness.failures()).toHaveLength(1);
    expect(shown(harness, 'גופן')).toBe('Assistant');
  });

  it('בורר הגודל חוזר לגודל שבמסמך', async () => {
    const adapter = createCommandDouble({ failures: READONLY });
    adapter.setState('font-size', { value: 20 });

    const harness = mountUi(HomeTab, { adapter });
    await settle();
    expect(shown(harness, 'גודל גופן')).toBe('20');

    await harness.wrapper.find('select[data-tip-title="גודל גופן"]').setValue('36');
    await settle();

    expect(shown(harness, 'גודל גופן')).toBe('20');
  });

  it('בורר מרווח השורות חוזר למרווח שבמסמך', async () => {
    const harness = mountUi(HomeTab, { adapter: createCommandDouble({ failures: READONLY }) });
    await settle();
    const before = shown(harness, 'מרווח בין שורות');

    await harness.wrapper.find('select[data-tip-title="מרווח בין שורות"]').setValue('3.0');
    await settle();

    expect(shown(harness, 'מרווח בין שורות')).toBe(before);
  });

  it('„הגדל גופן” אינו מטפס — כל לחיצה מחשבת מאותו גודל', async () => {
    const adapter = createCommandDouble({ failures: READONLY });
    const harness = mountUi(HomeTab, { adapter });
    await settle();

    for (let click = 0; click < 3; click += 1) {
      await buttonByTip(harness.wrapper, 'הגדל גופן').trigger('click');
      await settle();
    }

    // 12 הוא ברירת המחדל; הבא בסולם של Word הוא 14, ושם זה נעצר.
    expect(adapter.payloads('font-size')).toEqual([14, 14, 14]);
    expect(shown(harness, 'גודל גופן')).toBe('12');
  });

  it('„הקטן גופן” אינו יורד בזחילה', async () => {
    // בלי ערך מהמנוע (בחירה מעורבת, או מסמך שטרם דיווח) הזיכרון המקומי הוא
    // מה שמזין את החישוב — ושם הזחילה הייתה: 11, 10, 9.
    const adapter = createCommandDouble({ failures: READONLY });
    const harness = mountUi(HomeTab, { adapter });
    await settle();

    for (let click = 0; click < 3; click += 1) {
      await buttonByTip(harness.wrapper, 'הקטן גופן').trigger('click');
      await settle();
    }

    expect(adapter.payloads('font-size')).toEqual([11, 11, 11]);
    expect(shown(harness, 'גודל גופן')).toBe('12');
  });
});

describe('מסמך שמקבל את הפקודה', () => {
  it('הבורר מגיב מיד, בלי להמתין לדיווח של המנוע', async () => {
    // הבורר הוא פקד ולא דוח: המנוע מדווח א-סינכרונית, ובבחירה מעורבת אינו
    // מדווח ערך בכלל — תיבה שממתינה לו הייתה נראית קפואה.
    const harness = mountUi(HomeTab);
    await settle();

    await harness.wrapper.find('select[data-tip-title="גופן"]').setValue('Rubik');
    await settle();

    expect(harness.adapter.payloads('font-family')).toEqual(['Rubik']);
    expect(harness.failures()).toEqual([]);
    expect(shown(harness, 'גופן')).toBe('Rubik');
  });

  it('„הגדל גופן” מטפס בסולם כשהמסמך מקבל', async () => {
    const adapter = createCommandDouble();
    const harness = mountUi(HomeTab, { adapter });
    await settle();

    for (let click = 0; click < 3; click += 1) {
      await buttonByTip(harness.wrapper, 'הגדל גופן').trigger('click');
      await settle();
    }

    expect(adapter.payloads('font-size')).toEqual([14, 16, 18]);
  });
});

describe('מה שהמנוע מדווח', () => {
  it('דיווח של המנוע מנצח את הערך שנבחר מקומית', async () => {
    const adapter = createCommandDouble();
    const harness = mountUi(HomeTab, { adapter });
    await settle();

    await harness.wrapper.find('select[data-tip-title="גופן"]').setValue('Rubik');
    await settle();

    // הסמן זז לטקסט אחר, והמנוע דיווח גופן אחר.
    adapter.setState('font-family', { value: 'FrankRuhlCLM' });
    await settle();

    expect(shown(harness, 'גופן')).toBe('FrankRuhlCLM');
  });

  it('בחירה מעורבת אינה מרוקנת את הבורר — נשאר האחרון שידענו', async () => {
    const adapter = createCommandDouble();
    const harness = mountUi(HomeTab, { adapter });
    await settle();

    adapter.setState('font-family', { value: 'Shofar' });
    await settle();
    expect(shown(harness, 'גופן')).toBe('Shofar');

    // `undefined` = בחירה עם יותר מגופן אחד, או בחירה שטרם נפתרה.
    adapter.setState('font-family', { value: undefined });
    await settle();

    expect(shown(harness, 'גופן')).toBe('Shofar');
  });

  it('גופן שאינו ברשימה מתווסף אליה, כדי שהבורר לא ישקר', async () => {
    const adapter = createCommandDouble();
    adapter.setState('font-family', { value: 'Guttman Yad' });
    const harness = mountUi(HomeTab, { adapter });
    await settle();

    expect(shown(harness, 'גופן')).toBe('Guttman Yad');
  });
});

describe('בחירה שנייה בזמן שהראשונה באוויר', () => {
  it('תשובה מאוחרת אינה מוחקת בחירה טרייה', async () => {
    // בלי השומר `pending.value !== next`, התשובה של הבחירה הראשונה הייתה
    // מנקה את שכבת ה-pending — כלומר הבחירה השנייה נעלמת מהמסך בזמן שהיא
    // עצמה עוד באוויר.
    const adapter = createCommandDouble({
      held: ['font-family'],
      failures: { 'font-family': 'document-readonly' },
    });
    const harness = mountUi(HomeTab, { adapter });
    await settle();

    const select = harness.wrapper.find('select[data-tip-title="גופן"]');
    await select.setValue('Rubik');
    await settle();
    expect(shown(harness, 'גופן')).toBe('Rubik');

    await select.setValue('Shofar');
    await settle();
    expect(shown(harness, 'גופן')).toBe('Shofar');

    // התשובה של „Rubik” חוזרת ראשונה, והיא אינה שלנו יותר.
    adapter.release('font-family');
    await settle();
    expect(shown(harness, 'גופן')).toBe('Shofar');

    // ורק כשהתשובה של „Shofar” חוזרת — והיא כשל — המסמך חוזר להיות המוצג.
    adapter.release('font-family');
    await settle();
    expect(shown(harness, 'גופן')).toBe('Assistant');
  });
});
