const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const emptyPpFilters = {
  l4Mappings: [],
  customerGroupings: [],
  customerName: '',
  projectName: '',
  periodType: 'month',
  periodValue: '',
  month: '',
  fiscal: ''
};

export const PP_KPI_DEFINITIONS = [
  { key: 'totalRevenue', label: 'Total Revenue', digits: 0, kind: 'number' },
  { key: 'revisedDrc', label: 'Revised DRC', digits: 0, kind: 'number' },
  { key: 'revisedGm', label: 'Revised GM', digits: 0, kind: 'number' },
  { key: 'gmPct', label: 'GM%', digits: 1, kind: 'percent' },
  { key: 'totalProjectExpenses', label: 'Total Project Exp', digits: 0, kind: 'number' },
  { key: 'badDepts', label: 'Bad Depts', digits: 0, kind: 'number' },
  { key: 'realization', label: 'Realization', digits: 0, kind: 'number' },
  { key: 'totalArc', label: 'Total ARC', digits: 0, kind: 'number' },
  { key: 'totalGfte', label: 'Total GFTE', digits: 2, kind: 'number' },
  { key: 'totalAfte', label: 'Total AFTE', digits: 2, kind: 'number' },
  { key: 'totalBfte', label: 'Total BFTE', digits: 2, kind: 'number' },
  { key: 'unbilled', label: 'Unbilled', digits: 2, kind: 'number' },
  { key: 'gfteUtilPct', label: 'GFTE Utili %', digits: 1, kind: 'percent' },
  { key: 'afteUtilPct', label: 'AFTE Utili %', digits: 1, kind: 'percent' }
];

export function getPpUniqueOptions(rows = [], field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

export function sortPpMonths(months = []) {
  return [...months].sort((a, b) => getMonthIndex(a) - getMonthIndex(b));
}

export function sortPpPeriods(periodType = 'month', periods = []) {
  if (periodType === 'month') return sortPpMonths(periods);
  if (periodType === 'quarter') return [...periods].sort((a, b) => getQuarterIndex(a) - getQuarterIndex(b));
  return [...periods].sort((a, b) => String(a).localeCompare(String(b)));
}

export function getPpPeriodField(periodType = 'month') {
  if (periodType === 'quarter') return 'quarter';
  if (periodType === 'fiscal') return 'fiscal';
  return 'month';
}

export function applyPpFilters(rows = [], filters = {}) {
  return rows.filter((row) => {
    if (filters.l4Mappings?.length && !filters.l4Mappings.some((l4Mapping) => containsText(row.l4Mapping, l4Mapping))) return false;
    if (filters.l4Mapping && !containsText(row.l4Mapping, filters.l4Mapping)) return false;
    if (filters.customerGroupings?.length && !filters.customerGroupings.includes(row.customerGrouping)) return false;
    if (filters.customerGrouping && row.customerGrouping !== filters.customerGrouping) return false;
    if (filters.customerName && row.customerName !== filters.customerName) return false;
    if (filters.projectName && row.projectName !== filters.projectName) return false;
    if (filters.periodType && filters.periodValue && row[getPpPeriodField(filters.periodType)] !== filters.periodValue) return false;
    if (filters.month && row.month !== filters.month) return false;
    if (filters.fiscal && row.fiscal !== filters.fiscal) return false;
    return true;
  });
}

export function buildPpKpis(rows = []) {
  const totals = sumMetrics(rows);
  const realization = safeDivide(totals.totalRevenue, totals.totalAfte);
  const totalArc = safeDivide(totals.revisedDrc, totals.totalGfte);
  const gmPct = safeDivide(totals.revisedGm, totals.totalRevenue) * 100;
  const gfteUtilPct = safeDivide(totals.totalBfte, totals.totalGfte) * 100;
  const afteUtilPct = safeDivide(totals.totalBfte, totals.totalAfte) * 100;
  const unbilled = totals.totalAfte - totals.totalBfte;

  return {
    ...totals,
    projectCount: new Set(rows.map((row) => row.projectCode || row.projectName).filter(Boolean)).size,
    customerCount: new Set(rows.map((row) => row.customerName).filter(Boolean)).size,
    realization,
    totalArc,
    gmPct,
    gfteUtilPct,
    afteUtilPct,
    unbilled
  };
}

export function buildPpTrend(rows = []) {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!row.month) return;
    if (!grouped.has(row.month)) grouped.set(row.month, []);
    grouped.get(row.month).push(row);
  });

  return sortPpMonths([...grouped.keys()]).map((month) => {
    const kpis = buildPpKpis(grouped.get(month));
    return {
      month,
      revenue: round(kpis.totalRevenue),
      grossMargin: round(kpis.revisedGm),
      expenses: round(kpis.totalProjectExpenses),
      afte: round(kpis.totalAfte),
      bfte: round(kpis.totalBfte),
      afteUtilPct: round(kpis.afteUtilPct, 1),
      gmPct: round(kpis.gmPct, 1),
      realization: round(kpis.realization)
    };
  });
}

