/**
 * ניהול סגנונות מהגלריה — „שנה”, „צור”, „עדכן כך שיתאים לבחירה”, שינוי שם
 * ומחיקה. הלשונית מחזיקה רק את הדיאלוג; כל השאר כאן.
 *
 * כל פעולה מתחילה בקריאת `styles.xml` הטרי (`readStyles`), ולא ממטמון:
 * „ברירות מחדל למסמך” ופעולות אחרות כותבות לגיליון בלי לעבור כאן, ודיאלוג
 * שנפתח על גיליון ישן היה כותב בחזרה ערכים שכבר אינם נכונים.
 */
import { computed, inject, shallowRef } from 'vue';
import type { StyleCatalogItem } from 'superdoc/ui';
import {
  COMMAND_ADAPTER,
  COMMAND_REPORTER,
  STATUS_NOTIFIER,
  STYLE_DOCUMENT,
  type CommandReporter,
} from './keys';
import { ACTIVE_SUPERDOC } from '../engine/document-api';
import {
  listStyles,
  resolveFormat,
  type StyleEdit,
  type StyleFormat,
  type StyleInfo,
} from '../engine/docx-style-edit';
import { formatPatch, selectionStyleFormat } from '../engine/style-from-selection';
import { readParagraphFormat } from '../engine/paragraph-format';
import { styleDisplayLabel } from '../engine/style-gallery';
import type { StyleAction } from '../ui/ribbon/common/StyleGallery.vue';
import type { StyleChoice, StyleDialogMode, StyleDialogResult } from '../ui/panels/StyleDialog.vue';
import type { CommandOutcome } from '../engine/command-adapter';

export interface StyleDialogState {
  mode: StyleDialogMode;
  styleId: string | null;
  styleName: string;
  styleType: string;
  styles: readonly StyleChoice[];
  basedOn: string | null;
  next: string | null;
  format: StyleFormat;
  /** מה שהעיצוב יורש — הטלאי נכתב ביחס אליו. */
  baseline: StyleFormat;
  /** גיליון הסגנונות כפי שנקרא בפתיחה. */
  xml: string;
}

