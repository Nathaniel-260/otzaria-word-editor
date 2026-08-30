/**
 * דיאלוג ניהול המאקרו, כפי שהמשתמש פוגש אותו.
 *
 * ה-kit כאן אמיתי (MacroKit של superdoc-macros, עם אחסון בזיכרון) והמארח
 * כפיל — כלומר מה שנבדק הוא בדיוק מה שהדיאלוג עושה: שמירה, בחירה, הרצה
 * וייבוא/ייצוא מול ה-API האמיתי, בלי מנוע. הדיאלוג מרונדר ב-Teleport לגוף
 * הדף, ולכן הבדיקות ניגשות אליו דרך ה-document — כמו LinkDialog.
 */
import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { DOMWrapper } from '@vue/test-utils';
import {
  MacroKit,
  createMemoryStorage,
  type MacroHost,
  type MacroOutcome,
} from 'superdoc-macros';
import MacrosDialog from '../../src/ui/panels/MacrosDialog.vue';
import type { MacrosHandle } from '../../src/engine/macros';
import { autoUnmount, mountUi, settle } from './harness';

autoUnmount();

/** מארח כפיל: מסמך כמחרוזת. מספיק לכל מה שהדיאלוג מפעיל. */
function createFakeHost(): MacroHost & { text: string } {
  const host = {
    text: '',
    commands: {
      has: (id: string) => id === 'bold',
      ids: () => ['bold'] as const,
      async execute(): Promise<MacroOutcome> {
        return { ok: true };
      },
    },
    async insertText(value: string): Promise<MacroOutcome> {
      host.text += value;
      return { ok: true };
    },
    async deleteBackward(count: number): Promise<MacroOutcome> {
      host.text = host.text.slice(0, -count);
      return { ok: true };
    },
    async getSelection() {
      return { text: '', hasRange: false, blockId: null, selectionTarget: null, empty: true };
    },
    async replaceAll() {
      return { ok: true, replaced: 0 };
    },
    async getDocumentText() {
      return host.text;
    },
    onCommand: () => () => undefined,
    onTextInput: () => () => undefined,
  };
  return host;
}

function createHandle(): { handle: MacrosHandle; host: ReturnType<typeof createFakeHost> } {
  const host = createFakeHost();
  const kit = new MacroKit({ host, storage: createMemoryStorage(), runner: 'eval' });
  const handle: MacrosHandle = {
    kit,
    recording: shallowRef(false),
    toggleRecording: () => undefined,
    replayLast: () => undefined,
    dispose: () => undefined,
  };
  return { handle, host };
}

/** אלמנט מתוך ה-Teleport, כ-wrapper שאפשר ללחוץ עליו. */
function dialog(): DOMWrapper<Element> {
  const element = document.querySelector('.macros-dialog');
  if (!element) throw new Error('הדיאלוג אינו בגוף הדף');
  return new DOMWrapper(element);
}

function buttonByText(text: string): DOMWrapper<Element> {
  const button = dialog()
    .findAll('button')
    .find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`אין כפתור "${text}"`);
  return button;
}

async function switchTab(title: string): Promise<void> {
  const tab = dialog()
    .findAll('[role="tab"]')
    .find((candidate) => candidate.text() === title);
  if (!tab) throw new Error(`אין לשונית "${title}"`);
  await tab.trigger('click');
  await settle();
}

