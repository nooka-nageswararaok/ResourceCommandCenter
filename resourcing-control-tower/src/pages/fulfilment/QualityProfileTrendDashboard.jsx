import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { FolderOpen, Refresh } from '@mui/icons-material';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';

const DEFAULT_PROJECT_L4 = 'ERS VDU-MEGA-MFG-DIGITAL ENGG1';

const emptyFilters = {
  projectL4: [],
  statuses: [],
  customers: [],
  pms: [],
  months: []
};

const defaultFilters = {
  ...emptyFilters,
  projectL4: [DEFAULT_PROJECT_L4]
};

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'Candidate Tracker',
  refreshedAt: '',
  warning: ''
};

const qualityBuckets = [
  {
    id: 'profile-sourcing',
    label: 'TP1 Screen reject/dropped/No show',
    codes: ['1.15', '2.11', '2.12'],
    caption: 'StageStatus 1.15, 2.11, 2.12',
    color: '#316b83'
  },
  {
    id: 'tp1-reject',
    label: 'TP1 Reject',
    codes: ['2.1', '2.10'],
    caption: 'StageStatus 2.1 / 2.10',
    color: '#a33a28'
  },
  {
    id: 'tp2-dropped-no-show',
    label: 'TP2 Dropped/No show',
    codes: ['3.06', '3.07'],
    caption: 'StageStatus 3.06, 3.07',
    color: '#8a5a00'
  },
  {
    id: 'tp2-reject',
    label: 'TP2 Reject',
    codes: ['3.05'],
    caption: 'StageStatus 3.05',
    color: '#6d5a94'
  }
];

const otherBucket = {
  id: 'others',
  label: 'Others',
  codes: [],
  caption: 'All remaining profiles',
  color: '#496d3a'
};

const droppedNoShowBuckets = [
  {
    id: 'dropped',
    label: 'Dropped',
    codes: ['2.12', '3.07'],
    caption: 'StageStatus text containing Dropped, or codes 2.12 / 3.07',
    color: '#a33a28'
  },
  {
    id: 'no-show',
    label: 'No Show',
    codes: ['2.11', '3.06'],
    caption: 'StageStatus text containing No Show, or codes 2.11 / 3.06',
    color: '#8a5a00'
  },
  {
    id: 'drop-no-show-others',
    label: 'Others',
    codes: [],
    caption: 'All remaining Candidate Tracker statuses',
    color: '#316b83'
  }
];

