const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
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
const COMMENTS_CHANNEL = 'comments:getData';
const SAVE_RESOURCE_COMMENT_CHANNEL = 'comments:saveResource';
const SAVE_PP_COMMENT_CHANNEL = 'comments:savePp';
const RESOURCE_WORKBOOK_NAME = 'Resource_Data.xlsx';
const PP_WORKBOOK_PATH = "C:\\Users\\nooka.nageswararaok\\Downloads\\Final_MEGA Financial Trend FY'26 @FX27 Rates_IND.xlsb";
const RFS_WORKBOOK_PATH = "C:\\Users\\nooka.nageswararaok\\OneDrive - HCL TECHNOLOGIES LIMITED\\Documents\\Nagesh\\Engagements\\PP Report\\RFS Tracker - FY'27 (10).xlsb";
const FULFILMENT_WORKBOOK_PATH = "C:\\Users\\nooka.nageswararaok\\Downloads\\ERS VDU MEGA IND Digital Engg1 - SR Tracker-FY'25 - L2 report - 2026-05-15T170414.642.xlsx";
const STAGE_CLASSIFICATION_PATH = "C:\\Users\\nooka.nageswararaok\\Downloads\\Stage_Classification.xlsx";
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

function normalizePpRows(rows) {
  return rows.map((row, index) => ({
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
    totalProjectExpenses: toNumber(row['Total Project Expenses']),
    totalGfte: toNumber(row['Total GFTE']),
    totalAfte: toNumber(row['Total AFTE']),
    totalBfte: toNumber(row['Total BFTE'])
  }));
}

function parsePpWorkbook(filePath) {
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
  if (selectedWorkbookPath && fs.existsSync(selectedWorkbookPath)) {
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
  const sheetName = 'Active SR';
  const candidateSheetName = 'Candidate Tracker';
  const fulfilmentDetailsSheetName = 'Fulfillment Details 2025&2026';
  const workbook = XLSX.readFile(filePath, {
    dense: true,
    cellDates: false,
    sheets: [sheetName, candidateSheetName, fulfilmentDetailsSheetName],
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
    blankrows: false
  });
  const headerRow = aoa.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('customer') && headers.includes('status');
  });

  if (headerRow < 0) {
    throw new Error(`Unable to find Active SR header row in ${path.basename(filePath)}`);
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
        offshoreOnsite: String(getRowValue(rowObject, values, headerIndex, ['Offshore/Onsite', 'Offshore Onsite'], 12) || '').trim(),
        customer: String(getRowValue(rowObject, values, headerIndex, ['Customer'], 0) || '').trim(),
        legacyJobReqId: String(getRowValue(rowObject, values, headerIndex, ['Legacy Job Req Id', 'Legacy Job Req ID'], 5) || '').trim(),
        demandId: String(getRowValue(rowObject, values, headerIndex, ['Job Requisition ID/Demand ID', 'Job Requisition ID', 'Demand ID'], 6) || '').trim(),
        role: String(getRowValue(rowObject, values, headerIndex, ['Role'], 11) || '').trim(),
        prioritywise: String(getRowValue(rowObject, values, headerIndex, ['Prioritywise', 'Priority'], 13) || '').trim(),
        location: String(getRowValue(rowObject, values, headerIndex, ['Location'], 29) || '').trim(),
        band: String(getRowValue(rowObject, values, headerIndex, ['Band'], 34) || '').trim(),
        reqDate: String(getRowValue(rowObject, values, headerIndex, ['Req Date'], 26) || '').trim(),
        demandMonth: toMonthLabel(
          getRowValue(rowObject, values, headerIndex, ['Req Date'], 26) ||
          getRowValue(rowObject, values, headerIndex, ['TRF Requested Date'], 27)
        ),
        totalPositions: toNumber(getRowValue(rowObject, values, headerIndex, ['Actionable Position', 'Total Positions'], 33)),
        remainingPositions: toNumber(getRowValue(rowObject, values, headerIndex, ['Balance Positions', 'Remaining Positions'], 15)),
        agingDays: toNumber(getRowValue(rowObject, values, headerIndex, ['Aging', 'Aging in Days'], 14)),
        profilesReceived: toNumber(getRowValue(rowObject, values, headerIndex, ['Profiles Received', '# Profiles Received'], 17)),
        tp1Selected: toNumber(getRowValue(rowObject, values, headerIndex, ['TP-1 Selected', '# TP-1 Selected'], 18)),
        tp2ClientSelected: toNumber(getRowValue(rowObject, values, headerIndex, ['TP-2/Client Selected', '# TP-2/Client Selected'], 20)),
        tp3ClientSelected: toNumber(getRowValue(rowObject, values, headerIndex, ['TP-3/Client Selected', '# TP-3/Client Selected'], 21)),
        onboarded: toNumber(getRowValue(rowObject, values, headerIndex, ['Onboarded', '# Onboarded'], 23)),
        renege: toNumber(getRowValue(rowObject, values, headerIndex, ['Renege', '# Renege'], 24)),
        pm: String(getRowValue(rowObject, values, headerIndex, ['PM'], 1) || '').trim(),
        billingLoss: String(getRowValue(rowObject, values, headerIndex, ['Billing Loss'], 41) || '').trim(),
        cuMapping: String(getRowValue(rowObject, values, headerIndex, ['CU Mapping'], 43) || '').trim()
      };
    });

  const candidateRows = parseCandidateTrackerSheet(workbook.Sheets[candidateSheetName]);
  const fulfilmentDetailRows = parseFulfilmentDetailsSheet(workbook.Sheets[fulfilmentDetailsSheetName]);

  return { rows, sheetName, candidateRows, candidateSheetName, fulfilmentDetailRows, fulfilmentDetailsSheetName };
}

