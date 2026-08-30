/**
 * גופן חסר אינו עניין של מראה: `lineRule="auto"` גוזר את גובה השורה ממדדי
 * הגופן שנבחר בפועל, ולכן החלפה שגויה — או החלפה מיותרת — משנה את פריסת כל
 * המסמך. מכאן שלוש החובות שהבדיקות כאן שומרות עליהן:
 *
 * 1. **מחליפים רק מה שחסר.** גופן שנפתר במכונה חייב לעבור בלי שייגעו בו.
 * 2. **מחליפים רק עברית.** ה-fallback הלטיני של הדפדפן סביר, והתערבות בו היא
 *    שינוי בלי סיבה.
 * 3. **בייטים מהמארח רק כשאין ברירה.** גופן ב-base64 שוקל מאות קילובייטים,
 *    ובקשה שלו כשיש תחליף מותקן היא ניפוח של ה-WebView.
 *
 * ההחלטה נבדקת דרך `available` מוזרק ולא דרך canvas אמיתי: בדיקה שנשענת על
 * הגופנים שמותקנים במכונה שמריצה אותה בודקת את המכונה, לא את הקוד.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FONT_ALIAS_STYLE_ID,
  installDocumentFontAliases,
  isFamilyAvailable,
  parseFontTable,
  planFontAliases,
  shapeOf,
  substitutesFor,
  type DeclaredFont,
} from '../../src/engine/docx-fonts';

const { tryCallMock } = vi.hoisted(() => ({ tryCallMock: vi.fn() }));
vi.mock('../../src/host/otzaria-client', () => ({ tryCall: tryCallMock }));

/** טבלת הגופנים של המסמך שהתלונה נולדה ממנו, מקוצרת לשלוש הרשומות שקובעות. */
const REAL_FONT_TABLE =
  '<w:fonts xmlns:w="ns">' +
  '<w:font w:name="Arial"><w:panose1 w:val="020B0604020202020204"/><w:charset w:val="00"/>' +
  '<w:family w:val="swiss"/><w:pitch w:val="variable"/>' +
  '<w:sig w:usb0="E0002EFF" w:usb1="C000785B" w:csb0="000001FF" w:csb1="00000000"/></w:font>' +
  '<w:font w:name="FrankRuehl DP"><w:panose1 w:val="02000600000000000000"/><w:charset w:val="00"/>' +
  '<w:family w:val="auto"/><w:pitch w:val="variable"/>' +
  '<w:sig w:usb0="00000803" w:usb1="40000000" w:csb0="00000021" w:csb1="00000000"/></w:font>' +
  '<w:font w:name="Guttman Drogolin"><w:panose1 w:val="02010401010101010101"/><w:charset w:val="B1"/>' +
  '<w:family w:val="auto"/><w:pitch w:val="variable"/>' +
  '<w:sig w:usb0="00000801" w:usb1="40000000" w:csb0="00000020" w:csb1="00000000"/></w:font>' +
  '</w:fonts>';

function hebrewFont(overrides: Partial<DeclaredFont> = {}): DeclaredFont {
  return { name: 'חסר', family: 'auto', charset: '00', panose: null, hebrew: true, ...overrides };
}

afterEach(() => {
  tryCallMock.mockReset();
  document.getElementById(FONT_ALIAS_STYLE_ID)?.remove();
});

