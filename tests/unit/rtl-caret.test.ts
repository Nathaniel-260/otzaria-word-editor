/**
 * חצים אופקיים בשורה עברית — התיקון.
 *
 * **המספרים כאן אינם מומצאים.** כולם נמדדו ב-Chrome אמיתי על ה-`dist` הארוז
 * בגשש `scripts/qa/rtl-caret-visual-feasibility.mjs`, שהציב את הסמן בכל היסט
 * בתורו וקרא את ה-x שהמנוע צייר בו — על superdoc 2.14.0-next.5 ושוב על 2.15.0,
 * עם אותם ערכים בדיוק. תיבות התווים כאן נגזרות מאותן מדידות, וה„אמת” שבכל
 * בדיקה היא מה שהמנוע עצמו עשה.
 *
 * שלוש השורות שנמדדו וחוזרות כאן:
 *   „שלום עולם פשוט מאוד” — עברית נקייה, התאמה 20/20
 *   „פרק 12 בספר”        — אי של ספרות בתוך ריצה עברית אחת, 12/12
 *   „מילה ABC מילה”      — אי לטיני מוצהר, 12/14 (שני התפרים)
 *
 * ושתי שורות עם אי של **תו אחד** („סעיף 3 בחוק הזה”, „אות a אחת בלבד”), שנמדדו
 * באותה שיטה כשהתברר שהחץ נתקע בהן — ראו ההערה על `charDirections`.
 *
 * וגם צורת הציור של טאב, שנמדדה ב-`scripts/qa/tab-paint-probe.mjs`:
 * ‏`SPAN.superdoc-tab` עם `data-pm-start`/`data-pm-end` משלו, בלי טקסט.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  caretSlots,
  charDirections,
  edgeSlot,
  installRtlVisualArrows,
  isHorizontalArrow,
  movesForward,
  readLineChars,
  visualTarget,
  type CaretSlot,
  type PaintedChar,
  type RtlCaretHost,
} from '../../src/engine/rtl-caret';

/**
 * תיבות מרשימת קצוות, עם היסטים רצופים מ-`pm`.
 * `rtl` הופך את הקצוות — ברשימה של שורה עברית הם יורדים.
 */
function boxes(pm: number, edges: number[], rtl: boolean): PaintedChar[] {
  return edges.slice(0, -1).map((edge, i) => {
    const next = edges[i + 1]!;
    return { pm: pm + i, left: rtl ? next : edge, right: rtl ? edge : next };
  });
}

/**
 * „מילה ABC מילה”, ‏pm 51..64. שלוש ריצות: עברית, אי לטיני, עברית.
 * האי מצויר ב-[980 … 1012.9], והמילה העברית הראשונה מימין עד 1043.4.
 */
const LATIN_ISLAND: PaintedChar[] = [
  ...boxes(51, [1043.4, 1035.6, 1031.3, 1024.4, 1016.9, 1012.9], true),
  ...boxes(56, [980, 991.5, 1002.2, 1012.9], false),
  ...boxes(59, [980, 976, 968.2, 963.9, 957, 949.5], true),
];

/** „פרק 12 בספר”, ‏pm 39..50 — האי הוא ספרות בתוך ריצה עברית **אחת**. */
const DIGIT_ISLAND: PaintedChar[] = [
  ...boxes(39, [1043.4, 1036.3, 1028.8, 1021.2, 1017.2], true),
  ...boxes(43, [1001.2, 1009.2, 1017.2], false),
  ...boxes(45, [1001.2, 997.2, 989.9, 982.3, 975.3, 967.8], true),
];

/** „שלום עולם פשוט מאוד”, ‏pm 1..20 — עברית נקייה, 19 תווים. */
const CLEAN: PaintedChar[] = boxes(
  1,
  [
    1043.4, 1033.6, 1026.7, 1022.2, 1014.1, 1010.1, 1002.8, 998.4, 991.5, 983.4, 979.4, 972.3,
    962.5, 958.1, 950.5, 946.5, 938.7, 931, 926.5, 919.8,
  ],
  true,
);

/** תיבות עם התו עצמו — כך ש-`readLineChars` מחזירה אותן. */
function lettered(pm: number, text: string, edges: [number, number][]): PaintedChar[] {
  return [...text].map((ch, i) => ({ pm: pm + i, left: edges[i]![0], right: edges[i]![1], ch }));
}

/**
 * „סעיף 3 בחוק הזה”, ‏pm 1..15 — ספרה **בודדת** בין שני רווחים. נמדד ב-Chrome
 * על ה-dist (superdoc 2.15.0): התיבות, ובנפרד ה-x שהמנוע צייר בו את הסמן בכל
 * היסט. שני התפרים של הספרה (היסטים 5 ו-6) מצוירים שניהם בקצה השמאלי שלה.
 */
const LONE_DIGIT = lettered(1, 'סעיף 3 בחוק הזה', [
  [1035.8, 1043.4], [1028.5, 1035.8], [1024.2, 1028.5], [1017, 1024.2], [1013, 1017],
  [1005, 1013], [1000.9, 1005], [993.7, 1001], [986, 993.7], [981.6, 986],
  [974, 981.6], [970, 974], [962.5, 970], [957.9, 962.5], [950.3, 957.9],
]);
const LONE_DIGIT_PAINTED = [
  1043.3, 1035.8, 1028.5, 1024.2, 1017, 1005, 1004.9, 1000.9, 993.7, 986, 981.6, 974, 970, 962.5, 957.9,
  950.3,
];

/**
 * „אות a אחת בלבד”, ‏pm 36..49 — אות לטינית **בודדת**. כאן שני התפרים (היסטים
 * 4 ו-5) מצוירים שניהם בקצה הימני של האות.
 */
