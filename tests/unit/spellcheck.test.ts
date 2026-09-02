/**
 * מנוע ההתאמה של בדיקת האיות התורנית.
 *
 * שלוש משפחות, וכל אחת היא דרך שבה בדיקת איות נשברת בלי להיראות שבורה:
 *
 *   1. **החיפוש עצמו** — חיפוש בינארי על מחרוזת אחת. `Set` היה נכשל ברעש;
 *      כאן טעות בגבול מחזירה „לא נמצא” על ערך שקיים, והמסמך מתמלא קווים
 *      אדומים בלי שדבר ייכשל. לכן נבדקים כל הגבולות: הערך הראשון, האחרון,
 *      מחרוזת ריקה, ומילה שנופלת בין שני ערכים.
 *   2. **התחיליות** — שני הכיוונים, ובדיוק שתי הסרות. שלוש היו מכשירות
 *      כמעט כל מחרוזת, כלומר בדיקה שאינה מסמנת דבר.
 *   3. **הנרמול** — גרשיים טיפוגרפיים וניקוד. בלעדיו כל ראשי התיבות
 *      מסומנים, וזה בדיוק המקרה שהמילון קיים בשבילו.
 */
import { describe, it, expect } from 'vitest';
import {
  createDictionary,
  findMisspellings,
  normalizeWord,
  packWords,
} from '../../src/engine/spellcheck';

/** מילון קטן שאפשר לנמק עליו כל טענה. */
const WORDS = ['אמר', 'בית', 'גמרא', 'ושבת', 'כתב', 'משנה', 'עיין', 'רש"י', 'תוספות'];

const dict = () => createDictionary(packWords(WORDS));

describe('אריזת המילון', () => {
  it('ממוינת, ייחודית, ובלי ערכים ריקים', () => {
    expect(packWords(['ב', 'א', 'ב', ''])).toBe('א\nב');
  });

  it('המיון הוא לפי יחידות UTF-16 — אותו סדר שהחיפוש מניח', () => {
    // גרשיים (0x22) לפני גרש (0x27) לפני אות עברית (0x5D0 ומעלה).
    expect(packWords(['אא', 'א\'ב', 'א"ב'])).toBe('א"ב\nא\'ב\nאא');
  });
});

describe('חיפוש במילון', () => {
  it('מוצא כל ערך שנארז', () => {
    const dictionary = dict();
    for (const word of WORDS) expect(dictionary.has(word), word).toBe(true);
  });

  it('מוצא גם את הערך הראשון והאחרון', () => {
    const dictionary = createDictionary(packWords(['אאא', 'ננן', 'תתת']));
    expect(dictionary.has('אאא')).toBe(true);
    expect(dictionary.has('תתת')).toBe(true);
  });

  it('מילה שאינה במילון — ואינה נגזרת שלו — אינה נמצאת', () => {
    expect(dict().has('זזזזז')).toBe(false);
  });

  it('מילה שנופלת בין שני ערכים אינה נמצאת', () => {
    const dictionary = createDictionary(packWords(['אאא', 'תתת']));
    expect(dictionary.has('ננן')).toBe(false);
  });

  it('מילון ריק אינו מוצא דבר, ואינו נתקע', () => {
    const dictionary = createDictionary('');
    expect(dictionary.has('אמר')).toBe(false);
    expect(dictionary.size).toBe(0);
  });

  it('`size` סופר ערכים', () => {
    expect(dict().size).toBe(WORDS.length);
  });
});

describe('תחיליות', () => {
  it('הוספה: „שבת” נמצא דרך „ושבת”', () => {
    expect(dict().has('שבת')).toBe(true);
  });

  it('הסרה: „ועיין” נמצא דרך „עיין”', () => {
    expect(dict().has('ועיין')).toBe(true);
  });

  it('שתי תחיליות רצופות: „שהתוספות” נמצא דרך „תוספות”', () => {
    expect(dict().has('שהתוספות')).toBe(true);
  });

  it('שלוש תחיליות רצופות **אינן** מוכשרות', () => {
    // „ושהתוספות” = ו+ש+ה+תוספות. שלוש הסרות היו מכשירות כמעט כל מחרוזת.
    expect(dict().has('ושהתוספות')).toBe(false);
  });

  it('מילה בת שתי אותיות אינה מפורקת', () => {
    // „מר” אינו ערך; פירוק היה משאיר „ר”, וכל אות בודדת שהיא ערך הייתה
    // מכשירה הכול.
    const dictionary = createDictionary(packWords(['ר', 'אמר']));
    expect(dictionary.has('מר')).toBe(false);
  });
});

