/**
 * מדידת הקלדה **בתוך אוצריא**, מקצה לקצה: הקשה אמיתית של מערכת ההפעלה → keydown בדף →
 * ציור ב-renderer → פיקסלים על המסך. משלים את typing-latency-probe.mjs (--attach), שמודד
 * רק מה שקורה בתוך הדף ובמקשים סינתטיים של CDP.
 *
 * למה צריך את זה: הדף יכול לצייר תוך 30ms ובכל זאת התו יופיע למשתמש מאוחר — כי המארח
 * (WebView2 → Windows.Graphics.Capture → טקסטורה של Flutter → raster) מוסיף שלב משלו,
 * וכי חלון ממוזער או WebView מושהה הופכים את הדף ל-`hidden` (rAF לא רץ). שני אלה
 * אינם נראים במדידה דרך CDP בלבד.
 *
 * הכנה: להריץ את אוצריא עם WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9444,
 * לפתוח את התוסף עם מסמך, ולא לגעת במחשב בזמן הריצה (הכלי מביא את החלון לחזית).
 * ההקשות נכנסות למסמך הפעיל — לא להריץ על מסמך שאין לו גיבוי.
 *
 * אפשרויות:
 *   --port <n>       יציאת CDP של WebView2 (9444)
 *   --keys <n>       מספר הקשות (40); 0 = רק חיבור, מכשור ובדיקת מצב (בלי קלט)
 *   --gap <ms>       מרווח בין הקשות (80; עם --screen לפחות 350)
 *   --screen         גם דגימת המסך: כמה זמן עד שהפיקסלים בשורת הסמן משתנים
 *   --no-click       בלי לחיצת עכבר אמיתית לפני ההקלדה (ברירת המחדל לוחצת על שורת
 *                    טקסט גלויה — פוקוס JS בלבד אינו מעביר את פוקוס המקלדת של
 *                    המערכת אל חלון ה-WebView, וההקשות נופלות ב-Flutter)
 *
 * הרצה: node scripts/typing-latency-inapp.mjs --screen
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const PORT = Number(opt('--port', 9444));
const KEYS = Number(opt('--keys', 40));
const SCREEN = args.includes('--screen');
const GAP_MS = Math.max(Number(opt('--gap', 80)), SCREEN ? 350 : 0);
const CLICK = !args.includes('--no-click');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ CDP ------------------------------ */
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`).catch(() => null))?.json?.() ?? null;
if (!list) {
  console.error(`אין CDP ב-127.0.0.1:${PORT}. להריץ את אוצריא עם WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=${PORT}`);
  process.exit(1);
}
const page = list.find((t) => t.type === 'page' && /otzaria-word-editor\/dist\/index\.html/.test(t.url));
if (!page) {
  console.error('דף התוסף לא נמצא. דפים: ' + list.map((t) => `${t.type} ${t.url}`).join(' | '));
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', () => reject(new Error('חיבור CDP נכשל')), { once: true });
});
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = async (expression) => {
  const m = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (m.result?.exceptionDetails) throw new Error('CDP: ' + (m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails.text));
  return m.result?.result?.value;
};

/* ------------------------------ החלון ------------------------------ */
// חלון ממוזער = דף `hidden`; משחזרים אותו לפני בדיקת המצב, כמו שהמשתמש היה עושה.
const hwndOf = () => {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-Process otzaria -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowHandle'], { encoding: 'utf8' });
  const n = Number((r.stdout || '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const HWND = Number(opt('--hwnd', 0)) || hwndOf();
if (!HWND) {
  console.error('לא נמצא חלון של otzaria.exe');
  ws.close();
  process.exit(2);
}
{
  const r = spawnSync('powershell', ['-NoProfile', '-Command', `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class Wn { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h); }'; $h=[IntPtr]${HWND}; if ([Wn]::IsIconic($h)) { [void][Wn]::ShowWindow($h, 9); Start-Sleep -Milliseconds 400; 'restored' } else { 'shown' }`], { encoding: 'utf8' });
  const word = (r.stdout || '').trim();
  if (word === 'restored') {
    console.log('החלון היה ממוזער — שוחזר.');
    await sleep(800);
  }
}

