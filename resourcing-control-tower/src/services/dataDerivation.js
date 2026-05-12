const DAY_MS = 24 * 60 * 60 * 1000;

const headerAliases = {
  empId: ['emp id', 'employee id', 'employee code', 'employee number', 'resource id', 'resource number', 'personal id', 'id'],
  employeeName: ['employee name', 'resource name', 'name', 'associate name'],
  band: ['band', 'grade'],
  subBand: ['sub band', 'subband', 'sub grade'],
  location: ['location', 'work location', 'base location', 'personnel subarea', 'country', 'onoff classification', 'onoffnearshore classification', 'onsite/offshore'],
  manager: ['manager', 'reporting manager', 'people manager', 'supervisor'],
  capability: ['hr l4', 'capability', 'practice', 'competency', 'department', 'project l1', 'skill cluster'],
  skills: ['skills', 'skill', 'primary skill', 'employee skill name', 'skill group sps', 'primary skill structure sps', 'technology'],
  fresherClassification: ['fresherfcl lateral', 'fresher fcl lateral', 'fresher lateral', 'fresherflag'],
  projectName: ['project name', 'project', 'assignment name'],
  projectCode: ['project code', 'project id', 'wbs', 'engagement code'],
  wbsCode: ['wbs code', 'wbs', 'wbs element'],
  customer: ['customer', 'client', 'account'],
  pmName: ['pm name', 'pmname'],
  pmoComments: ['pmo comments', 'pmocomments'],
  billingStatus: ['billing status', 'billing', 'billability', 'status'],
  allocationPct: ['allocation %', 'allocation pct', 'allocation percent', 'allocation', 'fte'],
  assignmentStart: ['assignment start', 'start date', 'project start date'],
  assignmentEnd: ['assignment end', 'end date', 'project end date', 'roll off date']
};

const normaliseHeader = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9% ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function buildHeaderMap(row) {
  const headers = Object.keys(row || {});
  return Object.entries(headerAliases).reduce((map, [field, aliases]) => {
    const exact = headers.find((header) => aliases.includes(normaliseHeader(header)));
    const fuzzy = headers.find((header) =>
      aliases.some((alias) => normaliseHeader(header).includes(alias) || alias.includes(normaliseHeader(header)))
    );
    map[field] = exact || fuzzy || null;
    return map;
  }, {});
}

const readField = (row, headerMap, field) => {
  const header = headerMap[field];
  const value = header ? row[header] : '';
  return value == null ? '' : String(value).trim();
};

const parseNumber = (value) => {
  const number = Number(String(value || '').replace('%', '').trim());
  return Number.isFinite(number) ? number : 0;
};

const parseAllocationPct = (value) => {
  const number = parseNumber(value);
  if (number > 0 && number <= 1) {
    return Math.round(number * 100);
  }
  return number;
};

export function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;

  const [, first, second, yearText] = match;
  const year = yearText.length === 2 ? Number(`20${yearText}`) : Number(yearText);
  const dayFirst = Number(first) > 12;
  const month = dayFirst ? Number(second) - 1 : Number(first) - 1;
  const day = dayFirst ? Number(first) : Number(second);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function canonicalBillingStatus(value) {
  const status = String(value || '').trim();
  const compact = status.toLowerCase().replace(/[^a-z]/g, '');

  if (compact === 'b') return 'Billable';
  if (compact === 'c') return 'Contractual Shadow';
  if (compact === 'n') return 'Non Billable';
  if (compact.includes('non') || compact.includes('bench')) return 'Non Billable';
  if (compact.includes('contract')) return 'Contractual Shadow';
  if (compact.includes('bill')) return 'Billable';

  return status || 'Unspecified';
}

function deriveWbsCodeCategory(value) {
  const firstLetter = String(value || '').trim().charAt(0).toUpperCase();
  if (firstLetter === 'Y') return 'Y-Code';
  if (firstLetter === 'C') return 'C-Code';
  return 'Other';
}

export function isBenchStatus(status, wbsCodeCategory) {
  return ['Non Billable', 'Non-Billable'].includes(canonicalBillingStatus(status)) || ['Y-Code', 'C-Code'].includes(wbsCodeCategory);
}

function isFresher(value) {
  return String(value || '').trim().toLowerCase().startsWith('fresher');
}

