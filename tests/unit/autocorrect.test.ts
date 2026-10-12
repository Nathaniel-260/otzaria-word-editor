/**
 * תיקון אוטומטי: מה מתוקן, ומה במפורש לא.
 *
 * רוב הבדיקות כאן הן על **מה שאסור לתקן**: תיקון אוטומטי שפוגע בטקסט תקין גרוע
 * מתיקון שחסר. שלושה עקרונות נבדקים — מילה שהסמן עדיין נוגע בה אינה מתוקנת;
 * חוק סמל פועל מיד וחוק מילה רק אחרי שהושלמה; וחוקים שנקבעים לפי שני הצדדים
 * ממתינים לתו שאחריהם.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTOCORRECT,
  DEFAULT_REPLACEMENTS,
  normalizeAutoCorrect,
  normalizeEntries,
  planAutoCorrect,
  transferCase,
  type AutoCorrectOptions,
} from '../../src/engine/autocorrect';

/** מחיל את התיקונים על הטקסט — כמו שהמתקין עושה, מהסוף להתחלה. */
function apply(text: string, options: Partial<AutoCorrectOptions> = {}, atBlockStart = false): string {
  const fixes = planAutoCorrect(text, { ...DEFAULT_AUTOCORRECT, ...options }, { atBlockStart });
  return fixes.reduce(
    (result, fix) => result.slice(0, fix.start) + fix.replacement + result.slice(fix.end),
    text,
  );
}

const ONLY = (patch: Partial<AutoCorrectOptions>): Partial<AutoCorrectOptions> => ({
  replaceAsYouType: false,
  dashes: false,
  spacedHyphen: false,
  gershayim: false,
  finalLetters: false,
  twoInitialCaps: false,
  capitalizeSentences: false,
  capitalizeDays: false,
  ...patch,
});

describe('טבלת ההחלפות — חוקי סמל', () => {
  it('(c) הופך ל-© מיד כשנסגר, בלי רווח אחריו', () => {
    expect(apply('זכויות (c)')).toBe('זכויות ©');
  });

  it('שלוש נקודות הופכות לשלוש-נקודות, גם צמודות למילה', () => {
    expect(apply('וכן...')).toBe('וכן…');
  });

  it('החץ הארוך גובר על הקצר: --> ולא —>', () => {
    expect(apply('א --> ב', ONLY({ replaceAsYouType: true }))).toBe('א → ב');
  });

  it('חוק סמל שלם בלבד: (c בלי הסוגר אינו מתוקן', () => {
    expect(apply('זכויות (c')).toBe('זכויות (c');
  });

  it('שלוש נקודות בתוך ארבע: מתוקנות פעם אחת, והנקודה הרביעית נשארת', () => {
    expect(apply('סוף....')).toBe('סוף….');
  });
});

describe('טבלת ההחלפות — חוקי מילה', () => {
  const options = {
    replacements: [
      { from: 'teh', to: 'the' },
      { from: 'ר"ת', to: 'ראשי תיבות' },
    ],
  };

  it('מתקן רק אחרי רווח', () => {
    expect(apply('teh ', options)).toBe('the ');
  });

  it('מילה שהסמן נוגע בה אינה מתוקנת — teh באמצע tehran', () => {
    expect(apply('teh', options)).toBe('teh');
  });

  it('פיסוק שהוקלד אחרי המילה סוגר אותה', () => {
    expect(apply('teh,', options)).toBe('the,');
  });

  it('אינו נוגע במילה שמכילה את הדפוס: tehran נשאר', () => {
    expect(apply('tehran ', options)).toBe('tehran ');
  });

  it('שומר על רישיות: Teh ← The, TEH ← THE', () => {
    expect(apply('Teh ', options)).toBe('The ');
    expect(apply('TEH ', options)).toBe('THE ');
  });

  it('דפוס עברי עם גרשיים מותאם כמו שהוא', () => {
    expect(apply('ר"ת ', options)).toBe('ראשי תיבות ');
  });

  it('שבר בתאריך אינו מתוקן: 1/2/2024 נשאר, 1/2 בנפרד הופך', () => {
    expect(apply('ב-1/2/2024 ')).toBe('ב-1/2/2024 ');
    expect(apply('חצי 1/2 ')).toBe('חצי ½ ');
  });

  it('דפוס עם אות גדולה מותאם בדיוק בלבד', () => {
    const exact = { replacements: [{ from: 'NYC', to: 'ניו יורק' }] };
    expect(apply('NYC ', exact)).toBe('ניו יורק ');
    expect(apply('nyc ', exact)).toBe('nyc ');
  });

  it('כבוי: טבלה כבויה אינה מחליפה דבר', () => {
    expect(apply('(c) teh ', { ...options, replaceAsYouType: false })).toBe('(c) teh ');
  });
});

