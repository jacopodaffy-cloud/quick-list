/* ============================================================
   QuickList — formatting smoke tests
   Run:  node tools/test.mjs   (exits non-zero on failure)

   These mirror fmtText() / stripFmt() in app.js. Keep them in sync:
   if you change the formatting rules there, update them here too.
   The point is to lock in two guarantees that are easy to break:
     1. **bold** / __underline__ (and the combination) render correctly
     2. user text can NEVER inject HTML (escaped before tags are added)
   ============================================================ */
import assert from 'node:assert/strict';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtText = s => esc(s)
  .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  .replace(/__([^_]+?)__/g, '<u>$1</u>');
const stripFmt = s => String(s == null ? '' : s).replace(/\*\*([^*]+?)\*\*/g, '$1').replace(/__([^_]+?)__/g, '$1');

let passed = 0;
const test = (name, fn) => { fn(); passed++; };

test('bold', () => assert.equal(fmtText('**milk**'), '<strong>milk</strong>'));
test('underline', () => assert.equal(fmtText('__milk__'), '<u>milk</u>'));
test('bold + underline combined', () => assert.equal(fmtText('**__milk__**'), '<strong><u>milk</u></strong>'));
test('mixed in a sentence', () => assert.equal(fmtText('buy **milk** and __eggs__'), 'buy <strong>milk</strong> and <u>eggs</u>'));
test('plain text untouched', () => assert.equal(fmtText('just milk'), 'just milk'));
test('XSS: tags are escaped', () => assert.equal(fmtText('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;'));
test('XSS: cannot break out via bold', () => assert.equal(fmtText('**<script>**'), '<strong>&lt;script&gt;</strong>'));
test('strip markers for share/preview', () => assert.equal(stripFmt('**milk** and __eggs__'), 'milk and eggs'));
test('strip leaves plain text', () => assert.equal(stripFmt('just milk'), 'just milk'));

console.log(`✓ ${passed} formatting tests passed`);
