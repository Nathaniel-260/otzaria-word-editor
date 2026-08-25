/**
 * מדידה משולבת לגלים 17–25: metadata, protection, hyperlinks, diff,
 * plan.execute (מאקרו), contentControls, images, blocks.delete/create.
 * סקריפט זמני: יימחק לפני הקומיט.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openPage, requireChrome, sleep } from './cdp.mjs';

try { execSync(`pkill -f 'remote-debugging-port=9333'`); } catch { /* נקי */ }
setTimeout(() => { console.error('WATCHDOG'); process.exit(3); }, 420_000);

const DIST = new URL('../dist/', import.meta.url).pathname;
const stub = `<script>window.Otzaria={call:m=>m==='app.getInfo'?Promise.resolve({success:true,data:{version:'9',platform:'p'},error:null}):m==='app.getTheme'?Promise.resolve({success:true,data:{mode:'light',colorScheme:{},typography:{}},error:null}):Promise.resolve({success:false,data:null,error:{message:'no'}}),on(){},off(){}};</script>`;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const latchEnd = html.indexOf('</script>') + '</script>'.length;
writeFileSync(join(DIST, 'qa-tmp.html'), html.slice(0, latchEnd) + stub + html.slice(latchEnd));

requireChrome();
console.log('step: launching chrome');
const page = await openPage('file://' + join(DIST, 'qa-tmp.html'), { label: 'w1725' });
console.log('step: page open');

const FIND = `(function(){var el=document.querySelector('#app');var inst=(el.__vue_app__&&el.__vue_app__._instance)||(el._vnode&&el._vnode.component);if(!inst)return null;var p=inst.provides;var syms=Object.getOwnPropertySymbols(p);for(var i=0;i<syms.length;i++)if(String(syms[i])==='Symbol(activeSuperdoc)')return p[syms[i]].value;return null;})()`;

let sdReady = false;
for (let i = 0; i < 400 && !sdReady; i++) {
  try { sdReady = await page.cdp.evaluate(`!!${FIND}`); } catch { /* בטעינה */ }
  if (!sdReady) await sleep(300);
}
if (!sdReady) { console.error('לא נמצא מופע SuperDoc'); process.exit(1); }
console.log('== SuperDoc נטען ==');

async function withDoc(body) {
  const wrapped = `(async()=>{const d=${FIND}.activeEditor.doc;try{return JSON.stringify(await (async()=>{${body}})());}catch(e){return JSON.stringify({__threw:String(e&&e.message||e)});}})()`;
  return JSON.parse(await page.cdp.evaluate(wrapped));
}

// ---- seed -------------------------------------------------------------------
await withDoc(`return await d.insert({ value: 'משפט לבדיקת קישורים' });`);
const nodeId = await withDoc(`
  const l = await d.blocks.list();
  return ((l && l.blocks) || [])[0].nodeId;
`);
const SEL = JSON.stringify({
  kind: 'selection',
  start: { kind: 'text', blockId: nodeId, offset: 0 },
  end: { kind: 'text', blockId: nodeId, offset: 6 },
});

function step(label) { console.log(`\n=== ${label} ===`); }

// ---- גל 18: metadata --------------------------------------------------------
step('18 metadata');
console.log('attach:', JSON.stringify(await withDoc(`
  return await d.metadata.attach({ target: ${SEL}, namespace: 'urn:otzaria:test:1', payload: { מקור: 'בבלי', דף: 'ב' } });
`)));
console.log('list:', JSON.stringify(await withDoc(`
  const r = await d.metadata.list({ namespace: 'urn:otzaria:test:1' });
  return r;
`)));

// ---- גל 19: protection ------------------------------------------------------
step('19 protection');
console.log('protection.get:', JSON.stringify(await withDoc(`
  return await d.protection.get();
`)));

// ---- גל 22: hyperlinks ------------------------------------------------------
step('22 hyperlinks');
console.log('wrap:', JSON.stringify(await withDoc(`
  return await d.hyperlinks.wrap({ target: ${SEL}, href: 'https://otzaria.org' });
`)));
console.log('list:', JSON.stringify(await withDoc(`
  return await d.hyperlinks.list({ within: ${SEL} });
`)));
console.log('remove:', JSON.stringify(await withDoc(`
  return await d.hyperlinks.remove({ within: ${SEL} });
`)));

// ---- גל 20: diff ------------------------------------------------------------
step('20 diff');
console.log('diff.capture:', JSON.stringify(await withDoc(`
  return await d.diff.capture();
`)).slice(0, 400));

