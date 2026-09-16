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
    expect(readLineChars(line)).toEqual(LATIN_ISLAND);
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
    expect(readLineChars(line)).toEqual(LATIN_ISLAND);
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
    expect(readLineChars(line)).toEqual(LATIN_ISLAND);
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
