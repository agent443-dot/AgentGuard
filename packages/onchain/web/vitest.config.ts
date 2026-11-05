import { defineConfig } from 'vitest/config'

// The signing page in a real browser: slower than the unit suite, and it needs Chromium installed.
export default defineConfig({
  test: {
    name: 'onchain-web',
    environment: 'node',
    include: ['web/test/**/*.e2e.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
