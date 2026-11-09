import { defineConfig } from 'vite';
import { buildCsp } from './csp.js';

// Adds the Content-Security-Policy as a <meta> tag, since GitHub Pages can't set headers
function contentSecurityPolicy() {
  return {
    name: 'content-security-policy',
    transformIndexHtml(html, context) {
      // `context.server` only exists in dev
      const dev = Boolean(context.server);
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: buildCsp({ dev }),
            },
            // First in <head>, so it applies before anything loads
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

export default defineConfig({
  // Relative paths, since GitHub Pages serves the site from /pdf-processor/
  base: './',
  plugins: [contentSecurityPolicy()],
});
