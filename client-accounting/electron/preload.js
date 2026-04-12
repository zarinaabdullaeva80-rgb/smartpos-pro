const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    },
    // Folder management for exports
    getPath: (name) => ipcRenderer.invoke('get-path', name),
    ensureFolder: (folderPath) => ipcRenderer.invoke('ensure-folder', folderPath),
    saveFile: (options) => ipcRenderer.invoke('save-file', options),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    // Server management
    getServerInfo: () => ipcRenderer.invoke('get-server-info'),
    restartServer: () => ipcRenderer.invoke('restart-server'),
    // Server mode (server / client / cloud)
    getServerMode: () => ipcRenderer.invoke('get-server-mode'),
    setServerMode: (mode) => ipcRenderer.invoke('set-server-mode', mode),
    // App control
    quitApp: () => ipcRenderer.invoke('quit-app'),
    // Version & updates
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    getUpdateInfo: () => ipcRenderer.invoke('get-update-info')
});
