/**
 * ספריית אייקוני SVG וקטוריים של Microsoft Word / Fluent UI.
 * כל האייקונים הם inline SVG ב-`currentColor` לעבודה חלקה בכל ערכות הנושא.
 */

export const ICONS: Record<string, string> = {
  // מותג ואפליקציה
  word: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15A2.5 2.5 0 0 0 2 5.5v13A2.5 2.5 0 0 0 4.5 21h15a2.5 2.5 0 0 0 2.5-2.5v-13A2.5 2.5 0 0 0 19.5 3zm-6.2 14.5h-1.9l-2.1-7.8-2 7.8H5.5L3.8 6.5h2.1l1.1 6.8 1.9-6.8h1.8l1.9 6.8 1.1-6.8h2.1l-1.7 11z"/></svg>`,
  
  // סרגל גישה מהירה וכותרת
  save: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/></svg>`,
  saveAs: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7 7 0 0 1 19 16l2-2a9 9 0 0 0-8.5-6z"/></svg>`,
  redo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6A9 9 0 0 0 5 16l2 2a7 7 0 0 1 11.62-2.62L15 18h9V9l-5.6 1.6z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 14 15.5l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`,
  chevronUp: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`,
  launcher: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 3v10h10V3H3zm9 9H4V4h8v8zm-2-7h2v2h-1V6H9V5zm-4 5l3.5-3.5L9.2 5.8 6.4 8.6 5.7 7.9 5 8.6l1.4 1.4H5v1h1z"/></svg>`,

  // קבוצת לוח (Clipboard)
  paste: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>`,
  cut: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`,
  formatPainter: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v2h2v9c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h2c1.1 0 2-.9 2-2V4h-1zM6 6V4h10v2H6z"/></svg>`,

  // קבוצת גופן (Font)
  bold: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>`,
  italic: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>`,
  underline: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>`,
  strikethrough: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>`,
  subscript: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.88 4L3 8.35V9h4.31v-.95H4.62l1.9-2.83.69-1.02L7.21 4H5.88zm8.62 0l-2.88 4.35V9h4.31v-.95h-2.69l1.9-2.83.69-1.02L15.83 4h-1.33zm5 9h2.5v1.25l-2.08 2.08c-.26.26-.42.54-.42.87 0 .44.36.8.8.8h2.2V19h-2.5c-.83 0-1.5-.67-1.5-1.5 0-.47.2-.91.53-1.25l1.97-1.95v-.05H19.5V13z"/></svg>`,
  superscript: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.88 15L3 19.35V20h4.31v-.95H4.62l1.9-2.83.69-1.02L7.21 15H5.88zm8.62 0l-2.88 4.35V20h4.31v-.95h-2.69l1.9-2.83.69-1.02L15.83 15h-1.33zm5-11h2.5v1.25l-2.08 2.08c-.26.26-.42.54-.42.87 0 .44.36.8.8.8h2.2V10h-2.5c-.83 0-1.5-.67-1.5-1.5 0-.47.2-.91.53-1.25l1.97-1.95v-.05H19.5V4z"/></svg>`,
  fontColor: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.62 16h4.75l1.12 3h2.25L13.25 4h-2.5L6.25 19h2.25l1.12-3zm2.38-8.5l1.63 5.5h-3.25l1.62-5.5z"/></svg>`,
  highlight: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.24 3.76a2 2 0 0 1 2.83 0l2.17 2.17a2 2 0 0 1 0 2.83L11.5 17.5 6 18l.5-5.5 8.74-8.74zm1.42 1.42L8.2 13.63l-.2 2.2 2.2-.2 8.45-8.46-1.99-1.99zM4 20h16v2H4z"/></svg>`,
  clearFormatting: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/></svg>`,
  growFont: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.12 14L2 21h2.25l.88-2h4.75l.88 2h2.24L9.88 14h-4.76zm1.75 2h1.25l.62 1.5H6.25L6.87 16zm7.63-9.5l3.5-3.5 3.5 3.5h-2.5v6h-2v-6h-2.5z"/></svg>`,
  shrinkFont: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.12 14L2 21h2.25l.88-2h4.75l.88 2h2.24L9.88 14h-4.76zm1.75 2h1.25l.62 1.5H6.25L6.87 16zm10.13-1l-3.5 3.5h2.5v6h2v-6h2.5l-3.5-3.5z"/></svg>`,

  // קבוצת פיסקה (Paragraph)
  alignRight: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>`,
  alignCenter: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>`,
  alignLeft: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>`,
  alignJustify: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/></svg>`,
  bulletList: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>`,
  numberList: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-9v2h14V2H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>`,
  indentIncrease: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/></svg>`,
  indentDecrease: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/></svg>`,
  dirRtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 10v5h2V4h2v11h2V4h2V2h-8C7.79 2 6 3.79 6 6s1.79 4 4 4zm-7 7l4 4V13L3 17z"/></svg>`,
  dirLtr: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 10v5h2V4h2v11h2V4h2V2H9C6.79 2 5 3.79 5 6s1.79 4 4 4zm12 7l-4-4v8l4-4z"/></svg>`,
  lineSpacing: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 7h11V5H10v2zm0 6h11v-2H10v2zm0 6h11v-2H10v2zM6.5 4.5l-3 3h2v9h-2l3 3 3-3h-2v-9h2l-3-3z"/></svg>`,
  pilcrow: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 10v5h2V4h2v11h2V4h2V2h-8C7.79 2 6 3.79 6 6s1.79 4 4 4z"/></svg>`,
  borders: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 2v6h-6V5h6zm-8 0v6H5V5h6zm-6 8h6v6H5v-6zm8 6v-6h6v6h-6z"/></svg>`,
  shading: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5zM5.21 10L10 5.21 14.79 10H5.21zM16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM3 20h18v2H3v-2z"/></svg>`,

  // קבוצת עריכה (Editing)
  replace: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 6C9.55 6 8.22 6.56 7.22 7.5L10 10H3V3l2.77 2.77C7.16 4.1 8.97 3 11 3c3.92 0 7.09 3.06 7.42 6.9l-2.01.2C16.14 7.37 13.8 6 11 6zm.99 11c1.45 0 2.78-.56 3.78-1.5L13 13h7v7l-2.77-2.77c-1.39 1.67-3.19 2.77-5.23 2.77-3.92 0-7.09-3.06-7.42-6.9l2.01-.2c.28 2.73 2.62 4.1 5.4 4.1z"/></svg>`,
  select: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5V2z"/></svg>`,

  // לשוניות נוספות: הוספה, פריסה, סקירה, תצוגה
  table: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 2v4H4V4h7zm0 6v4H4v-4h7zm0 6v4H4v-4h7zm9 4h-7v-4h7v4zm0-6h-7v-4h7v4zm0-6h-7V4h7v4z"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
  pageBreak: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 2h16v4H4V2zm0 16h16v4H4v-4zM2 13h5v-2H2v2zm7 0h6v-2H9v2zm8 0h5v-2h-5v2z"/></svg>`,
  toc: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v2H3V4zm0 5h14v2H3V9zm0 5h18v2H3v-2zm0 5h14v2H3v-2z"/></svg>`,
  margins: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 7h2v10H7V7zm8 0h2v10h-2V7z"/></svg>`,
  orientation: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg>`,
  paperSize: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>`,
  columns: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 5v14h7V5H4zm9 0v14h7V5h-7z"/></svg>`,
  footnote: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 7h4v2H5V7zm0 4h14v2H5v-2zm0 4h10v2H5v-2z"/></svg>`,
  trackChanges: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  accept: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`,
  reject: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`,
  comment: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`,
  proofing: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  ruler: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 4v16h20V4H2zm18 14H4V6h2v3h2V6h2v2h2V6h2v3h2V6h2v2h2V6h2v12z"/></svg>`,
  zoom: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 14 15.5l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14zm.5-7v2h2v1h-2v2h-1v-2h-2v-1h2v-2h1z"/></svg>`,
  fitWidth: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v12H4V6zm-2 0h2v12H2V6zm20 0h2v12h-2V6z"/></svg>`,
  focusMode: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5h4V3H3v6h2V5zm10-2v2h4v4h2V3h-6zm4 14h-4v2h6v-6h-2v4zM9 19H5v-4H3v6h6v-2z"/></svg>`,
  print: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  otzaria: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.8l7.5 13.2H4.5L12 5.8zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>`,
};