/* ------------------------------ מצב הדף ------------------------------ */
const state = JSON.parse(
  await js(`JSON.stringify({
    vis: document.visibilityState, focus: document.hasFocus(),
    active: document.activeElement ? document.activeElement.tagName : null,
    tab: ((document.querySelector('.word-doctab.active') || {}).textContent || '').trim(),
    inner: [innerWidth, innerHeight], screen: [screenX, screenY],
    text: window.__otzariaEditor ? window.__otzariaEditor.container.textContent.length : -1,
    pages: document.querySelectorAll('[data-page-index]').length,
  })`),
);
console.log(`דף: ${page.url}`);
console.log(`מצב: נראות ${state.vis}, פוקוס ${state.focus}, לשונית „${state.tab}”, ${state.pages} עמודים, ${state.text} תווים ב-DOM, חלון ${state.inner.join('×')} במסך (${state.screen.join(',')})`);
if (state.vis !== 'visible') {
  console.error('הדף `hidden` — חלון ממוזער או WebView מושהה. במצב הזה rAF לא רץ והמדידה תראה „הקלדה איטית” שאינה כזו. לשחזר את החלון ולהריץ שוב.');
  ws.close();
  process.exit(2);
}
if (state.text < 0) {
  console.error('אין עורך פתוח (window.__otzariaEditor). לפתוח מסמך בתוסף ולהריץ שוב.');
  ws.close();
  process.exit(2);
}

/* ------------------------------ מכשור בדף ------------------------------ */
await js(`(function () {
  delete window.__inapp;
  var O = (window.__inapp = { keys: [], long: [], vis: [] });
  var epoch = function (t) { return performance.timeOrigin + t; };
  var c = window.__otzariaEditor.container;
  var pendingKey = null;
  document.addEventListener('keydown', function (e) {
    pendingKey = { key: e.key, down: epoch(performance.now()), mutated: null, painted: null };
    O.keys.push(pendingKey);
  }, true);
  new MutationObserver(function () {
    var p = pendingKey; if (!p || p.mutated !== null) return;
    p.mutated = epoch(performance.now());
    requestAnimationFrame(function () { p.painted = epoch(performance.now()); });
  }).observe(c, { childList: true, subtree: true, characterData: true, attributes: true });
  document.addEventListener('visibilitychange', function () { O.vis.push({ t: Date.now(), vis: document.visibilityState }); });
  try {
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (en) { O.long.push({ start: epoch(en.startTime), dur: Math.round(en.duration) }); }); }).observe({ entryTypes: ['longtask'] });
  } catch (e) { O.longError = String(e); }
  return 'ok';
})()`);

