import { ref, watch, onUnmounted, inject, type Ref, computed } from 'vue';
import type { CommandAdapter, CommandOutcome } from '../engine/command-adapter';
import type { CommandState } from 'superdoc/ui';

export function useCommand(commandId: string) {
  const adapterRef = inject<Ref<CommandAdapter | null>>('commandAdapter', ref(null));

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

  async function run(payload?: unknown): Promise<CommandOutcome> {
    if (!adapterRef.value) {
      return { ok: false, message: 'המנוע אינו מוכן', reason: 'not-ready' };
    }
    return adapterRef.value.run(commandId, payload);
  }

  return {
    state,
    enabled: computed(() => state.value.enabled),
    active: computed(() => state.value.active),
    value: computed(() => state.value.value),
    run,
  };
}
