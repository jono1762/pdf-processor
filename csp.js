/**
 * Builds the text of the Content-Security-Policy: the rules the browser enforces
 * about where this page may load code from and send data to.
 * @param {{ dev?: boolean }} [options] - `dev` adds only what Vite's dev server needs
 * @returns {string}
 */
export function buildCsp({ dev = false } = {}) {
  // Each rule maps a kind of request to the places it is allowed to go.
  // 'self' means our own site, and nothing else is allowed.
  const policy = {
    'default-src': ["'self'"],
    // No inline scripts. 'wasm-unsafe-eval' lets WebAssembly run (not eval), for
    // the image decoders inside PDF.js.
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    // The PDF.js worker, and later the OCR worker
    'worker-src': ["'self'", 'blob:'],
    // The key rule for privacy: fetch, XHR and WebSocket may only reach our own site
    'connect-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'style-src': ["'self'"],
    // Nothing in the app needs plugins or form submission
    'object-src': ["'none'"],
    'form-action': ["'none'"],
    // Stops an injected <base> tag from redirecting our relative URLs
    'base-uri': ["'self'"],
  };

  if (dev) {
    // Vite's dev server reloads the page over a WebSocket, and adds styles to the
    // page as inline <style> tags. The built site needs neither.
    policy['connect-src'].push('ws://localhost:*');
    policy['style-src'].push("'unsafe-inline'");
  }

  return Object.entries(policy)
    .map(([rule, sources]) => `${rule} ${sources.join(' ')}`)
    .join('; ');
}
