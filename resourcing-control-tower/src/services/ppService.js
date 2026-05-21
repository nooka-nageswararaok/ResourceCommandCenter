export async function getPpData() {
  if (!window.ppBridge?.getPpData) {
    throw new Error('Electron PP Analysis bridge is unavailable. Run the app through Electron.');
  }

  return window.ppBridge.getPpData();
}

export async function selectPpExcelFile() {
  if (!window.ppBridge?.selectPpExcelFile) {
    throw new Error('Electron PP Analysis file picker is unavailable. Run the app through Electron.');
  }

  return window.ppBridge.selectPpExcelFile();
}

export async function exportPpAnalysis(payload) {
  if (!window.ppBridge?.exportPpAnalysis) {
    throw new Error('Electron PP Analysis export bridge is unavailable. Run the app through Electron.');
  }

  return window.ppBridge.exportPpAnalysis(payload);
}
