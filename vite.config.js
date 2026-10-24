import { defineConfig } from 'vite';
import { buildCsp } from './csp.js';

// Puts the Content-Security-Policy into index.html as a <meta> tag. GitHub Pages
// can't send HTTP headers, so a meta tag is how the policy reaches the browser.
function contentSecurityPolicy() {
  return {
    name: 'content-security-policy',
    transformIndexHtml(html, context) {
      // Only the dev server provides `context.server`, so this tells dev from build
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
            // First in <head>, so the policy is in place before anything else loads
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [contentSecurityPolicy()],
});
