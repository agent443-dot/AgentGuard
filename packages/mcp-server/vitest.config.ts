import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'mcp-server',
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
})
