// eslint.config.cjs
const globals = require('globals');
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const unusedImports = require('eslint-plugin-unused-imports');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

/** @type {import("eslint").FlatConfig[]} */
module.exports = [
  js.configs.recommended, // Base ESLint rules for JavaScript
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2020,
        sourceType: 'module',
        globals: {
          ...globals.node,
          myCustomGlobal: 'readonly',
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      'unused-imports': unusedImports,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs.strict.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': ['error'],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn'],
      //'import/no-unresolved': 'error',
      'import/order': [
        'error',
        { alphabetize: { order: 'asc' }, 'newlines-between': 'always' },
      ],
      'unused-imports/no-unused-imports': 'error',
    },
  },
  prettierConfig, // Ensures Prettier compatibility
];
