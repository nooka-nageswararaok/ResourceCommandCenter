const DAY_MS = 24 * 60 * 60 * 1000;

const headerAliases = {
  empId: ['emp id', 'employee id', 'employee code', 'employee number', 'resource id', 'resource number', 'personal id', 'id'],
  employeeName: ['employee name', 'resource name', 'name', 'associate name'],
  band: ['band', 'grade'],
  subBand: ['sub band', 'subband', 'sub grade'],
  location: ['location', 'work location', 'base location', 'personnel subarea', 'country', 'onoff classification', 'onoffnearshore classification', 'onsite/offshore'],
  manager: ['manager', 'reporting manager', 'people manager', 'supervisor'],
  capability: ['hr l4', 'capability', 'practice', 'competency', 'department', 'project l1'],
  skills: ['skills', 'skill', 'primary skill', 'employee skill name', 'skill group sps', 'primary skill structure sps', 'technology'],
  skillCluster: ['skill cluster', 'skillcluster'],
  fresherClassification: ['fresherfcl lateral', 'fresher fcl lateral', 'fresher lateral', 'fresherflag'],
  projectName: ['project name', 'project', 'assignment name'],
  projectL4: ['project l4', 'project l4 org unit'],
  projectCode: ['project code', 'project id', 'wbs', 'engagement code'],
  wbsCode: ['wbs code', 'wbs', 'wbs element'],
  customer: ['customer', 'client', 'account'],
  pmName: ['pm name', 'pmname'],
  pmoComments: ['pmo comments', 'pmocomments'],
  billingStatus: ['billing status', 'billing', 'billability', 'status'],
  fte: ['fte'],
  allocationPct: ['allocation %', 'allocation pct', 'allocation percent', 'allocation'],
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

const parseFte = (value, allocationPct) => {
  const number = parseNumber(value);
  if (number > 0) return number;
  return allocationPct ? allocationPct / 100 : 0;
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
      skillCluster: readField(row, headerMap, 'skillCluster'),
      fresherClassification: readField(row, headerMap, 'fresherClassification'),
      skills: readField(row, headerMap, 'skills')
        .split(/[;,|]/)
        .map((skill) => skill.trim())
        .filter(Boolean)
    };

    const allocationPct = parseAllocationPct(readField(row, headerMap, 'allocationPct'));

    const assignment = {
      empId,
      projectName: readField(row, headerMap, 'projectName'),
      projectL4: readField(row, headerMap, 'projectL4'),
      projectCode: readField(row, headerMap, 'projectCode'),
      wbsCode,
      wbsCodeCategory,
      customer: readField(row, headerMap, 'customer') || 'Unassigned',
      pmName: readField(row, headerMap, 'pmName'),
      pmoComments: readField(row, headerMap, 'pmoComments'),
      billingStatus,
      allocationPct,
      fte: parseFte(readField(row, headerMap, 'fte'), allocationPct),
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

  const resources = records.map(({ projectName, projectL4, projectCode, wbsCode, wbsCodeCategory, customer, billingStatus, allocationPct, fte, assignmentStart, assignmentEnd, ...resource }) => resource);
  const assignments = records.map(({ employeeName, band, subBand, location, manager, capability, skillCluster, skills, daysToEnd, endRiskFlag, agingDays, benchFlag, id, ...assignment }) => assignment);

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
      matchesSelectedOption(filters.customer, record.customer) &&
      matchesSelectedOption(filters.project, record.projectName) &&
      matchesSelectedOption(filters.projectL4, record.projectL4) &&
      matchesSelectedOption(filters.pmName, record.pmName) &&
      matchesSelectedOption(filters.billingStatus, record.billingStatus) &&
      matchesSelectedOption(filters.wbsCodeCategory, record.wbsCodeCategory) &&
      matchesSelectedOption(filters.band, record.band) &&
      matchesSelectedOption(filters.location, record.location) &&
      matchesSelectedOption(filters.capability, record.capability) &&
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
      matchesSelectedOption(filters.customer, record.customer) &&
      matchesSelectedOption(filters.project, record.projectName) &&
      matchesSelectedOption(filters.projectL4, record.projectL4) &&
      matchesSelectedOption(filters.pmName, record.pmName) &&
      matchesSelectedOption(filters.location, record.location) &&
      matchesSelectedOption(filters.capability, record.capability)
    );
  });
}