export function buildPpComparison(rows = [], currentMonth, comparisonMonths = []) {
  const trend = buildPpTrend(rows);
  const currentIndex = trend.findIndex((item) => item.month === currentMonth);
  const current = currentIndex >= 0 ? trend[currentIndex] : trend[trend.length - 1];
  const comparisonRows = comparisonMonths.length
    ? trend.filter((item) => comparisonMonths.includes(item.month))
    : getPreviousTrendRows(trend, currentIndex);
  const comparison = averageTrend(comparisonRows);

  return {
    current,
    comparison,
    comparisonMonths: comparisonRows.map((row) => row.month),
    deltas: current && comparison
      ? {
          revenue: current.revenue - comparison.revenue,
          grossMargin: current.grossMargin - comparison.grossMargin,
          expenses: current.expenses - comparison.expenses,
          afteUtilPct: current.afteUtilPct - comparison.afteUtilPct,
          gmPct: current.gmPct - comparison.gmPct,
          realization: current.realization - comparison.realization
        }
      : {}
  };
}

export function getDefaultPpComparisonMonths(months = [], currentMonth) {
  const sortedMonths = sortPpMonths(months);
  const currentIndex = sortedMonths.findIndex((month) => month === currentMonth);
  if (currentIndex > 0) return sortedMonths.slice(Math.max(0, currentIndex - 3), currentIndex);
  return sortedMonths.slice(-4, -1);
}

export function getDefaultPpComparisonPeriods(periods = [], currentPeriod, periodType = 'month') {
  const sortedPeriods = sortPpPeriods(periodType, periods);
  const currentIndex = sortedPeriods.findIndex((period) => period === currentPeriod);
  if (currentIndex > 0) return sortedPeriods.slice(Math.max(0, currentIndex - 3), currentIndex);
  return sortedPeriods.slice(-4, -1);
}

export function buildPpCustomerComparisonRows(rows = [], currentPeriod, comparisonPeriods = [], periodType = 'month') {
  const periodField = getPpPeriodField(periodType);
  const currentRows = rows.filter((row) => row[periodField] === currentPeriod);
  const comparisonRows = rows.filter((row) => comparisonPeriods.includes(row[periodField]));
  const customers = [
    ...new Set(
      [...currentRows, ...comparisonRows]
        .map((row) => row.customerGrouping || row.customerName || 'Unassigned')
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));

  return customers.flatMap((customer, customerIndex) => {
    const currentKpis = buildPpKpis(currentRows.filter((row) => (row.customerGrouping || row.customerName || 'Unassigned') === customer));
    const comparisonByPeriod = comparisonPeriods.map((period) =>
      buildPpKpis(comparisonRows.filter((row) => row[periodField] === period && (row.customerGrouping || row.customerName || 'Unassigned') === customer))
    );
    const averageKpis = averageKpisByMonth(comparisonByPeriod);

    return PP_KPI_DEFINITIONS.map((definition, kpiIndex) => {
      const periodValues = comparisonPeriods.reduce((acc, period, periodIndex) => {
        acc[`period${periodIndex}`] = round(Number(comparisonByPeriod[periodIndex]?.[definition.key] || 0), definition.digits);
        return acc;
      }, {});
      const currentValue = Number(currentKpis[definition.key] || 0);
      const averageValue = Number(averageKpis[definition.key] || 0);
      const change = currentValue - averageValue;
      const changePct = averageValue ? change / Math.abs(averageValue) * 100 : 0;
      return {
        id: `${customerIndex + 1}-${kpiIndex + 1}`,
        customer,
        kpi: definition.label,
        kind: definition.kind,
        digits: definition.digits,
        currentMonth: currentPeriod,
        comparisonMonths: comparisonPeriods.join(', '),
        ...periodValues,
        currentValue: round(currentValue, definition.digits),
        comparisonAverage: round(averageValue, definition.digits),
        change: round(change, definition.digits),
        changePct: round(changePct, 1),
        trend: change > 0 ? 'Up' : change < 0 ? 'Down' : 'Flat'
      };
    });
  });
}