describe('MacrosDialog', () => {
  it('בלי מסמך — הסבר במקום פקדים', async () => {
    mountUi(MacrosDialog, { props: { isOpen: true, handle: null } });
    await settle();

    expect(dialog().text()).toContain('יש לפתוח מסמך');
    expect(dialog().findAll('[role="tab"]')).toHaveLength(0);
  });

  it('קטע טקסט: הוספה, בחירה ומחיקה מול ה-kit', async () => {
    const { handle } = createHandle();
    mountUi(MacrosDialog, { props: { isOpen: true, handle } });
    await settle();
    await switchTab('קטעי טקסט');

    await dialog().find('#md-snip-name').setValue('חתימה');
    await dialog().find('#md-snip-text').setValue('בברכה');
    await dialog().find('#md-snip-trigger').setValue('חתמ');
    await buttonByText('הוסף').trigger('click');
    await settle();

    expect(handle.kit.listSnippets()).toEqual([
      expect.objectContaining({ name: 'חתימה', text: 'בברכה', trigger: 'חתמ' }),
    ]);
    // אחרי שמירה הפריט נבחר, והכפתור מתחלף ל„עדכן”.
    expect(buttonByText('עדכן').exists()).toBe(true);

    await buttonByText('מחק').trigger('click');
    await settle();
    expect(handle.kit.listSnippets()).toHaveLength(0);
  });

  it('קיצור פסול חוסם שמירה ומציג שגיאה', async () => {
    const { handle } = createHandle();
    mountUi(MacrosDialog, { props: { isOpen: true, handle } });
    await settle();
    await switchTab('קטעי טקסט');

    await dialog().find('#md-snip-name').setValue('א');
    await dialog().find('#md-snip-text').setValue('ב');
    // `Ctrl+` — יש modifier ואין מקש; זה מה ש-parseShortcut דוחה.
    await dialog().find('#md-snip-shortcut').setValue('Ctrl+');
    await settle();

    expect(dialog().find('[role="alert"]').exists()).toBe(true);
    expect((buttonByText('הוסף').element as HTMLButtonElement).disabled).toBe(true);
    expect(handle.kit.listSnippets()).toHaveLength(0);
  });

  it('סקריפט: „הרץ” מריץ את מה שבעורך מול המסמך', async () => {
    const { handle, host } = createHandle();
    mountUi(MacrosDialog, { props: { isOpen: true, handle } });
    await settle();
    await switchTab('סקריפטים');

    await dialog().find('#md-scr-source').setValue(`await api.insertText('שלום');`);
    await buttonByText('הרץ').trigger('click');
    await settle();
    await settle();

    expect(host.text).toBe('שלום');
    expect(dialog().text()).toContain('המאקרו הסתיים בהצלחה');
  });

  it('הקלטה: בחירה, ניגון ועדכון שם', async () => {
    const { handle, host } = createHandle();
    handle.kit.importState(
      JSON.stringify({
        version: 1,
        scripts: [],
        snippets: [],
        recordings: [
          {
            version: 1,
            id: 'rec-1',
            name: 'פתיח',
            steps: [{ type: 'insert-text', text: 'בס"ד' }],
          },
        ],
      })
    );

    const wrapper = mountUi(MacrosDialog, { props: { isOpen: true, handle } }).wrapper;
    await settle();

    const item = dialog()
      .findAll('[role="option"]')
      .find((candidate) => candidate.text().includes('פתיח'));
    expect(item).toBeDefined();
    await item!.trigger('click');
    await settle();

    await buttonByText('נגן').trigger('click');
    await settle();
    await settle();
    expect(host.text).toBe('בס"ד');
    expect(wrapper.emitted('status')).toBeTruthy();

    await dialog().find('#md-rec-name').setValue('פתיח דבר תורה');
    await buttonByText('עדכן').trigger('click');
    await settle();
    expect(handle.kit.listRecordings()[0]!.name).toBe('פתיח דבר תורה');
  });

  it('ייצוא ממלא את התיבה וייבוא ממזג', async () => {
    const { handle } = createHandle();
    handle.kit.saveSnippet({ name: 'בס"ד', text: 'בס"ד', trigger: 'בסד' });

    mountUi(MacrosDialog, { props: { isOpen: true, handle } });
    await settle();
    await switchTab('ייבוא וייצוא');

    await buttonByText('ייצא לכאן').trigger('click');
    await settle();
    const exported = (dialog().find('#md-transfer').element as HTMLTextAreaElement).value;
    expect(exported).toContain('בסד');

    // מיזוג של אותו ייצוא חזרה — לא מכפיל: פריט עם אותו מזהה מוחלף.
    await buttonByText('ייבא מכאן').trigger('click');
    await settle();
    expect(handle.kit.listSnippets()).toHaveLength(1);
  });
});
