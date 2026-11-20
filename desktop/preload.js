// SaaS Veltrixx — passerelle sécurisée entre l'interface et le système
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('croisetteNative', {
  platform: process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux',
  fetch: (url, opts) => ipcRenderer.invoke('net:fetch', url, opts),
  printToPDF: o => ipcRenderer.invoke('pdf:render', o),
  savePDF: o => ipcRenderer.invoke('pdf:save', o),
  openExternal: url => ipcRenderer.invoke('shell:open', url),
  googleAuth: o => ipcRenderer.invoke('google:auth', o),
  setMode: m => ipcRenderer.invoke('ui:mode', m),
  takeSetup: () => ipcRenderer.invoke('setup:take'),
  ionos: (action, cfg, arg) => ipcRenderer.invoke('ionos', action, cfg, arg),
  app: {
    get: () => ipcRenderer.invoke('app:get'),
    set: patch => ipcRenderer.invoke('app:set', patch),
    pickDir: () => ipcRenderer.invoke('app:pickDir'),
    openDir: which => ipcRenderer.invoke('app:openDir', which),
    update: () => ipcRenderer.invoke('app:update'),
    relaunch: () => ipcRenderer.invoke('app:relaunch')
  }
});
