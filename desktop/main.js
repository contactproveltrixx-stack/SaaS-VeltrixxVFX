// Croisette — application PC (Electron)
const { app, BrowserWindow, ipcMain, shell, net, session, dialog, Menu, nativeTheme } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 47321;
const BUNDLED = path.join(__dirname, 'app');
const UPDATED = () => path.join(app.getPath('userData'), 'web');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
let win = null, port = PORT;
const pendingOAuth = new Map();

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function readConfig() { try { return JSON.parse(fs.readFileSync(path.join(BUNDLED, 'config.json'), 'utf8')); } catch (e) { return {}; } }

function resolveFile(rel) {
  const clean = path.normalize(rel).replace(/^([/\\])+/, '').replace(/^(\.\.[/\\])+/, '');
  for (const base of [UPDATED(), BUNDLED]) {
    const fp = path.join(base, clean);
    if (fp.startsWith(base) && fs.existsSync(fp) && fs.statSync(fp).isFile()) return fp;
  }
  return null;
}

function startServer() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/oauth') {
      const st = u.searchParams.get('state'), code = u.searchParams.get('code'), err = u.searchParams.get('error');
      const p = pendingOAuth.get(st);
      if (p) { pendingOAuth.delete(st); code ? p.res(code) : p.rej(new Error(err || 'Connexion refusée')); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><meta charset="utf-8"><title>Croisette</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#05070d;color:#F4F2EE;font:16px system-ui"><div style="text-align:center"><div style="font:italic 44px Georgia,serif">Croisette</div><p>${code ? 'Connexion Google réussie. Tu peux fermer cet onglet et revenir dans Croisette.' : 'Connexion annulée.'}</p></div></body>`);
      if (win) win.focus();
      return;
    }
    const fp = resolveFile(u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
    if (!fp) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(resolve => {
    srv.once('error', () => { srv.listen(0, '127.0.0.1', () => { port = srv.address().port; resolve(); }); });
    srv.listen(PORT, '127.0.0.1', () => resolve());
  });
}

// Mise à jour de l'interface depuis la version en ligne (GitHub Pages), si configurée
async function checkUpdate() {
  const { updateUrl } = readConfig();
  if (!updateUrl) return;
  try {
    const r = await net.fetch(updateUrl.replace(/\/?$/, '/') + 'index.html?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const html = await r.text();
    if (!html.includes('id="vault"') || !html.includes('Croisette')) return;
    const dir = UPDATED(); fs.mkdirSync(dir, { recursive: true });
    const cur = resolveFile('index.html');
    if (cur && fs.readFileSync(cur, 'utf8') === html) return;
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  } catch (e) { /* hors ligne */ }
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 380, minHeight: 600, show: false,
    backgroundColor: '#05070d', title: 'Croisette',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isMac ? false : { color: '#00000000', symbolColor: '#F4F2EE', height: 44 },
    icon: path.join(__dirname, 'app', 'icons', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://localhost:${port}/`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/accounts\.google\.com\//.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 700, autoHideMenuBar: true } };
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`http://localhost:${port}`)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.session.setSpellCheckerLanguages(['fr']);
}

app.whenReady().then(async () => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  // L'aperçu du site (onglet Mon site) : autorise l'affichage dans un cadre
  session.defaultSession.webRequest.onHeadersReceived((d, cb) => {
    if (d.resourceType !== 'subFrame') return cb({});
    const h = d.responseHeaders || {};
    for (const k of Object.keys(h)) {
      if (/^x-frame-options$/i.test(k)) delete h[k];
      else if (/^content-security-policy$/i.test(k)) h[k] = h[k].map(v => v.replace(/frame-ancestors[^;]*;?/gi, ''));
    }
    cb({ responseHeaders: h });
  });
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen'].includes(perm)));
  await startServer();
  createWindow();
  checkUpdate();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ---------- Ponts vers l'interface ---------- */
ipcMain.handle('net:fetch', async (_e, url, opts = {}) => {
  if (!/^https:\/\//.test(url)) throw new Error('Seules les adresses https sont autorisées');
  const r = await net.fetch(url, { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body || undefined });
  return { ok: r.ok, status: r.status, text: await r.text() };
});

async function renderPDF(html) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  await w.loadURL('data:text/html;charset=utf-8;base64,' + Buffer.from(html, 'utf8').toString('base64'));
  await new Promise(r => setTimeout(r, 300));
  const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'none' }, preferCSSPageSize: true });
  w.destroy();
  return pdf;
}
ipcMain.handle('pdf:render', async (_e, { html }) => ({ base64: (await renderPDF(html)).toString('base64') }));
ipcMain.handle('pdf:save', async (_e, { html, filename }) => {
  const pdf = await renderPDF(html);
  const { filePath, canceled } = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), filename.replace(/[\\/:*?"<>|]/g, '-')), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (canceled || !filePath) return { saved: false };
  fs.writeFileSync(filePath, pdf);
  shell.showItemInFolder(filePath);
  return { saved: true, path: filePath };
});
// Fichier de connexions préparé à l'installation (chiffré avec le compte) : lu une fois puis supprimé
const SETUP_FILE = () => path.join(app.getPath('documents'), 'Croisette', 'connexions.croisette');
ipcMain.handle('setup:take', () => {
  const f = SETUP_FILE();
  if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, 'utf8');
  try { fs.unlinkSync(f); } catch (e) {}
  return t;
});
ipcMain.handle('shell:open', (_e, url) => { if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url); });
ipcMain.handle('ui:mode', (_e, mode) => {
  if (!win || process.platform === 'darwin') return;
  try { win.setTitleBarOverlay({ color: '#00000000', symbolColor: mode === 'day' ? '#101826' : '#F4F2EE', height: 44 }); } catch (e) {}
});

// Connexion Google « application installée » : navigateur du système + code PKCE + jeton de rafraîchissement
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
ipcMain.handle('google:auth', async (_e, { clientId, clientSecret, scope }) => {
  const state = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const redirect = `http://localhost:${port}/oauth`;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope, access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256' });
  const code = await new Promise((res, rej) => {
    pendingOAuth.set(state, { res, rej });
    shell.openExternal(url);
    setTimeout(() => { if (pendingOAuth.has(state)) { pendingOAuth.delete(state); rej(new Error('Connexion Google : délai dépassé')); } }, 5 * 60e3);
  });
  const r = await net.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }).toString() });
  const j = await r.json();
  if (!j.access_token) throw new Error(j.error_description || j.error || 'Connexion Google refusée');
  if (win) win.focus();
  return j;
});