const LONE_LETTER = lettered(36, 'אות a אחת בלבד', [
  [1035.6, 1043.4], [1031.2, 1035.7], [1023.2, 1031.2], [1019.2, 1023.2], [1012.1, 1019.2],
  [1008.1, 1012.1], [1000.4, 1008.1], [992.8, 1000.4], [984.8, 992.8], [980.8, 984.8],
  [973.5, 980.8], [966.6, 973.5], [959.3, 966.6], [952.6, 959.3],
]);
const LONE_LETTER_PAINTED = [
  1043.3, 1035.6, 1031.2, 1023.2, 1019.2, 1019.2, 1008.1, 1000.4, 992.8, 984.8, 980.8, 973.5, 966.6, 959.3,
  952.6,
];

const pmsOf = (slots: readonly CaretSlot[]) => slots.map((s) => s.pm);
const xOf = (slots: readonly CaretSlot[], pm: number) => slots.find((s) => s.pm === pm)?.x;

describe('charDirections', () => {
  it('עברית נקייה — כל התווים ימין-לשמאל', () => {
    expect(charDirections(CLEAN, true).every((rtl) => rtl)).toBe(true);
  });

  it('אי לטיני מוצהר — שלושת תוויו נגזרים כשמאל-לימין', () => {
    expect(charDirections(LATIN_ISLAND, true)).toEqual([
      true, true, true, true, true, false, false, false, true, true, true, true, true,
    ]);
  });

  it('אי של ספרות בתוך ריצה עברית אחת — אותה הכרעה, בלי שום הצהרה שתעזור', () => {
    // זה המקרה שחלוקה לפי אלמנט DOM או לפי `w:rtl` מחמיצה: הריצה אחת, ורק
    // הגאומטריה מפרידה. ראו `bidi-declaration-is-not-direction`.
    expect(charDirections(DIGIT_ISLAND, true)).toEqual([
      true, true, true, true, false, false, true, true, true, true, true,
    ]);
  });

  it('שורה לטינית — כל התווים שמאל-לימין', () => {
    expect(charDirections(boxes(1, [441.6, 449.6, 454.1, 461.2, 465.6], false), false)).toEqual([
      false, false, false, false,
    ]);
  });
});

describe('caretSlots', () => {
  it('עברית נקייה: חריץ לכל היסט, ובדיוק ב-x שהמנוע צייר בו', () => {
    const slots = caretSlots(CLEAN, true);
    expect(slots).toHaveLength(CLEAN.length + 1);
    // שלושת אלה נמדדו מול המנוע, אחד לאחד.
    expect(xOf(slots, 1)).toBe(1043.4);
    expect(xOf(slots, 9)).toBe(991.5);
    expect(xOf(slots, 20)).toBe(919.8);
  });

  it('אי לטיני: שני התפרים מושמטים, ופנים האי נשאר', () => {
    const slots = caretSlots(LATIN_ISLAND, true);
    // 56 ו-59 הם ההיסטים שהמנוע צייר את שניהם באותו x (1012.9) — שני בתים
    // לאותו מקום, ובלי ידית לבחור. כיוון אליהם היה מזיז לכיוון ההפוך.
    expect(pmsOf(slots)).not.toContain(56);
    expect(pmsOf(slots)).not.toContain(59);
    expect(xOf(slots, 57), 'פנים האי — נמדד 991.5 במנוע').toBe(991.5);
    expect(xOf(slots, 58), 'פנים האי — נמדד 1002.2 במנוע').toBe(1002.2);
    expect(xOf(slots, 60), 'העברית שמשמאל לאי').toBe(976);
  });

  it('אי של ספרות: אותם שני תפרים מושמטים', () => {
    const slots = caretSlots(DIGIT_ISLAND, true);
    expect(pmsOf(slots)).not.toContain(43);
    expect(pmsOf(slots)).not.toContain(45);
    expect(xOf(slots, 44), 'בין שתי הספרות').toBe(1009.2);
    expect(xOf(slots, 42)).toBe(1021.2);
  });

  it('שורה ריקה — אין חריצים', () => {
    expect(caretSlots([], true)).toEqual([]);
  });
});

describe('אי של תו אחד', () => {
  /**
   * הקשה אחר הקשה, מול מה שהמנוע באמת מצייר: נקודת המוצא של כל הקשה היא ה-x
   * המצויר של ההיסט הנוכחי, בדיוק כמו ב-`installRtlVisualArrows`.
   */
  function hold(
    chars: readonly PaintedChar[],
    painted: readonly number[],
    base: number,
    from: number,
    toRight: boolean,
  ): number[] {
    const slots = caretSlots(chars, true);
    const visited = [from];
    let offset = from;
    for (let step = 0; step < chars.length + 2; step += 1) {
      const target = visualTarget(slots, painted[offset]!, toRight);
      if (!target) break;
      const next = target.pm - base;
      if (next === offset) break;
      visited.push(next);
      offset = next;
    }
    return visited;
  }

  const cases = [
    { name: 'ספרה', chars: LONE_DIGIT, painted: LONE_DIGIT_PAINTED, base: 1, island: 5 },
    { name: 'אות לטינית', chars: LONE_LETTER, painted: LONE_LETTER_PAINTED, base: 36, island: 4 },
  ];

  for (const c of cases) {
    it(`${c.name} בודדת מסווגת כשמאל-לימין, ושכניה נשארים עבריים`, () => {
      const dirs = charDirections(c.chars, true);
      expect(dirs[c.island]).toBe(false);
      expect(dirs[c.island - 1]).toBe(true);
      expect(dirs[c.island + 1]).toBe(true);
    });

    it(`${c.name} בודדת: שני התפרים שלה אינם יעד`, () => {
      const pms = pmsOf(caretSlots(c.chars, true));
      expect(pms).not.toContain(c.base + c.island);
      expect(pms).not.toContain(c.base + c.island + 1);
    });

    it(`${c.name} בודדת: החזקת חץ מכל היסט מתקדמת על המסך בכל הקשה, בלי לחזור`, () => {
      // זה ה„נתקע” שנמדד: שני התפרים מצוירים באותו x, והקשה אחת החזירה את
      // הסמן לתפר השני במקום לעבור את התו.
      for (let from = 0; from < c.painted.length; from += 1) {
        for (const toRight of [true, false]) {
          const visited = hold(c.chars, c.painted, c.base, from, toRight);
          expect(new Set(visited).size, `ביקור חוזר מ-${from}`).toBe(visited.length);
          for (let i = 1; i < visited.length; i += 1) {
            const dx = c.painted[visited[i]!]! - c.painted[visited[i - 1]!]!;
            expect(toRight ? dx : -dx, `צעד ${visited[i - 1]}→${visited[i]}`).toBeGreaterThan(0.5);
          }
        }
      }
    });
  }
});