/* ------------------------------ PowerShell: קלט אמיתי ומסך ------------------------------ */
// שני שלבים: (1) לחיצת עכבר על שורת טקסט גלויה, כדי שפוקוס המקלדת של המערכת יעבור לחלון
// ה-WebView (Chrome_WidgetWin_0); (2) הקשות SendInput ב-KEYEVENTF_UNICODE עם חותמת זמן
// לכל הקשה, ועם --screen גם דגימת המסך עד שינוי בשורת הסמן. INPUT הוא 40 בתים ב-x64
// (union של 32) — גודל שגוי מחזיר 0 עם ERROR_INVALID_PARAMETER ואין קלט בכלל.
const PS = String.raw`
param([string]$Mode, [int]$Hwnd, [int]$X, [int]$Y, [int]$Count, [int]$GapMs, [int]$RX, [int]$RY, [int]$RW, [int]$RH, [string]$Out)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Text;
public static class N {
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public long p0; [FieldOffset(8)] public long p1; [FieldOffset(16)] public long p2; [FieldOffset(24)] public long p3; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION u; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct GUITHREADINFO { public uint cbSize; public uint flags; public IntPtr hwndActive; public IntPtr hwndFocus; public IntPtr hwndCapture; public IntPtr hwndMenuOwner; public IntPtr hwndMoveSize; public IntPtr hwndCaret; public RECT rcCaret; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint tid, ref GUITHREADINFO info);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  static int Size() { return Marshal.SizeOf(typeof(INPUT)); }
  public static string SendChar(char c) {
    var d = new INPUT(); d.type = 1; d.u.ki.wScan = c; d.u.ki.dwFlags = 0x0004;
    var u = new INPUT(); u.type = 1; u.u.ki.wScan = c; u.u.ki.dwFlags = 0x0006;
    uint n = SendInput(2, new INPUT[] { d, u }, Size());
    return n == 2 ? "ok" : ("SendInput=" + n + " err=" + Marshal.GetLastWin32Error());
  }
  public static string Click(int x, int y) {
    SetCursorPos(x, y); System.Threading.Thread.Sleep(80);
    var d = new INPUT(); d.type = 0; d.u.mi.dwFlags = 0x0002; var u = new INPUT(); u.type = 0; u.u.mi.dwFlags = 0x0004;
    uint n = SendInput(1, new INPUT[] { d }, Size()); System.Threading.Thread.Sleep(40); n += SendInput(1, new INPUT[] { u }, Size());
    return n == 2 ? "ok" : ("SendInput=" + n + " err=" + Marshal.GetLastWin32Error());
  }
  public static string FocusClass() {
    IntPtr fg = GetForegroundWindow(); uint pid; uint tid = GetWindowThreadProcessId(fg, out pid);
    var g = new GUITHREADINFO(); g.cbSize = (uint)Marshal.SizeOf(typeof(GUITHREADINFO));
    if (!GetGUIThreadInfo(tid, ref g)) return "?";
    var sb = new StringBuilder(256); GetClassNameW(g.hwndFocus, sb, 256); return sb.ToString();
  }
  public static int Diff(System.Drawing.Bitmap a, System.Drawing.Bitmap b) {
    var rect = new System.Drawing.Rectangle(0, 0, a.Width, a.Height);
    var ra = a.LockBits(rect, System.Drawing.Imaging.ImageLockMode.ReadOnly, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
    var rb = b.LockBits(rect, System.Drawing.Imaging.ImageLockMode.ReadOnly, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
    int n = a.Width * a.Height; int[] pa = new int[n]; int[] pb = new int[n];
    Marshal.Copy(ra.Scan0, pa, 0, n); Marshal.Copy(rb.Scan0, pb, 0, n);
    a.UnlockBits(ra); b.UnlockBits(rb);
    int d = 0; for (int i = 0; i < n; i++) if (pa[i] != pb[i]) d++; return d;
  }
}
"@
function Grab { $bmp = New-Object System.Drawing.Bitmap $RW, $RH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($RX, $RY, 0, 0, (New-Object System.Drawing.Size $RW, $RH)); $g.Dispose(); return $bmp }
$h = [IntPtr]$Hwnd
if ([N]::IsIconic($h)) { [void][N]::ShowWindow($h, 9); Start-Sleep -Milliseconds 300 }
[void][N]::SetForegroundWindow($h); Start-Sleep -Milliseconds 400
$result = @{ fg = [int64][N]::GetForegroundWindow(); focusBefore = [N]::FocusClass() }
if ($Mode -eq 'click') {
  $result.click = [N]::Click($X, $Y); Start-Sleep -Milliseconds 400
  $result.focusAfter = [N]::FocusClass()
} else {
  $letters = -join (0x05D0..0x05EA | ForEach-Object { [char]$_ })
  $keys = New-Object System.Collections.ArrayList
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  for ($i = 0; $i -lt $Count; $i++) {
    $c = $letters[$i % $letters.Length]
    $base = $null
    if ($RW -gt 0) { $base = Grab; Start-Sleep -Milliseconds 25; $b2 = Grab; if ([N]::Diff($base, $b2) -gt 0) { $base.Dispose(); $base = $b2 } else { $b2.Dispose() } }
    $t0 = $sw.Elapsed.TotalMilliseconds
    $epoch = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $sent = [N]::SendChar($c)
    $seen = -1; $d = 0
    if ($base -ne $null) {
      while (($sw.Elapsed.TotalMilliseconds - $t0) -lt 4000) { $cur = Grab; $d = [N]::Diff($base, $cur); $cur.Dispose(); if ($d -ge 120) { $seen = [Math]::Round($sw.Elapsed.TotalMilliseconds - $t0); break } }
      $base.Dispose()
    }
    [void]$keys.Add(@{ i = $i; ch = [string]$c; t = $epoch; sent = $sent; screenMs = $seen; diff = $d })
    Start-Sleep -Milliseconds $GapMs
  }
  $result.keys = $keys
  $result.focusAfter = [N]::FocusClass()
}
$result | ConvertTo-Json -Compress -Depth 4 | Out-File -Encoding utf8 $Out
`;