function parseStageClassificationWorkbook(filePath = STAGE_CLASSIFICATION_PATH) {
  const emptyClassification = {
    sourceFileName: path.basename(filePath),
    filePath,
    sheetName: 'Resourcing',
    groups: [],
    stages: []
  };

  if (!filePath || !fs.existsSync(filePath)) {
    return emptyClassification;
  }

  const workbook = XLSX.readFile(filePath, {
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
    sheetName,
    groups,
    stages
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
        count: toNumber(getRowValue(rowObject, values, headerIndex, ['Count'], 9)),
        dm: String(getRowValue(rowObject, values, headerIndex, ['DM'], 10) || '').trim(),
        comments: String(getRowValue(rowObject, values, headerIndex, ['Comments'], 11) || '').trim(),
        laptopCollectedLocation: String(getRowValue(rowObject, values, headerIndex, ['Laptop Collected Location'], 12) || '').trim()
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

function resolvePpWorkbookPath() {
  const selectedWorkbookPath = loadSelectedPpWorkbookPath();
  if (selectedWorkbookPath && fs.existsSync(selectedWorkbookPath)) {
    return selectedWorkbookPath;
  }

  return PP_WORKBOOK_PATH;
}

async function getPpData() {
  const workbookPath = resolvePpWorkbookPath();

  if (!fs.existsSync(workbookPath)) {
    return {
      rows: [],
      fileName: path.basename(PP_WORKBOOK_PATH),
      filePath: workbookPath,
      sheetName: null,
      refreshedAt: new Date().toISOString(),
      warning: `PP Analysis input file not found: ${workbookPath}`
    };
  }

  const { rows, sheetName } = parsePpWorkbook(workbookPath);
  return {
    rows,
    fileName: path.basename(workbookPath),
    filePath: workbookPath,
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

  if (!fs.existsSync(workbookPath)) {
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

  const parsed = parseRfsWorkbook(workbookPath, quarterConfig.quarter);
  return {
    ...parsed,
    fileName: path.basename(workbookPath),
    filePath: workbookPath,
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
  if (selectedWorkbookPath && fs.existsSync(selectedWorkbookPath)) {
    return selectedWorkbookPath;
  }

  return FULFILMENT_WORKBOOK_PATH;
}

async function getFulfilmentData() {
  const workbookPath = resolveFulfilmentWorkbookPath();
  const stageClassification = parseStageClassificationWorkbook();

  if (!workbookPath || !fs.existsSync(workbookPath)) {
    return {
      activeDemandRows: [],
      candidateRows: [],
      fulfilmentDetailRows: [],
      stageClassification,
      fileName: path.basename(FULFILMENT_WORKBOOK_PATH),
      filePath: workbookPath || '',
      sheetName: 'Active SR',
      candidateSheetName: 'Candidate Tracker',
      fulfilmentDetailsSheetName: 'Fulfillment Details 2025&2026',
      refreshedAt: new Date().toISOString(),
      warning: `Fulfilment input workbook not found: ${workbookPath || FULFILMENT_WORKBOOK_PATH}`
    };
  }

  const { rows, sheetName, candidateRows, candidateSheetName, fulfilmentDetailRows, fulfilmentDetailsSheetName } = parseFulfilmentWorkbook(workbookPath);
  return {
    activeDemandRows: rows,
    candidateRows,
    fulfilmentDetailRows,
    stageClassification,
    fileName: path.basename(workbookPath),
    filePath: workbookPath,
    sheetName,
    candidateSheetName,
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

async function exportRfsSummary(event, payload) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save RFS summary',
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
