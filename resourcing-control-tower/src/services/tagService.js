export async function getTagData() {
  if (!window.tagBridge?.getTagData) {
    throw new Error('Electron TAG bridge is unavailable. Run the app through Electron.');
  }

  return window.tagBridge.getTagData();
}

export async function selectTagExcelFile() {
  if (!window.tagBridge?.selectTagExcelFile) {
    throw new Error('Electron TAG file picker is unavailable. Run the app through Electron.');
  }

  return window.tagBridge.selectTagExcelFile();
}
