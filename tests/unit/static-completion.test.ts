/**
 * השלמה מרשימות סטטיות: האינדקס (engine/static-completion.ts), הטעינה העצלה
 * (engine/static-completion-dictionary.ts), והנכס שהבנייה מייצרת.
 *
 * הבדיקה המרכזית כאן היא **גבול הרשומה**. המסלול המתבקש —
 * `buildSectionCache(entries.join('\n'))` — מאבד אותו: המטמון של הספר מחזיק
 * מערך שטוח של מילים, ולכן הצעה יכולה להתחיל בביטוי אחד ולהמשיך לזה שאחריו.
 * הבדיקה האחרונה כאן עוברת על **כל** המילים בשתי הרשימות האמיתיות ומאמתת
 * שכל תוצאה מוכלת ברשומה אחת — לא „מתחילה נכון”.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildStaticIndex, matchStaticCompletion } from '../../src/engine/static-completion';
import { loadStaticSources, resetStaticSources } from '../../src/engine/static-completion-dictionary';
import { STATIC_COMPLETION_GLOBAL } from '../../src/engine/static-completion-constants';
import {
  buildStaticCompletionAsset,
  readStaticCompletionSource,
} from '../../scripts/static-completion-asset';

/** שתי רשומות שחולקות את המילה הראשונה — בדיוק המקרה ששובר גבולות. */
const PHRASES = ['אבן השתיה', 'אבן שאין לה הופכין', 'אבן שואבת'];
const AUTHORS = ['אבן גבאי, מאיר בן יחזקאל', 'אבן עזרא'];

const phrases = buildStaticIndex('talmudic-phrases', PHRASES);
const authors = buildStaticIndex('authors', AUTHORS);
const sources = [phrases, authors];

const match = (precedingWords: string[], partialWord: string) =>
  matchStaticCompletion(sources, { precedingWords, partialWord });

describe('matchStaticCompletion', () => {
  it('משלימה מילה חלקית בלי הקשר, משתי אותיות', () => {
    expect(match([], 'אב')?.text).toBe('אבן השתיה');
  });

  it('אות אחת בלי הקשר אינה מספיקה', () => {
    expect(match([], 'א')).toBeNull();
  });

  it('הקשר מכוון את ההתאמה לרשומה הנכונה', () => {
    expect(match(['אבן'], 'שו')?.text).toBe('שואבת');
    expect(match(['אבן'], 'שא')?.text).toBe('שאין לה הופכין');
  });

  it('משלימה עד סוף הרשומה, לא חמש מילים', () => {
    expect(match(['אבן'], 'שאין')?.text).toBe('שאין לה הופכין');
  });

  it('פיסוק במקור נשמר', () => {
    expect(match(['אבן'], 'גב')?.text).toBe('גבאי, מאיר בן יחזקאל');
  });

  it('הביטויים נבדקים לפני המחברים, באותו אורך הקשר', () => {
    // „אבן ה…” קיים רק בביטויים, „אבן ג…” רק במחברים.
    expect(match(['אבן'], 'ה')?.source).toBe('talmudic-phrases');
    expect(match(['אבן'], 'גב')?.source).toBe('authors');
  });

  /**
   * הסדר בין השניים: הקשר תואם גובר על מקור מועדף. נמדד בשער —
   * „אבן גב” החזיר את הביטוי „גבור הכובש את יצרו” (התאמה בלי הקשר, במקור
   * הראשון) במקום את המחבר „אבן גבאי” (התאמה עם הקשר, במקור השני).
   */
  it('התאמה עם הקשר במקור מאוחר גוברת על התאמה בלי הקשר במקור מוקדם', () => {
    const withDecoy = [
      buildStaticIndex('talmudic-phrases', [...PHRASES, 'גבור הכובש את יצרו']),
      authors,
    ];
    const found = matchStaticCompletion(withDecoy, { precedingWords: ['אבן'], partialWord: 'גב' });
    expect(found?.source).toBe('authors');
    expect(found?.text).toBe('גבאי, מאיר בן יחזקאל');
  });

  it('null כשאין רשומה תואמת', () => {
    expect(match(['זזזזז'], 'טט')).toBeNull();
    expect(match([], 'זזזזז')).toBeNull();
  });

  it('ניקוד וגרשיים שהוקלדו אינם מונעים התאמה', () => {
    expect(match(['אֶבֶן'], 'שו')?.text).toBe('שואבת');
  });

  /**
   * הגבול, על הצורה המדויקת ששוברת אותו: „אבן הש” אחרי חיבור הרשומות היה
   * יכול להחזיר „השתיה אבן שאין לה” — סוף הרשומה הראשונה מודבק לתחילת הבאה.
   */
  it('אינה חוצה מרשומה לרשומה', () => {
    const found = match(['אבן'], 'הש');
    expect(found?.text).toBe('השתיה');
    expect(found?.text).not.toContain('אבן');
  });
});

