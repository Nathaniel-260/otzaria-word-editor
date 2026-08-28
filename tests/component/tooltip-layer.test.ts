/**
 * שכבת הטולטיפ — ui/tooltip/TooltipLayer.vue.
 *
 * ## התקלה שהבדיקה הזאת שומרת עליה
 *
 * הכרטיס מכבה את הטולטיפ המולד בכך שהוא מסיר את `title` מהעוגן הפעיל. בפקד
 * שיש לו **רק** `title` — הפס העליון, שורת המצב, לוח הצבעים, בוררי הגופן —
 * התכונה הזאת היא בדיוק מה שהפך אותו לעוגן, ועם הסרתה הוא חדל להיות כזה.
 * נמדד ב-Chrome על ה-dist הארוז, על `.word-app-badge`: ריחוף פותח את הכרטיס,
 * ותזוזה של פיקסל אחד סוגרת אותו — ואחרי 400ms הוא נפתח שוב. הבהוב, ודווקא
 * על כל מה שהכיסוי-ללא-חיווט הבטיח.
 *
 * ## למה `elementFromPoint` מזויף כאן
 *
 * ב-jsdom הוא אינו קיים, ו-`anchorAt` קורא לו בכל פעם שהמסלול הישיר לא מצא
 * עוגן. בלי הזיוף הקריאה **זורקת**, המאזין נופל באמצע, והכרטיס נשאר פתוח
 * במקרה — כלומר הבדיקה הייתה עוברת בירוק דווקא על הקוד השבור. הזיוף מחזיר
 * את מה שדפדפן אמיתי מחזיר: את האלמנט שתחת הסמן.
 *
 * הכיסוי בדפדפן אמיתי הוא ב-scripts/tooltip-probe.mjs, ששם גם המסלול של
 * כפתור מנוטרל נמדד.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import TooltipLayer from '../../src/ui/tooltip/TooltipLayer.vue';

/** SHOW_DELAY_MS בקומפוננטה. הבדיקה מקדמת שעון מזויף, ולא ממתינה באמת. */
const SHOW_DELAY_MS = 400;
/** HIDE_DELAY_MS בקומפוננטה, בתוספת שוליים. */
const HIDE_DELAY_MS = 200;

let wrapper: VueWrapper | null = null;
let hit: Element | null = null;

/** תנועת עכבר, עם ה-target שדפדפן היה שולח. */
function pointerMove(target: Element, x: number, y: number): void {
  const event = new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'target', { value: target });
  document.dispatchEvent(event);
}

beforeEach(() => {
  vi.useFakeTimers();
  (document as unknown as { elementFromPoint: (x: number, y: number) => Element | null })
    .elementFromPoint = () => hit;
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  hit = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('הטולטיפ על פקד שכל תוכנו title', () => {
  function mountOverBadge(): HTMLElement {
    const badge = document.createElement('div');
    badge.setAttribute('title', 'וורד לאוצריא');
    document.body.appendChild(badge);
    hit = badge;
    wrapper = mount(TooltipLayer, { attachTo: document.body });
    return badge;
  }

  it('נפתח, ומכבה את הטולטיפ המולד', async () => {
    const badge = mountOverBadge();

    pointerMove(badge, 10, 10);
    vi.advanceTimersByTime(SHOW_DELAY_MS + 20);
    await wrapper!.vm.$nextTick();

    expect(wrapper!.find('.word-tip').exists()).toBe(true);
    expect(wrapper!.find('.word-tip__title').text()).toBe('וורד לאוצריא');
    // המלבן האפור של מערכת ההפעלה כבוי — זו הסיבה שהתכונה מוסרת בכלל.
    expect(badge.getAttribute('title')).toBeNull();
  });

  it('שורד תזוזת עכבר נוספת על אותו פקד — זה ההבהוב שנמדד', async () => {
    const badge = mountOverBadge();

    pointerMove(badge, 10, 10);
    vi.advanceTimersByTime(SHOW_DELAY_MS + 20);
    await wrapper!.vm.$nextTick();
    expect(wrapper!.find('.word-tip').exists()).toBe(true);

    // פיקסל אחד. בקוד השבור העוגן כבר אינו נמצא, ו-scheduleHide רץ.
    pointerMove(badge, 11, 11);
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    await wrapper!.vm.$nextTick();

    expect(wrapper!.find('.word-tip').exists()).toBe(true);
  });

  it('היציאה מחזירה את התכונות שהושאלו, ואינה משאירה data-tip-title משלנו', async () => {
    const badge = mountOverBadge();

    pointerMove(badge, 10, 10);
    vi.advanceTimersByTime(SHOW_DELAY_MS + 20);
    await wrapper!.vm.$nextTick();

    hit = null;
    pointerMove(document.body, 900, 900);
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    await wrapper!.vm.$nextTick();

    expect(wrapper!.find('.word-tip').exists()).toBe(false);
    expect(badge.getAttribute('title')).toBe('וורד לאוצריא');
    expect(badge.hasAttribute('data-tip-title')).toBe(false);
    expect(badge.hasAttribute('aria-label')).toBe(false);
  });
});

describe('הטולטיפ על פקד שכבר מחווט', () => {
  it('ה-data-tip-title שלו נשאר שלו — ההשאלה אינה דורסת ואינה מוחקת', async () => {
    const button = document.createElement('button');
    button.setAttribute('title', 'מודגש (Ctrl+B)');
    button.setAttribute('data-tip-title', 'מודגש');
    button.setAttribute('data-tip-shortcut', 'Ctrl+B');
    document.body.appendChild(button);
    hit = button;
    wrapper = mount(TooltipLayer, { attachTo: document.body });

    pointerMove(button, 10, 10);
    vi.advanceTimersByTime(SHOW_DELAY_MS + 20);
    await wrapper!.vm.$nextTick();

    expect(wrapper!.find('.word-tip__title').text()).toBe('מודגש');
    expect(button.getAttribute('data-tip-title')).toBe('מודגש');

    hit = null;
    pointerMove(document.body, 900, 900);
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    await wrapper!.vm.$nextTick();

    expect(button.getAttribute('data-tip-title')).toBe('מודגש');
    expect(button.getAttribute('title')).toBe('מודגש (Ctrl+B)');
  });
});
