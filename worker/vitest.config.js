import { defineConfig } from 'vitest/config';

// Node tests: the Worker's modules use web-standard APIs (fetch, Response,
// URL, AbortSignal). The one exception, the Goodreads widget parser
// (HTMLRewriter), runs in workerd through Miniflare (test/helpers.js).
// Fixtures are read from test/fixtures; nothing touches the network.
export default defineConfig({
  test: { include: ['test/**/*.test.js'], environment: 'node' },
});
