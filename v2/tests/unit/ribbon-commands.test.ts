/**
 * בדיקות חיבור פקודות ה-Ribbon ל-SuperDoc דרך ה-CommandAdapter וה-useCommand Composable.
 *
 * מוודא שכל פקדי ה-UI (עיצוב גופן, פיסקה, יישור, סגנונות, טבלאות, מדיה, זום והיסטוריה)
 * מפעילים ומעבירים במדויק את הפרמטרים למנוע SuperDoc.
 */
import { describe, it, expect } from 'vitest';
import type { BorrowedSuperDocUI } from 'superdoc';
import type { CommandExecutionResult, CommandState } from 'superdoc/ui';
import { createCommandAdapter } from '../../src/engine/command-adapter';

interface CommandCallRecord {
  id: string;
  payload?: unknown;
}

function createMockSuperDocUi(commandCatalog: Record<string, Partial<CommandState>>): {
  ui: BorrowedSuperDocUI;
  calls: CommandCallRecord[];
  stateUpdaters: Record<string, (state: Partial<CommandState>) => void>;
} {
  const calls: CommandCallRecord[] = [];
  const stateUpdaters: Record<string, (state: Partial<CommandState>) => void> = {};
  const listeners: Record<string, Array<(state: CommandState) => void>> = {};

  const baseState: CommandState = {
    enabled: true,
    active: false,
    supported: true,
    source: 'builtin',
  };

  const ui = {
    commands: {
      has: (id: string) => id in commandCatalog,
      get: (id: string) => ({
        id,
        getState: (): CommandState => ({
          ...baseState,
          ...commandCatalog[id],
        }),
        observe: (listener: (state: CommandState) => void) => {
          if (!listeners[id]) listeners[id] = [];
          listeners[id].push(listener);
          stateUpdaters[id] = (newState: Partial<CommandState>) => {
            const full = { ...baseState, ...commandCatalog[id], ...newState };
            commandCatalog[id] = full;
            listener(full);
          };
          return () => {
            const idx = listeners[id]?.indexOf(listener) ?? -1;
            if (idx >= 0) listeners[id].splice(idx, 1);
          };
        },
        execute: (payload?: unknown) => {
          calls.push({ id, payload });
          return true;
        },
        executeAsync: async (payload?: unknown): Promise<CommandExecutionResult> => {
          calls.push({ id, payload });
          return true;
        },
      }),
      async executeAsync(id: string, payload?: unknown): Promise<CommandExecutionResult> {
        calls.push({ id, payload });
        return true;
      },
    },
  } as unknown as BorrowedSuperDocUI;

  return { ui, calls, stateUpdaters };
}

