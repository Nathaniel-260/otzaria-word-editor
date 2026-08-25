/**
 * ולידציית העיצוב של אוצריא פוסלת צבע מקודד ב-CSS ודורשת var(--color-*).
 * המשמעות היא שכל צבע בממשק תלוי בכך שהמיפוי כאן נכון — ושערך חסר לא מוחק
 * את ברירת המחדל.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { ThemePayload } from '../../src/types/otzaria_plugin';
import { applyTheme, blendHex, hexToRgba } from '../../src/host/theme';

function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

const FULL: ThemePayload = {
  mode: 'dark',
  colorScheme: {
    primary: '#1565C0',
    onPrimary: '#ffffff',
    secondary: '#6750A4',
    onSecondary: '#ffffff',
    surface: '#101014',
    onSurface: '#e6e6e6',
    onSurfaceVariant: '#c9c5d0',
    surfaceContainerHigh: '#2b2930',
    surfaceContainerHighest: '#36343b',
    outline: '#938f99',
    error: '#ffb4ab',
    onError: '#690005',
  },
  typography: {
    fontFamily: 'FrankRuhlCLM',
    fontSize: 22,
    lineHeight: 1.7,
    commentatorsFontFamily: 'Shofar',
    commentatorsFontSize: 16,
  },
} as ThemePayload;

beforeEach(() => {
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.theme;
  document.body.className = '';
});

describe('applyTheme', () => {
  it('ממפה את הצבעים לשמות שמדריך העיצוב מחייב', () => {
    applyTheme(FULL);

    expect(cssVar('--color-primary')).toBe('#1565C0');
    expect(cssVar('--color-surface-container-high')).toBe('#2b2930');
    expect(cssVar('--color-surface-container-highest')).toBe('#36343b');
    expect(cssVar('--color-on-surface-variant')).toBe('#c9c5d0');
    expect(cssVar('--color-outline')).toBe('#938f99');
  });

  it('מגדיר גופן, גודל ורווח שורות מהטיפוגרפיה', () => {
    applyTheme(FULL);

    expect(cssVar('--font-main')).toContain('FrankRuhlCLM');
    expect(cssVar('--font-size-base')).toBe('22px');
    expect(cssVar('--line-height')).toBe('1.7');
  });

  /**
   * הרגרסיה שהתיקון הזה נולד ממנה: הרצועה נצבעה ב---font-main, ולכן כפתורי
   * הממשק רונדרו בגופן הקריאה שהמשתמש בחר באוצריא — גופן סריפי, בלי hinting,
   * בגודל 11px. התוצאה הייתה טקסט מטושטש. applyTheme מותר לו לגעת בגופן
   * המסמך בלבד.
   */
  it('אינו נוגע בגופן הממשק — --font-ui אינו זז עם בחירת המשתמש', () => {
    applyTheme(FULL);

    expect(cssVar('--font-ui')).toBe('');
    expect(cssVar('--font-main')).toContain('FrankRuhlCLM');
  });

  /**
   * גודל שברירי פירושו ppem שברירי, כלומר גליף שנמרח בין שני פיקסלים. 22 × 0.78
   * הוא 17.16 שנחתך ל-16, ו-18 × 0.78 הוא 14.04 שמתעגל ל-14 — הערך השבור שנמדד
   * ב-dist הארוז לפני התיקון.
   */
  it('גוזר גדלי ממשק בפיקסלים שלמים בלבד', () => {
    applyTheme(FULL);
    expect(cssVar('--font-size-ui')).toBe('16px');
    // זוגי, לא רק שלם: מרכוז ב-flex של תיבה זוגית במיכל זוגי נוחת על פיקסל
    // שלם, וערבוב הזוגיות הוא שגלגל חצי פיקסל במורד עץ המעטפת.
    expect(cssVar('--line-height-ui')).toBe('28px'); // 16 × 1.7 = 27.2

    applyTheme({ ...FULL, typography: { ...FULL.typography, fontSize: 18, lineHeight: 1.5 } });
    expect(cssVar('--font-size-ui')).toBe('14px'); // ולא 14.04
    expect(cssVar('--line-height-ui')).toBe('22px'); // 14 × 1.5 = 21, מעוגל לזוגי
  });

  it('מצמיד את גודל הממשק לתחום 12..16 גם בקצוות', () => {
    applyTheme({ ...FULL, typography: { ...FULL.typography, fontSize: 8 } });
    expect(cssVar('--font-size-ui')).toBe('12px');

    applyTheme({ ...FULL, typography: { ...FULL.typography, fontSize: 40 } });
    expect(cssVar('--font-size-ui')).toBe('16px');
  });

  it('בחירת המשתמש קודמת לגופן הארוז, והארוז קודם ל-fallback', () => {
    // הסדר הוא ההתנהגות: אם 'Assistant' יעלה לפני בחירת המשתמש, הבחירה שלו
    // בהגדרות אוצריא תפסיק להשפיע על הממשק. 'David' נשאר אחרון כ-fallback
    // למתווים שאין גם בגופן הארוז.
    applyTheme(FULL);

    const chain = cssVar('--font-main');
    expect(chain.indexOf('FrankRuhlCLM')).toBeLessThan(chain.indexOf('Assistant'));
    expect(chain.indexOf('Assistant')).toBeLessThan(chain.indexOf('David'));
  });

  it('גוזר את גוני ה-subtle מהצבעים', () => {
    applyTheme(FULL);

    expect(cssVar('--color-primary-subtle')).toBe('rgba(21, 101, 192, 0.12)');
    expect(cssVar('--color-secondary-subtle')).toBe('rgba(103, 80, 164, 0.12)');
  });

  it('גוזר דרגת hover נפרדת מדרגת המצב הדלוק', () => {
    // זו הרגרסיה: כששתי הדרגות נגזרו לאותו ערך, ההבדל היחיד ברצועה בין „מודגש
    // דלוק” ל„העכבר עובר מעל” היה צבע המסגרת — וב-Word זו ההבחנה המרכזית.
    applyTheme(FULL);

    expect(cssVar('--color-primary-hover')).toBe('rgba(21, 101, 192, 0.08)');
    expect(cssVar('--color-primary-selected-hover')).toBe('rgba(21, 101, 192, 0.2)');

    // שלושתן ולא רק שתיים: hover ודלוק+עכבר לא נבדקו זו מול זו, ושתיהן
    // נגזרות מאותו צבע בסיס — כלומר alpha אחד שהועתק בטעות היה משאיר את
    // הפקד הדלוק והפקד שהעכבר מעליו זהים, וזה הבאג המקורי. הבדיקה על
    // *קבוצה* ולא על צמדים, כדי שהוספת דרגה רביעית תיכנס לכאן ולא תעקוף.
    const shades = [
      cssVar('--color-primary-hover'),
      cssVar('--color-primary-subtle'),
      cssVar('--color-primary-selected-hover'),
    ];
    expect(new Set(shades).size, shades.join(' | ')).toBe(3);
  });

  it('גוזר רקע שגיאה עדין מ-error של הערכה', () => {
    // הרקע של גלולת „שגיאה בשמירה” היה rgba קפוא לצד `color: var(--color-error)`
    // דינמי באותו כלל — כלומר במצב כהה הטקסט זז והרקע נשאר.
    applyTheme(FULL);

    expect(cssVar('--color-error-subtle')).toBe('rgba(255, 180, 171, 0.12)');
  });

  it('גוזר את ה-hover של כפתור ממולא לכיוון צבע הטקסט של המצב', () => {
    // במצב כהה onSurface בהיר, ולכן הגוון יוצא **בהיר** מ-primary; במצב בהיר
    // הוא יוצא כהה ממנו. זה מה שמחזיק את ההיענות ל-hover נראית בשני המצבים.
    applyTheme(FULL);
    expect(cssVar('--color-primary-filled-hover')).toBe('rgb(63, 127, 200)');

    applyTheme({
      ...FULL,
      mode: 'light',
      colorScheme: { ...FULL.colorScheme, onSurface: '#1a1a2e' },
    } as ThemePayload);
    expect(cssVar('--color-primary-filled-hover')).toBe('rgb(22, 86, 163)');
  });

  it('משאיר את ברירת המחדל של ה-hover הממולא כשחסר onSurface', () => {
    const { onSurface: _omitted, ...rest } = FULL.colorScheme;

    applyTheme({ ...FULL, colorScheme: rest } as ThemePayload);

    expect(cssVar('--color-primary-filled-hover')).toBe('');
  });

  it('מסמן מצב כהה על ה-root ועל ה-body', () => {
    applyTheme(FULL);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.body.classList.contains('dark-mode')).toBe(true);

    applyTheme({ ...FULL, mode: 'light' } as ThemePayload);

    expect(document.body.classList.contains('dark-mode')).toBe(false);
  });

  it('נופל ל-highest כשהגרסה אינה מחזירה surfaceContainerHigh', () => {
    const { surfaceContainerHigh: _omitted, ...rest } = FULL.colorScheme;

    applyTheme({ ...FULL, colorScheme: rest } as ThemePayload);

    expect(cssVar('--color-surface-container-high')).toBe('#36343b');
  });

  it('ערך חסר אינו מוחק את ברירת המחדל', () => {
    applyTheme({ mode: 'light', colorScheme: {}, typography: {} } as unknown as ThemePayload);

    expect(cssVar('--color-primary')).toBe('');
    expect(cssVar('--font-size-base')).toBe('');
  });
});

describe('blendHex', () => {
  it('ממזג שני צבעים לצבע אטום', () => {
    expect(blendHex('#000000', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)');
    expect(blendHex('#1565c0', '#1a1a2e', 0)).toBe('rgb(21, 101, 192)');
  });

  it('מחזיר null כששני הצדדים אינם hex', () => {
    expect(blendHex('var(--color-primary)', '#ffffff', 0.2)).toBeNull();
    expect(blendHex('#ffffff', 'currentColor', 0.2)).toBeNull();
  });
});

describe('hexToRgba', () => {
  it('ממיר #rrggbb', () => {
    expect(hexToRgba('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('ממיר #rgb', () => {
    expect(hexToRgba('#f80', 0.12)).toBe('rgba(255, 136, 0, 0.12)');
  });

  it('מחזיר null על ערך שאינו hex', () => {
    expect(hexToRgba('rebeccapurple', 0.12)).toBeNull();
    expect(hexToRgba('#12345', 0.12)).toBeNull();
  });
});