// ---- גל 24: plan.execute ----------------------------------------------------
step('24 plan.execute');
console.log('plan.execute bookmark:', JSON.stringify(await withDoc(`
  return await d.plan.execute({
    entries: [
      { operationId: 'bookmarks.insert', input: { name: 'סימניה_מקרו' } },
    ],
    captureReturns: '*',
  });
`)).slice(0, 500));

// ---- גל 25: contentControls -------------------------------------------------
step('25 contentControls');
console.log('contentControls keys:', JSON.stringify(await withDoc(`
  return Object.keys(d).filter(k => k.indexOf('content') === 0 || k === 'customXml');
`)));

// ---- גל 23: blocks / create --------------------------------------------------
step('23 blocks/create');
console.log('create.paragraph:', JSON.stringify(await withDoc(`
  return await d.create.paragraph({ at: { target: ${SEL} } });
`)).slice(0, 300));
console.log('blocks.delete:', JSON.stringify(await withDoc(`
  const l = await d.blocks.list();
  const last = ((l && l.blocks) || []).slice(-1)[0];
  return await d.blocks.delete({ target: { kind: 'block', nodeType: last.nodeType, nodeId: last.nodeId } });
`)).slice(0, 300));

// ---- סבב ב׳ -----------------------------------------------------------------
await page.close();
const page2 = await openPage('file://' + join(DIST, 'qa-tmp.html'), { label: 'w1725b' });
const FIND2 = FIND;
let ok2 = false;
for (let i = 0; i < 400 && !ok2; i++) {
  try { ok2 = await page2.cdp.evaluate(`!!${FIND2}`); } catch { /* בטעינה */ }
  if (!ok2) await sleep(300);
}
async function withDoc2(body) {
  const wrapped = `(async()=>{const d=${FIND2}.activeEditor.doc;try{return JSON.stringify(await (async()=>{${body}})());}catch(e){return JSON.stringify({__threw:String(e&&e.message||e)});}})()`;
  return JSON.parse(await page2.cdp.evaluate(wrapped));
}
await withDoc2(`return await d.insert({ value: 'טקסט לקישור ולבדיקות' });`);
const nid = await withDoc2(`
  const l = await d.blocks.list();
  return ((l && l.blocks) || [])[0].nodeId;
`);
const TA = JSON.stringify({ kind: 'text', blockId: nid, range: { start: 0, end: 5 } });

step('22b hyperlinks with TextAddress');
console.log('wrap:', JSON.stringify(await withDoc2(`
  return await d.hyperlinks.wrap({ target: ${TA}, href: 'https://otzaria.org' });
`)).slice(0, 300));
console.log('list:', JSON.stringify(await withDoc2(`
  return await d.hyperlinks.list();
`)).slice(0, 400));
console.log('remove:', JSON.stringify(await withDoc2(`
  return await d.hyperlinks.remove({ within: ${TA} });
`)));

step('24b plan.execute with full input');
console.log('plan.execute:', JSON.stringify(await withDoc2(`
  return await d.plan.execute({
    entries: [
      { operationId: 'bookmarks.insert',
        input: { name: 'מאקרו_א', target: ${TA} } },
    ],
    captureReturns: '*',
  });
`)).slice(0, 500));

step('19b protection set→get→clear→get');
console.log('set:', JSON.stringify(await withDoc2(`
  return await d.protection.setEditingRestriction({ mode: 'readOnly' });
`)));
console.log('capabilities after set:', JSON.stringify(await withDoc2(`
  const c = await d.capabilities.get();
  return { available: c.available, falseCount: Object.values(c.operations || {}).filter(o => o.available === false).length };
`)));
console.log('get after set:', JSON.stringify(await withDoc2(`
  return await d.protection.get();
`)));
console.log('clear:', JSON.stringify(await withDoc2(`
  return await d.protection.clearEditingRestriction();
`)));
console.log('get after clear:', JSON.stringify(await withDoc2(`
  return await d.protection.get();
`)));

step('23b create.paragraph before/after + blocks.delete');
console.log('create.paragraph after:', JSON.stringify(await withDoc2(`
  return await d.create.paragraph({ at: { target: { kind: 'block', nodeType: 'paragraph', nodeId: ${JSON.stringify(nid)} }, placement: 'after' } });
`)).slice(0, 300));

step('17 images.list');
console.log('images.list:', JSON.stringify(await withDoc2(`
  return await d.images.list();
`)).slice(0, 200));

console.log('\n== המדידה הושלמה ==');
page2.close();