describe('גבול הרשומה על הנתונים האמיתיים', () => {
  const { phrases: realPhrases, authors: realAuthors } = readStaticCompletionSource();

  it.each([
    ['talmudic-phrases', realPhrases],
    ['authors', realAuthors],
  ])('%s: כל תוצאה מוכלת ברשומה אחת', (name, entries) => {
    const index = buildStaticIndex(name, entries);
    const crossings: string[] = [];

    for (const entry of entries) {
      const words = entry.trim().split(/\s+/);
      for (let i = 0; i < words.length; i += 1) {
        const found = matchStaticCompletion([index], {
          precedingWords: words.slice(Math.max(0, i - 2), i),
          partialWord: words[i]!.slice(0, 2),
        });
        // תוצאה שחצתה גבול אינה רצף באף רשומה בודדת.
        if (found && !entries.some((candidate) => candidate.includes(found.text))) {
          crossings.push(`${entry} → ${found.text}`);
        }
      }
    }

    expect(crossings).toEqual([]);
  });
});

describe('loadStaticSources', () => {
  const PACKED = { phrases: PHRASES, authors: AUTHORS };

  beforeEach(() => resetStaticSources());

  it('נטען פעם אחת בלבד, גם בקריאות מקבילות', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return PACKED;
    };

    const [first, second] = await Promise.all([loadStaticSources(loader), loadStaticSources(loader)]);
    expect(calls).toBe(1);
    expect(first).toBe(second);
  });

  it('כשל מחזיר null, וההמתנה מונעת ניסיון חוזר בכל השהיה', async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      return null;
    };

    expect(await loadStaticSources(failing)).toBeNull();
    expect(await loadStaticSources(failing)).toBeNull();
    expect(calls).toBe(1);
  });

  it('loader שזורק נחשב כשל ואינו מפיל את ההשלמה', async () => {
    const thrower = async () => {
      throw new Error('נכס פגום');
    };
    expect(await loadStaticSources(thrower)).toBeNull();
  });
});

describe('הנכס שהבנייה מייצרת', () => {
  const globals = globalThis as Record<string, unknown>;

  beforeEach(() => resetStaticSources());
  afterEach(() => {
    delete globals[STATIC_COMPLETION_GLOBAL];
  });

  it('נטען דרך המסלול האמיתי ומשלים ביטוי ומחבר', async () => {
    new Function('window', buildStaticCompletionAsset())(globals);

    const indexes = await loadStaticSources();
    expect(indexes).not.toBeNull();
    expect(indexes?.map((index) => index.name)).toEqual(['talmudic-phrases', 'authors']);

    const found = matchStaticCompletion(indexes!, { precedingWords: ['אבן'], partialWord: 'הש' });
    expect(found?.text).toBe('השתיה');
    expect(found?.source).toBe('talmudic-phrases');
  });

  it('הספירה מדויקת', () => {
    const { phrases: p, authors: a } = readStaticCompletionSource();
    expect(p.length).toBe(325);
    expect(a.length).toBe(651);
  });
});