export function buildPpRevenueComparisonRows(rows = [], currentMonth, comparisonMonths = []) {
  const detailRows = buildPpCustomerComparisonRows(rows, currentMonth, comparisonMonths);
  return detailRows
    .filter((row) => row.kpi === 'Total Revenue')
    .map((row, index) => ({ ...row, id: `revenue-${index + 1}`, customerGrouping: row.customer }));
}

export function buildPpGrandTotalRows(rows = [], currentPeriod, comparisonPeriods = [], periodType = 'month') {
  const periodField = getPpPeriodField(periodType);
  const currentKpis = buildPpKpis(rows.filter((row) => row[periodField] === currentPeriod));
  const comparisonByPeriod = comparisonPeriods.map((period) => buildPpKpis(rows.filter((row) => row[periodField] === period)));
  const averageKpis = averageKpisByMonth(comparisonByPeriod);

  return PP_KPI_DEFINITIONS.map((definition, index) => {
    const periodValues = comparisonPeriods.reduce((acc, period, periodIndex) => {
      acc[`period${periodIndex}`] = round(Number(comparisonByPeriod[periodIndex]?.[definition.key] || 0), definition.digits);
      return acc;
    }, {});
    const currentValue = Number(currentKpis[definition.key] || 0);
    const averageValue = Number(averageKpis[definition.key] || 0);
    const change = currentValue - averageValue;
    const changePct = averageValue ? change / Math.abs(averageValue) * 100 : 0;

    return {
      id: `grand-${index + 1}`,
      customer: index === 0 ? 'ALL CUSTOMERS' : '',
      kpi: definition.label,
      kind: definition.kind,
      digits: definition.digits,
      currentMonth: currentPeriod,
      comparisonMonths: comparisonPeriods.join(', '),
      ...periodValues,
      currentValue: round(currentValue, definition.digits),
      comparisonAverage: round(averageValue, definition.digits),
      change: round(change, definition.digits),
      changePct: round(changePct, 1),
      trend: change > 0 ? 'Up' : change < 0 ? 'Down' : 'Flat'
    };
  });
}

