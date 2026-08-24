/**
 * שורת המצב.
 *
 * מה שהוצג שם עד עכשיו לא היה מדידה: „עמוד 1 מתוך 1” על כל מסמך, „0 מילים”
 * על מסמך מלא, „עברית” כשפת הגהה שאין לה פיצ'ר איות מאחוריה, כפתור „פריסת
 * הדפסה” עם `class="active"` קבוע ובלי `@click` — וגם „נטען ב-473 מילישניות”,
 * מדידת פיתוח שתפסה את השורה עד ההודעה הבאה. כל אלה HTML תקין לחלוטין, ולכן
 * שום typecheck ושום בדיקה לא התלוננו.
 *
 * הכלל שהבדיקות כאן מקבעות: **מה שלא נמדד אינו מוצג.** התוויות מקבלות „לא
 * ידוע” (`null`) ומחזירות עליו נוסח מצומצם או כלום — לא מספר שנראה אמיתי.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageLabel, wordCountLabel } from '../../src/composables/shell-format';

/** vitest רץ מ-v2/, ולכן src/ נמצא ביחס ל-cwd. */
const SRC = join(process.cwd(), 'src');

/** ההערות מוסרות: התיעוד מסביר מה **היה** שם, וההסבר אינו הפרה. */
function stripComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const STATUSBAR = stripComments(readFileSync(join(SRC, 'ui/shell/StatusBar.vue'), 'utf8'));
const APP = stripComments(readFileSync(join(SRC, 'App.vue'), 'utf8'));
const TEMPLATE = STATUSBAR.slice(0, STATUSBAR.indexOf('</template>'));

describe('תווית העמוד', () => {
  it('אין מספר עמודים — אין תווית', () => {
    // „עמוד 1 מתוך 1” היה מה שהוצג כאן, על כל מסמך.
    expect(pageLabel(null, null)).toBe('');
    expect(pageLabel(1, null)).toBe('');
    expect(pageLabel(1, 0)).toBe('');
  });

  it('יש עמודים ואין עמוד סמן — מספר העמודים בלבד', () => {
    expect(pageLabel(null, 12)).toBe('12 עמודים');
    expect(pageLabel(null, 1)).toBe('עמוד אחד');
  });

  it('שניהם ידועים — הנוסח המלא', () => {
    expect(pageLabel(4, 12)).toBe('עמוד 4 מתוך 12');
  });

  it('עמוד סמן שרץ לפני הפריסה מוגבל למספר העמודים', () => {
    // „עמוד 4 מתוך 3” נראה כמו באג, לא כמו מדידה שמתעכבת.
    expect(pageLabel(4, 3)).toBe('עמוד 3 מתוך 3');
  });
});

describe('תווית המילים', () => {
  it('טרם נמדד אינו „0 מילים”', () => {
    expect(wordCountLabel(null)).toBe('');
  });

  it('מסמך ריק, מילה אחת ורבים', () => {
    expect(wordCountLabel(0)).toBe('אין מילים');
    expect(wordCountLabel(1)).toBe('מילה אחת');
    expect(wordCountLabel(1840)).toBe('1840 מילים');
  });
});

describe('שורת המצב אינה מציגה נתונים מומצאים', () => {
  it('התוויות מגיעות מהפונקציות ולא מהתבנית', () => {
    expect(STATUSBAR).toContain('pageLabel');
    expect(STATUSBAR).toContain('wordCountLabel');
    expect(TEMPLATE).toContain('{{ pageText }}');
    expect(TEMPLATE).toContain('{{ wordText }}');
    // הנוסח נבנה בפונקציה, ולא ממספרים גולמיים בתוך הטקסט של התבנית.
    expect(TEMPLATE).not.toMatch(/\{\{\s*(currentPage|totalPages|wordCount)\s*\}\}/);
    expect(TEMPLATE).not.toMatch(/מתוך/);
  });

  it('כל פריט מוצג רק אם יש לו ערך', () => {
    expect(TEMPLATE).toMatch(/v-if="pageText"/);
    expect(TEMPLATE).toMatch(/v-if="wordText"/);
  });

  it('„עברית” כשפת הגהה הוסרה — אין פיצ׳ר איות מאחוריה', () => {
    expect(STATUSBAR).not.toMatch(/עברית/);
    expect(STATUSBAR).not.toMatch(/language/);
  });
});