describe('מקפים', () => {
  it('א--ב הופך לקו מפריד ארוך — רק אחרי שהאות שאחריו הוקלדה', () => {
    expect(apply('כן--ל')).toBe('כן—ל');
    expect(apply('כן--')).toBe('כן--');
  });

  it('מילה -- מילה הופך לקו מפריד בינוני עם רווחים', () => {
    expect(apply('כן -- ל')).toBe('כן – ל');
  });

  it('אינו נוגע בחץ --> שלא הוגדר, ואינו נוגע ברשימה "- "', () => {
    expect(apply('--> ב', ONLY({ dashes: true }))).toBe('--> ב');
    expect(apply('- פריט', ONLY({ dashes: true, spacedHyphen: true }))).toBe('- פריט');
  });

  it('מקף עם רווחים נשאר ברירת מחדל, והופך כשהמתג דלוק', () => {
    expect(apply('א - ב')).toBe('א - ב');
    expect(apply('א - ב', { spacedHyphen: true })).toBe('א – ב');
  });

  it('המתג של המקפים הכפולים אינו מפעיל את המקף הבודד', () => {
    expect(apply('א--ב א - ב', ONLY({ dashes: true }))).toBe('א—ב א - ב');
  });
});

describe('גרש וגרשיים', () => {
  const on = ONLY({ gershayim: true });

  it('מרכאה בין שתי אותיות עבריות הופכת לגרשיים', () => {
    expect(apply('רש"י ', on)).toBe('רש״י ');
    expect(apply('צה"ל', on)).toBe('צה״ל');
  });

  it('מרכאות של ציטוט אינן נוגעות: "שלום עולם"', () => {
    expect(apply('אמר "שלום עולם" וחזר', on)).toBe('אמר "שלום עולם" וחזר');
  });

  it('גרש אחרי אות עברית: ר\' ו-ג\'ירף', () => {
    expect(apply("ר' ", on)).toBe('ר׳ ');
    expect(apply("ג'ירף", on)).toBe('ג׳ירף');
  });

  it('גרש שהוא האחרון לפני הסמן ממתין לתו שאחריו', () => {
    expect(apply("ר'", on)).toBe("ר'");
  });

  it('גרש באנגלית אינו נוגע: don\'t', () => {
    expect(apply("don't ", on)).toBe("don't ");
  });

  it('כבוי כברירת מחדל', () => {
    expect(apply('רש"י ')).toBe('רש"י ');
  });
});

describe('אותיות סופיות', () => {
  const on = ONLY({ finalLetters: true });

  it('כ בסוף מילה הופכת ל-ך, בכל חמש האותיות', () => {
    expect(apply('שלומ ', on)).toBe('שלום ');
    expect(apply('ברכ ', on)).toBe('ברך ');
    expect(apply('חכמ ', on)).toBe('חכם ');
    expect(apply('סופ ', on)).toBe('סוף ');
    expect(apply('ארצ ', on)).toBe('ארץ ');
    expect(apply('הוא ממנ ', on)).toBe('הוא ממן ');
  });

  it('אות סופית באמצע מילה הופכת לרגילה', () => {
    expect(apply('שלוםע ', on)).toBe('שלומע ');
  });

  it('אות בודדת היא קיצור ואינה מתוקנת: מ\' ו-נ', () => {
    expect(apply('נ ', on)).toBe('נ ');
    expect(apply('מ ', on)).toBe('מ ');
  });

  it('מילה שאינה כולה אותיות עבריות אינה נוגעת: רש"י, תעתיק לטיני, ספרות', () => {
    expect(apply('רש"י ', on)).toBe('רש"י ');
    expect(apply('abc1 ', on)).toBe('abc1 ');
    expect(apply('כמ2 ', on)).toBe('כמ2 ');
  });

  it('מילה שהסמן נוגע בה ממתינה — מ באמצע הקלדת מילה', () => {
    expect(apply('שלומ', on)).toBe('שלומ');
  });
});

describe('אותיות גדולות', () => {
  it('TWo ← Two, אך לא IDs ולא מילה באותיות גדולות כולה', () => {
    expect(apply('TWo ')).toBe('Two ');
    expect(apply('IDs ')).toBe('IDs ');
    expect(apply('NASA ')).toBe('NASA ');
    expect(apply('Two ')).toBe('Two ');
  });

  it('ימי השבוע: monday ← Monday', () => {
    expect(apply('on monday ')).toBe('on Monday ');
  });

  it('תחילת משפט: אחרי נקודה, ובתחילת בלוק', () => {
    const on = ONLY({ capitalizeSentences: true });
    expect(apply('Hello. then ', on)).toBe('Hello. Then ');
    expect(apply('hello ', on, true)).toBe('Hello ');
    expect(apply('hello ', on, false)).toBe('hello ');
  });

  it('קיצורים וסימני רשימה אינם סוף משפט', () => {
    const on = ONLY({ capitalizeSentences: true });
    expect(apply('see e.g. this ', on)).toBe('see e.g. this ');
    expect(apply('vol. iii ', on)).toBe('vol. iii ');
    expect(apply('1. apple ', on)).toBe('1. apple ');
  });
});