export function buildKpis(records) {
  const totalHeadcount = sumFte(records);
  const billableCount = sumFte(records, (record) => record.billingStatus === 'Billable');
  const nonBillableCount = sumFte(records, (record) => ['Non Billable', 'Non-Billable'].includes(record.billingStatus));
  const utilizationPct = totalHeadcount ? Math.round(((totalHeadcount - nonBillableCount) / totalHeadcount) * 100) : 0;

  return {
    totalHeadcount,
    utilizationPct,
    billableCount,
    contractualShadowCount: sumFte(records, (record) => record.billingStatus === 'Contractual Shadow'),
    nonBillableCount,
    yCodeCount: sumFte(records, (record) => record.wbsCodeCategory === 'Y-Code'),
    cCodeCount: sumFte(records, (record) => record.wbsCodeCategory === 'C-Code'),
    fresherCount: sumFte(records, (record) => record.fresherFlag),
    endingThirtyDays: sumFte(records, (record) => record.endRiskFlag)
  };
}

export function groupCount(records, field) {
  const counts = records.reduce((acc, record) => {
    const key = record[field] || 'Unspecified';
    acc[key] = roundCount((acc[key] || 0) + Number(record.fte || 0));
    return acc;
  }, {});

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

const roundCount = (value) => Math.round(value * 100) / 100;

function sumFte(records, predicate = () => true) {
  return roundCount(records.reduce((sum, record) => sum + (predicate(record) ? Number(record.fte || 0) : 0), 0));
}

function utilizationFor(records) {
  const total = sumFte(records);
  const nonBillable = sumFte(records, (record) => record.billingStatus === 'Non Billable');
  return total ? Math.round(((total - nonBillable) / total) * 100) : 0;
}

export function buildLeadershipActions(records) {
  const actions = [];

  records.forEach((record) => {
    const owner = record.pmName || record.manager || 'Unassigned';
    const context = {
      empId: record.empId,
      employeeName: record.employeeName,
      pmName: owner,
      recordId: record.id,
      customer: record.customer,
      projectName: record.projectName,
      billingStatus: record.billingStatus,
      wbsCodeCategory: record.wbsCodeCategory,
      daysToEnd: record.daysToEnd,
      pmoComments: record.pmoComments || ''
    };

    if (typeof record.daysToEnd === 'number' && record.daysToEnd >= 0 && record.daysToEnd <= 15) {
      actions.push({
        id: `${record.id}-end-15`,
        priority: 'High',
        actionType: 'End Date Decision',
        recommendedAction: 'Confirm extension, replacement, or release decision',
        dueInDays: Math.max(record.daysToEnd, 0),
        ...context
      });
    } else if (typeof record.daysToEnd === 'number' && record.daysToEnd > 15 && record.daysToEnd <= 30) {
      actions.push({
        id: `${record.id}-end-30`,
        priority: 'Medium',
        actionType: 'End Date Follow-up',
        recommendedAction: 'Validate assignment continuity plan',
        dueInDays: record.daysToEnd,
        ...context
      });
    }

    if (record.billingStatus === 'Non Billable') {
      actions.push({
        id: `${record.id}-non-billable`,
        priority: record.agingDays > 30 ? 'High' : 'Medium',
        actionType: 'Non Billable Conversion',
        recommendedAction: 'Move to billable demand or approve bench plan',
        dueInDays: 7,
        ...context
      });
    }

    if (record.wbsCodeCategory === 'Y-Code' || record.wbsCodeCategory === 'C-Code') {
      actions.push({
        id: `${record.id}-wbs-code`,
        priority: record.wbsCodeCategory === 'Y-Code' ? 'High' : 'Medium',
        actionType: `${record.wbsCodeCategory} Review`,
        recommendedAction: 'Review code ageing and closure path',
        dueInDays: 7,
        ...context
      });
    }

  });

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueInDays - b.dueInDays);
}

export function buildPmAccountability(records) {
  const grouped = records.reduce((acc, record) => {
    const pmName = record.pmName || 'Unassigned';
    acc[pmName] = acc[pmName] || [];
    acc[pmName].push(record);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([pmName, pmRecords]) => {
      const kpis = buildKpis(pmRecords);
      return {
        id: pmName,
        pmName,
        headcount: sumFte(pmRecords),
        utilizationPct: utilizationFor(pmRecords),
        billableCount: kpis.billableCount,
        nonBillableCount: kpis.nonBillableCount,
        yCodeCount: kpis.yCodeCount,
        cCodeCount: kpis.cCodeCount,
        endingThirtyDays: kpis.endingThirtyDays,
        highPriorityActions: buildLeadershipActions(pmRecords).filter((action) => action.priority === 'High').length
      };
    })
    .sort((a, b) => b.highPriorityActions - a.highPriorityActions || b.nonBillableCount - a.nonBillableCount);
}