const tmp = mkdtempSync(join(tmpdir(), 'owe-inapp-'));
const psPath = join(tmp, 'inapp.ps1');
writeFileSync(psPath, '﻿' + PS, 'utf8');
const runPs = (params) => {
  const out = join(tmp, `out-${Date.now()}.json`);
  const argv = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, '-Out', out];
  for (const [k, v] of Object.entries(params)) argv.push(`-${k}`, String(v));
  const r = spawnSync('powershell', argv, { encoding: 'utf8', timeout: 600_000 });
  if (r.status !== 0) throw new Error('PowerShell נכשל: ' + (r.stderr || r.stdout).trim().slice(0, 600));
  return JSON.parse(readFileSync(out, 'utf8').replace(/^﻿/, ''));
};
let result = null;
try {
  const hwnd = HWND;
  if (KEYS === 0) {
    console.log('--keys 0: מכשור הותקן, אין קלט. (hwnd ' + hwnd + ')');
  } else {
    if (CLICK) {
      // שורת טקסט גלויה, בתוך החלון (בחלון צר הדף רחב מהחלון והשורות חורגות ממנו).
      const pt = JSON.parse(
        await js(`(function(){var W=innerWidth,H=innerHeight;var ls=[...document.querySelectorAll('.superdoc-line')].map(function(l){return l.getBoundingClientRect()}).filter(function(r){return r.height>8&&r.top>120&&r.bottom<H-40&&Math.min(r.right,W)-Math.max(r.left,0)>80;});if(!ls.length)return 'null';var r=ls[Math.min(ls.length-1,2)];var left=Math.max(r.left,0),right=Math.min(r.right,W);return JSON.stringify({x:Math.round((left+right)/2),y:Math.round(r.top+r.height/2)});})()`),
      );
      if (!pt) throw new Error('לא נמצאה שורת טקסט גלויה ללחיצה');
      const c = runPs({ Mode: 'click', Hwnd: hwnd, X: state.screen[0] + pt.x, Y: state.screen[1] + pt.y, Count: 0, GapMs: 0, RX: 0, RY: 0, RW: 0, RH: 0 });
      console.log(`לחיצה ב-(${state.screen[0] + pt.x},${state.screen[1] + pt.y}): ${c.click}; פוקוס המקלדת: ${c.focusBefore} → ${c.focusAfter}`);
      await sleep(400);
    }
    let region = { RX: 0, RY: 0, RW: 0, RH: 0 };
    if (SCREEN) {
      const caret = JSON.parse(
        await js(`(function(){var c=window.__otzariaEditor.container;var e=c.querySelector('.sd-v2-local-selection-caret')||c.querySelector('textarea');if(!e)return 'null';var r=e.getBoundingClientRect();return JSON.stringify({x:Math.round(r.x),y:Math.round(r.y),h:Math.round(r.height)});})()`),
      );
      if (!caret || caret.h <= 0) throw new Error('הסמן לא נמצא — ללחוץ במסמך קודם (בלי --no-click)');
      // שלוש שורות מגובה הסמן, לרוחב החלון: הסמן יורד שורה בזמן ההקלדה.
      region = { RX: state.screen[0], RY: state.screen[1] + caret.y - 8, RW: state.inner[0], RH: caret.h * 3 + 16 };
      console.log(`אזור המסך הנדגם: (${region.RX},${region.RY}) ${region.RW}×${region.RH}`);
    }
    const textBefore = await js('window.__otzariaEditor.container.textContent.length');
    const r = runPs({ Mode: 'type', Hwnd: hwnd, X: 0, Y: 0, Count: KEYS, GapMs: GAP_MS, ...region });
    await sleep(2500);
    const O = JSON.parse(await js('JSON.stringify(window.__inapp)'));
    const textAfter = await js('window.__otzariaEditor.container.textContent.length');
    result = { sent: r.keys, O, textBefore, textAfter, focus: `${r.focusBefore} → ${r.focusAfter}` };
  }
} finally {
  ws.close();
  rmSync(tmp, { recursive: true, force: true });
}
if (!result) process.exit(0);

