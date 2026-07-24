const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { StringDecoder } = require('string_decoder');
const zlib = require('zlib');
const XLSX = require('xlsx');

const RESOURCE_CHANNEL = 'resource:getData';
const SELECT_RESOURCE_CHANNEL = 'resource:selectExcel';
const EXPORT_SNAPSHOT_CHANNEL = 'resource:exportSnapshot';
const PP_CHANNEL = 'pp:getData';
const SELECT_PP_CHANNEL = 'pp:selectExcel';
const EXPORT_PP_CHANNEL = 'pp:exportAnalysis';
const RFS_CHANNEL = 'rfs:getData';
const SELECT_RFS_CHANNEL = 'rfs:selectExcel';
const EXPORT_RFS_CHANNEL = 'rfs:exportSummary';
const FULFILMENT_CHANNEL = 'fulfilment:getData';
const SELECT_FULFILMENT_CHANNEL = 'fulfilment:selectExcel';
const EXPORT_FULFILMENT_CHANNEL = 'fulfilment:exportSnapshot';
const TAG_CHANNEL = 'tag:getData';
const SELECT_TAG_CHANNEL = 'tag:selectExcel';
const DRAFT_HTML_EMAIL_CHANNEL = 'email:draftHtml';
const COMMENTS_CHANNEL = 'comments:getData';
const SAVE_RESOURCE_COMMENT_CHANNEL = 'comments:saveResource';
const SAVE_PP_COMMENT_CHANNEL = 'comments:savePp';
const RESOURCE_WORKBOOK_NAME = 'Resource_Data.xlsx';
const PP_WORKBOOK_PATH = "C:\\Users\\nooka.nageswararaok\\Downloads\\Final_MEGA Financial Trend FY'26 @FX27 Rates_IND.xlsb";
const RFS_WORKBOOK_PATH = "C:\\Users\\nooka.nageswararaok\\OneDrive - HCL TECHNOLOGIES LIMITED\\Documents\\Nagesh\\Engagements\\PP Report\\RFS Tracker - FY'27 (10).xlsb";
const FULFILMENT_WORKBOOK_PATH = "C:\\Users\\nooka.nageswararaok\\Downloads\\ERS VDU MEGA IND Digital Engg1 - SR Tracker-FY'25 - L2 report - 2026-05-15T170414.642.xlsx";
const TAG_WORKBOOK_PATH = "C:\\Users\\nooka.nageswararaok\\Downloads\\FTE GEO_Demand vs. Supply Report_17-Jun'26 v1.xlsb";
const STAGE_CLASSIFICATION_WORKBOOK_NAME = 'Stage_Classification.xlsx';
const FULFILMENT_SOURCE_SHEET_NAME = 'SF Datadump';
const FULFILMENT_CANDIDATE_SHEET_NAME = 'Candidate Tracker';
const FULFILMENT_DEMAND_MASTER_SHEET_NAME = 'Demand Master';
const FULFILMENT_DETAILS_SHEET_NAME = 'Fulfillment Details 2025&2026';
const SETTINGS_FILE_NAME = 'settings.json';
const COMMENTS_FILE_NAME = 'comments.json';
const APP_USER_MODEL_ID = 'com.resourcing.controltower';
const APP_ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');
const RFS_QUARTERS = {
  AMJ: {
    sourceSheetName: 'base data-AMJ26',
    outputSheetName: 'RFS Summary AMJ26',
    months: [
      { key: 'apr', label: 'APR', firmHeader: 'Apr Firm', mpHeader: 'Apr MP' },
      { key: 'may', label: 'MAY', firmHeader: 'May Firm', mpHeader: 'May MP' },
      { key: 'jun', label: 'JUN', firmHeader: 'Jun Firm', mpHeader: 'Jun MP' }
    ]
  },
  JAS: {
    sourceSheetName: 'base data-JAS26',
    outputSheetName: 'RFS Summary JAS26',
    months: [
      { key: 'jul', label: 'JUL', firmHeader: 'Jul Firm', mpHeader: 'Jul MP' },
      { key: 'aug', label: 'AUG', firmHeader: 'Aug Firm', mpHeader: 'Aug MP' },
      { key: 'sep', label: 'SEP', firmHeader: 'Sep Firm', mpHeader: 'Sep MP' }
    ]
  },
  OND: {
    sourceSheetName: 'base data-OND26',
    outputSheetName: 'RFS Summary OND26',
    months: [
      { key: 'oct', label: 'OCT', firmHeader: 'Oct Firm', mpHeader: 'Oct MP' },
      { key: 'nov', label: 'NOV', firmHeader: 'Nov Firm', mpHeader: 'Nov MP' },
      { key: 'dec', label: 'DEC', firmHeader: 'Dec Firm', mpHeader: 'Dec MP' }
    ]
  },
  JFM: {
    sourceSheetName: 'base data-JFM27',
    outputSheetName: 'RFS Summary JFM27',
    months: [
      { key: 'jan', label: 'JAN', firmHeader: 'Jan Firm', mpHeader: 'Jan MP' },
      { key: 'feb', label: 'FEB', firmHeader: 'Feb Firm', mpHeader: 'Feb MP' },
      { key: 'mar', label: 'MAR', firmHeader: 'Mar Firm', mpHeader: 'Mar MP' }
    ]
  }
};

let activeWorkbookPath = null;
let activePpWorkbookPath = null;
let activeRfsWorkbookPath = null;
let activeFulfilmentWorkbookPath = null;
let activeTagWorkbookPath = null;

function getSettingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
}

function getCommentsPath() {
  return path.join(app.getPath('userData'), COMMENTS_FILE_NAME);
}

function loadSelectedWorkbookPath() {
  if (activeWorkbookPath) return activeWorkbookPath;

  try {
    const settings = loadSettings();
    activeWorkbookPath = settings.selectedWorkbookPath || null;
    return activeWorkbookPath;
  } catch {
    return null;
  }
}

function loadSettings() {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) return {};
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

function saveSettings(nextSettings) {
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify({ ...loadSettings(), ...nextSettings }, null, 2));
}

function loadComments() {
  const commentsPath = getCommentsPath();
  if (!fs.existsSync(commentsPath)) return { resource: {}, pp: {} };
  try {
    return { resource: {}, pp: {}, ...JSON.parse(fs.readFileSync(commentsPath, 'utf8')) };
  } catch {
    return { resource: {}, pp: {} };
  }
}

function saveComments(nextComments) {
  fs.mkdirSync(path.dirname(getCommentsPath()), { recursive: true });
  fs.writeFileSync(getCommentsPath(), JSON.stringify(nextComments, null, 2));
}

async function getCommentsData() {
  return loadComments();
}

async function saveComment(section, payload = {}) {
  const key = String(payload.key || '').trim();
  if (!key) return loadComments();

  const comments = loadComments();
  comments[section] = comments[section] || {};
  comments[section][key] = String(payload.value || '');
  saveComments(comments);
  return comments;
}

function saveSelectedWorkbookPath(filePath) {
  activeWorkbookPath = filePath;
  saveSettings({ selectedWorkbookPath: filePath });
}

function loadSelectedPpWorkbookPath() {
  if (activePpWorkbookPath) return activePpWorkbookPath;

  try {
    const settings = loadSettings();
    activePpWorkbookPath = settings.selectedPpWorkbookPath || null;
    return activePpWorkbookPath;
  } catch {
    return null;
  }
}

function saveSelectedPpWorkbookPath(filePath) {
  activePpWorkbookPath = filePath;
  saveSettings({ selectedPpWorkbookPath: filePath });
}

function loadSelectedRfsWorkbookPath() {
  if (activeRfsWorkbookPath) return activeRfsWorkbookPath;

  try {
    const settings = loadSettings();
    activeRfsWorkbookPath = settings.selectedRfsWorkbookPath || null;
    return activeRfsWorkbookPath;
  } catch {
    return null;
  }
}

function saveSelectedRfsWorkbookPath(filePath) {
  activeRfsWorkbookPath = filePath;
  saveSettings({ selectedRfsWorkbookPath: filePath });
}

function loadSelectedFulfilmentWorkbookPath() {
  if (activeFulfilmentWorkbookPath) return activeFulfilmentWorkbookPath;

  try {
    const settings = loadSettings();
    activeFulfilmentWorkbookPath = settings.selectedFulfilmentWorkbookPath || null;
    return activeFulfilmentWorkbookPath;
  } catch {
    return null;
  }
}

function saveSelectedFulfilmentWorkbookPath(filePath) {
  activeFulfilmentWorkbookPath = filePath;
  saveSettings({ selectedFulfilmentWorkbookPath: filePath });
}

function loadSelectedTagWorkbookPath() {
  if (activeTagWorkbookPath) return activeTagWorkbookPath;

  try {
    const settings = loadSettings();
    activeTagWorkbookPath = settings.selectedTagWorkbookPath || null;
    return activeTagWorkbookPath;
  } catch {
    return null;
  }
}

function saveSelectedTagWorkbookPath(filePath) {
  activeTagWorkbookPath = filePath;
  saveSettings({ selectedTagWorkbookPath: filePath });
}

function getWorkbookCacheDir() {
  return path.join(app.getPath('userData'), 'workbook-cache');
}

function isSharePointUrl(filePath) {
  return /^https?:\/\//i.test(String(filePath || '')) || /^sharepoint:\/\//i.test(String(filePath || ''));
}

