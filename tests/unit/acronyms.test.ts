/**
 * מילון ראשי-התיבות: הפענוח (engine/acronyms.ts), הטעינה העצלה
 * (engine/acronym-dictionary.ts), והחוזה מול הנכס שהבנייה מייצרת בפועל.
 *
 * הבדיקה השלישית היא זו שהייתה חסרה: הקודמת מסרה לטוען `JSON.stringify(...)`
 * — מחרוזת מלאכותית שאינה מה שהבנייה מציבה — ולכן עברה בירוק גם כשהטוען
 * ציפה למחרוזת, הנכס הציב אובייקט, וההשלמה לא עבדה מעולם.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAcronymDictionary, looksLikeAcronym, type PackedAcronyms } from '../../src/engine/acronyms';
import { loadAcronymDictionary, resetAcronymDictionary } from '../../src/engine/acronym-dictionary';
import { ACRONYMS_GLOBAL } from '../../src/engine/acronyms-constants';
import { buildAcronymsAsset } from '../../scripts/acronyms-asset';

const PACKED: PackedAcronyms = { 'א"א': ['אי אפשר', 'אמר אברהם'], 'רמב"ן': ['רבי משה בן נחמן'] };

describe('createAcronymDictionary', () => {
  const dictionary = createAcronymDictionary(PACKED);

  it('מחזירה את הפירוש הראשון לר"ת מוכר', () => {
    expect(dictionary.lookup('א"א')).toBe('אי אפשר');
    expect(dictionary.lookup('רמב"ן')).toBe('רבי משה בן נחמן');
  });

  it('גרשיים של מקלדת עברית (U+05F4) מוצאים את הערך', () => {
    expect(dictionary.lookup('רמב״ן')).toBe('רבי משה בן נחמן');
  });

  it('ניקוד על המילה שהוקלדה אינו מונע התאמה', () => {
    expect(dictionary.lookup('רַמְבַּ"ן')).toBe('רבי משה בן נחמן');
  });

  it('null לר"ת שאינו ברשימה', () => {
    expect(dictionary.lookup('זזזזז')).toBeNull();
  });

  it('null גם למפתחות של Object.prototype', () => {
    expect(dictionary.lookup('constructor')).toBeNull();
    expect(dictionary.lookup('__proto__')).toBeNull();
  });
});

describe('looksLikeAcronym', () => {
  it('מזהה ר"ת בשני סוגי הגרשיים, עם ניקוד ובלעדיו', () => {
    expect(looksLikeAcronym('א"א')).toBe(true);
    expect(looksLikeAcronym('רמב״ן')).toBe(true);
    expect(looksLikeAcronym('רַמְבַּ"ן')).toBe(true);
  });

  it('דוחה מילה רגילה, גרש, וגרשיים בקצה', () => {
    // אלה המילים שבלי השער הזה היו מזריקות את הנכס לחינם.
    expect(looksLikeAcronym('אמר')).toBe(false);
    expect(looksLikeAcronym("וכו'")).toBe(false);
    expect(looksLikeAcronym('שלום"')).toBe(false);
    expect(looksLikeAcronym('"שלום')).toBe(false);
    expect(looksLikeAcronym('')).toBe(false);
  });
});

describe('loadAcronymDictionary', () => {
  beforeEach(() => resetAcronymDictionary());

  it('נטען פעם אחת בלבד, גם בקריאות מקבילות', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return PACKED;
    };

    const [first, second] = await Promise.all([loadAcronymDictionary(loader), loadAcronymDictionary(loader)]);
    const third = await loadAcronymDictionary(loader);
    expect(calls).toBe(1);
    expect(first).toBe(second);
    expect(third).toBe(first);
  });

  it('כשל מחזיר null, וההמתנה מונעת ניסיון חוזר בכל השהיה', async () => {
    let calls = 0;
    const failThenSucceed = async () => {
      calls += 1;
      return calls === 1 ? null : PACKED;
    };

    expect(await loadAcronymDictionary(failThenSucceed)).toBeNull();
    // בלי ההמתנה כל הקלדה הייתה מזריקה את הנכס מחדש.
    expect(await loadAcronymDictionary(failThenSucceed)).toBeNull();
    expect(calls).toBe(1);

    resetAcronymDictionary();
    expect((await loadAcronymDictionary(failThenSucceed))?.lookup('א"א')).toBe('אי אפשר');
    expect(calls).toBe(2);
  });

  it('loader שזורק נחשב כשל ואינו מפיל את ההשלמה', async () => {
    let calls = 0;
    const thrower = async () => {
      calls += 1;
      throw new Error('נכס פגום');
    };

    expect(await loadAcronymDictionary(thrower)).toBeNull();
    expect(await loadAcronymDictionary(thrower)).toBeNull();
    expect(calls).toBe(1);
  });
});

describe('הנכס שהבנייה מייצרת', () => {
  const globals = globalThis as Record<string, unknown>;

  beforeEach(() => resetAcronymDictionary());
  afterEach(() => {
    delete globals[ACRONYMS_GLOBAL];
  });

  /** מריצה את הנכס כפי שהדפדפן מריץ אותו, ומחזירה את מה שנשאר ב-`window`. */
  function runAsset(): unknown {
    const asset = buildAcronymsAsset();
    new Function('window', asset)(globals);
    return globals[ACRONYMS_GLOBAL];
  }

  it('נטען דרך המסלול האמיתי ומשלים ר"ת מהמילון', async () => {
    runAsset();

    // ה-loader המוגדר כברירת מחדל מוצא את הגלובל ואינו צריך <script> כלל.
    const dictionary = await loadAcronymDictionary();
    expect(dictionary).not.toBeNull();
    expect(dictionary?.lookup('חז"ל')).toBe('חכמינו זכרונם לברכה');
    expect(dictionary?.lookup('חז״ל')).toBe('חכמינו זכרונם לברכה');
  });

  it('כל מפתח בנכס עובר את השער שלפני הטעינה', () => {
    const packed = runAsset() as Record<string, readonly string[]>;
    const keys = Object.keys(packed);

    expect(keys.length).toBeGreaterThan(13_000);
    expect(keys.filter((key) => !looksLikeAcronym(key))).toEqual([]);
  });
});
