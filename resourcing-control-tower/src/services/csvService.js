export async function getResourceData() {
  if (!window.resourceBridge?.getResourceData) {
    throw new Error('Electron resource data bridge is unavailable. Run the app through Electron.');
  }

  return window.resourceBridge.getResourceData();
}

export async function selectExcelFile() {
  if (!window.resourceBridge?.selectExcelFile) {
    throw new Error('Electron Excel file picker is unavailable. Run the app through Electron.');
  }

  return window.resourceBridge.selectExcelFile();
}
