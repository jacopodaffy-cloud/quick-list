/* Drives the app inside the emulator over the Chrome DevTools Protocol:
   opens the account sheet, taps "Continue with Google", then reports whether
   the WebView survived and what error message (if any) the UI surfaced.
   Run by tools/smoke.sh after `adb forward tcp:9222 localabstract:...`. */
const http = require('http');
const WebSocket = require('ws');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 9222, path }, res => {
      let b = '';
      res.on('data', d => (b += d));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  let pages = [];
  for (let i = 0; i < 10 && !pages.length; i++) {
    try { pages = (await getJSON('/json/list')).filter(p => p.type === 'page'); } catch (e) { }
    if (!pages.length) await sleep(2000);
  }
  if (!pages.length) { console.log('LOGINTAP_RESULT: no CDP page found (WebView not debuggable?)'); return; }

  const ws = new WebSocket(pages[0].webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0;
  const pending = new Map();
  ws.on('message', m => {
    const d = JSON.parse(m);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  });
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  const send = (method, params) => new Promise(resolve => {
    const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  console.log('LOGINTAP: page url =', pages[0].url);
  console.log('LOGINTAP: Capacitor present =', await evaluate('!!window.Capacitor'));
  console.log('LOGINTAP: SocialLogin plugin present =',
    await evaluate('!!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SocialLogin)'));
  console.log('LOGINTAP: open account sheet =',
    await evaluate("(function(){var a=document.getElementById('avatar'); if(!a) return 'no-avatar'; a.click(); return 'ok';})()"));
  await sleep(1500);
  console.log('LOGINTAP: tap Continue with Google =',
    await evaluate("(function(){var b=document.querySelector('[data-auth=google]'); if(!b) return 'no-google-button'; b.click(); return 'ok';})()"));
  await sleep(12000);   // SDK import + native initialize + Credential Manager attempt

  const err = await evaluate("(document.getElementById('auth-error')||{}).textContent || ''");
  const alive = await evaluate('1+1');
  console.log('LOGINTAP: auth-error message =', JSON.stringify(err));
  console.log('LOGINTAP_RESULT:', alive === 2
    ? 'WebView ALIVE after Google tap (no-crash wiring works)'
    : 'WebView UNRESPONSIVE after Google tap');
  ws.close();
}

main().catch(e => { console.log('LOGINTAP_RESULT: script error:', e.message); process.exit(0); });