/* ------------------------------ החשבון ------------------------------ */
const { sent, O } = result;
const stat = (xs) => {
  if (!xs.length) return 'אין';
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return `n=${s.length} חציון=${Math.round(q(0.5))} p90=${Math.round(q(0.9))} מקס=${Math.round(s[s.length - 1])}`;
};
const failed = sent.filter((k) => k.sent !== 'ok');
console.log(`\nנשלחו ${sent.length} הקשות${failed.length ? ` (${failed.length} נכשלו: ${failed[0].sent})` : ''}; keydown בדף: ${O.keys.length}; טקסט ב-DOM ${result.textBefore} → ${result.textAfter}; פוקוס המקלדת: ${result.focus}`);
if (O.keys.length === 0) {
  console.log('אף הקשה לא הגיעה לדף: פוקוס המקלדת של המערכת אינו על חלון ה-WebView (Chrome_WidgetWin_0). להריץ בלי --no-click, או ללחוץ במסמך ידנית.');
  process.exit(1);
}
const n = Math.min(sent.length, O.keys.length);
const host = [], paint = [], total = [], present = [], screen = [];
for (let i = 0; i < n; i++) {
  const s = sent[i], k = O.keys[i];
  host.push(k.down - s.t);
  if (k.painted !== null) {
    paint.push(k.painted - k.down);
    total.push(k.painted - s.t);
    if (s.screenMs >= 0) {
      screen.push(s.screenMs);
      present.push(s.t + s.screenMs - k.painted);
    }
  }
}
console.log('\n== לכל הקשה (ms) ==');
console.log('מערכת ההפעלה → keydown בדף:   ' + stat(host));
console.log('keydown → ציור (rAF) בדף:      ' + stat(paint));
console.log('הקשה → ציור בדף, יחד:          ' + stat(total));
if (SCREEN) {
  console.log('ציור בדף → פיקסלים על המסך:    ' + stat(present) + '  (המארח: WebView2 → Capture → Flutter)');
  console.log('הקשה → פיקסלים על המסך, יחד:   ' + stat(screen));
  const unseen = sent.filter((s) => s.screenMs < 0).length;
  if (unseen) console.log(`הקשות בלי שינוי נראה באזור הנדגם: ${unseen} (הסמן יצא מהאזור, או שהתו התמזג עם הבא)`);
}
console.log(`תווים שלא נצפו כמצוירים בנפרד: ${O.keys.filter((k) => k.painted === null).length}`);
const slow = [];
for (let i = 0; i < n; i++) {
  const s = sent[i], k = O.keys[i];
  if (k.painted !== null && k.painted - s.t > 150) slow.push(`#${i} ‚${k.key}‘ ${Math.round(k.painted - s.t)}`);
}
if (slow.length) console.log('הקשות איטיות (>150ms עד ציור): ' + slow.join(', '));
const t0 = sent[0]?.t ?? 0;
const long = O.long.filter((l) => l.start >= t0 - 200);
console.log(`\nlong tasks בזמן ההקלדה: ${long.length}${long.length ? ' — ' + long.map((l) => l.dur + 'ms').join(', ') : ''}`);
if (O.vis.length) console.log('שינויי נראות בזמן הריצה: ' + O.vis.map((v) => v.vis).join(', '));
