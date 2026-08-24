/**
 * נקודת הכניסה הראשית — עורך Word לאוצריא (SuperDoc v2 + Vue 3).
 */
import { createApp } from 'vue';
import './styles/tokens.css';
import './styles/shell.css';
import './styles/ribbon.css';
import App from './App.vue';
import { installBundledFonts } from './styles/fonts';
import { onThemeChanged, resolveBoot } from './host/otzaria-client';
import { applyTheme } from './host/theme';

/** ב-build הסקריפט קלאסי, כלומר הוא עשוי לרוץ לפני שה-body נפרס. */
function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

async function main(): Promise<void> {
  // התקנת גופנים ארוזים ראשונה
  installBundledFonts();

  if (import.meta.env.DEV) {
    const { installDevStub } = await import('./host/dev-stub');
    installDevStub();
  }

  // שחזור או קבלת אירוע boot
  const bootPromise = resolveBoot();

  await domReady();

  // הרכבת אפליקציית Vue
  const app = createApp(App);
  app.mount('#app');

  try {
    const info = await bootPromise;
    applyTheme(info.theme);
    onThemeChanged(applyTheme);

    if (info.source === 'recovered') {
      console.warn('[otzaria-word] plugin.boot אבד; מצב האתחול שוחזר ב-RPC');
    }
  } catch (error) {
    console.error('[otzaria-word] כשל באתחול ערכת הנושא של אוצריא:', error);
  }
}

void main();