export function buildPpCustomerRows(rows = []) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.customerGrouping || row.customerName || 'Unassigned';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });

  return [...grouped.entries()]
    .map(([customerGrouping, customerRows], index) => {
      const kpis = buildPpKpis(customerRows);
      return {
        id: index + 1,
        customerGrouping,
        projects: kpis.projectCount,
        totalRevenue: round(kpis.totalRevenue),
        revisedDrc: round(kpis.revisedDrc),
        revisedGm: round(kpis.revisedGm),
        totalProjectExpenses: round(kpis.totalProjectExpenses),
        badDepts: round(kpis.badDepts),
        totalGfte: round(kpis.totalGfte, 2),
        totalAfte: round(kpis.totalAfte, 2),
        totalBfte: round(kpis.totalBfte, 2),
        realization: round(kpis.realization),
        totalArc: round(kpis.totalArc),
        gmPct: round(kpis.gmPct, 1),
        gfteUtilPct: round(kpis.gfteUtilPct, 1),
        afteUtilPct: round(kpis.afteUtilPct, 1),
        unbilled: round(kpis.unbilled, 2)
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function buildPpActionRows(customerRows = []) {
  return customerRows
    .map((row) => {
      const flags = [];
      if (row.revisedGm < 0) flags.push('Negative GM');
      if (row.afteUtilPct < 85) flags.push('Low AFTE Utilization');
      if (row.unbilled > 0) flags.push('Unbilled AFTE');
      if (row.totalProjectExpenses > row.revisedGm) flags.push('Expense Pressure');

      return {
        ...row,
        actionFlags: flags.join(', '),
        priority: flags.includes('Negative GM') || flags.includes('Expense Pressure') ? 'High' : flags.length ? 'Medium' : 'Normal'
      };
    })
    .filter((row) => row.actionFlags)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

export function formatPpNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

export function formatPpMetric(value, kind = 'number', digits = 0) {
  const formatted = formatPpNumber(value, digits);
  return kind === 'percent' ? `${formatted}%` : formatted;
}

function sumMetrics(rows) {
  return rows.reduce(
    (acc, row) => ({
      totalRevenue: acc.totalRevenue + Number(row.totalRevenue || 0),
      revisedDrc: acc.revisedDrc + Number(row.revisedDrc || 0),
      revisedGm: acc.revisedGm + Number(row.revisedGm || 0),
      totalProjectExpenses: acc.totalProjectExpenses + Number(row.totalProjectExpenses || 0),
      badDepts: acc.badDepts + Number(row.badDepts || 0),
      totalGfte: acc.totalGfte + Number(row.totalGfte || 0),
      totalAfte: acc.totalAfte + Number(row.totalAfte || 0),
      totalBfte: acc.totalBfte + Number(row.totalBfte || 0)
    }),
    {
      totalRevenue: 0,
      revisedDrc: 0,
      revisedGm: 0,
      totalProjectExpenses: 0,
      badDepts: 0,
      totalGfte: 0,
      totalAfte: 0,
      totalBfte: 0
    }
  );
}

function averageTrend(rows) {
  if (!rows.length) return null;
  return {
    revenue: average(rows, 'revenue'),
    grossMargin: average(rows, 'grossMargin'),
    expenses: average(rows, 'expenses'),
    afte: average(rows, 'afte'),
    bfte: average(rows, 'bfte'),
    afteUtilPct: average(rows, 'afteUtilPct'),
    gmPct: average(rows, 'gmPct'),
    realization: average(rows, 'realization')
  };
}

function averageKpisByMonth(monthlyKpis) {
  const divisor = monthlyKpis.length || 1;
  return PP_KPI_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.key] = monthlyKpis.reduce((sum, kpis) => sum + Number(kpis[definition.key] || 0), 0) / divisor;
    return acc;
  }, {});
}

function average(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length;
}

function safeDivide(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function getMonthIndex(month) {
  const match = String(month).match(/^([A-Za-z]{3})'?(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const [, name, year] = match;
  return Number(`20${year}`) * 12 + MONTH_ORDER.indexOf(name);
}

function getQuarterIndex(quarter) {
  const value = String(quarter || '');
  const quarterMatch = value.match(/Q([1-4])/i);
  const yearMatch = value.match(/(\d{2,4})/);
  const year = yearMatch ? Number(yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1]) : 9999;
  const quarterNumber = quarterMatch ? Number(quarterMatch[1]) : 9;
  return year * 4 + quarterNumber;
}

function getPreviousTrendRows(trend, currentIndex) {
  if (currentIndex > 0) return trend.slice(Math.max(0, currentIndex - 3), currentIndex);
  return trend.slice(-4, -1);
}

function containsText(value, searchValue) {
  return String(value || '').toLowerCase().includes(String(searchValue || '').toLowerCase());
}

function priorityRank(priority) {
  if (priority === 'High') return 0;
  if (priority === 'Medium') return 1;
  return 2;
}
