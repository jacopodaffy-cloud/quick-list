#!/usr/bin/env node
/**
 * deploy.js — bumpa la versione del cache e fa firebase deploy
 * Uso: npm run deploy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Legge la versione attuale da sw.js
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const match = sw.match(/quicklist-v(\d+)/);
if (!match) { console.error('❌ Versione non trovata in sw.js'); process.exit(1); }

const oldV = parseInt(match[1], 10);
const newV = oldV + 1;

console.log(`🔢 Versione: v${oldV} → v${newV}`);

// Aggiorna sw.js
const newSw = sw
  .replace(`quicklist-v${oldV}`, `quicklist-v${newV}`)
  .replace(new RegExp(`\\?v=${oldV - 1}`, 'g'), `?v=${newV}`);  // aggiorna asset version
fs.writeFileSync(path.join(ROOT, 'sw.js'), newSw);

// Aggiorna index.html
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const newHtml = html.replace(new RegExp(`\\?v=${oldV - 1}`, 'g'), `?v=${newV}`);
fs.writeFileSync(path.join(ROOT, 'index.html'), newHtml);

console.log('✅ sw.js e index.html aggiornati');
console.log('🚀 firebase deploy in corso...\n');

try {
  execSync('firebase deploy', { cwd: ROOT, stdio: 'inherit' });
  console.log(`\n✅ Deploy completato! App live su https://qwicklist-v3.web.app`);
} catch (e) {
  console.error('\n❌ Deploy fallito. Controlla l\'output sopra.');
  process.exit(1);
}
