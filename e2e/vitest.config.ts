import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'e2e',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    // End-to-end runs talk to Base Sepolia (or a local fork) and to live services.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