describe('visualTarget', () => {
  it('עברית נקייה: ימין מזיז ימינה על המסך, וההיסט יורד — כמו Word', () => {
    const slots = caretSlots(CLEAN, true);
    const from = xOf(slots, 9)!;
    const target = visualTarget(slots, from, true)!;
    expect(target.pm, 'היסט אחד אחורה').toBe(8);
    expect(target.x).toBeGreaterThan(from);
  });

  it('עברית נקייה: שמאל מזיז שמאלה, וההיסט עולה', () => {
    const slots = caretSlots(CLEAN, true);
    const from = xOf(slots, 9)!;
    const target = visualTarget(slots, from, false)!;
    expect(target.pm).toBe(10);
    expect(target.x).toBeLessThan(from);
  });

  it('הליכה שלמה על השורה: ימין לעולם אינו מזיז שמאלה', () => {
    // זו התכונה שהמשתמש מרגיש. שבירתה היא הבאג עצמו.
    for (const chars of [CLEAN, LATIN_ISLAND, DIGIT_ISLAND]) {
      const slots = caretSlots(chars, true);
      let x = Math.min(...slots.map((s) => s.x));
      let steps = 0;
      for (;;) {
        const next = visualTarget(slots, x, true);
        if (!next) break;
        expect(next.x, 'כל צעד ימינה גדל ב-x').toBeGreaterThan(x);
        x = next.x;
        steps += 1;
      }
      expect(steps, 'ההליכה עוברת את כל החריצים').toBe(slots.length - 1);
    }
  });

  it('כניסה לאי הלטיני מצד שמאל נוחתת בתוכו, ולא בצדו השני', () => {
    // 60@976 → 57@991.5. זה בדיוק מה שהמנוע מצייר ל-57 (נמדד), ולכן הצעד
    // אמיתי. הגבול ב-980 מדולג — זה המחיר המתועד של דילוג התפר.
    const slots = caretSlots(LATIN_ISLAND, true);
    expect(visualTarget(slots, 976, true)).toMatchObject({ pm: 57, x: 991.5 });
  });

  it('אין חריץ בכיוון המבוקש — `null`, והקצה מטופל בנפרד', () => {
    const slots = caretSlots(CLEAN, true);
    const rightmost = Math.max(...slots.map((s) => s.x));
    expect(visualTarget(slots, rightmost, true)).toBeNull();
  });
});

describe('movesForward', () => {
  it('בשורה עברית ימינה הוא אחורה בטקסט, ובלטינית להפך', () => {
    expect(movesForward(true, true), 'ימין בעברית').toBe(false);
    expect(movesForward(false, true), 'שמאל בעברית').toBe(true);
    expect(movesForward(true, false), 'ימין בלטינית').toBe(true);
    expect(movesForward(false, false), 'שמאל בלטינית').toBe(false);
  });
});

describe('edgeSlot', () => {
  const slots = caretSlots(CLEAN, true);

  it('אחורה: הקצה הגבוה של השורה שמעל — כלומר סופה', () => {
    expect(edgeSlot(slots, false, 999)).toMatchObject({ pm: 20 });
  });

  it('קדימה: תחילתה', () => {
    expect(edgeSlot(slots, true, 999)).toMatchObject({ pm: 1 });
  });

  it('ההיסט שהסמן כבר עליו מוחרג — גבול בין שתי שורות גולשות הוא היסט אחד', () => {
    // בלי ההחרגה הצעד היה מחזיר את הסמן בדיוק לאותו מקום, והמשתמש היה
    // רואה מקש שאינו עושה דבר.
    expect(edgeSlot(slots, false, 20)).toMatchObject({ pm: 19 });
  });

  it('שורה שכל חריציה הם ההיסט הנוכחי — `null`', () => {
    expect(edgeSlot([{ pm: 7, x: 10 }], false, 7)).toBeNull();
  });
});

