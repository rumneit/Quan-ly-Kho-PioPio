const targetId = "14B685DB0974ABEC01007A48AB1512E8";
const ws = new WebSocket(`ws://localhost:9222/devtools/page/${targetId}`);
let msgId = 1;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
  }
});
ws.addEventListener("open", async () => {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.reload", { ignoreCache: true });
  await new Promise(r => setTimeout(r, 3500));
  // click Bán giao hàng
  await send("Runtime.evaluate", { expression: `
    (() => {
      const links = Array.from(document.querySelectorAll('a.nav-link, .nav-link'));
      const del = links.find(a => a.textContent.includes('giao hàng'));
      if (del) del.click();
      return !!del;
    })()
  ` });
  await new Promise(r => setTimeout(r, 1000));
  const result = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { w: Math.round(r.width), h: Math.round(r.height), pad: s.padding };
        };
        const inputs = Array.from(document.querySelectorAll('.pos-form-row input'));
        const textareas = Array.from(document.querySelectorAll('.pos-textarea'));
        const selects = Array.from(document.querySelectorAll('.pos-select'));
        return JSON.stringify({
          rn: box(inputs[0]),
          ph: box(inputs[1]),
          textareas: textareas.map(box),
          selects: selects.map(box),
          err: document.body.innerText.includes('Application error')
        });
      })()
    `,
    returnByValue: true
  });
  console.log(result.result.value);
  ws.close();
  process.exit(0);
});
ws.addEventListener("error", (e) => { console.error("WS ERROR", e); process.exit(1); });