export function normalizeCsvRows(rows = []) {
  if (!rows.length) {
    return { resources: [], assignments: [], records: [] };
  }

  const headerMap = buildHeaderMap(rows[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const records = rows.map((row, index) => {
    const assignmentEnd = parseDate(readField(row, headerMap, 'assignmentEnd'));
    const assignmentStart = parseDate(readField(row, headerMap, 'assignmentStart'));
    const daysToEnd = assignmentEnd ? Math.ceil((assignmentEnd.getTime() - today.getTime()) / DAY_MS) : null;
    const billingStatus = canonicalBillingStatus(readField(row, headerMap, 'billingStatus'));
    const wbsCode = readField(row, headerMap, 'wbsCode');
    const wbsCodeCategory = deriveWbsCodeCategory(wbsCode);
    const agingDays = assignmentStart ? Math.max(0, Math.floor((today.getTime() - assignmentStart.getTime()) / DAY_MS)) : 0;
    const empId = readField(row, headerMap, 'empId') || `ROW-${index + 1}`;

    const resource = {
      empId,
      employeeName: readField(row, headerMap, 'employeeName') || 'Unnamed Resource',
      band: readField(row, headerMap, 'band'),
      subBand: readField(row, headerMap, 'subBand'),
      location: readField(row, headerMap, 'location'),
      manager: readField(row, headerMap, 'manager'),
      capability: readField(row, headerMap, 'capability'),
      fresherClassification: readField(row, headerMap, 'fresherClassification'),
      skills: readField(row, headerMap, 'skills')
        .split(/[;,|]/)
        .map((skill) => skill.trim())
        .filter(Boolean)
    };

    const assignment = {
      empId,
      projectName: readField(row, headerMap, 'projectName'),
      projectCode: readField(row, headerMap, 'projectCode'),
      wbsCode,
      wbsCodeCategory,
      customer: readField(row, headerMap, 'customer') || 'Unassigned',
      pmName: readField(row, headerMap, 'pmName'),
      pmoComments: readField(row, headerMap, 'pmoComments'),
      billingStatus,
      allocationPct: parseAllocationPct(readField(row, headerMap, 'allocationPct')),
      assignmentStart,
      assignmentEnd
    };

    return {
      id: `${empId}-${index}`,
      ...resource,
      ...assignment,
      daysToEnd,
      endRiskFlag: typeof daysToEnd === 'number' && daysToEnd <= 30 && daysToEnd >= 0,
      agingDays,
      fresherFlag: isFresher(resource.fresherClassification),
      benchFlag: isBenchStatus(billingStatus, wbsCodeCategory)
    };
  });

  const resources = records.map(({ projectName, projectCode, wbsCode, wbsCodeCategory, customer, billingStatus, allocationPct, assignmentStart, assignmentEnd, ...resource }) => resource);
  const assignments = records.map(({ employeeName, band, subBand, location, manager, capability, skills, daysToEnd, endRiskFlag, agingDays, benchFlag, id, ...assignment }) => assignment);

  return { resources, assignments, records };
}

export function getUniqueOptions(records, field) {
  return [...new Set(records.map((record) => record[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function matchesSelectedOption(selected, value) {
  if (Array.isArray(selected)) {
    return selected.length === 0 || selected.includes(value);
  }
  return !selected || value === selected;
}

export function applyResourceFilters(records, filters) {
  const search = filters.search.trim().toLowerCase();
  return records.filter((record) => {
    const matchesSearch =
      !search ||
      record.employeeName.toLowerCase().includes(search) ||
      record.empId.toLowerCase().includes(search);

    return (
      matchesSearch &&
      (!filters.customer || record.customer === filters.customer) &&
      (!filters.project || record.projectName === filters.project) &&
      matchesSelectedOption(filters.pmName, record.pmName) &&
      (!filters.billingStatus || record.billingStatus === filters.billingStatus) &&
      (!filters.wbsCodeCategory || record.wbsCodeCategory === filters.wbsCodeCategory) &&
      (!filters.band || record.band === filters.band) &&
      (!filters.location || record.location === filters.location) &&
      (!filters.fresherOnly || record.fresherFlag)
    );
  });
}

export function applyQuickFilters(records, filters) {
  const search = (filters.search || '').trim().toLowerCase();
  return records.filter((record) => {
    const matchesSearch =
      !search ||
      record.employeeName.toLowerCase().includes(search) ||
      record.empId.toLowerCase().includes(search);

    return (
      matchesSearch &&
      (!filters.customer || record.customer === filters.customer) &&
      (!filters.project || record.projectName === filters.project) &&
      matchesSelectedOption(filters.pmName, record.pmName) &&
      (!filters.location || record.location === filters.location)
    );
  });
}

export function buildKpis(records) {
  const totalHeadcount = new Set(records.map((record) => record.empId)).size;
  const billableCount = records.filter((record) => record.billingStatus === 'Billable').length;
  const nonBillableCount = records.filter((record) => ['Non Billable', 'Non-Billable'].includes(record.billingStatus)).length;
  const utilizationPct = totalHeadcount ? Math.round(((totalHeadcount - nonBillableCount) / totalHeadcount) * 100) : 0;

  return {
    totalHeadcount,
    utilizationPct,
    billableCount,
    contractualShadowCount: records.filter((record) => record.billingStatus === 'Contractual Shadow').length,
    nonBillableCount,
    yCodeCount: records.filter((record) => record.wbsCodeCategory === 'Y-Code').length,
    cCodeCount: records.filter((record) => record.wbsCodeCategory === 'C-Code').length,
    fresherCount: records.filter((record) => record.fresherFlag).length,
    endingThirtyDays: records.filter((record) => record.endRiskFlag).length
  };
}

export function groupCount(records, field) {
  const counts = records.reduce((acc, record) => {
    const key = record[field] || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}