describe('isHorizontalArrow', () => {
  const key = (over: Partial<KeyboardEvent> = {}) =>
    ({ key: 'ArrowRight', ctrlKey: false, metaKey: false, altKey: false, ...over }) as KeyboardEvent;

  it('חץ ימני ושמאלי', () => {
    expect(isHorizontalArrow(key())).toBe(true);
    expect(isHorizontalArrow(key({ key: 'ArrowLeft' }))).toBe(true);
  });

  it('Shift+חץ נשאר למנוע — בחירה שנכתבת דרך ה-API אינה מצוירת', () => {
    // נמדד ב-scripts/qa/shift-arrow-probe.mjs: אחרי כתיבת טווח
    // `doc.selection.current()` מדווח `{empty:false, range:{2,6}}` ובמסך אין
    // ולו מלבן אחד. יירוט כאן היה מחליף באג נראה בבחירה בלתי-נראית.
    expect(isHorizontalArrow(key({ shiftKey: true }))).toBe(false);
  });

  it('Ctrl/Alt/Meta הם קפיצת מילה — לא שלנו', () => {
    expect(isHorizontalArrow(key({ ctrlKey: true }))).toBe(false);
    expect(isHorizontalArrow(key({ altKey: true }))).toBe(false);
    expect(isHorizontalArrow(key({ metaKey: true }))).toBe(false);
  });

  it('חצים אנכיים אינם נוגעים', () => {
    expect(isHorizontalArrow(key({ key: 'ArrowUp' }))).toBe(false);
    expect(isHorizontalArrow(key({ key: 'ArrowDown' }))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* קריאת ה-DOM וההתקנה                                                 */
/* ------------------------------------------------------------------ */

/**
 * jsdom אינו פורס, ולכן `getBoundingClientRect` שלו מחזיר אפסים — גם ל-
 * `Range`. הדריסה כאן מזינה את המדידות האמיתיות במקומן: התיבות נשמרות על
 * אלמנט הריצה, ו-Range קורא מהן לפי ההיסט שלו.
 */
const originalRangeRect = Range.prototype.getBoundingClientRect;

function stubRects(): void {
  Range.prototype.getBoundingClientRect = function (this: Range) {
    const parent = (this.startContainer as Text).parentElement as
      | (HTMLElement & { __chars?: PaintedChar[] })
      | null;
    const box = parent?.__chars?.[this.startOffset];
    return { left: box?.left ?? 0, right: box?.right ?? 0 } as DOMRect;
  };
}

afterEach(() => {
  Range.prototype.getBoundingClientRect = originalRangeRect;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

interface RunSpec {
  text?: string;
  chars: PaintedChar[];
  /** ריצה שאינה טקסט המסמך — סמן המספור של פריט רשימה. */
  marker?: boolean;
  /** טאב: אלמנט בלי טקסט, שהתיבה שלו היא שלו עצמו. */
  tab?: boolean;
}

/** בונה שורה מצוירת אחת בצורה שנמדדה. */
function buildLine(
  runs: RunSpec[],
  pmStart: number,
  pmEnd: number,
  rtl: boolean,
  top = 0,
): HTMLElement {
  const line = document.createElement('div');
  line.setAttribute('data-pm-start', String(pmStart));
  line.setAttribute('data-pm-end', String(pmEnd));
  if (rtl) line.setAttribute('dir', 'rtl');
  line.getBoundingClientRect = () => ({ top, bottom: top + 20 }) as DOMRect;

  for (const run of runs) {
    const span = document.createElement('span') as HTMLElement & { __chars?: PaintedChar[] };
    if (run.tab) span.className = 'superdoc-tab';
    else if (!run.marker) span.className = 'superdoc-text-run';
    if (!run.marker && run.chars.length) {
      span.setAttribute('data-pm-start', String(run.chars[0]!.pm));
      span.setAttribute('data-pm-end', String(run.chars[run.chars.length - 1]!.pm + 1));
    }
    if (run.tab) {
      const box = run.chars[0]!;
      span.getBoundingClientRect = () => ({ left: box.left, right: box.right }) as DOMRect;
    } else {
      span.textContent = run.text ?? '';
      span.__chars = run.chars;
    }
    line.append(span);
  }
  return line;
}

/** מה ש-`readLineChars` קוראת מהשורה המעורבת: אותן תיבות, עם התו עצמו. */
const LATIN_ISLAND_READ: PaintedChar[] = LATIN_ISLAND.map((box, i) => ({ ...box, ch: [...'מילה ABC מילה'][i] }));

/** אותה שורה מעורבת שנמדדה, מפורקת לשלוש ריצות כפי שהיא מצוירת. */
const mixedRuns = (): RunSpec[] => [
  { text: 'מילה ', chars: LATIN_ISLAND.slice(0, 5) },
  { text: 'ABC', chars: LATIN_ISLAND.slice(5, 8) },
  { text: ' מילה', chars: LATIN_ISLAND.slice(8) },
];

describe('readLineChars', () => {
  it('מחזירה תיבה והיסט לכל תו, לפי הטווח של הריצה עצמה', () => {
    stubRects();
    const line = buildLine(mixedRuns(), 51, 64, true);
    document.body.append(line);
    expect(readLineChars(line)).toEqual(LATIN_ISLAND_READ);
  });

  it('טאב הוא יחידת pm אחת, והתיבה היא של האלמנט עצמו', () => {
    // נמדד: <SPAN.superdoc-tab> pm=5..6, רוחב 24, אפס תווים. בלי הטיפול הזה
    // השורה נפסלת כולה, וההקשה חוזרת למנוע — כלומר הבאג נשאר בפסקה עם טאב.
    stubRects();
    const line = buildLine(
      [
        { text: 'קודם', chars: boxes(1, [1043, 1035, 1027, 1019, 1011], true) },
        { tab: true, chars: [{ pm: 5, left: 987, right: 1011 }] },
        { text: 'אחרון', chars: boxes(6, [987, 979, 971, 963, 955, 947], true) },
      ],
      1,
      11,
      true,
    );
    document.body.append(line);
    const chars = readLineChars(line);
    expect(chars).toHaveLength(10);
    expect(chars![4]).toEqual({ pm: 5, left: 987, right: 1011 });
  });

  it('סמן המספור של פריט רשימה אינו נספר — אין לו טווח pm', () => {
    stubRects();
    const line = buildLine(
      [{ marker: true, chars: [] }, ...mixedRuns()],
      51,
      64,
      true,
    );
    document.body.append(line);
    expect(readLineChars(line)).toEqual(LATIN_ISLAND_READ);
  });

  it('טאב-הסיומת של סמן הרשימה אינו נושא טווח, ואינו נקרא כטווח 0..0', () => {
    // נמדד: <SPAN.superdoc-tab.superdoc-marker-suffix-tab> עם רווח אחד ובלי
    // data-pm. `Number(null)` הוא 0, ולכן בלי בדיקת קיום התכונה הוא היה
    // מתחזה לטווח 0..0 ופוסל את כל השורה — כלומר מחזיר את הבאג לכל רשימה.
    stubRects();
    const line = buildLine(mixedRuns(), 51, 64, true);
    const suffix = document.createElement('span');
    suffix.className = 'superdoc-tab superdoc-marker-suffix-tab';
    suffix.textContent = ' ';
    line.prepend(suffix);
    document.body.append(line);
    expect(readLineChars(line)).toEqual(LATIN_ISLAND_READ);
  });

  it('טווחים שאינם מכסים את השורה ברצף — `null`', () => {
    stubRects();
    const line = buildLine(mixedRuns(), 51, 70, true);
    document.body.append(line);
    expect(readLineChars(line)).toBeNull();
  });
});

interface Setup {
  host: HTMLElement;
  line: HTMLElement;
  superdoc: RtlCaretHost;
  setSelectionTarget: ReturnType<typeof vi.fn>;
}

function setup({
  runs = mixedRuns(),
  pmStart = 51,
  pmEnd = 64,
  caretOffset = 9,
  caretX = 976,
  caretY = 10,
  rtl = true,
  extraLine,
  nextFragment,
}: {
  runs?: RunSpec[];
  pmStart?: number;
  pmEnd?: number;
  caretOffset?: number;
  caretX?: number;
  caretY?: number;
  rtl?: boolean;
  extraLine?: { runs: RunSpec[]; pmStart: number; pmEnd: number };
  nextFragment?: { runs: RunSpec[]; pmStart: number; pmEnd: number };
} = {}): Setup {
  stubRects();

  const host = document.createElement('div');
  const page = document.createElement('div');
  const fragment = document.createElement('div');
  fragment.setAttribute('data-source-node-id', 'p1');
  fragment.setAttribute('data-pm-start', String(pmStart));
  fragment.setAttribute('data-pm-end', String(extraLine ? extraLine.pmEnd : pmEnd));

  const line = buildLine(runs, pmStart, pmEnd, rtl);
  fragment.append(line);
  if (extraLine) fragment.append(buildLine(extraLine.runs, extraLine.pmStart, extraLine.pmEnd, rtl, 20));
  page.append(fragment);

  if (nextFragment) {
    const second = document.createElement('div');
    second.setAttribute('data-source-node-id', 'p2');
    second.setAttribute('data-pm-start', String(nextFragment.pmStart));
    second.setAttribute('data-pm-end', String(nextFragment.pmEnd));
    second.append(buildLine(nextFragment.runs, nextFragment.pmStart, nextFragment.pmEnd, true));
    page.append(second);
  }

  host.append(page);

  const caret = document.createElement('div');
  caret.className = 'sd-v2-local-selection-caret';
  caret.getBoundingClientRect = () =>
    ({ left: caretX, right: caretX, top: caretY, bottom: caretY }) as DOMRect;
  host.append(caret);
  document.body.append(host);

  const setSelectionTarget = vi.fn();
  const story = { kind: 'story', storyType: 'body' };
  const superdoc: RtlCaretHost = {
    activeEditor: {
      host: {
        readLiveSelectionSyncSnapshot: () => ({
          selectionTarget: {
            kind: 'selection',
            start: { kind: 'text', blockId: 'p1', offset: caretOffset, story },
            end: { kind: 'text', blockId: 'p1', offset: caretOffset, story },
            story,
          },
        }),
      },
      authoring: { setSelectionTarget },
    },
  };

  return { host, line, superdoc, setSelectionTarget };
}

const press = (target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

/** מה שנכתב למנוע בקריאה הראשונה. */
const written = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls[0]![0] as {
    target: { start: { offset: number }; end: { offset: number; blockId: string } };
  };

describe('installRtlVisualArrows', () => {
  it('חץ ימני בשורה עברית: ההקשה נבלעת, והסמן נקבע לשכן החזותי', () => {
    const { host, line, superdoc, setSelectionTarget } = setup();
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowRight');

    expect(event.defaultPrevented, 'המנוע לא יראה את ההקשה').toBe(true);
    expect(setSelectionTarget).toHaveBeenCalledTimes(1);
    // pm 57 בתוך האי, כלומר היסט 6 בתוך הבלוק.
    expect(written(setSelectionTarget).target.end.offset).toBe(6);
    expect(written(setSelectionTarget).target.start.offset, 'בלי Shift הבחירה מתכווצת').toBe(6);
    handle.dispose();
  });

  it('Shift+חץ אינו נגזל — הבחירה נשארת של המנוע', () => {
    const { host, line, superdoc, setSelectionTarget } = setup();
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowRight', { shiftKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('בקצה הימני של שורה גולשת: היעד הוא סוף השורה שמעליה', () => {
    // בלי זה ההקשה הייתה חוזרת למנוע, והוא מזיז שם קדימה לוגית — כלומר
    // שמאלה על המסך. נמדד בשער.
    const { host, superdoc, setSelectionTarget } = setup({
      runs: [{ text: 'שורה', chars: boxes(51, [1043, 1035, 1027, 1019, 1011], true) }],
      pmStart: 51,
      pmEnd: 55,
      caretOffset: 4, // pm 55 — התפר, ששייך לשתי השורות
      caretX: 1043,
      caretY: 30, // השורה השנייה, ולא הראשונה
      extraLine: {
        runs: [{ text: 'שנייה', chars: boxes(55, [1043, 1035, 1027, 1019, 1011, 1003], true) }],
        pmStart: 55,
        pmEnd: 60,
      },
    });
    const handle = installRtlVisualArrows({ host, superdoc });

    // הסמן בתחילת השורה השנייה, בקצה הימני שלה; ימינה = אחורה לוגית.
    press(host, 'ArrowRight');

    expect(setSelectionTarget).toHaveBeenCalledTimes(1);
    // סוף השורה הראשונה הוא pm 54, כלומר היסט 3 — ולא 55, שהוא הסמן עצמו.
    expect(written(setSelectionTarget).target.end.offset).toBe(3);
    handle.dispose();
  });

  it('בקצה הפסקה: היעד הוא הפסקה השכנה באותו מכל ציור', () => {
    const { host, line, superdoc, setSelectionTarget } = setup({
      caretOffset: 0, // pm 51 — תחילת הבלוק, הקצה הימני בעברית
      caretX: 1043.4,
      nextFragment: {
        runs: [{ text: 'אחרי', chars: boxes(65, [900, 892, 884, 876, 868], true) }],
        pmStart: 65,
        pmEnd: 69,
      },
    });
    const handle = installRtlVisualArrows({ host, superdoc });

    // ימינה בתחילת פסקה = אחורה לוגית → הפסקה הקודמת. אין כזו, ולכן ההקשה
    // חוזרת למנוע; שמאלה, לעומת זאת, הוא קדימה → הפסקה הבאה.
    const event = press(line, 'ArrowRight');
    expect(event.defaultPrevented, 'אין פסקה קודמת').toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('שמאלה בסוף הפסקה עובר לתחילת הפסקה הבאה', () => {
    const { host, line, superdoc, setSelectionTarget } = setup({
      caretOffset: 13, // pm 64 — סוף הבלוק, הקצה השמאלי
      caretX: 949.5,
      nextFragment: {
        runs: [{ text: 'אחרי', chars: boxes(65, [900, 892, 884, 876, 868], true) }],
        pmStart: 65,
        pmEnd: 69,
      },
    });
    const handle = installRtlVisualArrows({ host, superdoc });

    press(line, 'ArrowLeft');

    expect(setSelectionTarget).toHaveBeenCalledTimes(1);
    expect(written(setSelectionTarget).target.end.blockId).toBe('p2');
    expect(written(setSelectionTarget).target.end.offset, 'תחילת הפסקה הבאה').toBe(0);
    handle.dispose();
  });

  it('טבלה בין הפסקאות: פער בטווחים, וההקשה נמסרת למנוע ולא מדלגת מעליה', () => {
    // נמדד: „לפני” pm 104..114, הטבלה 115..122 (fragment בלי מזהה מקור, ולכן
    // מחוץ לבורר), „אחרי” 123..133. בלי בדיקת הרציפות החץ קפץ לפסקה שמעבר
    // לטבלה; המנוע עצמו נכנס לתא.
    const { host, line, superdoc, setSelectionTarget } = setup({
      caretOffset: 13, // pm 64 — סוף הבלוק, הקצה השמאלי
      caretX: 949.5,
      nextFragment: {
        runs: [{ text: 'אחרי', chars: boxes(73, [900, 892, 884, 876, 868], true) }],
        pmStart: 73,
        pmEnd: 77,
      },
    });
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowLeft');

    expect(event.defaultPrevented, 'המנוע הוא שנכנס לטבלה').toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('פסקה עם טאב מטופלת ואינה נופלת חזרה למנוע', () => {
    const { host, line, superdoc, setSelectionTarget } = setup({
      runs: [
        { text: 'קודם', chars: boxes(51, [1043, 1035, 1027, 1019, 1011], true) },
        { tab: true, chars: [{ pm: 55, left: 987, right: 1011 }] },
        { text: 'אחרון', chars: boxes(56, [987, 979, 971, 963, 955, 947], true) },
      ],
      pmStart: 51,
      pmEnd: 61,
      caretOffset: 7, // pm 58, בתוך „אחרון”
      caretX: 971,
    });
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowRight');

    expect(event.defaultPrevented).toBe(true);
    expect(written(setSelectionTarget).target.end.offset, 'היסט אחד ימינה').toBe(6);
    handle.dispose();
  });

  it('שורה לטינית: ההקשה ממשיכה למנוע כפי שהיא', () => {
    const { host, line, superdoc, setSelectionTarget } = setup({ rtl: false });
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowRight');

    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('טווחים שאינם רציפים — אין מיפוי, ואין יעד', () => {
    const { host, line, superdoc, setSelectionTarget } = setup({ pmEnd: 70 });
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowRight');

    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('Ctrl+חץ הוא קפיצת מילה של המנוע, ואינו נגזל', () => {
    const { host, line, superdoc, setSelectionTarget } = setup();
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowRight', { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('בלי סמן מצויר אין נקודת מוצא, וההקשה נמסרת למנוע', () => {
    const { host, line, superdoc, setSelectionTarget } = setup();
    host.querySelector('.sd-v2-local-selection-caret')?.remove();
    const handle = installRtlVisualArrows({ host, superdoc });

    const event = press(line, 'ArrowRight');

    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('אחרי dispose המאזין אינו נוגע עוד', () => {
    const { host, line, superdoc, setSelectionTarget } = setup();
    const handle = installRtlVisualArrows({ host, superdoc });
    handle.dispose();

    const event = press(line, 'ArrowRight');

    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* עמודים: קצות המסמך, ופסקה שנחצית                                    */
/* ------------------------------------------------------------------ */

interface FragmentSpec {
  id: string;
  pmStart: number;
  pmEnd: number;
  continuesFromPrev?: boolean;
  continuesOnNext?: boolean;
  lines: Array<{ runs: RunSpec[]; pmStart: number; pmEnd: number; top: number }>;
}

/**
 * גוף עם עמודים (`.superdoc-page`) — כמו שהמנוע מצייר: ה-fragments ילדים
 * ישירים של העמוד, ופסקה חצויה היא שני fragments עם אותו מזהה.
 */
function pagesSetup(pages: FragmentSpec[][], caret: { blockId: string; offset: number; x: number; y: number }) {
  stubRects();
  const host = document.createElement('div');
  for (const fragments of pages) {
    const page = document.createElement('div');
    page.className = 'superdoc-page';
    for (const spec of fragments) {
      const fragment = document.createElement('div');
      fragment.className = 'superdoc-fragment';
      fragment.setAttribute('data-source-node-id', spec.id);
      fragment.setAttribute('data-pm-start', String(spec.pmStart));
      fragment.setAttribute('data-pm-end', String(spec.pmEnd));
      if (spec.continuesFromPrev) fragment.setAttribute('data-continues-from-prev', 'true');
      if (spec.continuesOnNext) fragment.setAttribute('data-continues-on-next', 'true');
      for (const line of spec.lines) fragment.append(buildLine(line.runs, line.pmStart, line.pmEnd, true, line.top));
      page.append(fragment);
    }
    host.append(page);
  }
  const caretEl = document.createElement('div');
  caretEl.className = 'sd-v2-local-selection-caret';
  caretEl.getBoundingClientRect = () =>
    ({ left: caret.x, right: caret.x, top: caret.y, bottom: caret.y }) as DOMRect;
  host.append(caretEl);
  document.body.append(host);

  const setSelectionTarget = vi.fn();
  const story = { kind: 'story', storyType: 'body' };
  const point = { kind: 'text', blockId: caret.blockId, offset: caret.offset, story };
  const superdoc: RtlCaretHost = {
    activeEditor: {
      host: { readLiveSelectionSyncSnapshot: () => ({ selectionTarget: { kind: 'selection', start: point, end: point, story } }) },
      authoring: { setSelectionTarget },
    },
  };
  const handle = installRtlVisualArrows({ host, superdoc });
  const line = host.querySelector('[dir="rtl"]') as HTMLElement;
  return { host, line, setSelectionTarget, handle };
}

/** פסקה של שורה אחת, „סעיף 3 בחוק הזה” — הלוגית שבה נמדדה המלכודת בקצוות. */
const loneDigitFragment = (id: string, top = 0): FragmentSpec => ({
  id,
  pmStart: 1,
  pmEnd: 16,
  lines: [{ runs: [{ text: 'סעיף 3 בחוק הזה', chars: LONE_DIGIT }], pmStart: 1, pmEnd: 16, top }],
});

describe('installRtlVisualArrows — קצות המסמך', () => {
  it('ימינה בתחילת המסמך — נבלע, ואינו נמסר למנוע', () => {
    // נמדד: המנוע זז שם לוגית, כלומר שמאלה, וההקשה הבאה החזירה — 0↔1 בלי סוף.
    const { line, setSelectionTarget, handle } = pagesSetup([[loneDigitFragment('p1')]], {
      blockId: 'p1', offset: 0, x: 1043.3, y: 10,
    });
    const event = press(line, 'ArrowRight');
    expect(event.defaultPrevented).toBe(true);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('שמאלה בסוף המסמך — נבלע', () => {
    const { line, setSelectionTarget, handle } = pagesSetup([[loneDigitFragment('p1')]], {
      blockId: 'p1', offset: 15, x: 950.3, y: 10,
    });
    const event = press(line, 'ArrowLeft');
    expect(event.defaultPrevented).toBe(true);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('ראשון בעמוד שאינו הראשון — עמוד קודם שלא צויר, וההקשה של המנוע', () => {
    // המנוע מצייר רק עמודים קרובים (נמדד: 3 מתוך 25) — „אין פסקה לפני” אינו
    // תחילת המסמך.
    const { line, setSelectionTarget, handle } = pagesSetup([[], [loneDigitFragment('p9')]], {
      blockId: 'p9', offset: 0, x: 1043.3, y: 10,
    });
    const event = press(line, 'ArrowRight');
    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('אחרון בעמוד שאינו האחרון — ההקשה של המנוע', () => {
    const { line, handle } = pagesSetup([[loneDigitFragment('p1')], []], {
      blockId: 'p1', offset: 15, x: 950.3, y: 10,
    });
    expect(press(line, 'ArrowLeft').defaultPrevented).toBe(false);
    handle.dispose();
  });

  it('פסקה שממשיכה בעמוד הבא אינה סוף המסמך', () => {
    const spec = { ...loneDigitFragment('p1'), continuesOnNext: true };
    const { line, handle } = pagesSetup([[spec]], { blockId: 'p1', offset: 15, x: 950.3, y: 10 });
    expect(press(line, 'ArrowLeft').defaultPrevented).toBe(false);
    handle.dispose();
  });
});

describe('installRtlVisualArrows — פסקה שנחצית בין עמודים', () => {
  // „שורה” בעמוד אחד (pm 51..55), והמשך „שנייה” בעמוד הבא (pm 55..60).
  const first: FragmentSpec = {
    id: 'p1',
    pmStart: 51,
    pmEnd: 55,
    continuesOnNext: true,
    lines: [{ runs: [{ text: 'שורה', chars: boxes(51, [1043, 1035, 1027, 1019, 1011], true) }], pmStart: 51, pmEnd: 55, top: 0 }],
  };
  const rest: FragmentSpec = {
    id: 'p1',
    pmStart: 55,
    pmEnd: 60,
    continuesFromPrev: true,
    lines: [{ runs: [{ text: 'שנייה', chars: boxes(55, [1043, 1035, 1027, 1019, 1011, 1003], true) }], pmStart: 55, pmEnd: 60, top: 500 }],
  };

  it('בתוך ההמשך: ההיסט יחסי לתחילת הפסקה, ולא ל-fragment', () => {
    // היסט 6 → pm 57, בשורה שבעמוד השני (x=1027). ימינה → pm 56 → היסט 5.
    const { host, setSelectionTarget, handle } = pagesSetup([[first], [rest]], {
      blockId: 'p1', offset: 6, x: 1027, y: 510,
    });
    press(host.querySelectorAll('[dir="rtl"]')[1] as HTMLElement, 'ArrowRight');
    expect(setSelectionTarget).toHaveBeenCalledTimes(1);
    expect(written(setSelectionTarget).target.end).toMatchObject({ blockId: 'p1', offset: 5 });
    handle.dispose();
  });

  it('בגבול, כשהסמן מצויר בעמוד הבא — ה-fragment שלו הוא ההמשך', () => {
    // pm 55 שייך לשניהם. הסמן בתחילת השורה של העמוד השני (x=1043, y=510):
    // שמאלה → pm 56 → היסט 5. בלי ה-y היה נבחר העמוד הראשון, והסמן קפץ
    // לתחילת השורה שם (נמדד: 898 → 811).
    const { host, setSelectionTarget, handle } = pagesSetup([[first], [rest]], {
      blockId: 'p1', offset: 4, x: 1043, y: 510,
    });
    press(host.querySelectorAll('[dir="rtl"]')[1] as HTMLElement, 'ArrowLeft');
    expect(written(setSelectionTarget).target.end).toMatchObject({ blockId: 'p1', offset: 5 });
    handle.dispose();
  });

  it('מסוף העמוד — שמאלה עובר להמשך בעמוד הבא', () => {
    // הסמן בסוף השורה של העמוד הראשון (pm 55, x=1011, y=10). אין חריץ משמאל,
    // אין שורה נוספת ב-fragment — וההמשך בעמוד הבא צמוד (55 = 55). היעד הוא
    // pm 56 → היסט 5 (55 עצמו מוחרג, כמו בין שורות גולשות).
    const { host, setSelectionTarget, handle } = pagesSetup([[first], [rest]], {
      blockId: 'p1', offset: 4, x: 1011, y: 10,
    });
    const event = press(host.querySelector('[dir="rtl"]') as HTMLElement, 'ArrowLeft');
    expect(event.defaultPrevented).toBe(true);
    expect(written(setSelectionTarget).target.end).toMatchObject({ blockId: 'p1', offset: 5 });
    handle.dispose();
  });

  it('מתחילת ההמשך — ימינה חוזר לעמוד הקודם', () => {
    const { host, setSelectionTarget, handle } = pagesSetup([[first], [rest]], {
      blockId: 'p1', offset: 4, x: 1043, y: 510,
    });
    press(host.querySelectorAll('[dir="rtl"]')[1] as HTMLElement, 'ArrowRight');
    expect(written(setSelectionTarget).target.end).toMatchObject({ blockId: 'p1', offset: 3 });
    handle.dispose();
  });

  it('החלק הראשון אינו מצויר — אין מיפוי, וההקשה של המנוע', () => {
    // היסט 2 מתחילת הפסקה. אילו הבסיס היה תחילת ההמשך (55), הוא היה ממופה
    // ל-pm 57 שבתוכו — מיפוי שגוי שנראה תקין.
    const { host, setSelectionTarget, handle } = pagesSetup([[], [rest]], {
      blockId: 'p1', offset: 2, x: 1027, y: 510,
    });
    const event = press(host.querySelector('[dir="rtl"]') as HTMLElement, 'ArrowRight');
    expect(event.defaultPrevented).toBe(false);
    expect(setSelectionTarget).not.toHaveBeenCalled();
    handle.dispose();
  });
});

describe('installRtlVisualArrows — טבלה שכנה', () => {
  /**
   * כמו שהמנוע מצייר (נמדד): fragment של טבלה בלי מזהה, ובתוכו פסקת התא —
   * עם מזהה, בלי טווח משלה, והטווח על השורה שלה. „לפני” 51..64, הטבלה 65..70,
   * „אחרי” 71..75.
   */
  function tableSetup(caret: { blockId: string; offset: number; x: number }) {
    stubRects();
    const host = document.createElement('div');
    const page = document.createElement('div');
    page.className = 'superdoc-page';

    const before = document.createElement('div');
    before.setAttribute('data-source-node-id', 'p1');
    before.setAttribute('data-pm-start', '51');
    before.setAttribute('data-pm-end', '64');
    before.append(buildLine(mixedRuns(), 51, 64, true, 0));

    const tableEl = document.createElement('div');
    tableEl.setAttribute('data-pm-start', '65');
    tableEl.setAttribute('data-pm-end', '70');
    const row = document.createElement('div');
    const cell = document.createElement('div');
    cell.setAttribute('data-source-node-id', 'c1');
    cell.append(buildLine([{ text: 'בתוכה', chars: boxes(65, [900, 892, 884, 876, 868, 860], true) }], 65, 70, true, 30));
    row.append(cell);
    tableEl.append(row);

    const after = document.createElement('div');
    after.setAttribute('data-source-node-id', 'p2');
    after.setAttribute('data-pm-start', '71');
    after.setAttribute('data-pm-end', '75');
    after.append(buildLine([{ text: 'אחרי', chars: boxes(71, [1043, 1035, 1027, 1019, 1011], true) }], 71, 75, true, 60));

    page.append(before, tableEl, after);
    host.append(page);
    const caretEl = document.createElement('div');
    caretEl.className = 'sd-v2-local-selection-caret';
    const y = caret.blockId === 'p1' ? 10 : 70;
    caretEl.getBoundingClientRect = () => ({ left: caret.x, right: caret.x, top: y, bottom: y }) as DOMRect;
    host.append(caretEl);
    document.body.append(host);

    const setSelectionTarget = vi.fn();
    const story = { kind: 'story', storyType: 'body' };
    const point = { kind: 'text', blockId: caret.blockId, offset: caret.offset, story };
    const superdoc: RtlCaretHost = {
      activeEditor: {
        host: { readLiveSelectionSyncSnapshot: () => ({ selectionTarget: { kind: 'selection', start: point, end: point, story } }) },
        authoring: { setSelectionTarget },
      },
    };
    const handle = installRtlVisualArrows({ host, superdoc });
    return { before, after, setSelectionTarget, handle };
  }

  it('שמאלה מסוף הפסקה שלפני — לתחילת הפסקה שבתא', () => {
    // נמדד: בפסקה לוגית המנוע זז קדימה בתוך הפסקה ולא נכנס לטבלה.
    const { before, setSelectionTarget, handle } = tableSetup({ blockId: 'p1', offset: 13, x: 949.5 });
    const event = press(before.firstElementChild as HTMLElement, 'ArrowLeft');
    expect(event.defaultPrevented).toBe(true);
    expect(written(setSelectionTarget).target.end).toMatchObject({ blockId: 'c1', offset: 0 });
    handle.dispose();
  });

  it('ימינה מתחילת הפסקה שאחרי — לסוף הפסקה שבתא', () => {
    const { after, setSelectionTarget, handle } = tableSetup({ blockId: 'p2', offset: 0, x: 1043 });
    const event = press(after.firstElementChild as HTMLElement, 'ArrowRight');
    expect(event.defaultPrevented).toBe(true);
    // סוף הפסקה שבתא — pm 70, היסט 5 מתחילתה (65).
    expect(written(setSelectionTarget).target.end).toMatchObject({ blockId: 'c1', offset: 5 });
    handle.dispose();
  });
});

