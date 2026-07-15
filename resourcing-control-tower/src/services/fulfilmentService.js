export async function getFulfilmentData() {
  if (!window.fulfilmentBridge?.getFulfilmentData) {
    throw new Error('Electron fulfilment bridge is unavailable. Run the app through Electron.');
  }

  return window.fulfilmentBridge.getFulfilmentData();
}

export async function selectFulfilmentExcelFile() {
  if (!window.fulfilmentBridge?.selectFulfilmentExcelFile) {
    throw new Error('Electron fulfilment file picker is unavailable. Run the app through Electron.');
  }

  return window.fulfilmentBridge.selectFulfilmentExcelFile();
}

export async function exportFulfilmentSnapshot(payload) {
  if (!window.fulfilmentBridge?.exportFulfilmentSnapshot) {
    throw new Error('Electron fulfilment export bridge is unavailable. Run the app through Electron.');
  }

  return window.fulfilmentBridge.exportFulfilmentSnapshot(payload);
}

export async function draftHtmlEmail(payload) {
  if (!window.fulfilmentBridge?.draftHtmlEmail) {
    throw new Error('Electron HTML email draft bridge is unavailable. Run the app through Electron.');
  }

  return window.fulfilmentBridge.draftHtmlEmail(payload);
}