describe('פקדי שורת המצב', () => {
  /**
   * כל תג `<button ...>` בתבנית, כולל תכונותיו. המחרוזות מדולגות במפורש:
   * `:disabled="zoomLevel >= zoomMax"` מכיל `>`, ותג שנחתך עליו היה נראה כמו
   * כפתור בלי מטפל.
   */
  const buttons = [...TEMPLATE.matchAll(/<button(?:"[^"]*"|'[^']*'|[^>])*>/g)].map((m) => m[0]);

  it('נמצאו כפתורים לבדוק', () => {
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('לכל כפתור יש @click — אין יותר כפתור מת', () => {
    // „פריסת הדפסה” היה כפתור בלי מטפל, שנראה דלוק תמיד ולא עשה כלום.
    expect(buttons.filter((button) => !button.includes('@click'))).toEqual([]);
  });

  it('אין class="active" קבוע — מצב פעיל נגזר ממצב אמיתי', () => {
    // `(?<!:)` מפריד `class="..."` מ-`:class="{ active: ... }"` שהוא בדיוק המצב הרצוי.
    expect(TEMPLATE).not.toMatch(/(?<!:)class="[^"]*\bactive\b/);
    expect(TEMPLATE).toMatch(/:class="\{ active: isFocusMode \}"/);
    expect(TEMPLATE).toMatch(/:aria-pressed="isFocusMode"/);
  });
});

describe('גבולות הזום', () => {
  it('הסרגל לוקח min/max מ-props ולא ממספר קשיח', () => {
    expect(TEMPLATE).toMatch(/:min="zoomMin"/);
    expect(TEMPLATE).toMatch(/:max="zoomMax"/);
    expect(TEMPLATE).not.toMatch(/\bmin="\d+"/);
    expect(TEMPLATE).not.toMatch(/\bmax="\d+"/);
  });

  it('הצעדים וההגבלה עוברים ב-clampZoom של המנוע', () => {
    expect(STATUSBAR).toContain('clampZoom');
    // 50/200 היו מקודדים גם ב-stepZoom, ולא רק בסרגל.
    expect(STATUSBAR).not.toMatch(/Math\.min\(200/);
    expect(STATUSBAR).not.toMatch(/Math\.max\(50/);
  });

  it('הערך המוצג מגיע מהמנוע דרך App.vue, ולא נכתב על ידי הסרגל', () => {
    // `zoomLevel.value = level` שהיה ב-onZoomChange חידש את התווית גם כשהמנוע
    // דחה את הפקודה — הסרגל זז והמסמך לא.
    expect(APP).toContain('observeZoom');
    expect(APP).not.toMatch(/zoomLevel\.value\s*=/);
  });
});

describe('מדידת זמן הטעינה', () => {
  it('עוברת ל-console ולא לשורת המצב', () => {
    expect(APP).not.toMatch(/setStatus\([^)]*מילישניות/);
    expect(APP).toMatch(/console\.info\([\s\S]*?מילישניות/);
  });
});

describe('מקורות הנתונים', () => {
  it('שורת המצב נשענת על המודד ולא על ref שאיש אינו מעדכן', () => {
    expect(APP).toContain('createDocMetrics');
    expect(APP).toMatch(/:total-pages="docMetrics\.totalPages"/);
    expect(APP).toMatch(/:word-count="docMetrics\.words"/);
    expect(APP).toMatch(/:current-page="docMetrics\.currentPage"/);
    expect(APP).not.toMatch(/const (currentPage|totalPages|wordCount) = ref\(/);
  });

  it('מספר העמודים מחובר ל-callback של העימוד', () => {
    expect(APP).toMatch(/onPaginationUpdate:.*notePaginationUpdate/s);
  });

  it('המודד מפורק עם ה-session, כדי שלא ימדוד מסמך שנסגר', () => {
    expect(APP).toMatch(/sessionMetrics\.dispose\(\)/);
  });
});
