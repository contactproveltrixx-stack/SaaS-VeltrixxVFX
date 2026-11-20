// SaaS Veltrixx — application PC (Electron)
const { app, BrowserWindow, ipcMain, shell, net, session, dialog, Menu, nativeTheme, Tray, globalShortcut, nativeImage, screen, Notification } = require('electron');
const path_ = require('path');
// Le nom affiché change, mais les données restent dans le même dossier qu'avant (sinon tout repartirait de zéro)
app.setPath('userData', path_.join(app.getPath('appData'), 'Croisette'));
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 47321;
const BUNDLED = path.join(__dirname, 'app');
const UPDATED = () => path.join(app.getPath('userData'), 'web');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
let win = null, port = PORT, tray = null, quitting = false;
/* ---------- Options de l'app PC (fichier app-prefs.json dans le dossier de l'app) ---------- */
const PREF_DEF = { tray: true, startHidden: true, hotkey: true, zoom: 1, onTop: false, pdfDir: '', bounds: null, maximized: false, trayTip: false };
const P = Object.assign({}, PREF_DEF);
const PREFS_FILE = () => path.join(app.getPath('userData'), 'app-prefs.json');
const HOTKEY = 'CommandOrControl+Alt+V', AUTOSTART_ARG = '--au-demarrage';
function loadPrefs() { try { Object.assign(P, JSON.parse(fs.readFileSync(PREFS_FILE(), 'utf8'))); } catch (e) {} }
function savePrefs() { try { fs.writeFileSync(PREFS_FILE(), JSON.stringify(P, null, 2)); } catch (e) {} }
const autostart = () => { try { return app.getLoginItemSettings({ args: [AUTOSTART_ARG] }).openAtLogin; } catch (e) { return false; } };
function showWin() { if (!win) return createWindow(true); if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function applyTray() {
  if (P.tray && !tray) {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'app', 'icons', 'icon-192.png')).resize({ width: 16, height: 16 }));
    tray.setToolTip('SaaS Veltrixx');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Ouvrir SaaS Veltrixx', click: showWin }, { type: 'separator' }, { label: 'Quitter', click: () => { quitting = true; app.quit(); } }]));
    tray.on('click', showWin);
  } else if (!P.tray && tray) { tray.destroy(); tray = null; }
}
function applyHotkey() {
  try { globalShortcut.unregister(HOTKEY); } catch (e) {}
  if (P.hotkey) { try { globalShortcut.register(HOTKEY, () => { if (win && win.isVisible() && win.isFocused()) win.hide(); else showWin(); }); } catch (e) {} }
}
function applyWindow() { if (!win) return; win.setAlwaysOnTop(!!P.onTop); win.webContents.setZoomFactor(P.zoom || 1); }
function validBounds(b) {
  if (!b || !b.width || !b.height) return null;
  return screen.getAllDisplays().some(d => { const a = d.workArea; return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y >= a.y - 10 && b.y < a.y + a.height - 80; }) ? b : null;
}
const pendingOAuth = new Map();
const pendingBank = new Map();

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => showWin());

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
      res.end(`<!DOCTYPE html><meta charset="utf-8"><title>SaaS Veltrixx</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0A0A0A;color:#EDEDED;font:16px system-ui"><div style="text-align:center"><div style="font:500 40px/1.1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:-.02em"><span style="display:inline-block;width:2px;height:28px;background:#2F7BFF;margin-right:12px;vertical-align:-2px"></span>SaaS Veltrixx</div><p>${code ? 'Connexion Google réussie. Tu peux fermer cet onglet et revenir dans SaaS Veltrixx.' : 'Connexion annulée.'}</p></div></body>`);
      if (win) win.focus();
      return;
    }
    if (u.pathname === '/banque') {
      const st = u.searchParams.get('state'), code = u.searchParams.get('code'), err = u.searchParams.get('error_description') || u.searchParams.get('error');
      const p = pendingBank.get(st);
      if (p) { pendingBank.delete(st); code ? p.res(code) : p.rej(new Error(err || 'Connexion annulée')); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><meta charset="utf-8"><title>SaaS Veltrixx</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0A0A0A;color:#EDEDED;font:16px system-ui"><div style="text-align:center;max-width:420px;padding:24px"><div style="font:600 30px system-ui;letter-spacing:-.02em">SaaS Veltrixx</div><p>${code && p ? 'Compte relié. Tu peux fermer cet onglet et revenir dans SaaS Veltrixx.' : code ? 'Ce lien a déjà servi ou a expiré : relance la connexion depuis SaaS Veltrixx.' : 'Connexion annulée.'}</p></div></body>`);
      if (win && p) showWin();
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

function buildStamp(html) { const m = String(html).match(/"build":"([0-9a-z]+)"/); return m ? parseInt(m[1], 36) : 0; }

// Mise à jour de l'interface depuis la version en ligne (GitHub Pages), si configurée
async function checkUpdate() {
  const { updateUrl } = readConfig();
  if (!updateUrl) return;
  try {
    const r = await net.fetch(updateUrl.replace(/\/?$/, '/') + 'index.html?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const html = await r.text();
    if (!html.includes('id="vault"')) return;
    const dir = UPDATED(); fs.mkdirSync(dir, { recursive: true });
    const cur = resolveFile('index.html');
    // Jamais de retour en arrière : la version en ligne doit être plus récente que celle déjà présente
    if (cur && buildStamp(html) <= buildStamp(fs.readFileSync(cur, 'utf8'))) return false;
    const tmp = path.join(dir, 'index.html.part');
    fs.writeFileSync(tmp, html); fs.renameSync(tmp, path.join(dir, 'index.html'));
    return true;
  } catch (e) { /* hors ligne */ return null; }
}

function createWindow(visible = true) {
  const isMac = process.platform === 'darwin';
  const b = validBounds(P.bounds);
  win = new BrowserWindow({
    width: b ? b.width : 1440, height: b ? b.height : 920, ...(b ? { x: b.x, y: b.y } : {}), minWidth: 380, minHeight: 600, show: false,
    backgroundColor: '#0A0A0A', title: 'SaaS Veltrixx',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isMac ? false : { color: '#00000000', symbolColor: '#F4F2EE', height: 44 },
    icon: path.join(__dirname, 'app', 'icons', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.once('ready-to-show', () => { if (P.maximized) win.maximize(); if (visible) win.show(); });
  win.webContents.on('did-finish-load', applyWindow);
  const keep = () => { if (!win || win.isMinimized()) return; P.maximized = win.isMaximized(); if (!P.maximized) P.bounds = win.getBounds(); savePrefs(); };
  win.on('resize', keep); win.on('move', keep);
  win.on('close', e => {
    keep();
    if (P.tray && !quitting) {
      e.preventDefault(); win.hide();
      if (!P.trayTip && Notification.isSupported()) { P.trayTip = true; savePrefs(); new Notification({ title: 'SaaS Veltrixx reste ouvert', body: 'Il est en bas à droite, près de l’horloge. Ctrl+Alt+V pour le rouvrir.' }).show(); }
    }
  });
  win.on('closed', () => { win = null; });
  win.loadURL(`http://localhost:${port}/`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/accounts\.google\.com\//.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 700, autoHideMenuBar: true } };
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`http://localhost:${port}`)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.session.setSpellCheckerLanguages(['fr']);
}

// Après une réinstallation, la version livrée avec l'app peut être plus récente que celle téléchargée
function dropStaleUpdate() {
  try {
    const up = path.join(UPDATED(), 'index.html'), bu = path.join(BUNDLED, 'index.html');
    if (!fs.existsSync(up) || !fs.existsSync(bu)) return;
    const stamp = f => buildStamp(fs.readFileSync(f, 'utf8'));
    if (stamp(bu) >= stamp(up)) fs.unlinkSync(up);
  } catch (e) {}
}

app.whenReady().then(async () => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  loadPrefs();
  dropStaleUpdate();
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
  const atLogin = process.argv.includes(AUTOSTART_ARG);
  createWindow(!(atLogin && P.startHidden && P.tray));
  applyTray(); applyHotkey();
  checkUpdate();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !P.tray) app.quit(); });
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch (e) {} });

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
  const { filePath, canceled } = await dialog.showSaveDialog(win, { defaultPath: path.join(P.pdfDir && fs.existsSync(P.pdfDir) ? P.pdfDir : app.getPath('documents'), filename.replace(/[\\/:*?"<>|]/g, '-')), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
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

// Boîte mail pro (IONOS ou tout serveur IMAP/SMTP) : lecture en IMAP, envoi en SMTP, copie dans « Envoyés »
const mailErr = e => {
  if (e && (e.authenticationFailed || /auth|login|credentials|535|password/i.test(String(e.responseText || e.response || e.message)))) return 'Adresse ou mot de passe refusé par le serveur mail. Utilise le mot de passe de la boîte mail (pas celui du compte IONOS).';
  if (e && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT/.test(String(e.code || e.message))) return 'Serveur mail injoignable. Vérifie ta connexion et le nom du serveur.';
  return (e && (e.responseText || e.message)) || 'Erreur du serveur mail';
};
const addrText = list => (list || []).map(a => a.name ? `${a.name} <${a.address}>` : a.address).join(', ');
async function withImap(cfg, fn) {
  const { ImapFlow } = require('imapflow');
  const c = new ImapFlow({ host: cfg.imapHost || 'imap.ionos.fr', port: +cfg.imapPort || 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false, connectionTimeout: 20000, greetingTimeout: 15000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.logout(); } catch (e) { try { c.close(); } catch (e2) {} } }
}
async function sentFolder(c) {
  const boxes = await c.list();
  const b = boxes.find(x => x.specialUse === '\\Sent') || boxes.find(x => /^(sent|envoy|gesendet|éléments envoyés|elements envoyes)/i.test(x.name));
  return b ? b.path : null;
}
const IONOS = {
  async test(cfg) { await withImap(cfg, async () => true); return { ok: true }; },
  async list(cfg, { q = '', unread = false, from = [], limit = 30 } = {}) {
    return withImap(cfg, async c => {
      const lock = await c.getMailboxLock('INBOX');
      try {
        const crit = {};
        if (unread) crit.seen = false;
        const ors = [];
        if (q) ors.push({ from: q }, { subject: q }, { to: q });
        for (const f of from) ors.push({ from: f });
        if (ors.length === 1) Object.assign(crit, ors[0]); else if (ors.length) crit.or = ors;
        const uids = (await c.search(Object.keys(crit).length ? crit : { all: true }, { uid: true })) || [];
        const pick = uids.slice(-limit);
        const items = [];
        if (pick.length) for await (const m of c.fetch(pick, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true })) {
          const env = m.envelope || {};
          items.push({ id: String(m.uid), from: addrText(env.from), to: addrText(env.to), subject: env.subject || '(sans objet)', date: +(m.internalDate || env.date || Date.now()), snippet: '', unread: !(m.flags && m.flags.has('\\Seen')) });
        }
        items.sort((a, b) => b.date - a.date);
        const unseen = (await c.search({ seen: false }, { uid: true })) || [];
        return { items, unread: unseen.length };
      } finally { lock.release(); }
    });
  },
  async read(cfg, id) {
    return withImap(cfg, async c => {
      const lock = await c.getMailboxLock('INBOX');
      try {
        const m = await c.fetchOne(String(id), { uid: true, source: true }, { uid: true });
        if (!m || !m.source) throw new Error('Mail introuvable');
        try { await c.messageFlagsAdd(String(id), ['\\Seen'], { uid: true }); } catch (e) {}
        const { simpleParser } = require('mailparser');
        const p = await simpleParser(m.source);
        return { id: String(id), from: p.from ? p.from.text : '', to: p.to ? p.to.text : '', subject: p.subject || '', date: p.date ? +p.date : Date.now(), msgId: p.messageId || '', html: p.html || '', text: p.text || '' };
      } finally { lock.release(); }
    });
  },
  async send(cfg, msg) {
    const nodemailer = require('nodemailer');
    const MailComposer = require('nodemailer/lib/mail-composer');
    const opts = { from: msg.from || cfg.user, to: msg.to, subject: msg.subject, text: msg.text, date: new Date(),
      attachments: (msg.attachments || []).map(a => ({ filename: a.name, content: Buffer.from(a.base64, 'base64'), contentType: a.type })) };
    if (msg.inReplyTo) { opts.inReplyTo = msg.inReplyTo; opts.references = msg.inReplyTo; }
    const raw = await new MailComposer(opts).compile().build();
    const port = +cfg.smtpPort || 465;
    const t = nodemailer.createTransport({ host: cfg.smtpHost || 'smtp.ionos.fr', port, secure: port === 465, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 20000 });
    await t.sendMail({ envelope: { from: cfg.user, to: msg.to }, raw });
    try { await withImap(cfg, async c => { const box = await sentFolder(c); if (box) await c.append(box, raw, ['\\Seen']); }); } catch (e) { /* copie facultative */ }
    return { ok: true };
  }
};
ipcMain.handle('ionos', async (_e, action, cfg, arg) => {
  if (!IONOS[action] || !cfg || !cfg.user || !cfg.pass) return { error: 'Boîte mail pro non configurée' };
  try { return await IONOS[action](cfg, arg); } catch (e) { return { error: mailErr(e) }; }
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

/* ---------- Banques (Enable Banking) : la page de la banque s'ouvre dans le navigateur, le retour arrive sur /banque ---------- */
ipcMain.handle('bank:port', () => port);
ipcMain.handle('bank:auth', (_e, url, state) => new Promise((res, rej) => {
  if (!/^https:\/\//.test(url) || !state) return rej(new Error('Lien de connexion invalide'));
  for (const [k, p] of pendingBank) { p.rej(new Error('Connexion remplacée')); pendingBank.delete(k); }
  pendingBank.set(state, { res, rej });
  shell.openExternal(url);
  setTimeout(() => { if (pendingBank.has(state)) { pendingBank.delete(state); rej(new Error('Connexion bancaire : délai dépassé (15 min)')); } }, 15 * 60e3);
}));
ipcMain.handle('bank:code', (_e, state, code) => { const p = pendingBank.get(state); if (!p) return false; pendingBank.delete(state); p.res(code); return true; });
ipcMain.handle('bank:cancel', () => { for (const [k, p] of pendingBank) { p.rej(new Error('Connexion annulée')); pendingBank.delete(k); } });

/* ---------- Réglages de l'app PC ---------- */
const appState = () => ({ prefs: { ...P, bounds: undefined }, openAtLogin: autostart(), version: app.getVersion(), hotkey: 'Ctrl+Alt+V', documents: app.getPath('documents') });
ipcMain.handle('app:get', () => appState());
ipcMain.handle('app:set', (_e, patch = {}) => {
  if ('openAtLogin' in patch) { try { app.setLoginItemSettings({ openAtLogin: !!patch.openAtLogin, args: [AUTOSTART_ARG] }); } catch (e) {} delete patch.openAtLogin; }
  for (const k of Object.keys(patch)) if (k in PREF_DEF && k !== 'bounds') P[k] = patch[k];
  if (P.zoom < .7 || P.zoom > 1.6) P.zoom = 1;
  savePrefs(); applyTray(); applyHotkey(); applyWindow();
  return appState();
});
ipcMain.handle('app:pickDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Dossier des factures', defaultPath: P.pdfDir || app.getPath('documents'), properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return appState();
  P.pdfDir = r.filePaths[0]; savePrefs(); return appState();
});
ipcMain.handle('app:openDir', (_e, which) => shell.openPath(which === 'pdf' ? (P.pdfDir || app.getPath('documents')) : app.getPath('userData')));
ipcMain.handle('app:update', async () => ({ ready: await checkUpdate() }));
ipcMain.handle('app:relaunch', () => { quitting = true; app.relaunch(); app.quit(); });
