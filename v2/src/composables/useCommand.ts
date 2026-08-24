import { ref, watch, onUnmounted, inject, computed } from 'vue';
import type { CommandAdapter, CommandOutcome } from '../engine/command-adapter';
import type { CommandState } from 'superdoc/ui';
import { COMMAND_ADAPTER, COMMAND_REPORTER, type CommandReporter } from './keys';

/**
 * ברירת המחדל כשאין מדווח: הכשל לקונסולה ולא לשום מקום. משמש בבדיקות ובכל
 * הרכבה חלקית של קומפוננטה — ולעולם לא במעטפת עצמה, שמזריקה מדווח אמיתי.
 */
const consoleReporter: CommandReporter = (outcome, commandId) => {
  if (!outcome.ok) console.warn(`[otzaria-word] ${commandId}: ${outcome.message}`);
};

export function useCommand(commandId: string) {
  const adapterRef = inject(COMMAND_ADAPTER, ref(null));
  const report = inject(COMMAND_REPORTER, consoleReporter);

  const state = ref<CommandState>({
    supported: false,
    enabled: false,
    active: false,
    value: undefined,
  });

  let unsubscribe: (() => void) | null = null;

  function cleanup(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function setup(adapter: CommandAdapter | null): void {
    cleanup();
    if (!adapter || !adapter.has(commandId)) {
      state.value = { supported: false, enabled: false, active: false, value: undefined };
      return;
    }
    state.value = adapter.getState(commandId);
    unsubscribe = adapter.observe(commandId, (newState) => {
      state.value = newState;
    });
  }

  watch(
    adapterRef,
    (newAdapter) => {
      setup(newAdapter);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    cleanup();
  });

  /**
   * מריצה את הפקודה **ומדווחת** על התוצאה. הדיווח כאן ולא באתר הקריאה בכוונה:
   * הפקדים ב-Ribbon קוראים `void cmd.run()`, וכל דרך אחרת הייתה מחייבת 38
   * אתרי קריאה לזכור לטפל בכשל — וזה בדיוק מה שלא קרה עד עכשיו.
   */
  async function run(payload?: unknown): Promise<CommandOutcome> {
    const outcome = adapterRef.value
      ? await adapterRef.value.run(commandId, payload)
      : ({ ok: false, message: 'המנוע אינו מוכן', reason: 'not-ready' } as CommandOutcome);

    report(outcome, commandId);
    return outcome;
  }

  return {
    state,
    enabled: computed(() => state.value.enabled),
    active: computed(() => state.value.active),
    value: computed(() => state.value.value),
    run,
  };
}
