export async function getRfsData(options = {}) {
  if (!window.rfsBridge?.getRfsData) {
    throw new Error('Electron RFS Tracker bridge is unavailable. Run the app through Electron.');
  }

  return window.rfsBridge.getRfsData(options);
}

export async function selectRfsExcelFile(options = {}) {
  if (!window.rfsBridge?.selectRfsExcelFile) {
    throw new Error('Electron RFS Tracker file picker is unavailable. Run the app through Electron.');
  }

  return window.rfsBridge.selectRfsExcelFile(options);
}

export async function exportRfsSummary(payload) {
  if (!window.rfsBridge?.exportRfsSummary) {
    throw new Error('Electron RFS export bridge is unavailable. Run the app through Electron.');
  }

  return window.rfsBridge.exportRfsSummary(payload);
}
