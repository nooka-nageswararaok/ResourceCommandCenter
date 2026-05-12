const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const RESOURCE_CHANNEL = 'resource:getData';
const SELECT_RESOURCE_CHANNEL = 'resource:selectExcel';
const RESOURCE_WORKBOOK_NAME = 'Resource_Data.xlsx';
const SETTINGS_FILE_NAME = 'settings.json';

let activeWorkbookPath = null;

function getSettingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
}

function loadSelectedWorkbookPath() {
  if (activeWorkbookPath) return activeWorkbookPath;

  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) return null;
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    activeWorkbookPath = settings.selectedWorkbookPath || null;
    return activeWorkbookPath;
  } catch {
    return null;
  }
}

function saveSelectedWorkbookPath(filePath) {
  activeWorkbookPath = filePath;
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify({ selectedWorkbookPath: filePath }, null, 2));
}

function resolveWorkbookPath() {
  const selectedWorkbookPath = loadSelectedWorkbookPath();
  if (selectedWorkbookPath && fs.existsSync(selectedWorkbookPath)) {
    return selectedWorkbookPath;
  }

  const candidates = [
    path.join(__dirname, '..', 'data', RESOURCE_WORKBOOK_NAME),
    path.join(process.cwd(), 'data', RESOURCE_WORKBOOK_NAME),
    path.join(path.dirname(process.execPath), 'data', RESOURCE_WORKBOOK_NAME),
    path.join(process.resourcesPath || '', 'data', RESOURCE_WORKBOOK_NAME)
  ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || candidates[0];
}

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    dateNF: 'yyyy-mm-dd'
  });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`No worksheets found in ${path.basename(filePath)}`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
    blankrows: false
  });

  return { rows, sheetName };
}

async function getResourceData() {
  const workbookPath = resolveWorkbookPath();
  const dataFolder = path.dirname(workbookPath);

  if (!fs.existsSync(workbookPath)) {
    return {
      rows: [],
      fileName: RESOURCE_WORKBOOK_NAME,
      filePath: workbookPath,
      dataFolder,
      sheetName: null,
      refreshedAt: new Date().toISOString(),
      warning: `Excel input file not found: ${workbookPath}`
    };
  }

  const { rows, sheetName } = parseWorkbook(workbookPath);
  return {
    rows,
    fileName: path.basename(workbookPath),
    filePath: workbookPath,
    dataFolder,
    sheetName,
    refreshedAt: new Date().toISOString()
  };
}

async function selectExcelFile(event) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Choose resource Excel file',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Workbooks', extensions: ['xlsx', 'xls', 'xlsm'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  saveSelectedWorkbookPath(result.filePaths[0]);
  return getResourceData();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f7f8fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle(RESOURCE_CHANNEL, getResourceData);
  ipcMain.handle(SELECT_RESOURCE_CHANNEL, selectExcelFile);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