function safeFileName(value) {
  return String(value || 'workbook')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function getCachedWorkbookSettingKey(moduleKey) {
  return `${moduleKey}CachedWorkbookPath`;
}

function getWorkbookReadErrorMessage(filePath, error) {
  if (isSharePointUrl(filePath)) {
    return 'Please select the synced local file path, not the SharePoint web URL.';
  }

  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');
  if (['EBUSY', 'EPERM', 'EACCES'].includes(code) || /busy|access|permission|locked|being used/i.test(message)) {
    return 'The workbook is locked by another application or still syncing. Close Excel/allow sync to finish and retry.';
  }

  if (['ENOENT', 'ENOTDIR'].includes(code)) {
    return `Excel input file not found: ${filePath}`;
  }

  return 'The selected SharePoint/OneDrive file is not available offline. Please right-click the file and choose "Always keep on this device", then refresh.';
}

function prepareWorkbookForRead(sourcePath, moduleKey) {
  if (!sourcePath) {
    throw new Error('No Excel workbook path was provided.');
  }
  if (isSharePointUrl(sourcePath)) {
    throw new Error('Please select the synced local file path, not the SharePoint web URL.');
  }
  if (!fs.existsSync(sourcePath)) {
    const error = new Error(`Excel input file not found: ${sourcePath}`);
    error.code = 'ENOENT';
    throw error;
  }

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(sourcePath);
  } catch (error) {
    throw new Error(getWorkbookReadErrorMessage(sourcePath, error));
  }

  const cacheDir = getWorkbookCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  const extension = path.extname(sourcePath) || '.xlsx';
  const baseName = safeFileName(path.basename(sourcePath, extension));
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const cachedPath = path.join(cacheDir, `${safeFileName(moduleKey)}_${stamp}_${baseName}${extension}`);
  fs.writeFileSync(cachedPath, fileBuffer);
  saveSettings({ [getCachedWorkbookSettingKey(moduleKey)]: cachedPath });

  return {
    sourcePath,
    cachedPath,
    fileName: path.basename(sourcePath),
    cachedFileName: path.basename(cachedPath)
  };
}

function resolveWorkbookPath() {
  const selectedWorkbookPath = loadSelectedWorkbookPath();
  if (selectedWorkbookPath && (isSharePointUrl(selectedWorkbookPath) || fs.existsSync(selectedWorkbookPath))) {
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

function resolveStageClassificationWorkbookPath() {
  const candidates = [
    path.join(__dirname, '..', 'data', STAGE_CLASSIFICATION_WORKBOOK_NAME),
    path.join(process.cwd(), 'data', STAGE_CLASSIFICATION_WORKBOOK_NAME),
    path.join(path.dirname(process.execPath), 'data', STAGE_CLASSIFICATION_WORKBOOK_NAME),
    path.join(process.resourcesPath || '', 'data', STAGE_CLASSIFICATION_WORKBOOK_NAME)
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

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/\((.*)\)/, '-$1')
    .trim();
  if (!cleaned || /^-+$/.test(cleaned)) return 0;
  return Number(cleaned) || 0;
}

function toMonthLabel(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const text = String(value || '').trim();
    return /^[A-Za-z]{3}[' -]?\d{2,4}$/.test(text) ? text : '';
  }
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = String(date.getFullYear()).slice(-2);
  return `${month}'${year}`;
}

function normalizeHeaderName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getPpSourceValue(row, aliases = []) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }

  const normalizedAliases = aliases.map(normalizeHeaderName);
  const matchingKey = Object.keys(row).find((key) => normalizedAliases.includes(normalizeHeaderName(key)));
  return matchingKey ? row[matchingKey] : '';
}

function normalizePpRow(row, index) {
  const projectExpenses = getPpSourceValue(row, ['Total Project Expenses', 'Project Expenses']);

  return {
    id: index + 1,
    l4Mapping: row['L4 mapping'] || row['Project  L4 org unit'] || '',
    l3Mapping: row['L3 mapping'] || row['Project L3 Org. Unit'] || '',
    customerCode: row['Customer code'] || '',
    customerName: row['Customer name'] || '',
    customerGrouping: row['Customer grouping'] || '',
    componentGroup: row['Component Group'] || '',
    revisedComponentGroup: row['Revised Component Group'] || '',
    projectCode: row.Project || '',
    projectName: row.Project_5 || '',
    projectType: row['Project Type'] || '',
    majorProjectCategory: row['Major Proj Cat'] || row['Major Proj. Category'] || '',
    costElement: row['Cost Element_6'] || row['Cost Element'] || '',
    mode: row.Mode_9 || row.Mode || '',
    month: row.Month || '',
    quarter: row.Qtr || '',
    fiscal: row.Fiscal || '',
    offshoreOnsite: row['OFF/ON/Nearshore'] || '',
    l2Pm: row['L2-PM'] || '',
    l3Pm: row['L3-PM'] || '',
    l4Pm: row['L4-PM'] || '',
    totalRevenue: toNumber(row['Total Revenue']),
    revisedDrc: toNumber(row['Revised DRC']),
    revisedGm: toNumber(row['Revised GM']),
    totalProjectExpenses: toNumber(projectExpenses),
    badDepts: toNumber(getPpSourceValue(row, ['Bad Depts', 'Bad depts', 'Bad Debts', 'Bad debts', 'Bad Debt', 'Bad debt'])),
    totalGfte: toNumber(row['Total GFTE']),
    totalAfte: toNumber(row['Total AFTE']),
    totalBfte: toNumber(row['Total BFTE'])
  };
}

function normalizePpRows(rows) {
  return rows.map((row, index) => normalizePpRow(row, index));
}

function xmlDecode(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getXmlAttribute(xml, attributeName) {
  const match = new RegExp(`${attributeName}="([^"]*)"`).exec(xml);
  return match ? xmlDecode(match[1]) : '';
}

function findZipEntry(filePath, entryName) {
  const stat = fs.statSync(filePath);
  const tailLength = Math.min(stat.size, 1024 * 128);
  const fd = fs.openSync(filePath, 'r');
  try {
    const tail = Buffer.alloc(tailLength);
    fs.readSync(fd, tail, 0, tailLength, stat.size - tailLength);

    let eocdOffset = -1;
    for (let index = tailLength - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === 0x06054b50) {
        eocdOffset = stat.size - tailLength + index;
        break;
      }
    }

    if (eocdOffset < 0) {
      throw new Error('Unable to locate XLSX ZIP directory.');
    }

    const eocd = Buffer.alloc(22);
    fs.readSync(fd, eocd, 0, 22, eocdOffset);
    const centralDirectorySize = eocd.readUInt32LE(12);
    const centralDirectoryOffset = eocd.readUInt32LE(16);
    const centralDirectory = Buffer.alloc(centralDirectorySize);
    fs.readSync(fd, centralDirectory, 0, centralDirectorySize, centralDirectoryOffset);

    let offset = 0;
    while (offset < centralDirectory.length) {
      if (centralDirectory.readUInt32LE(offset) !== 0x02014b50) break;

      const compressionMethod = centralDirectory.readUInt16LE(offset + 10);
      const compressedSize = centralDirectory.readUInt32LE(offset + 20);
      const uncompressedSize = centralDirectory.readUInt32LE(offset + 24);
      const fileNameLength = centralDirectory.readUInt16LE(offset + 28);
      const extraLength = centralDirectory.readUInt16LE(offset + 30);
      const commentLength = centralDirectory.readUInt16LE(offset + 32);
      const localHeaderOffset = centralDirectory.readUInt32LE(offset + 42);
      const fileName = centralDirectory.toString('utf8', offset + 46, offset + 46 + fileNameLength);

      if (fileName === entryName) {
        const localHeader = Buffer.alloc(30);
        fs.readSync(fd, localHeader, 0, 30, localHeaderOffset);
        if (localHeader.readUInt32LE(0) !== 0x04034b50) {
          throw new Error(`Invalid XLSX ZIP local header for ${entryName}.`);
        }

        const localNameLength = localHeader.readUInt16LE(26);
        const localExtraLength = localHeader.readUInt16LE(28);
        return {
          entryName,
          compressionMethod,
          compressedSize,
          uncompressedSize,
          dataOffset: localHeaderOffset + 30 + localNameLength + localExtraLength
        };
      }

      offset += 46 + fileNameLength + extraLength + commentLength;
    }
  } finally {
    fs.closeSync(fd);
  }

  return null;
}

function openZipEntryStream(filePath, entryName) {
  const entry = findZipEntry(filePath, entryName);
  if (!entry) {
    throw new Error(`XLSX entry not found: ${entryName}`);
  }

  const source = fs.createReadStream(filePath, {
    start: entry.dataOffset,
    end: entry.dataOffset + entry.compressedSize - 1
  });

  if (entry.compressionMethod === 0) return source;
  if (entry.compressionMethod === 8) return source.pipe(zlib.createInflateRaw());
  throw new Error(`Unsupported XLSX ZIP compression method ${entry.compressionMethod} for ${entryName}.`);
}

function readZipEntryText(filePath, entryName) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = openZipEntryStream(filePath, entryName);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function getXlsxPartPath(basePart, target) {
  const normalizedTarget = String(target || '').replace(/\\/g, '/');
  if (normalizedTarget.startsWith('/')) return normalizedTarget.replace(/^\/+/, '');

  const baseFolder = basePart.includes('/') ? basePart.slice(0, basePart.lastIndexOf('/')) : '';
  const parts = `${baseFolder}/${normalizedTarget}`.split('/');
  const resolved = [];
  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  });
  return resolved.join('/');
}

