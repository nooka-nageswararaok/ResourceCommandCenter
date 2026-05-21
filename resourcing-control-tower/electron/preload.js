const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resourceBridge', {
  getResourceData: () => ipcRenderer.invoke('resource:getData'),
  selectExcelFile: () => ipcRenderer.invoke('resource:selectExcel'),
  exportWeeklySnapshot: (payload) => ipcRenderer.invoke('resource:exportSnapshot', payload)
});

contextBridge.exposeInMainWorld('ppBridge', {
  getPpData: () => ipcRenderer.invoke('pp:getData'),
  selectPpExcelFile: () => ipcRenderer.invoke('pp:selectExcel'),
  exportPpAnalysis: (payload) => ipcRenderer.invoke('pp:exportAnalysis', payload)
});

contextBridge.exposeInMainWorld('rfsBridge', {
  getRfsData: (options) => ipcRenderer.invoke('rfs:getData', options),
  selectRfsExcelFile: (options) => ipcRenderer.invoke('rfs:selectExcel', options),
  exportRfsSummary: (payload) => ipcRenderer.invoke('rfs:exportSummary', payload)
});

contextBridge.exposeInMainWorld('fulfilmentBridge', {
  getFulfilmentData: () => ipcRenderer.invoke('fulfilment:getData'),
  selectFulfilmentExcelFile: () => ipcRenderer.invoke('fulfilment:selectExcel'),
  exportFulfilmentSnapshot: (payload) => ipcRenderer.invoke('fulfilment:exportSnapshot', payload)
});

contextBridge.exposeInMainWorld('commentsBridge', {
  getCommentsData: () => ipcRenderer.invoke('comments:getData'),
  saveResourceComment: (payload) => ipcRenderer.invoke('comments:saveResource', payload),
  savePpComment: (payload) => ipcRenderer.invoke('comments:savePp', payload)
});
