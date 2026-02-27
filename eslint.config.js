import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none'
      }],
      'no-undef': 'error',
      'no-constant-binary-expression': 'error',
      'no-constructor-return': 'error',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-case-declarations': 'off',
      'no-useless-escape': 'off'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'browserbible/dist/**',
      'downloads/**',
      '**/*.min.js',
      'browserbible/js/core/config-custom.js',
      'browserbible/js/core/config-custom-example.js'
    ]
  }
];