describe('כללי יסוד', () => {
  it('מתג ראשי כבוי: דבר אינו מתוקן', () => {
    expect(apply('(c) TWo monday ', { enabled: false })).toBe('(c) TWo monday ');
  });

  it('טקסט ריק או טקסט תקין: אין תיקונים', () => {
    expect(planAutoCorrect('', DEFAULT_AUTOCORRECT)).toEqual([]);
    expect(planAutoCorrect('שלום עולם, מה שלומך?', DEFAULT_AUTOCORRECT)).toEqual([]);
  });

  it('התיקונים ממוינים מההיסט הגבוה לנמוך, כדי שהחלה לא תזיז היסטים', () => {
    const fixes = planAutoCorrect('(c) ו-(r) ו-(tm)', DEFAULT_AUTOCORRECT);
    const starts = fixes.map((fix) => fix.start);

    expect(starts).toEqual([...starts].sort((a, b) => b - a));
    expect(apply('(c) ו-(r) ו-(tm)')).toBe('© ו-® ו-™');
  });

  it('תיקונים חופפים: הראשון לפי עדיפות מנצח, ואין היסט כפול', () => {
    const options = ONLY({ replaceAsYouType: true, finalLetters: true, replacements: [{ from: 'שלומ', to: 'שלום עולם' }] });
    expect(apply('שלומ ', options)).toBe('שלום עולם ');
  });

  it('החלפה ששווה למקור אינה נחשבת תיקון', () => {
    const options = { replacements: [{ from: 'aaa', to: 'aaa' }] };
    expect(planAutoCorrect('aaa ', { ...DEFAULT_AUTOCORRECT, ...options })).toEqual([]);
  });
});

describe('transferCase', () => {
  it('מועתק רק כשיש מה להעתיק', () => {
    expect(transferCase('teh', 'teh', 'the')).toBe('the');
    expect(transferCase('Teh', 'teh', 'the')).toBe('The');
    expect(transferCase('TEH', 'teh', 'the')).toBe('THE');
    expect(transferCase('שלום', 'שלום', 'שלומ')).toBe('שלומ');
  });
});

describe('normalizeAutoCorrect', () => {
  it('ערך שאינו אובייקט: ברירת המחדל', () => {
    expect(normalizeAutoCorrect(null)).toBe(DEFAULT_AUTOCORRECT);
    expect(normalizeAutoCorrect('x')).toBe(DEFAULT_AUTOCORRECT);
  });

  it('שדה שאינו בוליאני נופל לברירת המחדל שלו, והשאר נשמרים', () => {
    const result = normalizeAutoCorrect({ enabled: false, dashes: 'כן', finalLetters: true });

    expect(result.enabled).toBe(false);
    expect(result.dashes).toBe(DEFAULT_AUTOCORRECT.dashes);
    expect(result.finalLetters).toBe(true);
    expect(result.replacements).toBe(DEFAULT_REPLACEMENTS);
  });

  it('טבלה שנשמרה כרשימה ריקה נשארת ריקה — לא חוזרת לברירת המחדל', () => {
    expect(normalizeAutoCorrect({ replacements: [] }).replacements).toEqual([]);
  });
});

describe('normalizeEntries', () => {
  it('זורק רשומה פגומה לבדה ושומר את השאר', () => {
    const out = normalizeEntries([
      { from: 'a', to: 'b' },
      null,
      { from: 1, to: 'x' },
      { from: '', to: 'x' },
      { from: 'c', to: 3 },
      { from: 'd', to: 'e' },
    ]);

    expect(out).toEqual([
      { from: 'a', to: 'b' },
      { from: 'd', to: 'e' },
    ]);
  });

  it('כפילות לפי „החלף”: הראשונה נשארת', () => {
    expect(normalizeEntries([{ from: 'a', to: '1' }, { from: 'a', to: '2' }])).toEqual([{ from: 'a', to: '1' }]);
  });

  it('דפוס עם רווח בקצה או ירידת שורה נזרק — מילה מוגדרת בין רווחים', () => {
    expect(normalizeEntries([{ from: ' a', to: 'b' }, { from: 'a\nb', to: 'c' }, { from: 'ok', to: 'x\ny' }])).toEqual([]);
  });

  it('החלפה לריק מותרת — מחיקת טקסט היא שימוש לגיטימי', () => {
    expect(normalizeEntries([{ from: 'xx', to: '' }])).toEqual([{ from: 'xx', to: '' }]);
  });
});
