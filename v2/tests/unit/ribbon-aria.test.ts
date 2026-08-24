/**
 * הנגישות של הרצועה — הלוגיקה, לא ה-markup.
 *
 * שני דברים נמדדים כאן:
 *   1. ניווט החצים בין הלשוניות. בסרגל RTL הלשונית הבאה נמצאת שמאלה מהפעילה,
 *      ולכן ArrowLeft מתקדם — ההיפוך הזה הוא מה שנשבר בלי שרואים.
 *   2. המכניקה שמאפשרת ל-RibbonButton לדעת אם הוא מתג. אין במאגר תשתית
 *      לבדיקות קומפוננטות, ולכן הבדיקה השלישית מרימה קומפוננטה שקולה מ-vue
 *      עצמו ומודדת את **התנהגות Vue** שהפתרון נשען עליה: prop עם ברירת מחדל
 *      false אינו מבדיל בין „מתג כבוי” ל„כפתור פעולה”, ו-vnode.props כן.
 */
import { describe, expect, it } from 'vitest';
import { createApp, defineComponent, getCurrentInstance, h, nextTick, ref } from 'vue';
import { RIBBON_PANEL_ID, isToggleButton, nextTabIndex, ribbonTabId } from '../../src/ui/ribbon/aria';

describe('nextTabIndex', () => {
  it('ב-RTL ArrowLeft מתקדם ו-ArrowRight חוזר', () => {
    expect(nextTabIndex('ArrowLeft', 3, 8)).toBe(4);
    expect(nextTabIndex('ArrowRight', 3, 8)).toBe(2);
  });

  it('ב-LTR הכיוונים מתהפכים', () => {
    expect(nextTabIndex('ArrowRight', 3, 8, 'ltr')).toBe(4);
    expect(nextTabIndex('ArrowLeft', 3, 8, 'ltr')).toBe(2);
  });

  it('עוטף משני הקצוות', () => {
    expect(nextTabIndex('ArrowLeft', 7, 8)).toBe(0);
    expect(nextTabIndex('ArrowRight', 0, 8)).toBe(7);
  });

  it('Home ו-End קופצים לקצוות', () => {
    expect(nextTabIndex('Home', 5, 8)).toBe(0);
    expect(nextTabIndex('End', 5, 8)).toBe(7);
  });

  it('מקש שאינו ניווט מחזיר null, כדי שהאירוע לא ייחטף', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', ' ', 'a', 'Escape']) {
      expect(nextTabIndex(key, 3, 8)).toBeNull();
    }
  });

  it('אינו מתפוצץ על סרגל ריק או על לשונית שאינה ברשימה', () => {
    expect(nextTabIndex('ArrowLeft', 0, 0)).toBeNull();
    expect(nextTabIndex('ArrowLeft', -1, 8)).toBe(0);
    expect(nextTabIndex('ArrowRight', -1, 8)).toBe(6);
  });
});

describe('isToggleButton', () => {
  it('מזהה כפתור שההורה קשר לו active', () => {
    expect(isToggleButton({ active: false })).toBe(true);
    expect(isToggleButton({ active: true })).toBe(true);
  });

  it('כפתור פעולה — שההורה העביר לו רק תווית ואייקון — אינו מתג', () => {
    expect(isToggleButton({ label: 'שמור', icon: 'save', variant: 'large' })).toBe(false);
    expect(isToggleButton({})).toBe(false);
    expect(isToggleButton(null)).toBe(false);
    expect(isToggleButton(undefined)).toBe(false);
  });
});

describe('מזהי ה-DOM שמקשרים לשונית לפאנל', () => {
  it('יציבים ומבוססים על מזהה הלשונית', () => {
    expect(ribbonTabId('home')).toBe('word-ribbon-tab-home');
    expect(RIBBON_PANEL_ID).toBe('word-ribbon-panel');
  });
});

describe('התנהגות Vue שעליה aria-pressed נשען', () => {
  /** אותו חיווט שב-RibbonButton.vue, בקומפוננטה מינימלית ובלי SFC. */
  const Probe = defineComponent({
    props: { active: { type: Boolean, default: false } },
    setup(props) {
      const isToggle = isToggleButton(getCurrentInstance()?.vnode.props);
      return () =>
        h('button', {
          'aria-pressed': isToggle ? (props.active ? 'true' : 'false') : undefined,
        });
    },
  });

  it('כפתור פעולה יוצא בלי aria-pressed, ומתג מדווח את מצבו', () => {
    const host = document.createElement('div');
    createApp({
      render: () => h('div', [h(Probe), h(Probe, { active: false }), h(Probe, { active: true })]),
    }).mount(host);

    const buttons = [...host.querySelectorAll('button')];

    // זו הרגרסיה: לפני התיקון גם הכפתור הראשון קיבל aria-pressed="false",
    // וקורא מסך הכריז „שמור” ו„הדפסה” כמתג כבוי.
    expect(buttons[0].hasAttribute('aria-pressed')).toBe(false);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('מתג ממשיך לדווח נכון כשהמצב מתחלף', async () => {
    // ההחלטה „האם זה מתג” נמדדת פעם אחת ב-setup, ולכן חשוב שהדיווח עצמו
    // יישאר תגובתי ל-prop.
    const host = document.createElement('div');
    const isActive = ref(false);
    createApp({ render: () => h(Probe, { active: isActive.value }) }).mount(host);

    const button = host.querySelector('button');
    expect(button?.getAttribute('aria-pressed')).toBe('false');

    isActive.value = true;
    await nextTick();

    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });
});
