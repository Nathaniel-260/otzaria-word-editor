/**
 * stub לפיתוח בדפדפן רגיל, כשאין window.Otzaria.
 * נטען רק ב-import.meta.env.DEV ולכן אינו נכנס ל-build.
 *
 * הוא משגר plugin.boot כ-CustomEvent על window — בדיוק כמו אוצריא — ולא
 * קורא ל-callbacks ישירות, כדי שה-latch שב-otzaria-client ייבדק בפיתוח באותו
 * מסלול שבו הוא עובד בייצור.
 */
import type { BootPayload, OtzariaGlobal } from '../types/otzaria_plugin';

const BOOT: BootPayload = {
  plugin: { id: 'dev', version: '0.0.0' },
  app: {
    version: '0.9.96',
    platform: 'dev',
    locale: 'he-IL',
    textDirection: 'rtl',
  },
  theme: {
    mode: 'light',
    colorScheme: {
      primary: '#1565C0',
      onPrimary: '#ffffff',
      secondary: '#6750A4',
      onSecondary: '#ffffff',
      surface: '#f8f9fa',
      onSurface: '#1a1a2e',
      onSurfaceVariant: '#49454f',
      surfaceContainerHigh: '#ece6f0',
      surfaceContainerHighest: '#e0e0e0',
      outline: '#cbd5e1',
      error: '#b00020',
      onError: '#ffffff',
    },
    typography: {
      fontFamily: 'FrankRuhlCLM',
      fontSize: 18,
      lineHeight: 1.5,
      commentatorsFontFamily: 'Shofar',
      commentatorsFontSize: 14,
    },
  },
  connectivity: { isOfflineMode: false, hasNetwork: false, isOnline: false },
  permissions: ['fs.user_files.read'],
};

export function installDevStub(): void {
  if ((window as Partial<Window>).Otzaria) return;

  const stub = {
    async call(method: string, payload?: unknown) {
      console.info('[stub] call', method, payload);
      return { success: true, data: null, error: null };
    },
    on(event: string, cb: (payload: unknown) => void) {
      window.addEventListener(event, (e) => cb((e as CustomEvent).detail));
    },
    off() {
      // ה-stub אינו שומר הפניות; אין צורך בביטול בפיתוח.
    },
  };

  // ה-stub מממש רק את מה שהתוסף באמת קורא לו, ולא את כל העומסים של
  // OtzariaGlobal — לכן ההמרה המפורשת.
  window.Otzaria = stub as unknown as OtzariaGlobal;

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));
  }, 0);
}
