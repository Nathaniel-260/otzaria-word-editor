/**
 * התווית שהמשתמש רואה. עד עכשיו היא הייתה מחרוזת חופשית ב-tooltip, ולכן
 * „Ctrl+B” הופיע על כפתור „מודגש” שנתיים בלי שאיש קשר את הצירוף. כאן נבדק
 * שהיא באה מהרשימה — ורק ממנה.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RibbonButton from '../../src/ui/ribbon/common/RibbonButton.vue';
import FileTab from '../../src/ui/ribbon/tabs/FileTab.vue';
import HomeTab from '../../src/ui/ribbon/tabs/HomeTab.vue';
import InsertTab from '../../src/ui/ribbon/tabs/InsertTab.vue';
import ViewTab from '../../src/ui/ribbon/tabs/ViewTab.vue';
import { SHORTCUTS, shortcutLabel } from '../../src/ui/shortcuts/registry';
import { autoUnmount, mountUi, settle } from './harness';

autoUnmount();

describe('תווית הקיצור בכפתור', () => {
  it('התווית נשלפת מהרשימה', () => {
    const wrapper = mount(RibbonButton, {
      props: { label: 'שמור', shortcutId: 'save' },
    });

    expect(wrapper.attributes('title')).toBe('שמור (Ctrl+S)');
  });

  it('tooltip מפורש קודם ל-label, והצירוף נלווה אליו', () => {
    const wrapper = mount(RibbonButton, {
      props: { label: 'שמור', tooltip: 'שמירת המסמך', shortcutId: 'save' },
    });

    expect(wrapper.attributes('title')).toBe('שמירת המסמך (Ctrl+S)');
  });

  it('כפתור בלי קיצור אינו ממציא סוגריים', () => {
    const wrapper = mount(RibbonButton, { props: { label: 'אודות' } });

    expect(wrapper.attributes('title')).toBe('אודות');
  });

  it('shortcutLabel מחזירה את מה שברשימה', () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcutLabel(shortcut.id)).toBe(shortcut.label);
    }
  });
});

describe('הרצועה מציגה את הצירופים האמיתיים', () => {
  it('„שמור” ו„שמור בשם” מציגים את הצירוף מהרשימה', async () => {
    const { wrapper } = mountUi(FileTab, { props: { hasDocument: true } });

    const titles = wrapper.findAll('button').map((button) => button.attributes('title'));

    expect(titles).toContain('שמירת שינויים במסמך (Ctrl+S)');
    expect(titles).toContain('שמירת המסמך כקובץ חדש (Ctrl+Shift+S)');
    expect(titles).toContain('הדפסת המסמך (Ctrl+P)');
  });

  it('אין באף לשונית tooltip עם צירוף שאינו ברשימה', async () => {
    // הבדיקה רצה על כל הלשוניות שיש בהן קיצור, ולא על אחת: התוויות שהיו
    // שקריות ישבו דווקא ב„בית”.
    const labels = new Set(SHORTCUTS.map((shortcut) => shortcut.label));
    const tabs = [FileTab, HomeTab, InsertTab, ViewTab];
    let checked = 0;

    for (const tab of tabs) {
      const { wrapper } = mountUi(tab, { props: { hasDocument: true } });
      await settle();

      for (const button of wrapper.findAll('button')) {
        const title = button.attributes('title') ?? '';
        const match = /\(([^)]+)\)$/.exec(title);
        // סוגריים בסוף אינם בהכרח קיצור: „הוספת תמונה מקובץ (PNG או JPEG)”.
        // נבדק רק מה שמתיימר להיות צירוף מקשים.
        if (!match || !/^(?:Ctrl|Alt|Shift|Esc|F\d)/i.test(match[1]!)) continue;
        checked += 1;
        expect(labels, title).toContain(match[1]);
      }
    }

    // אחרת הלולאה עוברת על ריק ואינה בודקת דבר.
    expect(checked).toBeGreaterThan(8);
  });
});