describe('parseFontTable', () => {
  it('קורא שם, משפחה, charset ו-panose', () => {
    const fonts = parseFontTable(REAL_FONT_TABLE);
    expect(fonts.map((font) => font.name)).toEqual(['Arial', 'FrankRuehl DP', 'Guttman Drogolin']);

    const frank = fonts[1];
    expect(frank.family).toBe('auto');
    expect(frank.panose).toBe('02000600000000000000');
    expect(frank.charset).toBe('00');
  });

  it('מזהה עברית משלושת הסימנים, וכל אחד מהם לבדו מספיק', () => {
    // csb0 ביט 5, usb0 ביט 11, ו-charset B1 — גופנים עבריים ותיקים ממלאים
    // רק חלק מהם, ולכן אף אחד מהשלושה אינו יכול להיות התנאי היחיד.
    const byCsb = parseFontTable('<w:font w:name="a"><w:sig w:csb0="00000020"/></w:font>');
    const byUsb = parseFontTable('<w:font w:name="b"><w:sig w:usb0="00000800"/></w:font>');
    const byCharset = parseFontTable('<w:font w:name="c"><w:charset w:val="B1"/></w:font>');
    expect([byCsb[0].hebrew, byUsb[0].hebrew, byCharset[0].hebrew]).toEqual([true, true, true]);
  });

  it('גופן לטיני אינו מסומן כעברי', () => {
    const fonts = parseFontTable(REAL_FONT_TABLE);
    expect(fonts[0].hebrew).toBe(false);
    expect(fonts[1].hebrew).toBe(true);
    expect(fonts[2].hebrew).toBe(true);
  });

  it('טבלה פגומה אינה מפילה — היא רק מחזירה פחות', () => {
    expect(parseFontTable('')).toEqual([]);
    expect(parseFontTable('<w:fonts><w:font/></w:fonts>')).toEqual([]);
    expect(parseFontTable('לא XML בכלל')).toEqual([]);
    expect(parseFontTable('<w:font w:name="יחיד"/>')).toHaveLength(1);
  });
});

describe('shapeOf', () => {
  it('`w:family` מפורש קובע', () => {
    expect(shapeOf(hebrewFont({ family: 'roman' }))).toBe('serif');
    expect(shapeOf(hebrewFont({ family: 'swiss' }))).toBe('sans');
    expect(shapeOf(hebrewFont({ family: 'modern' }))).toBe('sans');
  });

  it('בלי `w:family` נופלים ל-PANOSE', () => {
    expect(shapeOf(hebrewFont({ panose: '0203000000000000000' }))).toBe('serif');
    // serif-style 11 ("Normal Sans") נכתב הקסה כ-"0B", לא כ-"11".
    expect(shapeOf(hebrewFont({ panose: '020B000000000000000' }))).toBe('sans');
  });

  it('ספרת serif-style הקסדצימלית (A–F) נקראת נכון', () => {
    // "020B0604020202020204" הוא ה-PANOSE האמיתי של Arial: family=2,
    // serif-style=11 ("Normal Sans", נכתב "0B"). serif-style בטווח 10-15
    // חייב הקסה כדי להיקרא נכון — parseInt במסד 10 היה עוצר ב-"0" ומחזיר
    // 'serif' בטעות.
    expect(shapeOf(hebrewFont({ family: null, panose: '020B0604020202020204' }))).toBe('sans');
    expect(shapeOf(hebrewFont({ family: null, panose: '020F000000000000000' }))).toBe('sans');
  });

  it('בלי מידע — סריפי, כי זה מה שגופני ספרים עבריים הם', () => {
    // בדיוק המקרה של FrankRuehl DP: family=auto, ו-serif-style אפס.
    expect(shapeOf(hebrewFont({ family: 'auto', panose: '02000600000000000000' }))).toBe('serif');
    expect(shapeOf(hebrewFont({ family: null, panose: null }))).toBe('serif');
  });
});