describe('Ribbon Commands & SuperDoc Integration', () => {
  const allKnownCommands: Record<string, Partial<CommandState>> = {
    undo: { enabled: true },
    redo: { enabled: true },
    bold: { enabled: true, active: false },
    italic: { enabled: true, active: false },
    underline: { enabled: true, active: false },
    strikethrough: { enabled: true, active: false },
    'clear-formatting': { enabled: true },
    'copy-format': { enabled: true },
    'font-family': { enabled: true, value: 'FrankRuhlCLM' },
    'font-size': { enabled: true, value: '12pt' },
    'text-color': { enabled: true, value: '#000000' },
    'highlight-color': { enabled: true },
    'bullet-list': { enabled: true },
    'numbered-list': { enabled: true },
    'indent-increase': { enabled: true },
    'indent-decrease': { enabled: true },
    'direction-rtl': { enabled: true, active: true },
    'direction-ltr': { enabled: true, active: false },
    'formatting-marks': { enabled: true, active: false },
    'text-align': { enabled: true, value: 'right' },
    'line-height': { enabled: true, value: 1.5 },
    'linked-style': { enabled: true, value: 'Normal' },
    'table-insert': { enabled: true },
    'table-add-row-before': { enabled: true },
    'table-add-row-after': { enabled: true },
    'table-delete-row': { enabled: true },
    'table-add-column-before': { enabled: true },
    'table-add-column-after': { enabled: true },
    'table-delete-column': { enabled: true },
    'table-delete': { enabled: true },
    image: { enabled: true },
    link: { enabled: true },
    'table-of-contents-insert': { enabled: true },
    ruler: { enabled: true },
    zoom: { enabled: true },
    'zoom-fit-width': { enabled: true },
    acceptChange: { enabled: true },
    rejectChange: { enabled: true },
    acceptAllChanges: { enabled: true },
    rejectAllChanges: { enabled: true },
  };

  it('מעביר פקודות עיצוב גופן בסיסיות למנוע SuperDoc', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('bold');
    await adapter.run('italic');
    await adapter.run('underline');
    await adapter.run('strikethrough');
    await adapter.run('clear-formatting');
    await adapter.run('copy-format');

    expect(calls.map((c) => c.id)).toEqual([
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'clear-formatting',
      'copy-format',
    ]);
  });

  it('מעביר פקודות טיפוגרפיה וצבעים עם ה-Payload המדויק', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('font-family', { fontFamily: 'TaameyDavidCLM' });
    await adapter.run('font-size', { fontSize: '16pt' });
    await adapter.run('text-color', { color: '#0055FF' });
    await adapter.run('highlight-color', { color: '#FFFF00' });

    expect(calls).toEqual([
      { id: 'font-family', payload: { fontFamily: 'TaameyDavidCLM' } },
      { id: 'font-size', payload: { fontSize: '16pt' } },
      { id: 'text-color', payload: { color: '#0055FF' } },
      { id: 'highlight-color', payload: { color: '#FFFF00' } },
    ]);
  });

  it('מעביר פקודות פיסקה, רשימות והזחות', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('bullet-list');
    await adapter.run('numbered-list');
    await adapter.run('indent-increase');
    await adapter.run('indent-decrease');
    await adapter.run('formatting-marks');

    expect(calls.map((c) => c.id)).toEqual([
      'bullet-list',
      'numbered-list',
      'indent-increase',
      'indent-decrease',
      'formatting-marks',
    ]);
  });

  it('מעביר פקודות כיווניות עברית RTL, יישור טקסט ומרווח שורות', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('direction-rtl');
    await adapter.run('text-align', { alignment: 'right' });
    await adapter.run('text-align', { alignment: 'center' });
    await adapter.run('text-align', { alignment: 'justify' });
    await adapter.run('line-height', { lineHeight: 2.0 });

    expect(calls).toEqual([
      { id: 'direction-rtl', payload: undefined },
      { id: 'text-align', payload: { alignment: 'right' } },
      { id: 'text-align', payload: { alignment: 'center' } },
      { id: 'text-align', payload: { alignment: 'justify' } },
      { id: 'line-height', payload: { lineHeight: 2.0 } },
    ]);
  });

  it('מעביר פקודות סגנונות (StyleGallery) עם שם הסגנון', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('linked-style', { style: 'Heading1' });
    await adapter.run('linked-style', { style: 'Quote' });

    expect(calls).toEqual([
      { id: 'linked-style', payload: { style: 'Heading1' } },
      { id: 'linked-style', payload: { style: 'Quote' } },
    ]);
  });

  it('מעביר פקודות הוספת טבלאות ומדיה (InsertTab)', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('table-insert', { rows: 4, cols: 5 });
    await adapter.run('image');
    await adapter.run('link');
    await adapter.run('table-of-contents-insert');

    expect(calls).toEqual([
      { id: 'table-insert', payload: { rows: 4, cols: 5 } },
      { id: 'image', payload: undefined },
      { id: 'link', payload: undefined },
      { id: 'table-of-contents-insert', payload: undefined },
    ]);
  });

  it('מעביר פקודות תצוגה (ViewTab) ובקרת זום', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('ruler');
    await adapter.run('zoom', { zoom: 1.25 });
    await adapter.run('zoom-fit-width');

    expect(calls).toEqual([
      { id: 'ruler', payload: undefined },
      { id: 'zoom', payload: { zoom: 1.25 } },
      { id: 'zoom-fit-width', payload: undefined },
    ]);
  });

  it('מעביר פקודות היסטוריה ושמירה (TitleBar / Quick Access)', async () => {
    const { ui, calls } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    await adapter.run('undo');
    await adapter.run('redo');

    expect(calls.map((c) => c.id)).toEqual(['undo', 'redo']);
  });

  it('מעדכן מאזינים באופן ריאקטיבי בעת שינוי מצב הפקודה (State Observation)', () => {
    const { ui, stateUpdaters } = createMockSuperDocUi(allKnownCommands);
    const adapter = createCommandAdapter(ui);

    const boldStates: boolean[] = [];
    const stopObserve = adapter.observe('bold', (state) => {
      boldStates.push(state.active);
    });

    // שינוי מצב bold ל-active
    stateUpdaters['bold']({ active: true });
    expect(boldStates).toContain(true);

    stopObserve();
  });
});