function parseWorkbookRelationships(relsXml) {
  const rels = {};
  const relationshipRegex = /<Relationship\b[^>]*>/g;
  let match;
  while ((match = relationshipRegex.exec(relsXml))) {
    const xml = match[0];
    const id = getXmlAttribute(xml, 'Id');
    const target = getXmlAttribute(xml, 'Target');
    if (id && target) rels[id] = target;
  }
  return rels;
}

function parseWorkbookSheets(workbookXml) {
  const sheets = [];
  const sheetRegex = /<sheet\b[^>]*>/g;
  let match;
  while ((match = sheetRegex.exec(workbookXml))) {
    const xml = match[0];
    sheets.push({
      name: getXmlAttribute(xml, 'name'),
      relationshipId: getXmlAttribute(xml, 'r:id')
    });
  }
  return sheets;
}

function extractTextNodes(xml) {
  const values = [];
  const textRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match;
  while ((match = textRegex.exec(xml))) {
    values.push(xmlDecode(match[1]));
  }
  return values.join('');
}

async function readXlsxSharedStrings(filePath) {
  if (!findZipEntry(filePath, 'xl/sharedStrings.xml')) return [];

  const sharedStringsXml = await readZipEntryText(filePath, 'xl/sharedStrings.xml');
  const sharedStrings = [];
  const itemRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = itemRegex.exec(sharedStringsXml))) {
    sharedStrings.push(extractTextNodes(match[1]));
  }
  return sharedStrings;
}

function columnLettersToIndex(letters) {
  let index = 0;
  String(letters || '').toUpperCase().split('').forEach((letter) => {
    index = index * 26 + letter.charCodeAt(0) - 64;
  });
  return index - 1;
}

function getCellColumnIndex(cellXml) {
  const reference = getXmlAttribute(cellXml, 'r');
  const columnMatch = /^([A-Z]+)/i.exec(reference);
  return columnMatch ? columnLettersToIndex(columnMatch[1]) : -1;
}

function extractXlsxCellValue(cellXml, sharedStrings) {
  const type = getXmlAttribute(cellXml, 't');

  if (type === 'inlineStr') {
    return extractTextNodes(cellXml);
  }

  const valueMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellXml);
  if (!valueMatch) return '';

  const rawValue = xmlDecode(valueMatch[1]);
  if (type === 's') return sharedStrings[Number(rawValue)] || '';
  if (type === 'b') return rawValue === '1' ? 'TRUE' : 'FALSE';
  return rawValue;
}

function parseXlsxRow(rowXml, sharedStrings) {
  const row = [];
  const cellRegex = /<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/g;
  let match;
  while ((match = cellRegex.exec(rowXml))) {
    const columnIndex = getCellColumnIndex(match[0]);
    if (columnIndex >= 0) {
      row[columnIndex] = extractXlsxCellValue(match[0], sharedStrings);
    }
  }
  return row;
}

function getHeaderName(headers, index) {
  return String(headers[index] || '').trim();
}

function rowArrayToObject(headers, values) {
  const row = {};
  values.forEach((value, index) => {
    const header = getHeaderName(headers, index);
    if (header) row[header] = value ?? '';
  });
  return row;
}

async function parseLargeXlsxPpBaseWorkbook(filePath) {
  const workbookXml = await readZipEntryText(filePath, 'xl/workbook.xml');
  const relsXml = await readZipEntryText(filePath, 'xl/_rels/workbook.xml.rels');
  const relationships = parseWorkbookRelationships(relsXml);
  const sheets = parseWorkbookSheets(workbookXml);
  const baseSheet = sheets.find((sheet) => sheet.name === 'Base') || sheets[0];

  if (!baseSheet?.relationshipId || !relationships[baseSheet.relationshipId]) {
    throw new Error(`No readable Base worksheet found in ${path.basename(filePath)}`);
  }

  const sheetEntryName = getXlsxPartPath('xl/workbook.xml', relationships[baseSheet.relationshipId]);
  const sharedStrings = await readXlsxSharedStrings(filePath);
  const rows = [];
  let headers = null;
  let buffer = '';
  let rowIndex = 0;
  const decoder = new StringDecoder('utf8');

  await new Promise((resolve, reject) => {
    const stream = openZipEntryStream(filePath, sheetEntryName);

    stream.on('data', (chunk) => {
      buffer += decoder.write(chunk);

      let rowEnd = buffer.indexOf('</row>');
      while (rowEnd >= 0) {
        const rowStart = buffer.lastIndexOf('<row', rowEnd);
        if (rowStart < 0) {
          buffer = buffer.slice(rowEnd + 6);
          rowEnd = buffer.indexOf('</row>');
          continue;
        }

        const rowXml = buffer.slice(rowStart, rowEnd + 6);
        buffer = buffer.slice(rowEnd + 6);
        const values = parseXlsxRow(rowXml, sharedStrings);

        if (!headers && values.some((value) => String(value || '').trim())) {
          headers = values.map((value) => String(value || '').trim());
        } else if (headers && values.some((value) => String(value || '').trim())) {
          rows.push(normalizePpRow(rowArrayToObject(headers, values), rowIndex));
          rowIndex += 1;
        }

        rowEnd = buffer.indexOf('</row>');
      }

      if (buffer.length > 1024 * 1024 * 4) {
        buffer = buffer.slice(-1024 * 1024);
      }
    });

    stream.on('error', reject);
    stream.on('end', () => {
      buffer += decoder.end();
      resolve();
    });
  });

  if (!headers) {
    throw new Error(`Unable to find PP Base header row in ${path.basename(filePath)}`);
  }

  return { rows, sheetName: baseSheet.name };
}

async function parsePpWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, {
    dense: true,
    cellDates: false,
    sheets: ['Base'],
    bookDeps: false,
    bookVBA: false,
    bookFiles: false
  });
  const sheetName = workbook.Sheets.Base ? 'Base' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    if (path.extname(filePath).toLowerCase() === '.xlsx' && workbook.SheetNames.includes('Base')) {
      return parseLargeXlsxPpBaseWorkbook(filePath);
    }
    throw new Error(`No worksheets found in ${path.basename(filePath)}`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
    blankrows: false
  });

  return { rows: normalizePpRows(rows), sheetName };
}

function resolveRfsWorkbookPath() {
  const selectedWorkbookPath = loadSelectedRfsWorkbookPath();
  if (selectedWorkbookPath && (isSharePointUrl(selectedWorkbookPath) || fs.existsSync(selectedWorkbookPath))) {
    return selectedWorkbookPath;
  }

  return RFS_WORKBOOK_PATH;
}

function getRfsQuarterConfig(quarter) {
  const quarterKey = String(quarter || 'AMJ').toUpperCase();
  return { quarter: RFS_QUARTERS[quarterKey] ? quarterKey : 'AMJ', ...(RFS_QUARTERS[quarterKey] || RFS_QUARTERS.AMJ) };
}

function parseRfsWorkbook(filePath, quarter = 'AMJ') {
  const quarterConfig = getRfsQuarterConfig(quarter);
  const { sourceSheetName, outputSheetName, months } = quarterConfig;
  const promptSheetName = 'RFS Summary Prompt';
  const workbook = XLSX.readFile(filePath, {
    dense: true,
    cellDates: false,
    sheets: [sourceSheetName, outputSheetName, promptSheetName],
    bookDeps: false,
    bookVBA: false,
    bookFiles: false
  });
  const worksheet = workbook.Sheets[sourceSheetName];

  if (!worksheet) {
    throw new Error(`Source worksheet not found: ${sourceSheetName}`);
  }

  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });
  const headerRow = aoa.findIndex((row) => row.includes('Project Status') && row.includes('Customer Group'));
  if (headerRow < 0) {
    throw new Error(`Unable to find RFS header row in ${sourceSheetName}`);
  }

  const headers = aoa[headerRow].map((header) => String(header || '').trim());
  const detailRows = aoa.slice(headerRow + 1).map((values, index) => {
    const row = Object.fromEntries(headers.map((header, colIndex) => [header, values[colIndex] ?? '']));
    const detail = {
      id: index + 1,
      l4Name: row['L4 NAME'] || '',
      projectStatus: row['Project Status'] || '',
      year: row.Year || row['Fiscal Year'] || row.FY || row['RFS Year'] || getRfsYearFromConfig(quarterConfig),
      customerName: row['Customer Name'] || '',
      customerGroup: row['Customer Group'] || '',
      projectCode: row['Project Code'] || '',
      projectName: row['Project Name'] || '',
      pm: row.PM || '',
      eeEnNn: row['EE/EN/NN'] || '',
      onOff: row['On/Off '] || row['On/Off'] || ''
    };
    months.forEach((month) => {
      detail[`${month.key}Firm`] = toNumber(row[month.firmHeader]);
      detail[`${month.key}Mp`] = toNumber(row[month.mpHeader]);
    });
    return detail;
  });
  const summaryMap = new Map();

  detailRows.forEach((row) => {
    if (String(row.projectStatus).trim().toLowerCase() !== 'active') return;
    const customerGroup = String(row.customerGroup || '').trim();
    if (!customerGroup) return;
    if (!summaryMap.has(customerGroup)) {
      const summary = {
        id: customerGroup,
        customerGroup,
        totalRfs: 0
      };
      months.forEach((month) => {
        summary[`${month.key}Rfs`] = 0;
      });
      summaryMap.set(customerGroup, summary);
    }
    const summary = summaryMap.get(customerGroup);
    months.forEach((month) => {
      summary[`${month.key}Rfs`] += Number(row[`${month.key}Firm`] || 0) + Number(row[`${month.key}Mp`] || 0);
    });
    summary.totalRfs = months.reduce((sum, month) => sum + Number(summary[`${month.key}Rfs`] || 0), 0);
  });

  const summaryRows = [...summaryMap.values()].sort((a, b) => a.customerGroup.localeCompare(b.customerGroup));
  const grandTotal = { id: 'grand-total', customerGroup: 'Grand Total', totalRfs: 0 };
  months.forEach((month) => {
    grandTotal[`${month.key}Rfs`] = 0;
  });
  summaryRows.forEach((row) => {
    months.forEach((month) => {
      grandTotal[`${month.key}Rfs`] += Number(row[`${month.key}Rfs`] || 0);
    });
    grandTotal.totalRfs += Number(row.totalRfs || 0);
  });
  const promptRows = workbook.Sheets[promptSheetName]
    ? XLSX.utils.sheet_to_json(workbook.Sheets[promptSheetName], { header: 1, defval: '', raw: false, blankrows: false })
    : [];

  return {
    quarter: quarterConfig.quarter,
    months,
    sourceSheetName,
    outputSheetName,
    promptSheetName,
    summaryRows,
    grandTotal,
    detailRows,
    promptRows
  };
}

