const CDP = "http://127.0.0.1:9222";
async function targets() { const r = await fetch(`${CDP}/json/list`); return r.json(); }
function ws(id) {
  return new Promise((resolve, reject) => {
    const w = new WebSocket(`ws://127.0.0.1:9222/devtools/page/${id}`);
    let msgId = 1; const pending = new Map();
    w.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const id2 = msgId++; pending.set(id2, { res, rej });
        w.send(JSON.stringify({ id: id2, method, params }));
      })
    });
    w.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const h = pending.get(m.id); pending.delete(m.id); m.error ? h.rej(new Error(JSON.stringify(m.error))) : h.res(m.result); }
    };
    w.onerror = reject;
  });
}
async function evalOn(id, expr) {
  const c = await ws(id);
  await c.send("Runtime.enable");
  const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return r.result.value;
}
const list = await targets();
const pio = list.find(t => t.url.includes("khopiopio.vercel.app/sales"));
console.log("pio", pio?.id);
const dump = await evalOn(pio.id, `(() => {
  const isDelivery = document.querySelector('.nav-link.active')?.textContent || 'none';
  const selects = Array.from(document.querySelectorAll('select')).map(s => ({ w: s.getBoundingClientRect().width, cls: s.className, opts: s.options.length }));
  const wrap = document.querySelector('.pos-delivery-form');
  const inputs = wrap ? Array.from(wrap.querySelectorAll('input,select,textarea')).map(el => ({ tag: el.tagName, ph: el.placeholder || '', cls: el.className })) : [];
  return JSON.stringify({ activeMode: isDelivery, selectsCount: selects.length, selects, deliveryFormExists: !!wrap, inputs }, null, 1);
})()`);
console.log(dump);
