// Hand-off from HexaEngine, HexaShield's sister console. HexaEngine's HexaView banner opens
// this demo with ?from=engine (it lives on claude.ai), so we remember that for the session and
// offer a way back. Demo reset keeps the flag (see resetDemo in src/demo/tour.ts).

export const ENGINE_KEY = 'hv.from';
export const ENGINE_URL = 'https://claude.ai/artifact/GrH5R9QUb3LhzGUAk4o1yZ';

/** Call once at start-up, before the router rewrites the URL. */
export function rememberEngineHandoff() {
  try {
    const fromParam = new URLSearchParams(window.location.search).get('from') === 'engine';
    // The sign-in redirect carries the original query inside ?next=, so look there too.
    const next = new URLSearchParams(window.location.search).get('next') ?? '';
    const fromNext = /[?&]from=engine\b/.test(next);
    let fromRef = false;
    try { fromRef = !!document.referrer && new URL(document.referrer).hostname.endsWith('claude.ai'); } catch { /* bad referrer */ }
    if (fromParam || fromNext || fromRef) sessionStorage.setItem(ENGINE_KEY, 'engine');
  } catch { /* storage unavailable */ }
}

export function cameFromEngine(): boolean {
  try { return sessionStorage.getItem(ENGINE_KEY) === 'engine'; } catch { return false; }
}
