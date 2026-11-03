import eslintJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * Shared lint rules for every package. See /CLAUDE.md "Code standards".
 * Money rule reminder: amounts are bigint internally, never JS numbers.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'packages/onchain/out/**',
      'packages/onchain/cache/**',
      'packages/onchain/lib/**',
      'packages/onchain/broadcast/**',
    ],
  },
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'prefer-const': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'JSON',
          property: 'parse',
          message: 'Validate external input with zod at the boundary.',
        },
      ],
    },
  },
  {
    // Operator scripts and tests print to stdout and may parse trusted local fixtures.
    files: ['**/scripts/**/*.ts', '**/test/**/*.ts', '**/*.test.ts', 'e2e/**/*.ts'],
    rules: { 'no-console': 'off', 'no-restricted-properties': 'off' },
  },
  prettier,
)
