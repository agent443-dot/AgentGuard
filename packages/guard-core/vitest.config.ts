import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'guard-core',
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // SPEC: coverage >= 90% on domain/ (policy engine, amount math, parsers).
      thresholds: {
        'src/domain/**/*.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
})
