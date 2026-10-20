<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="bug-dialog"
      :style="dragStyle"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-dialog-title"
      @keydown.esc.stop="$emit('close')"
      @keydown.enter="onDialogEnter"
    >
      <div
        class="br-header dialog-drag-handle"
        @pointerdown="startDialogDrag"
      >
        <span
          id="bug-dialog-title"
          class="br-title"
        >דיווח על באג</span>
        <button
          type="button"
          class="br-close-btn"
          data-tip-title="סגור"
          data-tip-shortcut="Esc"
          aria-label="סגור את הדיווח"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="br-body">
        <template v-if="phase === 'form' || phase === 'sending'">
          <label
            for="br-title-input"
            class="br-label"
          >נושא</label>
          <input
            id="br-title-input"
            ref="titleRef"
            v-model="title"
            type="text"
            class="br-input"
            maxlength="120"
            placeholder="למשל: הסמן קופץ אחרי הדבקה"
          >

          <label
            for="br-desc-input"
            class="br-label"
          >מה קרה</label>
          <textarea
            id="br-desc-input"
            v-model="description"
            class="br-input br-textarea"
            rows="4"
            placeholder="מה עשיתם, מה ציפיתם שיקרה, ומה קרה בפועל"
          />

          <label
            v-if="errors.length > 0"
            class="br-check"
          >
            <input
              v-model="includeErrors"
              type="checkbox"
            >
            צרף שגיאות אחרונות מהתוסף ({{ errors.length }})
          </label>

          <details class="br-preview">
            <summary>מה יישלח</summary>
            <pre
              class="br-preview-text"
              dir="auto"
            >{{ preview }}</pre>
          </details>

          <p class="br-note">
            תוכן המסמך אינו נשלח. הדיווח נפתח כטופס ב-GitHub בדפדפן, ושם אפשר
            לערוך אותו לפני השליחה (נדרש חשבון GitHub).
          </p>
        </template>

        <p
          v-else
          class="br-status"
          role="status"
        >
          <template v-if="phase === 'opened'">
            הטופס נפתח בדפדפן, והשליחה עצמה נעשית שם.
            <template v-if="sentTruncated">
              הדיווח היה ארוך מדי לכתובת וקוצר בה; הנוסח המלא הועתק ללוח.
            </template>
          </template>
          <template v-else>
            {{ phase === 'copied' ? 'לא ניתן לפתוח את הדפדפן מכאן, והדיווח הועתק ללוח.' : 'לא ניתן לפתוח את הדפדפן מכאן, וגם ההעתקה ללוח נכשלה — את הדיווח אפשר להעתיק מהתיבה שלמטה.' }}
            פתחו בדפדפן את הכתובת הזאת והדביקו בה את הדיווח:
            <input
              class="br-input br-url"
              type="text"
              readonly
              dir="ltr"
              :value="BUG_REPORT_NEW_ISSUE"
              aria-label="כתובת לפתיחת דיווח"
              @focus="($event.target as HTMLInputElement).select()"
            >
            <textarea
              v-if="phase === 'failed'"
              class="br-input br-textarea br-manual"
              readonly
              rows="6"
              dir="auto"
              aria-label="טקסט הדיווח להעתקה ידנית"
              :value="preview"
              @focus="($event.target as HTMLTextAreaElement).select()"
            />
          </template>
        </p>
      </div>

      <div class="br-footer">
        <template v-if="phase === 'form' || phase === 'sending'">
          <button
            ref="sendRef"
            type="button"
            class="br-btn br-btn-primary"
            data-default-action
            :disabled="phase === 'sending'"
            @click="send"
          >
            פתח דיווח
          </button>
          <button
            type="button"
            class="br-btn"
            @click="$emit('close')"
          >
            ביטול
          </button>
        </template>
        <template v-else>
          <button
            v-if="phase === 'failed'"
            type="button"
            class="br-btn"
            @click="copyAgain"
          >
            העתק שוב
          </button>
          <button
            ref="doneRef"
            type="button"
            class="br-btn br-btn-primary"
            @click="$emit('close')"
          >
            סגור
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * „דיווח על באג”.
 *
 * הדיאלוג אוסף נושא ותיאור, מציג **בדיוק** את מה שיישלח (כולל הפרטים הטכניים
 * והשגיאות), ופותח issue ממולא מראש ב-GitHub. ההיגיון כולו ב-host/bug-report.ts;
 * כאן רק התצוגה והמעברים בין „טופס”, „נפתח” ו„הועתק”.
 *
 * השגיאות נלכדות ברגע הפתיחה ולא בזמן השליחה: מה שהמשתמש ראה בתצוגה המקדימה
 * הוא מה שיוצא, גם אם בינתיים נרשמה שגיאה נוספת.
 */
import { computed, nextTick, ref, watch } from 'vue';
import {
  BUG_REPORT_NEW_ISSUE,
  buildIssueBody,
  buildIssueUrl,
  collectEnvironment,
  issueTitle,
  type BugReportInput,
  copyText,
  openInBrowser,
} from '../../host/bug-report';
import { recentErrors, type RecentError } from '../../host/recent-errors';
import { useDialogDrag } from '../../composables/dialog-drag';
import { useDialogDefaultAction } from '../../composables/dialog-default-action';