describe('planFontAliases', () => {
  const installed = (names: string[]) => (name: string) => names.includes(name);

  it('גופן שנפתר אינו מוחלף', () => {
    const plan = planFontAliases(parseFontTable(REAL_FONT_TABLE), () => true);
    expect(plan.css).toBe('');
    expect(plan.missing).toEqual([]);
    expect(plan.needBytes).toEqual([]);
  });

  it('גופן לטיני חסר אינו מוחלף', () => {
    // Arial חסר כאן, ובכל זאת אין לו כלל: ה-fallback הלטיני סביר, והחלפה
    // שלו הייתה שינוי מראה בלי סיבה.
    const plan = planFontAliases(parseFontTable(REAL_FONT_TABLE), installed(['FrankRuehl']));
    expect(plan.css).not.toContain('Arial');
    expect(plan.missing.map((font) => font.name)).toEqual(['FrankRuehl DP', 'Guttman Drogolin']);
  });

  it('גופן עברי חסר מקבל שרשרת `local()` של מה שמותקן בלבד', () => {
    const plan = planFontAliases(parseFontTable(REAL_FONT_TABLE), installed(['FrankRuehl', 'David']));
    expect(plan.css).toContain('@font-face{font-family:"FrankRuehl DP";');
    expect(plan.css).toContain('local("FrankRuehl")');
    expect(plan.css).toContain('local("David")');
    // Narkisim אינו מותקן — אין טעם להציע אותו.
    expect(plan.css).not.toContain('Narkisim');
    expect(plan.needBytes).toEqual([]);
  });

  it('בלי אף תחליף מותקן — מבקשים בייטים, ולא כותבים כלל ריק', () => {
    const plan = planFontAliases(parseFontTable(REAL_FONT_TABLE), installed([]));
    expect(plan.css).toBe('');
    expect(plan.needBytes.map((font) => font.name)).toEqual(['FrankRuehl DP', 'Guttman Drogolin']);
  });

  it('אותה משפחה פעמיים בטבלה מקבלת כלל אחד', () => {
    const twice = `<w:fonts>${'<w:font w:name="כפול"><w:charset w:val="B1"/></w:font>'.repeat(2)}</w:fonts>`;
    const plan = planFontAliases(parseFontTable(twice), installed(['FrankRuehl']));
    expect(plan.css.match(/@font-face/g)).toHaveLength(1);
  });

  it('שם עם גרשיים אינו שובר את ה-CSS', () => {
    const odd = '<w:font w:name="גופן &quot;מוזר&quot;"><w:charset w:val="B1"/></w:font>';
    const plan = planFontAliases(parseFontTable(odd), installed(['FrankRuehl']));
    expect(plan.css).toContain('\\"');
  });
});

describe('substitutesFor', () => {
  it('סריפי מקבל שרשרת עברית סריפית, וחלק שרשרת חלקה', () => {
    expect(substitutesFor(hebrewFont({ family: 'roman' }))[0]).toBe('FrankRuehl');
    expect(substitutesFor(hebrewFont({ family: 'swiss' }))[0]).toBe('Arial');
    // FrankRuhlCLM הוא הגופן שאוצריא אורזת, וזה מה שהופך אותו לתחליף שאפשר
    // לקבל את הבייטים שלו גם במכונה ריקה.
    expect(substitutesFor(hebrewFont({ family: 'roman' }))).toContain('FrankRuhlCLM');
  });
});

describe('isFamilyAvailable', () => {
  it('בלי canvas מחזיר „זמין” — לא מחליפים על סמך ניחוש', () => {
    // jsdom אינו מממש getContext('2d'). זו בדיוק הסביבה שבה אסור לנו להחליט:
    // החלפה שגויה גרועה מלא לגעת.
    expect(isFamilyAvailable('גופן שאינו קיים בשום מקום')).toBe(true);
  });
});

describe('installDocumentFontAliases', () => {
  beforeEach(() => {
    tryCallMock.mockResolvedValue(null);
  });

  it('בלי טבלה — סגנון ריק, ובלי פנייה למארח', async () => {
    await expect(installDocumentFontAliases(null)).resolves.toEqual([]);
    expect(document.getElementById(FONT_ALIAS_STYLE_ID)?.textContent).toBe('');
    expect(tryCallMock).not.toHaveBeenCalled();
  });

  it('קריאה חוזרת דורסת את הסגנון ואינה מוסיפה עוד אחד', async () => {
    await installDocumentFontAliases(REAL_FONT_TABLE);
    await installDocumentFontAliases(REAL_FONT_TABLE);
    expect(document.querySelectorAll(`#${FONT_ALIAS_STYLE_ID}`)).toHaveLength(1);
  });

  it('בסביבה בלי canvas שום גופן אינו נחשב חסר, ולכן אין מה להתקין', async () => {
    // הנפילה הבטוחה, מקצה לקצה: אין מדידה → אין החלפה → אין פנייה למארח.
    await expect(installDocumentFontAliases(REAL_FONT_TABLE)).resolves.toEqual([]);
    expect(tryCallMock).not.toHaveBeenCalled();
  });
});
