import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'e2e',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    // Generous for the devnet runs on the owner's machine; the in-process suite takes seconds.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
