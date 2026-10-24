import { describe, it, expect } from 'vitest';
import { buildCsp } from './csp.js';

// Turns the policy text into { rule: [sources] } so tests can check each rule
function parse(policy) {
  return Object.fromEntries(
    policy.split('; ').map((rule) => {
      const [name, ...sources] = rule.split(' ');
      return [name, sources];
    }),
  );
}

describe('buildCsp', () => {
  it('only allows our own site by default', () => {
    expect(parse(buildCsp())['default-src']).toEqual(["'self'"]);
  });

  it('only lets the app send data to its own site', () => {
    expect(parse(buildCsp())['connect-src']).toEqual(["'self'"]);
  });

  it('allows no outside hosts anywhere in the built policy', () => {
    const sources = Object.values(parse(buildCsp())).flat();

    // Every source is a keyword like 'self', or the data: / blob: scheme.
    // A host such as https://cdn.example.com would not match.
    for (const source of sources) {
      expect(source).toMatch(/^('[a-z-]+'|data:|blob:)$/);
    }
  });

  it('allows no inline or eval-style scripts in the built policy', () => {
    const scriptSources = parse(buildCsp())['script-src'];

    expect(scriptSources).not.toContain("'unsafe-inline'");
    expect(scriptSources).not.toContain("'unsafe-eval'");
  });

  it('allows no plugins or form submission', () => {
    const policy = parse(buildCsp());

    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['form-action']).toEqual(["'none'"]);
  });

  it('adds only a local WebSocket and inline styles in dev mode', () => {
    const built = parse(buildCsp());
    const dev = parse(buildCsp({ dev: true }));

    expect(dev['connect-src']).toEqual(["'self'", 'ws://localhost:*']);
    expect(dev['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
    // Everything else stays as strict as the built policy
    expect(dev['script-src']).toEqual(built['script-src']);
    expect(dev['default-src']).toEqual(built['default-src']);
  });
});
