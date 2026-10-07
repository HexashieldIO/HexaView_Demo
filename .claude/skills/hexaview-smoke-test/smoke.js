// HexaView smoke test: paste into mcp__Claude_Browser__javascript_tool on a https://localhost page.
// Replace ROUTES, run, then poll window.__smoke until done is true.
const ROUTES = [
  '/',
  '/strike/aipentest',
  '/incident-response/overview',
];
const CUSTOMERS = ['maritime', 'finserv', 'media', 'healthcare', 'automotive', 'insurance', 'defence', 'pharma', 'sghospital', 'studio'];
const BAD = [/Something went wrong/, /\bNaN\b/, /\bundefined\b/, /Infinity/, /New module/];
const clearStores = () => Object.keys(sessionStorage).filter((k) => k.startsWith('hv.aipt.') || k.startsWith('hv.ir.')).forEach((k) => sessionStorage.removeItem(k));

clearStores();
sessionStorage.setItem('hv.session', '1');
window.__smoke = { done: false, out: [], n: 0, total: ROUTES.length * CUSTOMERS.length };
(async () => {
  for (const c of CUSTOMERS) {
    localStorage.setItem('hv.customer', c);
    await Promise.all(ROUTES.map(async (p) => {
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:-3000px;width:1400px;height:900px';
      f.src = p;
      document.body.appendChild(f);
      await new Promise((r) => setTimeout(r, 3800));
      const t = f.contentDocument?.body?.innerText || '';
      const bad = BAD.filter((r) => r.test(t)).map(String);
      if (bad.length || t.length < 300) window.__smoke.out.push(`${c} ${p} ${bad.join(',')} len=${t.length}`);
      window.__smoke.n++;
      f.remove();
    }));
  }
  localStorage.setItem('hv.customer', 'maritime');
  clearStores();
  window.__smoke.done = true;
})();
'started';