const { dragStyle, startDialogDrag } = useDialogDrag();
/* Enter בשדה הנושא = „פתח דיווח”; בתיבת התיאור הוא שורה חדשה. */
const { onDialogEnter } = useDialogDefaultAction();

const props = withDefaults(defineProps<{ isOpen?: boolean }>(), { isOpen: false });

defineEmits<{
  (e: 'close'): void;
}>();

type Phase = 'form' | 'sending' | 'opened' | 'copied' | 'failed';

const phase = ref<Phase>('form');
const title = ref('');
const description = ref('');
const includeErrors = ref(true);
const errors = ref<RecentError[]>([]);
const environment = ref(collectEnvironment());

const titleRef = ref<HTMLInputElement | null>(null);
const doneRef = ref<HTMLButtonElement | null>(null);

const sentTruncated = ref(false);

const input = computed<BugReportInput>(() => ({
  title: title.value,
  description: description.value,
  environment: environment.value,
  errors: includeErrors.value ? errors.value : [],
}));

/**
 * התצוגה המקדימה היא הנוסח המלא — מה שיגיע ל-GitHub אם אינו ארוך מדי, ומה
 * שמועתק ללוח בכל מקרה. הכתובת עצמה, עם הקיצור שלה, נבנית רק בשליחה: הקיצור
 * מחפש אורך, ואין סיבה להריץ אותו בכל הקשה.
 */
const preview = computed(
  () => `${issueTitle(input.value.title, input.value.description)}

${buildIssueBody(input.value)}`,
);

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    phase.value = 'form';
    title.value = '';
    description.value = '';
    includeErrors.value = true;
    sentTruncated.value = false;
    errors.value = recentErrors();
    // גרסת אוצריא מגיעה מה-boot, שעשוי להסתיים אחרי הרכבת הקומפוננטה.
    environment.value = collectEnvironment();
    void nextTick(() => titleRef.value?.focus());
  },
);

async function send(): Promise<void> {
  if (phase.value === 'sending') return;
  phase.value = 'sending';
  const current = buildIssueUrl(input.value);
  sentTruncated.value = current.truncated;
  try {
    await openInBrowser(current.url);
    // הכתובת קוצרה — הנוסח המלא נשמר בלוח כדי שאפשר יהיה להדביק אותו.
    if (current.truncated) await copyText(current.fullText);
    phase.value = 'opened';
  } catch {
    phase.value = (await copyText(current.fullText)) ? 'copied' : 'failed';
  }
  void nextTick(() => doneRef.value?.focus());
}

async function copyAgain(): Promise<void> {
  if (await copyText(preview.value)) phase.value = 'copied';
}
</script>

<style scoped>
.bug-dialog {
  position: fixed;
  top: 120px;
  inset-inline-start: 40px;
  z-index: 2000;
  background: var(--color-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  width: 400px;
  max-width: calc(100vw - 32px);
  /* חלון נמוך (אוצריא בחצי מסך): הגוף נגלל, והכותרת והכפתורים נשארים. */
  max-height: calc(100vh - 136px);
  display: flex;
  flex-direction: column;
  font-family: var(--font-main);
}

.br-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-block-end: 1px solid var(--color-outline-variant);
  padding: 6px 8px 6px 12px;
  background: var(--color-surface-container-high);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  user-select: none;
}

.br-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.br-close-btn {
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-xs);
}

.br-close-btn:hover {
  background: var(--word-btn-hover);
  color: var(--color-error);
}

.br-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.br-label {
  font-size: 11px;
  color: var(--color-on-surface);
}

.br-input {
  padding: 4px 8px;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-main);
  font-size: 12px;
  outline: none;
}

.br-input:focus {
  border-color: var(--word-blue);
  box-shadow: 0 0 0 1px var(--word-blue);
}

.br-textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.4;
}

.br-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-on-surface);
  margin-block-start: 2px;
}

.br-preview {
  font-size: 11px;
  color: var(--color-on-surface-variant);
}

.br-preview summary {
  cursor: pointer;
}

.br-preview-text {
  margin: 4px 0 0;
  max-height: 140px;
  overflow: auto;
  padding: 6px 8px;
  background: var(--color-surface-container-high);
  border-radius: var(--radius-xs);
  font-family: var(--font-main);
  font-size: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-on-surface);
}

.br-note,
.br-status {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-on-surface-variant);
}

.br-status {
  color: var(--color-on-surface);
}

.br-url {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-block-start: 6px;
}

.br-manual {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-block-start: 6px;
  font-size: 10px;
}

.br-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px;
  border-block-start: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

.br-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--font-main);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-on-surface);
  cursor: pointer;
}

.br-btn:hover:not(:disabled) {
  background: var(--word-btn-hover);
  border-color: var(--word-blue);
}

.br-btn-primary {
  background: var(--word-blue);
  color: var(--color-on-primary);
  border-color: var(--word-blue);
}

.br-btn-primary:hover:not(:disabled) {
  background: var(--word-blue-dark);
}

.br-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
