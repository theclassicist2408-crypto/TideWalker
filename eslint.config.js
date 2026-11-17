import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'android', 'ios', 'desktop/web', 'desktop/release', 'desktop/node_modules', 'public/sw.js', '**/*.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['scripts/**', '*.config.*', 'desktop/**'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', window: 'readonly', document: 'readonly', Response: 'readonly' } },
    rules: { 'no-console': 'off' },
  },
  {
    // The desktop shell is CommonJS, as Electron's main process expects.
    files: ['desktop/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', __dirname: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
