/**
 * מצב מיקוד — איזה קצה חושף מה.
 *
 * הבאג שהבדיקה הזאת מקבעת: החשיפה הייתה
 * `.word-app-shell.focus-mode:hover`, וה-hover הוא על כל המעטפת. כלומר כל
 * תנועת עכבר בחלון החזירה את שלושת הפסים, ומצב המיקוד לא הסתיר כלום בפועל.
 */
import { describe, expect, it } from 'vitest';
import { REVEAL_EDGE_PX, revealZone } from '../../src/composables/focus-mode';

const HEIGHT = 900;

describe('revealZone', () => {
  it('מצביע בגוף המסמך אינו חושף כלום', () => {
    // זה המקרה שהיה שבור: אמצע החלון החזיר את כל הפסים.
    expect(revealZone(450, HEIGHT)).toBeNull();
    expect(revealZone(REVEAL_EDGE_PX + 1, HEIGHT)).toBeNull();
    expect(revealZone(HEIGHT - REVEAL_EDGE_PX - 1, HEIGHT)).toBeNull();
  });

  it('קרבה לקצה העליון חושפת את הפס העליון והרצועה', () => {
    expect(revealZone(0, HEIGHT)).toBe('top');
    expect(revealZone(REVEAL_EDGE_PX, HEIGHT)).toBe('top');
  });

  it('קרבה לקצה התחתון חושפת את שורת המצב', () => {
    expect(revealZone(HEIGHT, HEIGHT)).toBe('bottom');
    expect(revealZone(HEIGHT - REVEAL_EDGE_PX, HEIGHT)).toBe('bottom');
  });

  it('בחלון נמוך מפעמיים הרצועה הקצה העליון גובר', () => {
    // שני האזורים חופפים, ובלי סדר מוגדר התחתון היה מנצח בכל מקום — כלומר
    // הפס העליון לא היה נחשף אף פעם בחלון קטן.
    expect(revealZone(10, 30)).toBe('top');
    expect(revealZone(25, 30)).toBe('bottom');
  });

  it('עובי הרצועה נשלט מבחוץ', () => {
    expect(revealZone(40, HEIGHT, 60)).toBe('top');
    expect(revealZone(40, HEIGHT, 10)).toBeNull();
  });

  it('קלט לא חוקי אינו חושף ואינו זורק', () => {
    // `clientY` מ-pointerevent סינתטי, וגובה 0 לפני שהחלון נמדד.
    expect(revealZone(Number.NaN, HEIGHT)).toBeNull();
    expect(revealZone(10, 0)).toBeNull();
    expect(revealZone(10, Number.NaN)).toBeNull();
  });

  it('הרצועה צרה מהפס עצמו', () => {
    // פס הכותרת הוא 48px; רצועה בעובי הפס הייתה נחשפת כבר בשורה הראשונה של
    // הטקסט, וזה חוזר לבאג המקורי בגרסה מרוככת.
    expect(REVEAL_EDGE_PX).toBeLessThan(48);
  });
});