function getRfsYearFromConfig(quarterConfig) {
  const sourceText = `${quarterConfig?.sourceSheetName || ''} ${quarterConfig?.outputSheetName || ''}`;
  const match = sourceText.match(/(?:FY)?'?(\d{2,4})\b/i);
  if (!match) return '';
  const year = match[1];
  return year.length === 2 ? `20${year}` : year;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getRowValue(rowObject, values, headerIndex, aliases, columnIndex) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(rowObject, alias)) {
      return rowObject[alias];
    }
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const index = headerIndex.get(normalizedAlias);
    if (index !== undefined) return values[index] ?? '';
  }

  return values[columnIndex] ?? '';
}

function parseFulfilmentWorkbook(filePath) {
  const sheetName = FULFILMENT_SOURCE_SHEET_NAME;
  const candidateSheetName = FULFILMENT_CANDIDATE_SHEET_NAME;
  const demandMasterSheetName = FULFILMENT_DEMAND_MASTER_SHEET_NAME;
  const fulfilmentDetailsSheetName = FULFILMENT_DETAILS_SHEET_NAME;
  const workbook = XLSX.readFile(filePath, {
    dense: true,
    cellDates: false,
    sheets: [sheetName, candidateSheetName, demandMasterSheetName, fulfilmentDetailsSheetName],
    bookDeps: false,
    bookVBA: false,
    bookFiles: false
  });
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Source worksheet not found: ${sheetName}`);
  }

  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: true
  });
  const headerRow = aoa.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('jobrequisitionid') && headers.includes('legacyjobreqid') && headers.includes('status');
  });

  if (headerRow < 0) {
    throw new Error(`Unable to find ${sheetName} header row in ${path.basename(filePath)}`);
  }

  const headers = aoa[headerRow].map((header) => String(header || '').trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const rows = aoa
    .slice(headerRow + 1)
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values, index) => {
      const rowObject = Object.fromEntries(headers.map((header, colIndex) => [header, values[colIndex] ?? '']));
      return {
        id: index + 1,
        status: String(getRowValue(rowObject, values, headerIndex, ['Status'], 2) || '').trim(),
        offshoreOnsite: String(getRowValue(rowObject, values, headerIndex, ['Onshore/Offshore'], 31) || '').trim(),
        customer: String(getRowValue(rowObject, values, headerIndex, ['Customer Name (AIS)', 'Customer'], 27) || '').trim(),
        legacyJobReqId: String(getRowValue(rowObject, values, headerIndex, ['Legacy Job Req Id'], 1) || '').trim(),
        demandId: String(getRowValue(rowObject, values, headerIndex, ['Job Requisition ID'], 0) || '').trim(),
        stageStatus: String(getRowValue(rowObject, values, headerIndex, ['StageStatus', 'Stage Status'], -1) || '').trim(),
        role: String(getRowValue(rowObject, values, headerIndex, ['Role Name (Demand Unit)'], 39) || '').trim(),
        skillCluster: String(getRowValue(rowObject, values, headerIndex, ['Skill Cluster', 'SkillCluster', 'Demand Skill Cluster', 'Skill Cluster (Demand Unit)'], -1) || '').trim(),
        projectL4: String(getRowValue(rowObject, values, headerIndex, ['Project L4'], 25) || '').trim(),
        prioritywise: '',
        location: String(getRowValue(rowObject, values, headerIndex, ['Personnel Sub Area Name'], 30) || '').trim(),
        band: String(getRowValue(rowObject, values, headerIndex, ['Demand Sub Band Name'], 36) || '').trim(),
        requestRequisitionType: String(getRowValue(rowObject, values, headerIndex, ['Request/Requisition Type', 'Request Requisition Type'], 33) || '').trim(),
        reqDate: String(getRowValue(rowObject, values, headerIndex, ['Date Created'], 14) || '').trim(),
        closedDate: String(getRowValue(rowObject, values, headerIndex, ['Closed_Date', 'Closed Date'], -1) || '').trim(),
        demandMonth: toMonthLabel(
          getRowValue(rowObject, values, headerIndex, ['Date Created'], 14)
        ),
        numberOfOpenings: toNumber(getRowValue(rowObject, values, headerIndex, ['Number of Openings'], -1)),
        totalPositions: toNumber(getRowValue(rowObject, values, headerIndex, ['Number of Openings'], -1)),
        remainingPositions: toNumber(getRowValue(rowObject, values, headerIndex, ['Actionable Position'], 63)),
        agingDays: toNumber(getRowValue(rowObject, values, headerIndex, ['Demand_Ageing_days'], 68)),
        profilesReceived: toNumber(getRowValue(rowObject, values, headerIndex, ['Profiles Received'], 75)),
        tp1Selected: toNumber(getRowValue(rowObject, values, headerIndex, ['TP-1 Selected'], 76)),
        tp2ClientSelected: toNumber(getRowValue(rowObject, values, headerIndex, ['TP-2/Client Selected'], 78)),
        tp3ClientSelected: toNumber(getRowValue(rowObject, values, headerIndex, ['TP-3/Client Selected'], 79)),
        onboarded: toNumber(getRowValue(rowObject, values, headerIndex, ['Onboarded'], 80)),
        renege: toNumber(getRowValue(rowObject, values, headerIndex, ['Renege'], 81)),
        pm: String(getRowValue(rowObject, values, headerIndex, ['Hiring Manager'], 3) || '').trim(),
        billingLoss: String(getRowValue(rowObject, values, headerIndex, ['Billing Loss flag'], 87) || '').trim(),
        billingLossValue: getRowValue(rowObject, values, headerIndex, ['Billing Loss'], 74) ?? '',
        cuMapping: String(getRowValue(rowObject, values, headerIndex, ['HR L4'], 13) || '').trim()
      };
    });

  const candidateRows = parseCandidateTrackerSheet(workbook.Sheets[candidateSheetName]);
  const demandMasterRows = parseDemandMasterSheet(workbook.Sheets[demandMasterSheetName]);
  const fulfilmentDetailRows = enrichFulfilmentDetails(
    parseFulfilmentDetailsSheet(workbook.Sheets[fulfilmentDetailsSheetName]),
    rows
  );

  return { rows, sheetName, candidateRows, candidateSheetName, demandMasterRows, demandMasterSheetName, fulfilmentDetailRows, fulfilmentDetailsSheetName };
}

function enrichFulfilmentDetails(fulfilmentRows, demandRows) {
  const demandByLegacyId = new Map();
  const demandByDemandId = new Map();

  demandRows.forEach((row) => {
    if (row.legacyJobReqId) demandByLegacyId.set(String(row.legacyJobReqId).trim(), row);
    if (row.demandId) demandByDemandId.set(String(row.demandId).trim(), row);
  });

  return fulfilmentRows.map((row) => {
    const demand = demandByLegacyId.get(String(row.sr || '').trim()) ||
      demandByDemandId.get(String(row.jobRequisitionId || '').trim()) ||
      {};

    return {
      ...row,
      customer: row.customer || demand.customer || '',
      projectL4: demand.projectL4 || '',
      hiringManager: demand.pm || '',
      cuMapping: demand.cuMapping || '',
      demandStatus: demand.status || '',
      demandId: demand.demandId || row.jobRequisitionId || '',
      legacyJobReqId: demand.legacyJobReqId || row.sr || ''
    };
  });
}

function parseStageClassificationWorkbook(filePath = resolveStageClassificationWorkbookPath()) {
  const emptyClassification = {
    sourceFileName: path.basename(filePath),
    filePath,
    cachedFilePath: '',
    sheetName: 'Resourcing',
    groups: [],
    stages: [],
    warning: ''
  };

  if (!filePath || !fs.existsSync(filePath)) {
    return emptyClassification;
  }

  let preparedWorkbook;
  try {
    preparedWorkbook = prepareWorkbookForRead(filePath, 'stage-classification');
  } catch (error) {
    return {
      ...emptyClassification,
      warning: error.message || getWorkbookReadErrorMessage(filePath, error)
    };
  }

  const workbook = XLSX.readFile(preparedWorkbook.cachedPath, {
    cellDates: false,
    bookDeps: false,
    bookVBA: false,
    bookFiles: false
  });
  const sheetName = workbook.SheetNames.includes('Resourcing') ? 'Resourcing' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return emptyClassification;

  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });
  const headerRow = aoa.findIndex((row) => row.map(normalizeHeader).includes('stakeholders'));
  if (headerRow < 0) return { ...emptyClassification, sheetName };

  const headers = aoa[headerRow].map((header) => String(header || '').trim());
  const stagePairs = [
    { group: cleanStageGroupName(headers[2] || 'Profile Sourcing'), stageIndex: 1, descriptionIndex: 2 },
    { group: cleanStageGroupName(headers[4] || 'TP1'), stageIndex: 3, descriptionIndex: 4 },
    { group: cleanStageGroupName(headers[6] || 'TP2'), stageIndex: 5, descriptionIndex: 6 },
    { group: cleanStageGroupName(headers[8] || 'Customer Feedback'), stageIndex: 7, descriptionIndex: 8 },
    { group: cleanStageGroupName(headers[10] || 'Onboarding'), stageIndex: 9, descriptionIndex: 10 }
  ];
  const groups = stagePairs.map((pair) => pair.group);
  const stages = [];
  let stakeholder = '';

  aoa.slice(headerRow + 1).forEach((row, rowIndex) => {
    const nextStakeholder = String(row[0] || '').trim();
    if (nextStakeholder) stakeholder = nextStakeholder;

    stagePairs.forEach((pair) => {
      const stage = String(row[pair.stageIndex] || '').trim();
      const description = String(row[pair.descriptionIndex] || '').trim();
      if (!stage && !description) return;
      stages.push({
        id: `${pair.group}-${stage || rowIndex + 1}`,
        stakeholder,
        spoc: getStageSpoc(description) || getStageSpoc(stakeholder),
        group: pair.group,
        stage,
        description
      });
    });
  });

  return {
    sourceFileName: path.basename(filePath),
    filePath,
    cachedFilePath: preparedWorkbook.cachedPath,
    sheetName,
    groups,
    stages,
    warning: ''
  };
}

function cleanStageGroupName(value) {
  const text = String(value || '').trim();
  if (/^profle\s+sourcing$/i.test(text)) return 'Profile Sourcing';
  return text;
}

function getStageSpoc(value) {
  const text = String(value || '').trim();
  const bracketMatch = text.match(/\[([^\]]+)\]/);
  const candidate = String(bracketMatch?.[1] || text).trim().toUpperCase();
  if (candidate.includes('TAG')) return 'TAG';
  if (candidate.includes('CU')) return 'CU';
  if (candidate.includes('DU')) return 'DU';
  return '';
}

function parseFulfilmentDetailsSheet(worksheet) {
  if (!worksheet) return [];

  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });
  const headerRow = aoa.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('month') && headers.includes('customer') && headers.includes('hiringmode');
  });

  if (headerRow < 0) return [];

  const headers = aoa[headerRow].map((header) => String(header || '').trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  return aoa
    .slice(headerRow + 1)
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values, index) => {
      const rowObject = Object.fromEntries(headers.map((header, colIndex) => [header, values[colIndex] ?? '']));
      return {
        id: index + 1,
        location: String(getRowValue(rowObject, values, headerIndex, ['Location'], 0) || '').trim(),
        sapId: String(getRowValue(rowObject, values, headerIndex, ['SAP ID'], 1) || '').trim(),
        candidateName: String(getRowValue(rowObject, values, headerIndex, ['Candidate Name'], 2) || '').trim(),
        hiringMode: String(getRowValue(rowObject, values, headerIndex, ['Hiring Mode'], 3) || '').trim(),
        joiningDate: String(getRowValue(rowObject, values, headerIndex, ['HCL Joining Date / FS Date', 'Joining Date'], 4) || '').trim(),
        month: String(getRowValue(rowObject, values, headerIndex, ['Month'], 5) || '').trim(),
        customer: String(getRowValue(rowObject, values, headerIndex, ['Customer'], 6) || '').trim(),
        sr: String(getRowValue(rowObject, values, headerIndex, ['SR#', 'SR'], 7) || '').trim(),
        psa: String(getRowValue(rowObject, values, headerIndex, ['PSA'], 8) || '').trim(),
        count: toNumber(getRowValue(rowObject, values, headerIndex, ['Count'], -1)) || 1,
        dm: String(getRowValue(rowObject, values, headerIndex, ['DM'], 10) || '').trim(),
        comments: String(getRowValue(rowObject, values, headerIndex, ['Comments'], 11) || '').trim(),
        jobRequisitionId: String(getRowValue(rowObject, values, headerIndex, ['Job Requisition ID'], 11) || '').trim(),
        laptopCollectedLocation: String(getRowValue(rowObject, values, headerIndex, ['Laptop Collected Location'], 12) || '').trim()
      };
    });
}

function parseDemandMasterSheet(worksheet) {
  if (!worksheet) return [];

  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });
  const headerRow = aoa.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((header) => [
      'legacyjobreqid',
      'jobrequisitionid',
      'demandid',
      'sr',
      'srno',
      'srnumber'
    ].includes(header));
  });

  if (headerRow < 0) return [];

  const headers = aoa[headerRow].map((header) => String(header || '').trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  return aoa
    .slice(headerRow + 1)
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values, index) => {
      const rowObject = Object.fromEntries(headers.map((header, colIndex) => [header, values[colIndex] ?? '']));
      return {
        id: index + 1,
        legacyJobReqId: String(getRowValue(rowObject, values, headerIndex, ['Legacy Job Req Id', 'Legacy Job Req ID', 'SR', 'SR#', 'SR No', 'SR Number'], -1) || '').trim(),
        demandId: String(getRowValue(rowObject, values, headerIndex, ['Job Requisition ID', 'Demand ID', 'DemandId', 'Job Req ID', 'JobReqId'], -1) || '').trim(),
        status: String(getRowValue(rowObject, values, headerIndex, ['Status', 'Demand Status'], -1) || '').trim(),
        customer: String(getRowValue(rowObject, values, headerIndex, ['Customer Name (AIS)', 'Customer'], -1) || '').trim()
      };
    });
}

function parseCandidateTrackerSheet(worksheet) {
  if (!worksheet) return [];

  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });
  const headerRow = aoa.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('sr') && headers.includes('candidatename');
  });

  if (headerRow < 0) return [];

  const headers = aoa[headerRow].map((header) => String(header || '').trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  return aoa
    .slice(headerRow + 1)
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values, index) => {
      const rowObject = Object.fromEntries(headers.map((header, colIndex) => [header, values[colIndex] ?? '']));
      return {
        id: index + 1,
        sr: String(getRowValue(rowObject, values, headerIndex, ['SR', 'Legacy Job Req Id', 'Legacy Job Req ID'], 1) || '').trim(),
        profileReceivedDate: String(getRowValue(rowObject, values, headerIndex, ['Profile Received Date'], 0) || '').trim(),
        skill: String(getRowValue(rowObject, values, headerIndex, ['Skill'], 2) || '').trim(),
        customer: String(getRowValue(rowObject, values, headerIndex, ['Customer'], 3) || '').trim(),
        candidateStatus: String(getRowValue(rowObject, values, headerIndex, ['Status'], 4) || '').trim(),
        sharedBy: String(getRowValue(rowObject, values, headerIndex, ['Shared_by', 'Shared By', 'Profile Shared By'], 5) || '').trim(),
        candidateName: String(getRowValue(rowObject, values, headerIndex, ['Candidate Name'], 8) || '').trim(),
        stageStatus: String(getRowValue(rowObject, values, headerIndex, ['StageStatus', 'Stage Status'], 9) || '').trim(),
        talentNavigatorScore: String(getRowValue(rowObject, values, headerIndex, ['Talent Navigator Score %', 'Talent Navigator Score'], 9) || '').trim(),
        externalInternal: String(getRowValue(rowObject, values, headerIndex, ['External/Internal'], 6) || '').trim(),
        sapId: String(getRowValue(rowObject, values, headerIndex, ['SAP ID'], 7) || '').trim(),
        screenStatus: String(getRowValue(rowObject, values, headerIndex, ['Screen Select/Screen Reject'], 10) || '').trim(),
        screenDate: String(getRowValue(rowObject, values, headerIndex, ['Screen Date'], 11) || '').trim(),
        tp1Status: String(getRowValue(rowObject, values, headerIndex, ['TP1 Status', 'TP-1 Status'], 12) || '').trim(),
        tp1Date: String(getRowValue(rowObject, values, headerIndex, ['TP-1 Date', 'TP1 Date'], 13) || '').trim(),
        tp2Status: String(getRowValue(rowObject, values, headerIndex, ['TP2 Status/ Client Interview-1', 'TP2 Status', 'TP-2 Status'], 14) || '').trim(),
        tp2Date: String(getRowValue(rowObject, values, headerIndex, ['TP2 Date / Customer Interview', 'TP-2 Date'], 15) || '').trim(),
        tp3Status: String(getRowValue(rowObject, values, headerIndex, ['TP3 Status / Customer Interview-2', 'TP3 Status', 'TP-3 Status'], 16) || '').trim(),
        tp3Date: String(getRowValue(rowObject, values, headerIndex, ['TP3 Date / Customer Interview', 'TP-3 Date'], 17) || '').trim(),
        profileSharedTp2: String(getRowValue(rowObject, values, headerIndex, ['Profile shared with Customer_TP-2 round', 'Profile shared with Customer TP-2 round'], 18) || '').trim(),
        profileSharedTp3: String(getRowValue(rowObject, values, headerIndex, ['Profile shared with Customer_TP-3 round', 'Profile shared with Customer TP-3 round'], 19) || '').trim(),
        tp2AgingDays: toNumber(getRowValue(rowObject, values, headerIndex, ['Aging of TP-2 round', 'TP-2 Aging', 'TP2 Aging'], 20)),
        tp3AgingDays: toNumber(getRowValue(rowObject, values, headerIndex, ['Aging of TP-3 round', 'TP-3 Aging', 'TP3 Aging'], 21)),
        offerStatus: String(getRowValue(rowObject, values, headerIndex, ['offer Status', 'Offer Status'], 22) || '').trim(),
        offerDate: String(getRowValue(rowObject, values, headerIndex, ['Offer Date', 'offer Date'], 24) || '').trim(),
        customerFeedbackDate: String(getRowValue(rowObject, values, headerIndex, ['Customer Feedback Date', 'Feedback Date'], 25) || '').trim(),
        onboardingDate: String(getRowValue(rowObject, values, headerIndex, ['Onboarding Date', 'Joining Date', 'HCL Joining Date'], 26) || '').trim(),
        stageDelayDays: toNumber(getRowValue(rowObject, values, headerIndex, ['Stage Delay', 'Stage Delay Days', 'Delay Days', 'Days in Stage', 'Current Stage Delay', 'Stage Aging', 'Stage Ageing', 'Aging in Current Stage'], 27)),
        comments: String(getRowValue(rowObject, values, headerIndex, ['Comments'], 23) || '').trim()
      };
    });
}

function parseHeaderedSheet(worksheet, requiredHeaders = []) {
  if (!worksheet) return { rows: [], sheetName: '' };

  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: true
  });
  const normalizedRequired = requiredHeaders.map(normalizeHeader);
  const headerRow = aoa.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return normalizedRequired.every((header) => headers.includes(header));
  });

  if (headerRow < 0) {
    return { rows: [], headers: [], headerIndex: new Map() };
  }

  const headers = aoa[headerRow].map((header) => String(header || '').trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const rows = aoa.slice(headerRow + 1).filter((values) => values.some((value) => String(value || '').trim()));
  return { rows, headers, headerIndex };
}

function getSheetValue(values, headerIndex, aliases) {
  for (const alias of aliases) {
    const index = headerIndex.get(normalizeHeader(alias));
    if (index !== undefined) return values[index] ?? '';
  }
  return '';
}

function toText(value) {
  return String(value ?? '').trim();
}

function buildCandidateName(values, headerIndex) {
  const explicitName = toText(getSheetValue(values, headerIndex, ['Candidate Name']));
  if (explicitName) return explicitName;
  return [
    getSheetValue(values, headerIndex, ['First Name (Application)']),
    getSheetValue(values, headerIndex, ['Middle Name']),
    getSheetValue(values, headerIndex, ['Last Name'])
  ].map(toText).filter(Boolean).join(' ');
}

function normalizeTagDemandRows(worksheet) {
  const parsed = parseHeaderedSheet(worksheet, ['Job Requisition ID', 'Legacy Job Req Id', 'LOB', 'Project L1']);
  return parsed.rows.map((values, index) => {
    const jobRequisitionId = toText(getSheetValue(values, parsed.headerIndex, ['Job Requisition ID']));
    const legacyJobReqId = toText(getSheetValue(values, parsed.headerIndex, ['Legacy Job Req Id']));
    return {
      id: `demand-${index + 1}`,
      jobRequisitionId,
      legacyJobReqId,
      demandKey: legacyJobReqId || jobRequisitionId || `demand-${index + 1}`,
      status: toText(getSheetValue(values, parsed.headerIndex, ['Status'])),
      lob: toText(getSheetValue(values, parsed.headerIndex, ['LOB'])),
      projectL1: toText(getSheetValue(values, parsed.headerIndex, ['Project L1'])),
      projectL4: toText(getSheetValue(values, parsed.headerIndex, ['Project L4'])),
      customer: toText(getSheetValue(values, parsed.headerIndex, ['Customer Name (AIS)', 'Customer'])),
      hiringManager: toText(getSheetValue(values, parsed.headerIndex, ['Hiring Manager'])),
      recruiter: toText(getSheetValue(values, parsed.headerIndex, ['Recruiter', 'Recuriter Code'])),
      geoTagLead: toText(getSheetValue(values, parsed.headerIndex, ['Geo Tag Lead'])),
      dateCreated: toText(getSheetValue(values, parsed.headerIndex, ['Date Created', 'Date  Created'])),
      tagAssignedDate: toText(getSheetValue(values, parsed.headerIndex, ['Tag Assigned Date', 'Tag assigned date'])),
      role: toText(getSheetValue(values, parsed.headerIndex, ['Role Name (Demand Unit)'])),
      skillCluster: toText(getSheetValue(values, parsed.headerIndex, ['Final Skill Cluster', 'Skill Classification Name'])),
      geo: toText(getSheetValue(values, parsed.headerIndex, ['GEO', 'Geo'])),
      offOn: toText(getSheetValue(values, parsed.headerIndex, ['Off/On', 'Onshore/Offshore', 'OFF/ON'])),
      hiringType: toText(getSheetValue(values, parsed.headerIndex, ['Hiring Type', 'Type Of Hires'])),
      demandCategorization: toText(getSheetValue(values, parsed.headerIndex, ['Demand Categorization'])),
      numberOfOpenings: toNumber(getSheetValue(values, parsed.headerIndex, ['Number of Openings'])),
      balancePositions: toNumber(getSheetValue(values, parsed.headerIndex, ['Balance Positions'])),
      actionablePositions: toNumber(getSheetValue(values, parsed.headerIndex, ['Actionable Position'])),
      offered: toNumber(getSheetValue(values, parsed.headerIndex, ['Offered'])),
      externalFulfilled: toNumber(getSheetValue(values, parsed.headerIndex, ['External Fulfilled'])),
      internalFulfilled: toNumber(getSheetValue(values, parsed.headerIndex, ['Internal Fulfilled'])),
      demandAgeingDays: toNumber(getSheetValue(values, parsed.headerIndex, ['Demand Ageing (days)', 'Demand_Ageing_days']))
    };
  });
}

function normalizeTagCandidateRows(worksheet, sheetName = 'Early Pipeline') {
  const parsed = parseHeaderedSheet(worksheet, ['Job Requisition ID', 'Legacy Job Req Id', 'LOB', 'Project L1']);
  return parsed.rows.map((values, index) => {
    const jobRequisitionId = toText(getSheetValue(values, parsed.headerIndex, ['Job Requisition ID']));
    const legacyJobReqId = toText(getSheetValue(values, parsed.headerIndex, ['Legacy Job Req Id']));
    return {
      id: `${safeFileName(sheetName)}-${index + 1}`,
      sourceSheet: sheetName,
      jobRequisitionId,
      legacyJobReqId,
      demandKey: legacyJobReqId || jobRequisitionId || `${safeFileName(sheetName)}-${index + 1}`,
      applicationId: toText(getSheetValue(values, parsed.headerIndex, ['Application ID'])),
      candidateId: toText(getSheetValue(values, parsed.headerIndex, ['Candidate ID'])),
      candidateName: buildCandidateName(values, parsed.headerIndex),
      applicationStatus: toText(getSheetValue(values, parsed.headerIndex, ['Application Status', 'Current Application Status', 'Status', 'New status', 'Joiner Stage'])),
      currentApplicationStatus: toText(getSheetValue(values, parsed.headerIndex, ['Current Application Status'])),
      source: toText(getSheetValue(values, parsed.headerIndex, ['source_details', 'source_custom', 'source', 'Source'])),
      sourceCategory: toText(getSheetValue(values, parsed.headerIndex, ['Source'])),
      recruiter: toText(getSheetValue(values, parsed.headerIndex, ['Recruiter', 'Recruiter User ID', 'Recruiter code'])),
      recruiterCode: toText(getSheetValue(values, parsed.headerIndex, ['Recruiter code', 'Recruiter User ID'])),
      tagLeadName: toText(getSheetValue(values, parsed.headerIndex, ['TAG Lead Name'])),
      customer: toText(getSheetValue(values, parsed.headerIndex, ['Customer'])),
      projectName: toText(getSheetValue(values, parsed.headerIndex, ['Project Name'])),
      projectCode: toText(getSheetValue(values, parsed.headerIndex, ['Project Code', 'Project code'])),
      lob: toText(getSheetValue(values, parsed.headerIndex, ['LOB'])),
      projectL1: toText(getSheetValue(values, parsed.headerIndex, ['Project L1'])),
      projectL4: toText(getSheetValue(values, parsed.headerIndex, ['Project L4'])),
      geo: toText(getSheetValue(values, parsed.headerIndex, ['GEO', 'Geo Location/Country', 'Country'])),
      offOn: toText(getSheetValue(values, parsed.headerIndex, ['OFF/ON', 'Off/On'])),
      hiringType: toText(getSheetValue(values, parsed.headerIndex, ['Hiring Type', 'Type of Hires'])),
      demandCategorization: toText(getSheetValue(values, parsed.headerIndex, ['Demand Categorization'])),
      role: toText(getSheetValue(values, parsed.headerIndex, ['Role Name (Demand Unit)'])),
      band: toText(getSheetValue(values, parsed.headerIndex, ['Band(Employee Sub group/Employment Type)', 'Employment Type Name'])),
      subBand: toText(getSheetValue(values, parsed.headerIndex, ['Sub Band'])),
      offerDate: toText(getSheetValue(values, parsed.headerIndex, ['Offer Date', 'Offer-Approved', 'Offer-Sent'])),
      joiningDate: toText(getSheetValue(values, parsed.headerIndex, ['Joining Date', 'Joined Date'])),
      hireDate: toText(getSheetValue(values, parsed.headerIndex, ['Hire Date', 'Hire  Date', 'Hired-On'])),
      tp1PanelName: toText(getSheetValue(values, parsed.headerIndex, ['TP1 Panel Name'])),
      tp1InterviewDate: toText(getSheetValue(values, parsed.headerIndex, ['TP1 Interview date'])),
      tp2PanelName: toText(getSheetValue(values, parsed.headerIndex, ['TP2 Panel Name'])),
      tp2InterviewDate: toText(getSheetValue(values, parsed.headerIndex, ['TP2 Interview date']))
    };
  });
}

function parseTagWorkbook(filePath) {
  const sheetNames = [
    'Demand data',
    'Early Pipeline',
    'MTD Offered',
    'MTD Renege',
    'MTD Declined',
    'Yet to Joiner',
    'Past Joiner',
    'Rejected'
  ];
  const workbook = XLSX.readFile(filePath, {
    dense: true,
    cellDates: false,
    sheets: sheetNames,
    bookDeps: false,
    bookVBA: false,
    bookFiles: false
  });

  const demandRows = normalizeTagDemandRows(workbook.Sheets['Demand data']);
  const earlyPipelineRows = normalizeTagCandidateRows(workbook.Sheets['Early Pipeline'], 'Early Pipeline');
  const outcomeRows = {
    offered: normalizeTagCandidateRows(workbook.Sheets['MTD Offered'], 'MTD Offered'),
    renege: normalizeTagCandidateRows(workbook.Sheets['MTD Renege'], 'MTD Renege'),
    declined: normalizeTagCandidateRows(workbook.Sheets['MTD Declined'], 'MTD Declined'),
    yetToJoin: normalizeTagCandidateRows(workbook.Sheets['Yet to Joiner'], 'Yet to Joiner'),
    pastJoiner: normalizeTagCandidateRows(workbook.Sheets['Past Joiner'], 'Past Joiner'),
    rejected: normalizeTagCandidateRows(workbook.Sheets.Rejected, 'Rejected')
  };

  return {
    demandSheetName: 'Demand data',
    earlyPipelineSheetName: 'Early Pipeline',
    outcomeSheetNames: {
      offered: 'MTD Offered',
      renege: 'MTD Renege',
      declined: 'MTD Declined',
      yetToJoin: 'Yet to Joiner',
      pastJoiner: 'Past Joiner',
      rejected: 'Rejected'
    },
    demandRows,
    earlyPipelineRows,
    outcomeRows
  };
}

async function getResourceData() {
  const workbookPath = resolveWorkbookPath();
  const dataFolder = path.dirname(workbookPath);

  if (!isSharePointUrl(workbookPath) && !fs.existsSync(workbookPath)) {
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

  let preparedWorkbook;
  try {
    preparedWorkbook = prepareWorkbookForRead(workbookPath, 'resource');
  } catch (error) {
    return {
      rows: [],
      fileName: path.basename(workbookPath),
      filePath: workbookPath,
      dataFolder,
      sheetName: null,
      refreshedAt: new Date().toISOString(),
      warning: error.message || getWorkbookReadErrorMessage(workbookPath, error)
    };
  }

  const { rows, sheetName } = parseWorkbook(preparedWorkbook.cachedPath);
  return {
    rows,
    fileName: preparedWorkbook.fileName,
    filePath: workbookPath,
    cachedFilePath: preparedWorkbook.cachedPath,
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

function resolvePpWorkbookPath() {
  const selectedWorkbookPath = loadSelectedPpWorkbookPath();
  if (selectedWorkbookPath && (isSharePointUrl(selectedWorkbookPath) || fs.existsSync(selectedWorkbookPath))) {
    return selectedWorkbookPath;
  }

  return PP_WORKBOOK_PATH;
}

async function getPpData() {
  const workbookPath = resolvePpWorkbookPath();

  if (!isSharePointUrl(workbookPath) && !fs.existsSync(workbookPath)) {
    return {
      rows: [],
      fileName: path.basename(PP_WORKBOOK_PATH),
      filePath: workbookPath,
      sheetName: null,
      refreshedAt: new Date().toISOString(),
      warning: `PP Analysis input file not found: ${workbookPath}`
    };
  }

  let preparedWorkbook;
  try {
    preparedWorkbook = prepareWorkbookForRead(workbookPath, 'pp');
  } catch (error) {
    return {
      rows: [],
      fileName: path.basename(workbookPath),
      filePath: workbookPath,
      sheetName: null,
      refreshedAt: new Date().toISOString(),
      warning: error.message || getWorkbookReadErrorMessage(workbookPath, error)
    };
  }

  const { rows, sheetName } = await parsePpWorkbook(preparedWorkbook.cachedPath);
  return {
    rows,
    fileName: preparedWorkbook.fileName,
    filePath: workbookPath,
    cachedFilePath: preparedWorkbook.cachedPath,
    sheetName,
    refreshedAt: new Date().toISOString()
  };
}

async function selectPpExcelFile(event) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Choose PP Analysis Excel file',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Workbooks', extensions: ['xlsb', 'xlsx', 'xls', 'xlsm'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  saveSelectedPpWorkbookPath(result.filePaths[0]);
  return getPpData();
}

async function getRfsData(event, options = {}) {
  const quarterConfig = getRfsQuarterConfig(options.quarter);
  const workbookPath = resolveRfsWorkbookPath();

  if (!isSharePointUrl(workbookPath) && !fs.existsSync(workbookPath)) {
    return {
      summaryRows: [],
      detailRows: [],
      promptRows: [],
      grandTotal: null,
      quarter: quarterConfig.quarter,
      months: quarterConfig.months,
      fileName: path.basename(RFS_WORKBOOK_PATH),
      filePath: workbookPath,
      sourceSheetName: null,
      outputSheetName: quarterConfig.outputSheetName,
      promptSheetName: 'RFS Summary Prompt',
      refreshedAt: new Date().toISOString(),
      warning: `RFS Tracker input file not found: ${workbookPath}`
    };
  }

  let preparedWorkbook;
  try {
    preparedWorkbook = prepareWorkbookForRead(workbookPath, 'rfs');
  } catch (error) {
    return {
      summaryRows: [],
      detailRows: [],
      promptRows: [],
      grandTotal: null,
      quarter: quarterConfig.quarter,
      months: quarterConfig.months,
      fileName: path.basename(workbookPath),
      filePath: workbookPath,
      sourceSheetName: null,
      outputSheetName: quarterConfig.outputSheetName,
      promptSheetName: 'RFS Summary Prompt',
      refreshedAt: new Date().toISOString(),
      warning: error.message || getWorkbookReadErrorMessage(workbookPath, error)
    };
  }

  const parsed = parseRfsWorkbook(preparedWorkbook.cachedPath, quarterConfig.quarter);
  return {
    ...parsed,
    fileName: preparedWorkbook.fileName,
    filePath: workbookPath,
    cachedFilePath: preparedWorkbook.cachedPath,
    refreshedAt: new Date().toISOString()
  };
}

async function selectRfsExcelFile(event, options = {}) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Choose RFS Tracker Excel file',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Workbooks', extensions: ['xlsb', 'xlsx', 'xls', 'xlsm'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  saveSelectedRfsWorkbookPath(result.filePaths[0]);
  return getRfsData(event, options);
}

function resolveFulfilmentWorkbookPath() {
  const selectedWorkbookPath = loadSelectedFulfilmentWorkbookPath();
  if (selectedWorkbookPath && (isSharePointUrl(selectedWorkbookPath) || fs.existsSync(selectedWorkbookPath))) {
    return selectedWorkbookPath;
  }

  return FULFILMENT_WORKBOOK_PATH;
}

async function getFulfilmentData() {
  const workbookPath = resolveFulfilmentWorkbookPath();
  const stageClassification = parseStageClassificationWorkbook();

  if (!workbookPath || (!isSharePointUrl(workbookPath) && !fs.existsSync(workbookPath))) {
    return {
      activeDemandRows: [],
      candidateRows: [],
      demandMasterRows: [],
      fulfilmentDetailRows: [],
      stageClassification,
      fileName: path.basename(FULFILMENT_WORKBOOK_PATH),
      filePath: workbookPath || '',
      sheetName: FULFILMENT_SOURCE_SHEET_NAME,
      candidateSheetName: FULFILMENT_CANDIDATE_SHEET_NAME,
      demandMasterSheetName: FULFILMENT_DEMAND_MASTER_SHEET_NAME,
      fulfilmentDetailsSheetName: FULFILMENT_DETAILS_SHEET_NAME,
      refreshedAt: new Date().toISOString(),
      warning: `Fulfilment input workbook not found: ${workbookPath || FULFILMENT_WORKBOOK_PATH}`
    };
  }

  let preparedWorkbook;
  try {
    preparedWorkbook = prepareWorkbookForRead(workbookPath, 'fulfilment');
  } catch (error) {
    return {
      activeDemandRows: [],
      candidateRows: [],
      demandMasterRows: [],
      fulfilmentDetailRows: [],
      stageClassification,
      fileName: path.basename(workbookPath),
      filePath: workbookPath,
      sheetName: FULFILMENT_SOURCE_SHEET_NAME,
      candidateSheetName: FULFILMENT_CANDIDATE_SHEET_NAME,
      demandMasterSheetName: FULFILMENT_DEMAND_MASTER_SHEET_NAME,
      fulfilmentDetailsSheetName: FULFILMENT_DETAILS_SHEET_NAME,
      refreshedAt: new Date().toISOString(),
      warning: error.message || getWorkbookReadErrorMessage(workbookPath, error)
    };
  }

  const { rows, sheetName, candidateRows, candidateSheetName, demandMasterRows, demandMasterSheetName, fulfilmentDetailRows, fulfilmentDetailsSheetName } = parseFulfilmentWorkbook(preparedWorkbook.cachedPath);
  return {
    activeDemandRows: rows,
    candidateRows,
    demandMasterRows,
    fulfilmentDetailRows,
    stageClassification,
    fileName: preparedWorkbook.fileName,
    filePath: workbookPath,
    cachedFilePath: preparedWorkbook.cachedPath,
    sheetName,
    candidateSheetName,
    demandMasterSheetName,
    fulfilmentDetailsSheetName,
    refreshedAt: new Date().toISOString()
  };
}

async function selectFulfilmentExcelFile(event) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Choose fulfilment Excel workbook',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Workbooks', extensions: ['xlsb', 'xlsx', 'xls', 'xlsm'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  saveSelectedFulfilmentWorkbookPath(result.filePaths[0]);
  return getFulfilmentData();
}

function resolveTagWorkbookPath() {
  const selectedWorkbookPath = loadSelectedTagWorkbookPath();
  if (selectedWorkbookPath && (isSharePointUrl(selectedWorkbookPath) || fs.existsSync(selectedWorkbookPath))) {
    return selectedWorkbookPath;
  }

  return TAG_WORKBOOK_PATH;
}

async function getTagData() {
  const workbookPath = resolveTagWorkbookPath();

  if (!workbookPath || (!isSharePointUrl(workbookPath) && !fs.existsSync(workbookPath))) {
    return {
      demandRows: [],
      earlyPipelineRows: [],
      outcomeRows: {
        offered: [],
        renege: [],
        declined: [],
        yetToJoin: [],
        pastJoiner: [],
        rejected: []
      },
      fileName: path.basename(TAG_WORKBOOK_PATH),
      filePath: workbookPath || '',
      demandSheetName: 'Demand data',
      earlyPipelineSheetName: 'Early Pipeline',
      refreshedAt: new Date().toISOString(),
      warning: `TAG input workbook not found: ${workbookPath || TAG_WORKBOOK_PATH}`
    };
  }

  let preparedWorkbook;
  try {
    preparedWorkbook = prepareWorkbookForRead(workbookPath, 'tag');
  } catch (error) {
    return {
      demandRows: [],
      earlyPipelineRows: [],
      outcomeRows: {
        offered: [],
        renege: [],
        declined: [],
        yetToJoin: [],
        pastJoiner: [],
        rejected: []
      },
      fileName: path.basename(workbookPath),
      filePath: workbookPath,
      demandSheetName: 'Demand data',
      earlyPipelineSheetName: 'Early Pipeline',
      refreshedAt: new Date().toISOString(),
      warning: error.message || getWorkbookReadErrorMessage(workbookPath, error)
    };
  }

  const parsed = parseTagWorkbook(preparedWorkbook.cachedPath);
  return {
    ...parsed,
    fileName: preparedWorkbook.fileName,
    filePath: workbookPath,
    cachedFilePath: preparedWorkbook.cachedPath,
    refreshedAt: new Date().toISOString()
  };
}

async function selectTagExcelFile(event) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Choose TAG demand and supply workbook',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Workbooks', extensions: ['xlsb', 'xlsx', 'xls', 'xlsm'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  saveSelectedTagWorkbookPath(result.filePaths[0]);
  return getTagData();
}

async function exportFulfilmentSnapshot(event, payload) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save fulfilment leadership snapshot',
    defaultPath: `Fulfilment_Leadership_Snapshot_${stamp}.xlsx`,
    filters: [
      { name: 'Excel Workbook', extensions: ['xlsx'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const workbook = XLSX.utils.book_new();
  Object.entries(payload.sheets || {}).forEach(([sheetName, rows]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows || []);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  });
  XLSX.writeFile(workbook, result.filePath);

  return { canceled: false, filePath: result.filePath };
}

function encodeMimeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ''), 'utf8').toString('base64')}?=`;
}