export default function QualityProfileTrendDashboard() {
  const [activeDemandRows, setActiveDemandRows] = useState([]);
  const [candidateRows, setCandidateRows] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (picker = false) => {
    setLoading(true);
    setError('');
    try {
      const payload = picker ? await selectFulfilmentExcelFile() : await getFulfilmentData();
      if (!payload.canceled) {
        setActiveDemandRows(payload.activeDemandRows || []);
        setCandidateRows(payload.candidateRows || []);
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          sheetName: payload.candidateSheetName || 'Candidate Tracker',
          refreshedAt: payload.refreshedAt || '',
          warning: payload.warning || ''
        });
      }
    } catch (err) {
      setError(err.message || 'Unable to load fulfilment workbook.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const enrichedRows = useMemo(
    () => enrichCandidateRows(candidateRows, activeDemandRows),
    [activeDemandRows, candidateRows]
  );

  const projectL4FilteredRows = useMemo(
    () => enrichedRows.filter((row) => !filters.projectL4.length || filters.projectL4.includes(row.projectL4)),
    [enrichedRows, filters.projectL4]
  );

  const statusFilteredRows = useMemo(
    () => projectL4FilteredRows.filter((row) => !filters.statuses.length || filters.statuses.includes(row.demandStatus)),
    [filters.statuses, projectL4FilteredRows]
  );

  const customerFilteredRows = useMemo(
    () => statusFilteredRows.filter((row) => !filters.customers.length || filters.customers.includes(row.customer)),
    [filters.customers, statusFilteredRows]
  );

  const filteredRows = useMemo(
    () =>
      enrichedRows.filter((row) => {
        if (filters.projectL4.length && !filters.projectL4.includes(row.projectL4)) return false;
        if (filters.statuses.length && !filters.statuses.includes(row.demandStatus)) return false;
        if (filters.customers.length && !filters.customers.includes(row.customer)) return false;
        if (filters.pms.length && !filters.pms.includes(row.pm)) return false;
        if (filters.months.length && !filters.months.includes(row.profileMonth)) return false;
        return true;
      }),
    [enrichedRows, filters]
  );

  const options = useMemo(() => ({
    projectL4: uniqueOptions(enrichedRows, 'projectL4'),
    statuses: uniqueOptions(projectL4FilteredRows, 'demandStatus'),
    customers: uniqueOptions(statusFilteredRows, 'customer'),
    pms: uniqueOptions(customerFilteredRows, 'pm'),
    months: sortMonths(uniqueOptions(customerFilteredRows, 'profileMonth'))
  }), [customerFilteredRows, enrichedRows, projectL4FilteredRows, statusFilteredRows]);

  const qualityRows = useMemo(() => buildQualityRows(filteredRows), [filteredRows]);
  const droppedNoShowRows = useMemo(() => buildDroppedNoShowRows(filteredRows), [filteredRows]);
  const summary = useMemo(() => buildSummary(qualityRows, filteredRows.length), [filteredRows.length, qualityRows]);

  const updateMultiFilter = (field, event) => {
    setFilters((current) => ({
      ...current,
      [field]: Array.from(event.target.selectedOptions).map((option) => option.value)
    }));
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Quality of Profile Trend</h1>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for fulfilment workbook'} {meta.sheetName ? `/ ${meta.sheetName}` : ''}
          </p>
          <p>Loaded: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
        </div>
        <div className="page-actions">
          <Button variant="outlined" startIcon={<FolderOpen />} onClick={() => loadData(true)} disabled={loading}>
            Choose Fulfilment Excel
          </Button>
          <Button variant="contained" startIcon={<Refresh />} onClick={() => loadData(false)} disabled={loading}>
            Refresh Fulfilment
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="state-panel">
          <CircularProgress />
          <span>Loading fulfilment workbook...</span>
        </div>
      ) : error ? (
        <div className="state-panel error">{error}</div>
      ) : meta.warning ? (
        <div className="state-panel">
          <strong>{meta.warning}</strong>
          <span>Use Choose Fulfilment Excel to load a workbook that contains Candidate Tracker.</span>
        </div>
      ) : (
        <>
          <section className="plain-section quality-profile-filter-section">
            <div className="page-title-row compact-row collapsible-section-header">
              <div>
                <h2>Filters</h2>
                <p>Limit profile quality mix by SF demand attributes and Candidate Tracker profile month.</p>
              </div>
              <Button variant="outlined" size="small" onClick={() => setFilters(emptyFilters)}>Clear Filters</Button>
            </div>
            <div className="fulfilment-filter-bar quality-profile-filter-bar">
              <MultiSelect label="Project L4" value={filters.projectL4} options={options.projectL4} onChange={(event) => updateMultiFilter('projectL4', event)} />
              <MultiSelect label="Demand Status" value={filters.statuses} options={options.statuses} onChange={(event) => updateMultiFilter('statuses', event)} />
              <MultiSelect label="Customer" value={filters.customers} options={options.customers} onChange={(event) => updateMultiFilter('customers', event)} />
              <MultiSelect label="Hiring Manager" value={filters.pms} options={options.pms} onChange={(event) => updateMultiFilter('pms', event)} />
              <MultiSelect label="Profile Month" value={filters.months} options={options.months} onChange={(event) => updateMultiFilter('months', event)} />
            </div>
          </section>

          <section className="quality-profile-layout">
            <div className="plain-section quality-profile-chart-panel">
              <div className="page-title-row compact-row">
                <div>
                  <h2>Profile Quality Mix</h2>
                  <p>{summary.totalProfiles} total profiles in selected scope. Values are shown as % of total profiles.</p>
                </div>
              </div>
              <div className="quality-profile-pie-wrap">
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={qualityRows}
                      dataKey="percentage"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={118}
                      paddingAngle={2}
                      label={renderPieLabel}
                      labelLine
                    >
                      {qualityRows.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => [`${formatPercent(value)} (${props.payload.count} profiles)`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="plain-section quality-profile-chart-panel">
              <div className="page-title-row compact-row">
                <div>
                  <h2>Dropped / No Show Mix</h2>
                  <p>{filteredRows.length} total profiles in selected scope. Others includes every remaining Candidate Tracker status.</p>
                </div>
              </div>
              <div className="quality-profile-pie-wrap">
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={droppedNoShowRows}
                      dataKey="percentage"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={118}
                      paddingAngle={2}
                      label={renderPieLabel}
                      labelLine
                    >
                      {droppedNoShowRows.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => [`${formatPercent(value)} (${props.payload.count} profiles)`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="plain-section quality-profile-summary-panel">
              <h2>Quality Summary</h2>
              <div className="quality-profile-summary-grid">
                <SummaryMetric label="Total Profiles" value={summary.totalProfiles} caption="Candidate Tracker rows" />
                <SummaryMetric label="Categorized %" value={`${summary.categorizedPct}%`} caption="Defined quality buckets" />
                <SummaryMetric label="Others %" value={`${summary.othersPct}%`} caption="Remaining profiles" />
              </div>
              <div className="quality-profile-detail-list">
                {qualityRows.map((row) => (
                  <div className="quality-profile-detail-row" key={row.id}>
                    <span className="quality-color-dot" style={{ background: row.color }} />
                    <div>
                      <strong>{row.label}</strong>
                      <small>{row.caption}</small>
                    </div>
                    <b>{formatPercent(row.percentage)}</b>
                    <i>{row.count} profiles</i>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function MultiSelect({ label, value, options, onChange }) {
  return (
    <label>
      {label}
      <select className="multi-select" multiple value={value} onChange={onChange}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SummaryMetric({ label, value, caption }) {
  return (
    <div className="quality-profile-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

function enrichCandidateRows(candidateRows, demandRows) {
  const demandMap = new Map(demandRows.map((row) => [String(row.legacyJobReqId || '').trim(), row]));
  return candidateRows.map((row) => {
    const demand = demandMap.get(String(row.sr || '').trim()) || {};
    return {
      ...row,
      stageCode: getStageStatusCode(row.stageStatus),
      profileMonth: toMonthLabel(row.profileReceivedDate),
      customer: row.customer || demand.customer || 'Unassigned',
      pm: demand.pm || 'Unassigned',
      projectL4: demand.projectL4 || 'Unassigned',
      demandStatus: demand.status || row.candidateStatus || 'Unassigned'
    };
  });
}

function buildQualityRows(rows) {
  const totalProfiles = rows.length;
  const matchedIds = new Set();
  const bucketRows = qualityBuckets.map((bucket) => {
    const codeSet = new Set(bucket.codes);
    const bucketCount = rows.filter((row) => codeSet.has(row.stageCode)).length;
    bucket.codes.forEach((code) => matchedIds.add(code));
    return {
      ...bucket,
      count: bucketCount,
      percentage: pct(bucketCount, totalProfiles)
    };
  });
  const othersCount = rows.filter((row) => !matchedIds.has(row.stageCode)).length;
  return [
    ...bucketRows,
    {
      ...otherBucket,
      count: othersCount,
      percentage: pct(othersCount, totalProfiles)
    }
  ];
}

function buildDroppedNoShowRows(rows) {
  const totalProfiles = rows.length;
  const counts = new Map(droppedNoShowBuckets.map((bucket) => [bucket.id, 0]));
  const droppedCodes = new Set(droppedNoShowBuckets.find((bucket) => bucket.id === 'dropped')?.codes || []);
  const noShowCodes = new Set(droppedNoShowBuckets.find((bucket) => bucket.id === 'no-show')?.codes || []);

  rows.forEach((row) => {
    const text = normalizeStageStatus(row.stageStatus);
    if (text.includes('no show') || text.includes('noshow') || noShowCodes.has(row.stageCode)) {
      counts.set('no-show', (counts.get('no-show') || 0) + 1);
      return;
    }
    if (text.includes('drop') || droppedCodes.has(row.stageCode)) {
      counts.set('dropped', (counts.get('dropped') || 0) + 1);
      return;
    }
    counts.set('drop-no-show-others', (counts.get('drop-no-show-others') || 0) + 1);
  });

  return droppedNoShowBuckets.map((bucket) => {
    const count = counts.get(bucket.id) || 0;
    return {
      ...bucket,
      count,
      percentage: pct(count, totalProfiles)
    };
  });
}

function buildSummary(qualityRows, totalProfiles) {
  const others = qualityRows.find((row) => row.id === 'others') || { count: 0 };
  const categorizedCount = Math.max(totalProfiles - others.count, 0);
  return {
    totalProfiles,
    categorizedPct: pct(categorizedCount, totalProfiles),
    othersPct: pct(others.count, totalProfiles)
  };
}

function normalizeStageStatus(value) {
  return String(value || '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getStageStatusCode(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d+(?:\.\d+)?)/);
  return match ? match[1] : '';
}

function renderPieLabel({ label, percentage }) {
  return percentage > 0 ? `${label}: ${formatPercent(percentage)}` : '';
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function pct(part, whole) {
  if (!whole) return 0;
  return Number(((part / whole) * 100).toFixed(1));
}

function uniqueOptions(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function sortMonths(months) {
  return [...months].sort((a, b) => monthOrder(a) - monthOrder(b));
}

function toMonthLabel(value) {
  const date = parseDate(value);
  if (!date) return 'No Date';
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' }).replace(' ', '-');
}

function monthOrder(value) {
  const text = String(value || '');
  const monthName = text.slice(0, 3).toLowerCase();
  const index = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName);
  const year = Number(text.match(/\d{2,4}/)?.[0] || 0);
  return (year * 12) + (index < 0 ? 99 : index);
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
