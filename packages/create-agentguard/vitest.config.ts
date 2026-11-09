import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'create-agentguard',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
})
