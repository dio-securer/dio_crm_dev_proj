// The issue code table in docs/framework/metamodel.md must match the code table of the validator.
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { m, assert } = require('./helpers.cjs');

test('docs/framework/metamodel.md lists exactly the issue codes of the validator', () => {
  const text = fs.readFileSync(path.join(__dirname, '../../docs/framework/metamodel.md'), 'utf8');
  const start = '<!-- issue-codes:start -->\n', end = '\n<!-- issue-codes:end -->';
  const i = text.indexOf(start), j = text.indexOf(end);
  assert.ok(i >= 0 && j > i, 'markers missing');
  assert.equal(text.slice(i + start.length, j), m.renderIssueCodeTable(), 'run: node -e "console.log(require(\'./packages/contracts/dist/metadata\').renderIssueCodeTable())" and paste between the markers');
});
