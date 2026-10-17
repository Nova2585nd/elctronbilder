const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('nova', {
  getState: () => call('state'), addSubscription: (url) => call('sub:add', String(url)), refreshSubscription: () => call('sub:refresh'),
  removeSubscription: () => call('sub:remove'), connect: (id) => call('conn:connect', id ? String(id) : null), disconnect: () => call('conn:disconnect'),
  testAll: () => call('test'), setSettings: (p) => call('settings', p), getLogs: () => call('logs'), quit: () => call('quit'),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
});
