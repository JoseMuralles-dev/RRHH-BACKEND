const { jest: base } = require('../package.json');

module.exports = {
  ...base,
  rootDir: '..',
  testRegex: '(\\.spec|\\.e2e-spec)\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'html', 'json-summary'],
};
