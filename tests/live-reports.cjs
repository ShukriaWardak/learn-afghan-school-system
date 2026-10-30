const vm = require('node:vm');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const context = {
  state: {branches: []},
  escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  heading: (title, description) => title + description,
  metric: (label, count) => `${label}:${count};`,
  panel: (title, content) => title + content,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../live.js'), 'utf8') + '\nglobalThis.live = Live;', context);
context.live.zones = [{id: 1, code: 'N', name: '<North>'}, {id: 2, code: 'S', name: 'South'}];
context.state.branches = [
  {zone_id: 1, status: 'Active'},
  {zone_id: 1, status: 'Inactive'},
  {zone_id: 2, status: 'Pending setup'},
];
let html = context.live.reportsView();
assert.ok(html.includes('Accessible branches:3;'));
for (const status of ['Active', 'Inactive', 'Pending setup']) assert.ok(html.includes(`${status}:1;`));
assert.ok(html.includes('<td>&lt;North&gt;</td><td>2</td><td>1</td><td>1</td><td>0</td>'));
assert.ok(html.includes('<td>South</td><td>1</td><td>0</td><td>0</td><td>1</td>'));
assert.ok(!html.includes('<North>'));
assert.ok(html.includes('Download authorized branch CSV'));
context.state.branches = [];
context.live.zones = [];
html = context.live.reportsView();
assert.ok(html.includes('Accessible branches:0;'));
assert.ok(html.includes('No authorized zones are available.'));
assert.ok(html.includes('Download all 0 accessible branch records'));
console.log('PASS: report totals, zone breakdown, escaped names and empty scope');
