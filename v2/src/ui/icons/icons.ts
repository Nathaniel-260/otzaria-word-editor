/**
 * ספריית אייקוני SVG וקטוריים של Microsoft Word / Fluent UI.
 * כל האייקונים הם inline SVG מדויקים וחדים ב-`currentColor`.
 */

export const ICONS: Record<string, string> = {
  // מותג ואפליקציה
  word: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15A2.5 2.5 0 0 0 2 5.5v13A2.5 2.5 0 0 0 4.5 21h15a2.5 2.5 0 0 0 2.5-2.5v-13A2.5 2.5 0 0 0 19.5 3zm-6.2 14.5h-1.9l-2.1-7.8-2 7.8H5.5L3.8 6.5h2.1l1.1 6.8 1.9-6.8h1.8l1.9 6.8 1.1-6.8h2.1l-1.7 11z"/></svg>`,

  // סרגל גישה מהירה וכותרת
  save: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M14.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 4 17.5h12a1.5 1.5 0 0 0 1.5-1.5V5.5l-3-3zm-4.5 13a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm2.5-8H5V4.2h7.5v3.3z"/></svg>`,
  saveAs: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M16 8.5a4.5 4.5 0 0 0-8.5-1.8A3.5 3.5 0 0 0 3 10a3.5 3.5 0 0 0 3.5 3.5h9.5a3 3 0 0 0 3-3c0-1.5-1.1-2.7-2.5-2.9zm-2 3.5l-4 4-4-4h2.5V8.5h3V12H14z"/></svg>`,
  undo: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.5 6.5A6.5 6.5 0 0 0 5 9.1L2.5 6.5v7h7l-2.8-2.8A4.8 4.8 0 0 1 15 13.5l1.6-1.2A6.5 6.5 0 0 0 10.5 6.5z"/></svg>`,
  redo: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.5 6.5A6.5 6.5 0 0 1 15 9.1l2.5-2.6v7h-7l2.8-2.8A4.8 4.8 0 0 0 5 13.5L3.4 12.3A6.5 6.5 0 0 1 9.5 6.5z"/></svg>`,
  search: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 3a5.5 5.5 0 0 1 4.3 8.9l4.4 4.4-1.3 1.3-4.4-4.4A5.5 5.5 0 1 1 8.5 3zm0 1.8a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z"/></svg>`,
  chevronDown: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5.3 7.3L10 12l4.7-4.7 1.3 1.4-6 6-6-6 1.3-1.4z"/></svg>`,
  chevronUp: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5.3 12.7L10 8l4.7 4.7 1.3-1.4-6-6-6 6 1.3 1.4z"/></svg>`,
  launcher: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 3v10h10V3H3zm9 9H4V4h8v8zm-2-7h2v2h-1V6H9V5zm-4 5l3.5-3.5L9.2 5.8 6.4 8.6 5.7 7.9 5 8.6l1.4 1.4H5v1h1z"/></svg>`,

  // קבוצת לוח (Clipboard)
  paste: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 16H5V5h2v2h10V5h2v14z"/></svg>`,
  cut: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.2 7.2c.2-.5.3-1 .3-1.6A3.6 3.6 0 1 0 4.9 9.2L8.5 12l-3.6 2.8A3.6 3.6 0 1 0 8.5 14.4c0-.6-.1-1.1-.3-1.6L10 11.2l5.5 5.3h2.5l-6.8-6.5 6.8-6.5H15.5L10 8.8 8.2 7.2zM4.9 7.4a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm0 9a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"/></svg>`,
  copy: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.5 1.5H4a2 2 0 0 0-2 2v11h1.8V3.5h9.7V1.5zm2.5 3.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 13H7V7h9v11z"/></svg>`,
  formatPainter: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M15.5 2.5h-10a1.5 1.5 0 0 0-1.5 1.5v3.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1.5 1.5 0 0 0-1.5-1.5zM5.8 4.2h8.4v1.6H5.8V4.2zM7.5 10h1.8v6.5a1 1 0 0 0 1 1h.4a1 1 0 0 0 1-1V10h1.8V8.5H7.5V10z"/></svg>`,

  // קבוצת גופן (Font)
  bold: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3.5h5.2a3.3 3.3 0 0 1 2.3 5.6A3.7 3.7 0 0 1 10.8 16.5H5V3.5zm2.4 2.2v3.6h2.8a1.4 1.4 0 0 0 1.4-1.4 1.4 1.4 0 0 0-1.4-1.4H7.4v-.8zm0 5.8v3.6h3.4a1.8 1.8 0 0 0 1.8-1.8 1.8 1.8 0 0 0-1.8-1.8H7.4z"/></svg>`,
  italic: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 3.5h7v1.8h-2.4l-3.2 9.4H12v1.8H5v-1.8h2.4l3.2-9.4H8V3.5z"/></svg>`,
  underline: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 13.5a4 4 0 0 0 4-4V3.5h-2v6a2 2 0 0 1-4 0v-6H6v6a4 4 0 0 0 4 4zm-6 2.5h12v1.6H4V16z"/></svg>`,
  strikethrough: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 10.5h15v1.6h-15v-1.6zm4.8-1.7a2.8 2.8 0 0 1 2.5-1.5c1.4 0 2.2.8 2.2 2.2v4.8h-1.6v-1.2A2.7 2.7 0 0 1 8 14.5c-1.5 0-2.5-.9-2.5-2.2 0-1.5 1.2-2.3 3.6-2.5l1.1-.1v-.3c0-.6-.4-1-1.2-1a1.5 1.5 0 0 0-1.4.9l-1.3-.5zm4.4 3.7v-.9l-1.3.1c-1.2.1-1.7.5-1.7 1.2 0 .6.5 1 1.2 1 .9 0 1.8-.5 1.8-1.4z"/></svg>`,
  subscript: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4.5 4.5l2.2 3.8 2.2-3.8h2.1l-3.3 5 3.5 5.5H9.1l-2.4-4-2.4 4H2.2l3.5-5.5-3.3-5h2.1zm11 7h2v1l-1.7 1.7c-.2.2-.3.4-.3.7 0 .4.3.6.6.6h1.8v1.2h-2.1c-.8 0-1.3-.5-1.3-1.2 0-.4.2-.7.4-1l1.6-1.6H15.5v-1.4z"/></svg>`,
  superscript: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4.5 7.5l2.2 3.8 2.2-3.8h2.1l-3.3 5 3.5 5.5H9.1l-2.4-4-2.4 4H2.2l3.5-5.5-3.3-5h2.1zm11-4h2v1l-1.7 1.7c-.2.2-.3.4-.3.7 0 .4.3.6.6.6h1.8v1.2h-2.1c-.8 0-1.3-.5-1.3-1.2 0-.4.2-.7.4-1l1.6-1.6H15.5V3.5z"/></svg>`,
  fontColor: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 3h3l4.5 12h-2.3l-1.1-3.2H7.4L6.3 15H4L8.5 3zm2.3 7L9.9 5.8 9 10h1.8zm-6.8 6h12v3H4v-3z"/></svg>`,
  highlight: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M12.8 2.2a1.8 1.8 0 0 1 2.5 0l2.5 2.5a1.8 1.8 0 0 1 0 2.5L9.5 15.5 5 16l.5-4.5 7.3-9.3zm1.2 1.2L7.5 12l-.2 2.2 2.2-.2 6.5-6.5-2-2zM3 17.5h14v1.8H3v-1.8z"/></svg>`,
  clearFormatting: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 3.5h1.8L11.5 15h-1.9l-.8-2.4H5.2L4.4 15H2.5L6 3.5zm1.7 7.2L6.9 6.2 6 10.7h1.7zm6.8-5.7l3 3-5.5 5.5-3-3 5.5-5.5zm1.5-1.5l1.5 1.5-1 1-1.5-1.5 1-1zM11 16.5h7v1.8h-7v-1.8z"/></svg>`,
  growFont: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 3.5h1.8L11.5 15h-1.9l-.8-2.4H5.2L4.4 15H2.5L6 3.5zm1.7 7.2L6.9 6.2 6 10.7h1.7zM14.5 3.5l3 3.5h-2v7h-2V7h-2l3-3.5z"/></svg>`,
  shrinkFont: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 3.5h1.8L11.5 15h-1.9l-.8-2.4H5.2L4.4 15H2.5L6 3.5zm1.7 7.2L6.9 6.2 6 10.7h1.7zM14.5 14l3-3.5h-2V3.5h-2v7h-2l3 3.5z"/></svg>`,

  // קבוצת פיסקה (Paragraph)
  alignRight: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5h16v1.6H2V3.5zm5 3.8h11v1.6H7V7.3zm-5 3.8h16v1.6H2v-1.6zm5 3.8h11v1.6H7v-1.6z"/></svg>`,
  alignCenter: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5h16v1.6H2V3.5zm2.5 3.8h11v1.6h-11V7.3zm-2.5 3.8h16v1.6H2v-1.6zm2.5 3.8h11v1.6h-11v-1.6z"/></svg>`,
  alignLeft: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5h16v1.6H2V3.5zm0 3.8h11v1.6H2V7.3zm0 3.8h16v1.6H2v-1.6zm0 3.8h11v1.6H2v-1.6z"/></svg>`,
  alignJustify: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5h16v1.6H2V3.5zm0 3.8h16v1.6H2V7.3zm0 3.8h16v1.6H2v-1.6zm0 3.8h16v1.6H2v-1.6z"/></svg>`,
  bulletList: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 4.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5-.8h9v1.6h-9V3.7zm-5 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5-.7h9v1.6h-9V8.5zm-5 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5-.7h9v1.6h-9v-1.6z"/></svg>`,
  numberList: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4.5 3h1.2v4H4.5V4.2H3.8V3.4l.7-.4zm-1 6.5a1.3 1.3 0 0 1 1.4-1.3c.8 0 1.3.5 1.3 1.2 0 .5-.3.9-.8 1.3l-.7.6h1.6v.9H2.8v-.8l1.3-1.1c.3-.3.4-.5.4-.7 0-.3-.2-.5-.5-.5-.3 0-.5.2-.5.5H3.5zm0 4.8c0-.7.6-1.1 1.3-1.1s1.3.4 1.3 1c0 .4-.2.7-.6.9.5.2.7.5.7 1 0 .7-.6 1.1-1.4 1.1-.8 0-1.4-.4-1.4-1.1h1c0 .3.2.4.4.4.3 0 .4-.2.4-.4 0-.3-.2-.4-.5-.4h-.4v-.8h.4c.3 0 .4-.1.4-.4 0-.2-.1-.3-.3-.3-.2 0-.4.1-.4.3h-.9zm4.5-9.6h9v1.6h-9V4.7zm0 4.8h9v1.6h-9V9.5zm0 4.8h9v1.6h-9v-1.6z"/></svg>`,
  indentIncrease: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5h16v1.6H2V3.5zm6 3.8h10v1.6H8V7.3zm0 3.8h10v1.6H8v-1.6zm-6 3.8h16v1.6H2v-1.6zM2 7l4 3.5L2 14V7z"/></svg>`,
  indentDecrease: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5h16v1.6H2V3.5zm6 3.8h10v1.6H8V7.3zm0 3.8h10v1.6H8v-1.6zm-6 3.8h16v1.6H2v-1.6zm4-3.5L6 7v7l-4-3.5z"/></svg>`,
  dirRtl: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 2.5h6v1.6h-1.6v9.4h-1.6V4.1h-1.2v9.4H8.5V4.1h-.8a2.6 2.6 0 1 1 0-5.2h.8zm-6 12.5l3.5 3.5V16H11v-2H6v-2.5L2.5 15z"/></svg>`,
  dirLtr: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M11.5 2.5h6v1.6h-1.6v9.4h-1.6V4.1h-1.2v9.4h-1.6V4.1h-.8a2.6 2.6 0 1 1 0-5.2h.8zm6 12.5l-3.5 3.5V16H9v-2h5v-2.5l3.5 3.5z"/></svg>`,
  lineSpacing: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 4.5h9v1.6h-9V4.5zm0 5h9v1.6h-9V9.5zm0 5h9v1.6h-9v-1.6zM4.5 3l-2.5 3h1.8v8H2l2.5 3 2.5-3H5.2V6H7L4.5 3z"/></svg>`,
  pilcrow: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 3h7v1.8h-1.8v11.4h-1.8V4.8h-1.6v11.4H9V4.8h-.8A3.3 3.3 0 1 1 8.2 3H9z"/></svg>`,
  borders: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M16.5 2.5h-13a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1zm-7 1.8v5h-5v-5h5zm-5 6.8h5v5h-5v-5zm6.8 5v-5h5v5h-5zm5-6.8h-5v-5h5v5z"/></svg>`,
  shading: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M16 9.5a2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5c0-1.5 2.5-4.5 2.5-4.5s2.5 3 2.5 4.5zM4.5 9l4-4 4 4h-8zM14 8l-6.5-6.5-1.2 1.2 2 2-4.5 4.5a1.5 1.5 0 0 0 0 2.1l4.5 4.5a1.5 1.5 0 0 0 2.1 0L14 11.3l-2-2 2-1.3zM2.5 17h15v1.8h-15V17z"/></svg>`,

  // קבוצת עריכה (Editing)
  replace: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.5 4.5A5 5 0 0 0 5 8.2L3 6.2V11h4.8L5.9 9.1a3.2 3.2 0 0 1 3.6-2.8c1.6.2 2.8 1.5 3 3.1l1.8-.3A5 5 0 0 0 9.5 4.5zm1 11a5 5 0 0 0 4.5-3.7l2 2V9H12.2l1.9 1.9a3.2 3.2 0 0 1-3.6 2.8c-1.6-.2-2.8-1.5-3-3.1l-1.8.3A5 5 0 0 0 10.5 15.5z"/></svg>`,
  select: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 2.5l9 8.5-4.5.4 2.5 5.6-1.7.8-2.5-5.7L5.5 15V2.5z"/></svg>`,

  // לשוניות נוספות: הוספה, פריסה, סקירה, תצוגה
  table: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M17 2.5H3a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 3 17.5h14a1.5 1.5 0 0 0 1.5-1.5V4a1.5 1.5 0 0 0-1.5-1.5zm-8 1.8v3.5H3.2V4.3H9zm0 5.2v3.5H3.2V9.5H9zm0 5.2v3H3.2v-3H9zm7.8 3H10.8v-3h6v3zm0-4.8H10.8V9.5h6v3.5zm0-5.2H10.8V4.3h6v3.5z"/></svg>`,
  image: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M17.5 3.5h-15a1.5 1.5 0 0 0-1.5 1.5v10a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V5a1.5 1.5 0 0 0-1.5-1.5zm-15 11.2V5.2h15v9.5H2.5zm5-4.7l2.5 3.1 3.5-4.5 4.5 5.9h-13l2.5-4.5zM6.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`,
  link: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 11.5a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 5l-1 1-1.3-1.3 1-1a1.7 1.7 0 0 0-2.4-2.4l-2 2a1.7 1.7 0 0 0 2.4 2.4l.6-.6 1.3 1.3-.6.6a3.5 3.5 0 0 1-5 0zm3-3a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5-5l1-1 1.3 1.3-1 1a1.7 1.7 0 0 0 2.4 2.4l2-2a1.7 1.7 0 0 0-2.4-2.4l-.6.6-1.3-1.3.6-.6a3.5 3.5 0 0 1 5 0z"/></svg>`,
  pageBreak: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 2.5h13v3.5h-13V2.5zm0 11.5h13v3.5h-13V14zM2 10.8h4v-1.6H2v1.6zm6 0h4v-1.6H8v1.6zm6 0h4v-1.6h-4v1.6z"/></svg>`,
  toc: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 3.5h15v1.6h-15V3.5zm0 4.2h11v1.6h-11V7.7zm0 4.2h15v1.6h-15v-1.6zm0 4.2h11v1.6h-11v-1.6z"/></svg>`,
  margins: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 2.5v15h14v-15H3zm12.2 13.2H4.8V4.3h10.4v11.4zM6.5 6h1.8v8H6.5V6zm5.2 0h1.8v8h-1.8V6z"/></svg>`,
  orientation: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M16.5 3.5h-13a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1zm-13 11.2V5.2h13v9.5h-13z"/></svg>`,
  paperSize: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M12 2.5H4.5a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 4.5 17.5h11a1.5 1.5 0 0 0 1.5-1.5V7l-5-4.5zm3.5 13.2h-11V4.3h6.3v3.8h4.7v7.6z"/></svg>`,
  columns: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 3.5v13h5.5v-13H3.5zm7.5 0v13h5.5v-13H11z"/></svg>`,
  footnote: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M17.5 2.5h-15a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V4a1.5 1.5 0 0 0-1.5-1.5zm-15 13.2V4.3h15v11.4h-15zM4.5 6h3.5v1.8H4.5V6zm0 3.5h11v1.8h-11V9.5zm0 3.5h8v1.8h-8V13z"/></svg>`,
  trackChanges: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm1 12H9V9h2v5zm0-6H9V6h2v2z"/></svg>`,
  accept: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M7.8 14.2l-3.5-3.5 1.3-1.3 2.2 2.2 6.9-6.9 1.3 1.3-8.2 8.2z"/></svg>`,
  reject: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M14.7 6.3l-1-1L10 8.9 6.3 5.3l-1 1L8.9 10l-3.6 3.7 1 1L10 11.1l3.7 3.6 1-1L11.1 10l3.6-3.7z"/></svg>`,
  comment: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M17.5 3.5h-15a1.5 1.5 0 0 0-1.5 1.5v9a1.5 1.5 0 0 0 1.5 1.5h11l3.5 3V5a1.5 1.5 0 0 0-1.5-1.5zm0 9.2h-11l-2.2 2V5.2h13.2v7.5z"/></svg>`,
  proofing: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm-1.8 11.8l-3.5-3.5 1.3-1.3 2.2 2.2 5.9-5.9 1.3 1.3-7.2 7.2z"/></svg>`,
  ruler: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 4.5v11h15v-11h-15zm13.2 9.2H4.3V6.3h1.8v2.5h1.8V6.3h1.8v1.8h1.8V6.3h1.8v2.5h1.8V6.3h1.1v7.4z"/></svg>`,
  zoom: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 3a5.5 5.5 0 0 1 4.3 8.9l4.4 4.4-1.3 1.3-4.4-4.4A5.5 5.5 0 1 1 8.5 3zm0 1.8a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4zm.9 1.8h-1.8v1.8H5.8v1.8h1.8v1.8h1.8v-1.8h1.8V8.4H9.4V6.6z"/></svg>`,
  fitWidth: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 5.5h13v9h-13v-9zM2 5.5h1.2v9H2v-9zm16 0h1.2v9H18v-9z"/></svg>`,
  focusMode: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4.5 4.5h3.5V3H3v5h1.5V4.5zm8-1.5v1.5H16V8h1.5V3h-5zm3.5 12.5h-3.5V17H17v-5h-1.5v3.5zM8 15.5H4.5V12H3v5h5v-1.5z"/></svg>`,
  print: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M15.5 6.5h-11V3h11v3.5zm1 1.5H3.5a1.5 1.5 0 0 0-1.5 1.5v5h2.5v4h11v-4H18v-5a1.5 1.5 0 0 0-1.5-1.5zm-2 9h-9v-4.5h9V17zm1.5-6a.8.8 0 1 1 .8-.8.8.8 0 0 1-.8.8z"/></svg>`,
  info: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm1 12H9V9h2v5zm0-6H9V6h2v2z"/></svg>`,
  otzaria: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2l-8 15h16L10 2zm0 3.8l5.5 10.2H4.5L10 5.8zM9.2 8.5v3.5h1.6V8.5H9.2zm0 4.8v1.6h1.6v-1.6H9.2z"/></svg>`,
  book: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M15.5 2.5H5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h10.5v-15zM5.2 4.3h4v6.5L7.2 9.5 5.2 10.8V4.3z"/></svg>`,
};
