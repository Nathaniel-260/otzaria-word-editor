/**
 * כיווץ קבוצות הרצועה כשאין מקום — ההתנהגות של Word.
 *
 * במקום פס גלילה, הקבוצות שבסוף הרצועה מתקפלות כל אחת לכפתור אחד שפותח את
 * תוכנה בפופאובר. הסדר הוא מהסוף להתחלה, כמו ב-Word: „לוח” היא האחרונה
 * שנכנעת.
 */
import { inject, provide, type InjectionKey, type Ref } from 'vue';

/** רוחב שמניחים לצ'יפ עד שנמדד אחד אמיתי. */
export const CHIP_ESTIMATE_PX = 76;

export interface GroupWidth {
  /** רוחב הקבוצה הפרושה. */
  natural: number;
  /** רוחב הצ'יפ שיחליף אותה. */
  chip: number;
}

/**
 * אילו קבוצות מתכווצות ברוחב הזה — פונקציה טהורה, ולכן נבדקת בלי DOM.
 *
 * דטרמיניסטית לחלוטין ביחס לרוחב: אין כאן זיכרון של המצב הקודם, ולכן אין
 * מצב שבו כיווץ אחד גורר את הבא ושניהם מהבהבים.
 */
export function planCollapse(groups: readonly GroupWidth[], available: number): boolean[] {
  const flags = new Array<boolean>(groups.length).fill(false);
  if (!groups.length || available <= 0) return flags;

  let total = groups.reduce((sum, group) => sum + group.natural, 0);
  for (let i = groups.length - 1; i >= 0 && total > available; i--) {
    // קבוצה שהצ'יפ שלה אינו צר ממנה אינה קונה כלום, וכיווצה רק מסתיר פקדים.
    if (groups[i].chip >= groups[i].natural) continue;
    total += groups[i].chip - groups[i].natural;
    flags[i] = true;
  }
  return flags;
}

export interface RibbonGroupEntry {
  el: HTMLElement;
  collapsed: Ref<boolean>;
  /** סוגר את הפופאובר של הקבוצה — נקרא כשהיא נפרשת בחזרה. */
  close: () => void;
}

export interface RibbonOverflow {
  register(entry: RibbonGroupEntry): () => void;
  /** מדידה מחדש לפי בקשה — פקד ששינה רוחב. */
  remeasure(): void;
}

const RIBBON_OVERFLOW: InjectionKey<RibbonOverflow> = Symbol('ribbon-overflow');

interface Tracked extends RibbonGroupEntry {
  natural: number;
  chip: number;
}

/**
 * מתקין את הבקר על גוף הרצועה. הקבוצות מוצאות אותו ב-`useRibbonOverflow`.
 */
export function provideRibbonOverflow(host: Ref<HTMLElement | null>): RibbonOverflow {
  const entries: Tracked[] = [];
  let scheduled = 0;
  let passes = 0;

  function schedule(): void {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      measure();
    });
  }

  function measure(): void {
    const container = host.value;
    // רצועה מכווצת או שטרם נפרסה — `clientWidth` אפס, וכל מדידה כאן הייתה
    // מכווצת את הכול על סמך כלום.
    if (!container || container.clientWidth === 0 || !entries.length) return;

    entries.sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );

    for (const entry of entries) {
      const width = entry.el.offsetWidth;
      if (!width) continue;
      if (entry.collapsed.value) {
        entry.chip = width;
      } else {
        entry.natural = width;
      }
    }

    const style = getComputedStyle(container);
    const available =
      container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    const plan = planCollapse(entries, available);
    let changed = false;
    plan.forEach((collapsed, index) => {
      const entry = entries[index];
      if (entry.collapsed.value === collapsed) return;
      entry.collapsed.value = collapsed;
      if (!collapsed) entry.close();
      changed = true;
    });

    // הצ'יפ הראשון נמדד רק אחרי שהוא צויר, ולכן פעימה נוספת מדייקת את התוכנית.
    // התקרה היא מה שמונע רדיפה בין שתי תוכניות שאינן מתכנסות.
    if (changed && passes < 4) {
      passes++;
      schedule();
    } else {
      passes = 0;
    }
  }

  const observer =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
  let observed: HTMLElement | null = null;

  function sync(): void {
    if (!observer) return;
    if (observed === host.value) return;
    if (observed) observer.unobserve(observed);
    observed = host.value;
    if (observed) observer.observe(observed);
  }

  const api: RibbonOverflow = {
    register(entry) {
      const tracked: Tracked = {
        ...entry,
        natural: entry.el.offsetWidth,
        chip: CHIP_ESTIMATE_PX,
      };
      entries.push(tracked);
      sync();
      passes = 0;
      schedule();
      return () => {
        const index = entries.indexOf(tracked);
        if (index >= 0) entries.splice(index, 1);
        passes = 0;
        schedule();
      };
    },
    remeasure() {
      passes = 0;
      schedule();
    },
  };

  provide(RIBBON_OVERFLOW, api);
  return api;
}

export function useRibbonOverflow(): RibbonOverflow | null {
  return inject(RIBBON_OVERFLOW, null);
}