/** השם של הסגנון החדש הבא: „סגנון1”, „סגנון2”… — כמו ב-Word. */
export function nextStyleName(styles: readonly StyleInfo[]): string {
  const taken = new Set(styles.map((style) => style.name.trim().toLowerCase()));
  for (let index = 1; ; index++) {
    const candidate = `סגנון${index}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function labelOf(style: StyleInfo): string {
  return styleDisplayLabel({ id: style.id, name: style.name, custom: style.custom } as StyleCatalogItem);
}

function choicesOf(styles: readonly StyleInfo[]): StyleChoice[] {
  return styles
    .filter((style) => style.type === 'paragraph' || style.type === 'character')
    .map((style) => ({ id: style.id, label: labelOf(style), type: style.type }));
}

const silentReporter: CommandReporter = () => {};

export function useStyleManager(activeStyleId: () => string | null) {
  const handle = inject(STYLE_DOCUMENT, null);
  const adapter = inject(COMMAND_ADAPTER, () => shallowRef(null), true);
  const superdoc = inject(ACTIVE_SUPERDOC, () => shallowRef(null), true);
  const report = inject(COMMAND_REPORTER, silentReporter);
  const notify = inject(STATUS_NOTIFIER, () => {});

  const dialog = shallowRef<StyleDialogState | null>(null);
  const busy = shallowRef(false);
  const error = shallowRef<string | null>(null);

  const available = computed(() => handle !== null && superdoc.value !== null);

  async function readSelection(): Promise<StyleFormat> {
    const paragraph = await readParagraphFormat(superdoc.value);
    return selectionStyleFormat(adapter.value, paragraph.ok ? paragraph.snapshot : null);
  }

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (busy.value) return undefined;
    busy.value = true;
    try {
      return await action();
    } finally {
      busy.value = false;
    }
  }

  function fail(message: string, id: string): CommandOutcome {
    const outcome: CommandOutcome = { ok: false, message, reason: 'style-manager' };
    report(outcome, id);
    return outcome;
  }

  async function readSheet(): Promise<string | null> {
    const xml = (await handle?.readStyles()) ?? null;
    if (xml === null) fail('גיליון הסגנונות של המסמך אינו קריא', 'style-manager');
    return xml;
  }

  async function apply(edit: StyleEdit, success: string, options?: { applyToSelection?: boolean }): Promise<boolean> {
    if (!handle) return false;
    const outcome = await handle.applyEdit(edit, options);
    report(outcome, `style-${edit.kind}`);
    if (!outcome.ok) {
      error.value = outcome.message;
      return false;
    }
    notify(success);
    return true;
  }

  /** פעולה מהתפריט של הגלריה. */
  async function onAction(action: StyleAction, styleId: string | null): Promise<void> {
    if (!available.value) return;
    error.value = null;
    await run(async () => {
      const xml = await readSheet();
      if (xml === null) return;
      const styles = listStyles(xml);
      const id = styleId ?? activeStyleId() ?? styles.find((s) => s.type === 'paragraph' && s.isDefault)?.id ?? null;
      const info = id ? styles.find((style) => style.id === id) : undefined;

      if (action === 'create') {
        const base = info && info.type === 'paragraph' ? info : styles.find((s) => s.type === 'paragraph' && s.isDefault);
        const baseline = base ? resolveFormat(xml, base.id) : {};
        dialog.value = {
          mode: 'create',
          styleId: null,
          styleName: nextStyleName(styles),
          styleType: 'paragraph',
          styles: choicesOf(styles),
          basedOn: base?.id ?? null,
          next: null,
          format: { ...baseline, ...(await readSelection()) },
          baseline,
          xml,
        };
        return;
      }

      if (!info) {
        fail('הסגנון אינו במסמך — ייתכן שהוא מוצע בגלריה ועדיין לא הוגדר', `style-${action}`);
        return;
      }
      const resolved = resolveFormat(xml, info.id);

      if (action === 'update') {
        const patch = formatPatch(await readSelection(), resolved);
        if (Object.keys(patch).length === 0) {
          notify(`„${labelOf(info)}” כבר תואם לבחירה`);
          return;
        }
        await apply({ kind: 'modify', id: info.id, format: patch }, `הסגנון „${labelOf(info)}” עודכן`);
        return;
      }

      dialog.value = {
        mode: action as StyleDialogMode,
        styleId: info.id,
        styleName: action === 'rename' ? info.name : labelOf(info),
        styleType: info.type,
        styles: choicesOf(styles),
        basedOn: info.basedOn,
        next: info.next ?? info.id,
        format: resolved,
        baseline: resolved,
        xml,
      };
    });
  }

  async function onSubmit(result: StyleDialogResult): Promise<void> {
    const state = dialog.value;
    if (!state) return;
    error.value = null;
    await run(async () => {
      let done = false;
      switch (state.mode) {
        case 'create': {
          // הטלאי ביחס לבסיס **שנבחר בדיאלוג**, ולא לזה שהדיאלוג נפתח עליו.
          const baseline = result.basedOn ? resolveFormat(state.xml, result.basedOn) : {};
          done = await apply(
            {
              kind: 'create',
              name: result.name,
              type: 'paragraph',
              basedOn: result.basedOn,
              next: result.next,
              format: formatPatch(result.format, baseline),
            },
            `נוצר הסגנון „${result.name}”`,
            { applyToSelection: true },
          );
          break;
        }
        case 'modify': {
          const changedBase = result.basedOn !== state.basedOn;
          const patch = formatPatch(result.format, state.baseline);
          const changedNext = state.styleType === 'paragraph' && result.next !== state.next;
          if (!changedBase && !changedNext && Object.keys(patch).length === 0) {
            done = true;
            break;
          }
          done = await apply(
            {
              kind: 'modify',
              id: state.styleId as string,
              basedOn: changedBase ? result.basedOn : undefined,
              next: changedNext ? result.next : undefined,
              format: patch,
            },
            `הסגנון „${state.styleName}” עודכן`,
          );
          break;
        }
        case 'rename':
          done = result.name === state.styleName || await apply(
            { kind: 'rename', id: state.styleId as string, name: result.name },
            `שם הסגנון שונה ל„${result.name}”`,
          );
          break;
        case 'delete':
          done = await apply({ kind: 'delete', id: state.styleId as string }, `הסגנון „${state.styleName}” נמחק`);
          break;
      }
      if (done) dialog.value = null;
    });
  }

  function close(): void {
    dialog.value = null;
    error.value = null;
  }

  return { dialog, busy, error, available, onAction, onSubmit, close };
}
