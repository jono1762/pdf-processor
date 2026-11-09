/**
 * Builds the Content-Security-Policy: where the page may load from and send to.
 * @param {{ dev?: boolean }} [options] - `dev` adds only what Vite's dev server needs
 * @returns {string}
 */
export function buildCsp({ dev = false } = {}) {
  // Each rule lists where a kind of request may go. 'self' means our own site.
  const policy = {
    'default-src': ["'self'"],
    // No inline scripts. 'wasm-unsafe-eval' allows WebAssembly (not eval), for PDF.js.
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    // The PDF.js worker, and later the OCR worker
    'worker-src': ["'self'", 'blob:'],
    // The key privacy rule: requests may only reach our own site
    'connect-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'style-src': ["'self'"],
    // No plugins or form submission
    'object-src': ["'none'"],
    'form-action': ["'none'"],
    // Stops an injected <base> tag redirecting relative URLs
    'base-uri': ["'self'"],
  };

  if (dev) {
    // Vite's dev server needs a WebSocket and inline styles; the built site doesn't
    policy['connect-src'].push('ws://localhost:*');
    policy['style-src'].push("'unsafe-inline'");
  }

  return Object.entries(policy)
    .map(([rule, sources]) => `${rule} ${sources.join(' ')}`)
    .join('; ');
}
