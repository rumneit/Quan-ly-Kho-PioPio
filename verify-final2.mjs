const CDP = "http://localhost:9222";
const tabsRes = await fetch(`${CDP}/json`);
const tabs = await tabsRes.json();
const tab = tabs.find(t => t.url && t.url.includes("khopiopio.vercel.app/sales"));
if (!tab) { console.log("NO TAB"); process.exit(1); }

const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});
await send("Page.enable");
await send("Runtime.enable");

// Click Bán giao hàng
const clickExpr = `
(() => {
  const links = Array.from(document.querySelectorAll('a.nav-link, li a'));
  const target = links.find(a => a.textContent.trim().includes('Bán giao hàng'));
  if (!target) return { found: false };
  target.click();
  return { found: true };
})()
`;
const clickResult = await send("Runtime.evaluate", { expression: clickExpr, returnByValue: true });
console.log("click:", JSON.stringify(clickResult.result.value));

await new Promise(r => setTimeout(r, 1000));

const measureExpr = `
(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), pad: s.padding, radius: s.borderRadius };
  };
  const rn = document.querySelector('input[placeholder="Tên người nhận"]');
  const ph = document.querySelector('input[placeholder="Số điện thoại"]');
  const textareas = Array.from(document.querySelectorAll('textarea.pos-textarea')).map(box);
  const selects = Array.from(document.querySelectorAll('select.pos-select')).map(box);
  const packInputs = Array.from(document.querySelectorAll('.pos-pack-input')).map(box);
  return { rn: box(rn), ph: box(ph), textareas, selects, packInputs, mode: document.querySelector('main')?.className };
})()
`;
const measureResult = await send("Runtime.evaluate", { expression: measureExpr, returnByValue: true });
console.log(JSON.stringify(measureResult.result.value, null, 1));
ws.close();
