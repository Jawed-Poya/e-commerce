const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('easyCartDesktop', Object.freeze({
    isDesktop: true,
    platform: process.platform,
    getAdminToken: () => ipcRenderer.sendSync('easycart:token:get'),
    setAdminToken: (token) => {
        if (typeof token === 'string') ipcRenderer.sendSync('easycart:token:set', token);
    },
    clearAdminToken: () => ipcRenderer.sendSync('easycart:token:clear'),
}));