function chunkBase64(value) {
  return String(value || '').match(/.{1,76}/g)?.join('\r\n') || '';
}

async function draftHtmlEmail(_event, payload = {}) {
  const subject = String(payload.subject || 'Candidate Stage Status').trim() || 'Candidate Stage Status';
  const htmlBody = String(payload.htmlBody || '').trim();
  if (!htmlBody) {
    throw new Error('Email body is empty.');
  }

  const draftDir = path.join(app.getPath('temp'), 'ras-email-drafts');
  fs.mkdirSync(draftDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const draftPath = path.join(draftDir, `${stamp}_${safeFileName(subject)}.eml`);
  const eml = [
    'X-Unsent: 1',
    `Date: ${new Date().toUTCString()}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    chunkBase64(Buffer.from(htmlBody, 'utf8').toString('base64')),
    ''
  ].join('\r\n');

  fs.writeFileSync(draftPath, eml, 'utf8');
  const openError = await shell.openPath(draftPath);
  if (openError) {
    throw new Error(openError);
  }

  return { canceled: false, filePath: draftPath };
}

async function exportRfsSummary(event, payload) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save RFS workbook',
    defaultPath: `${payload.outputSheetName || 'RFS Summary AMJ26'}.xlsx`,
    filters: [
      { name: 'Excel Workbook', extensions: ['xlsx'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(payload.rows || []);
  XLSX.utils.book_append_sheet(workbook, worksheet, (payload.outputSheetName || 'RFS Summary AMJ26').slice(0, 31));
  if (Array.isArray(payload.detailRows) && payload.detailRows.length) {
    const detailWorksheet = XLSX.utils.json_to_sheet(payload.detailRows);
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Active Source Detail');
  }
  XLSX.writeFile(workbook, result.filePath);

  return { canceled: false, filePath: result.filePath };
}

async function exportPpAnalysis(event, payload) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save PP Report Analysis',
    defaultPath: `PP_Report_Analysis_${stamp}.xlsx`,
    filters: [
      { name: 'Excel Workbook', extensions: ['xlsx'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const workbook = XLSX.utils.book_new();
  Object.entries(payload.sheets || {}).forEach(([sheetName, rows]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows || []);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  });
  XLSX.writeFile(workbook, result.filePath);

  return { canceled: false, filePath: result.filePath };
}

async function exportWeeklySnapshot(event, payload) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save weekly resourcing snapshot',
    defaultPath: `Weekly_Resourcing_Snapshot_${stamp}.xlsx`,
    filters: [
      { name: 'Excel Workbook', extensions: ['xlsx'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const workbook = XLSX.utils.book_new();
  Object.entries(payload.sheets || {}).forEach(([sheetName, rows]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows || []);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  });
  XLSX.writeFile(workbook, result.filePath);

  return { canceled: false, filePath: result.filePath };
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f7f8fb',
    icon: APP_ICON_PATH,
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
  app.setAppUserModelId(APP_USER_MODEL_ID);
  ipcMain.handle(RESOURCE_CHANNEL, getResourceData);
  ipcMain.handle(SELECT_RESOURCE_CHANNEL, selectExcelFile);
  ipcMain.handle(EXPORT_SNAPSHOT_CHANNEL, exportWeeklySnapshot);
  ipcMain.handle(PP_CHANNEL, getPpData);
  ipcMain.handle(SELECT_PP_CHANNEL, selectPpExcelFile);
  ipcMain.handle(EXPORT_PP_CHANNEL, exportPpAnalysis);
  ipcMain.handle(RFS_CHANNEL, getRfsData);
  ipcMain.handle(SELECT_RFS_CHANNEL, selectRfsExcelFile);
  ipcMain.handle(EXPORT_RFS_CHANNEL, exportRfsSummary);
  ipcMain.handle(FULFILMENT_CHANNEL, getFulfilmentData);
  ipcMain.handle(SELECT_FULFILMENT_CHANNEL, selectFulfilmentExcelFile);
  ipcMain.handle(EXPORT_FULFILMENT_CHANNEL, exportFulfilmentSnapshot);
  ipcMain.handle(TAG_CHANNEL, getTagData);
  ipcMain.handle(SELECT_TAG_CHANNEL, selectTagExcelFile);
  ipcMain.handle(DRAFT_HTML_EMAIL_CHANNEL, draftHtmlEmail);
  ipcMain.handle(COMMENTS_CHANNEL, getCommentsData);
  ipcMain.handle(SAVE_RESOURCE_COMMENT_CHANNEL, (_event, payload) => saveComment('resource', payload));
  ipcMain.handle(SAVE_PP_COMMENT_CHANNEL, (_event, payload) => saveComment('pp', payload));
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
