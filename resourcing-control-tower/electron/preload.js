const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resourceBridge', {
  getResourceData: () => ipcRenderer.invoke('resource:getData'),
  selectExcelFile: () => ipcRenderer.invoke('resource:selectExcel')
});
