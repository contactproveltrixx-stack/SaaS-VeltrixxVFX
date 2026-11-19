// Croisette — passerelle sécurisée entre l'interface et le système
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('croisetteNative', {
  platform: process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux',
  fetch: (url, opts) => ipcRenderer.invoke('net:fetch', url, opts),
  printToPDF: o => ipcRenderer.invoke('pdf:render', o),
  savePDF: o => ipcRenderer.invoke('pdf:save', o),
  openExternal: url => ipcRenderer.invoke('shell:open', url),
  googleAuth: o => ipcRenderer.invoke('google:auth', o),
  setMode: m => ipcRenderer.invoke('ui:mode', m),
  takeSetup: () => ipcRenderer.invoke('setup:take')
});