describe('נרמול', () => {
  it('מסיר ניקוד וטעמים', () => {
    expect(normalizeWord('בָּרָא')).toBe('ברא');
  });

  it('מאחד גרשיים וגרש טיפוגרפיים לישרים', () => {
    expect(normalizeWord('רש״י')).toBe('רש"י');
    expect(normalizeWord('ר׳')).toBe("ר'");
  });

  it('מילה בלי ניקוד וגרשיים חוזרת כמות שהיא', () => {
    const word = 'תוספות';
    expect(normalizeWord(word)).toBe(word);
  });

  it('ראשי תיבות עם גרשיים טיפוגרפיים נמצאים במילון', () => {
    expect(dict().has('רש״י')).toBe(true);
  });

  it('מילה מנוקדת נמצאת במילון שאינו מנוקד', () => {
    expect(dict().has('בַּיִת')).toBe(true);
  });
});

describe('מילון המשתמש', () => {
  it('מילה שנוספה מפסיקה להיות שגיאה', () => {
    const dictionary = dict();
    expect(dictionary.has('זזזזז')).toBe(false);
    expect(dictionary.addUserWord('זזזזז')).toBe(true);
    expect(dictionary.has('זזזזז')).toBe(true);
  });

  it('הוספה חוזרת מדווחת `false` — אין מה לשמור', () => {
    const dictionary = dict();
    dictionary.addUserWord('זזזזז');
    expect(dictionary.addUserWord('זזזזז')).toBe(false);
  });

  it('המילה נשמרת מנורמלת, כדי שהצורה המנוקדת תימצא גם היא', () => {
    const dictionary = dict();
    dictionary.addUserWord('זַ״ץ');
    expect(dictionary.userWords()).toEqual(['ז"ץ']);
    expect(dictionary.has('ז״ץ')).toBe(true);
  });

  it('מילון המשתמש אינו נספר ב-`size` — הוא נשמר לבד', () => {
    const dictionary = dict();
    dictionary.addUserWord('זזזזז');
    expect(dictionary.size).toBe(WORDS.length);
  });

  it('רשימת משתמש שנמסרה בבנייה מוכרת מיד', () => {
    const dictionary = createDictionary(packWords(WORDS), ['זזזזז']);
    expect(dictionary.has('זזזזז')).toBe(true);
  });
});

describe('סריקת טקסט', () => {
  it('מחזירה טווחים מדויקים בקואורדינטות הטקסט', () => {
    const text = 'אמר זזזזז כתב';
    expect(findMisspellings(text, dict())).toEqual([{ word: 'זזזזז', start: 4, end: 9 }]);
  });

  it('מילה מוכרת אינה מסומנת', () => {
    expect(findMisspellings('אמר כתב עיין', dict())).toEqual([]);
  });

  it('גרשיים הם חלק מהמילה ולא גבול שלה', () => {
    // פיצול על הגרשיים היה מסמן „רש” ו„י” כשתי שגיאות במקום ערך אחד מוכר.
    expect(findMisspellings('דברי רש״י כאן', dict()).map((m) => m.word)).toEqual(['דברי', 'כאן']);
  });

  it('אותיות לטיניות וספרות אינן נסרקות כלל', () => {
    expect(findMisspellings('Word 2024 :: ---', dict())).toEqual([]);
  });

  it('סריקה חוזרת על אותו טקסט מחזירה את אותה תשובה', () => {
    // ה-regex משותף בין קריאות, ו-`lastIndex` שנשאר תקוע היה מדלג על
    // המילה הראשונה בסריקה השנייה — כלומר קו שמופיע ונעלם בכל גלילה.
    const dictionary = dict();
    const text = 'זזזזז אמר חחחחח';
    expect(findMisspellings(text, dictionary)).toEqual(findMisspellings(text, dictionary));
  });
});
