import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { FolderOpen, Refresh } from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import KPIWidget from '../../components/KPIWidget.jsx';
import { getTagData, selectTagExcelFile } from '../../services/tagService.js';

const DEFAULT_LOB = 'ERS';
const DEFAULT_PROJECT_L1 = 'ERS VDU';
const DEFAULT_PROJECT_L4 = 'ERS VDU-MEGA-MFG-DIGITAL ENGG1';
const DETAIL_LIMIT = 500;

const initialMeta = {
  fileName: '',
  filePath: '',
  demandSheetName: 'Demand data',
  earlyPipelineSheetName: 'Early Pipeline',
  refreshedAt: '',
  warning: ''
};

const emptyFilters = {
  projectL1: [],
  projectL4: [],
  statuses: [],
  customers: [],
  hiringManagers: [],
  applicationStatuses: [],
  demandKeys: []
};

const defaultFilters = {
  ...emptyFilters,
  projectL1: [DEFAULT_PROJECT_L1],
  projectL4: [DEFAULT_PROJECT_L4]
};

const funnelOrder = [
  'Sourcing / Default',
  'Phone Screen',
  'Hiring Manager',
  'Interview 1',
  'Interview 2',
  'Client Interview',
  'Offer Stage',
  'Repurpose / Other Req',
  'Unblock',
  'Other'
];

const funnelColors = {
  'Sourcing / Default': '#316b83',
  'Phone Screen': '#4b8f8c',
  'Hiring Manager': '#8a5a00',
  'Interview 1': '#6d5a94',
  'Interview 2': '#496d3a',
  'Client Interview': '#245b73',
  'Offer Stage': '#1f6f55',
  'Repurpose / Other Req': '#a33a28',
  Unblock: '#607080',
  Other: '#94a3b8'
};

export default function TagDashboard({ initialState = {} }) {
  const [demandRows, setDemandRows] = useState([]);
  const [earlyPipelineRows, setEarlyPipelineRows] = useState([]);
  const [outcomeRows, setOutcomeRows] = useState({});
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState(() => ({
    ...defaultFilters,
    demandKeys: initialState.legacyJobReqId || initialState.demandId ? [initialState.legacyJobReqId || initialState.demandId] : []
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (picker = false) => {
    setLoading(true);
    setError('');
    try {
      const payload = picker ? await selectTagExcelFile() : await getTagData();
      if (!payload.canceled) {
        setDemandRows(payload.demandRows || []);
        setEarlyPipelineRows(payload.earlyPipelineRows || []);
        setOutcomeRows(payload.outcomeRows || {});
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          demandSheetName: payload.demandSheetName || 'Demand data',
          earlyPipelineSheetName: payload.earlyPipelineSheetName || 'Early Pipeline',
          refreshedAt: payload.refreshedAt || '',
          warning: payload.warning || ''
        });
      }
    } catch (err) {
      setError(err.message || 'Unable to load TAG workbook.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const demandKey = initialState.legacyJobReqId || initialState.demandId || '';
    if (demandKey) {
      setFilters((current) => ({ ...current, demandKeys: [demandKey] }));
    }
  }, [initialState.legacyJobReqId, initialState.demandId]);

  const baseDemandRows = useMemo(
    () => demandRows.filter((row) => {
      if (filters.projectL1.length && !filters.projectL1.includes(row.projectL1)) return false;
      if (filters.projectL4.length && !filters.projectL4.includes(row.projectL4)) return false;
      return true;
    }),
    [demandRows, filters.projectL1, filters.projectL4]
  );

  const demandOptionsScope = useMemo(
    () => demandRows.filter((row) => {
      if (filters.projectL1.length && !filters.projectL1.includes(row.projectL1)) return false;
      if (filters.projectL4.length && !filters.projectL4.includes(row.projectL4)) return false;
      return true;
    }),
    [demandRows, filters.projectL1, filters.projectL4]
  );
  const demandOptionsKeyMap = useMemo(() => buildDemandKeyMap(demandOptionsScope), [demandOptionsScope]);

  const filteredDemandRows = useMemo(
    () => baseDemandRows.filter((row) => {
      if (filters.statuses.length && !filters.statuses.includes(row.status)) return false;
      if (filters.customers.length && !filters.customers.includes(row.customer)) return false;
      if (filters.hiringManagers.length && !filters.hiringManagers.includes(row.hiringManager)) return false;
      if (filters.demandKeys.length && !filters.demandKeys.some((key) => keyMatchesDemand(row, key))) return false;
      return true;
    }),
    [baseDemandRows, filters]
  );

  const demandKeyMap = useMemo(() => buildDemandKeyMap(filteredDemandRows), [filteredDemandRows]);
  const filteredEarlyRows = useMemo(
    () => earlyPipelineRows.filter((row) => {
      if (!rowMatchesDemandKeys(row, demandKeyMap)) return false;
      if (filters.applicationStatuses.length && !filters.applicationStatuses.includes(row.applicationStatus)) return false;
      return true;
    }),
    [demandKeyMap, earlyPipelineRows, filters.applicationStatuses]
  );

  const filteredOutcomeRows = useMemo(
    () => Object.fromEntries(
      Object.entries(outcomeRows).map(([key, rows]) => [
        key,
        (rows || []).filter((row) => rowMatchesDemandKeys(row, demandKeyMap))
      ])
    ),
    [demandKeyMap, outcomeRows]
  );

  const options = useMemo(() => ({
    projectL1: uniqueOptions(demandRows, 'projectL1'),
    projectL4: uniqueOptions(demandRows.filter((row) =>
      (!filters.projectL1.length || filters.projectL1.includes(row.projectL1))
    ), 'projectL4'),
    statuses: uniqueOptions(demandOptionsScope, 'status'),
    customers: uniqueOptions(demandOptionsScope, 'customer'),
    hiringManagers: uniqueOptions(demandOptionsScope, 'hiringManager'),
    applicationStatuses: uniqueOptions(earlyPipelineRows.filter((row) => rowMatchesDemandKeys(row, demandOptionsKeyMap)), 'applicationStatus'),
    demandKeys: demandOptionsScope
      .map((row) => row.legacyJobReqId || row.jobRequisitionId)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .slice(0, 1000)
  }), [demandOptionsKeyMap, demandOptionsScope, demandRows, earlyPipelineRows, filters.projectL1]);

  const coverageRows = useMemo(() => buildCoverageRows(filteredDemandRows, filteredEarlyRows), [filteredDemandRows, filteredEarlyRows]);
  const summary = useMemo(() => buildSummary(filteredDemandRows, filteredEarlyRows, filteredOutcomeRows, coverageRows), [coverageRows, filteredDemandRows, filteredEarlyRows, filteredOutcomeRows]);
  const funnelRows = useMemo(() => buildFunnelRows(filteredEarlyRows), [filteredEarlyRows]);
  const applicationStatusRows = useMemo(() => topGroups(filteredEarlyRows, 'applicationStatus', 12), [filteredEarlyRows]);
  const customerHotspots = useMemo(() => buildCustomerHotspots(coverageRows, filteredOutcomeRows), [coverageRows, filteredOutcomeRows]);

  const updateMultiFilter = (field, event) => {
    setFilters((current) => ({
      ...current,
      [field]: Array.from(event.target.selectedOptions).map((option) => option.value)
    }));
  };

  const clearFilters = () => setFilters(emptyFilters);
  const resetDefaults = () => setFilters(defaultFilters);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>TAG Dashboard</h1>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for TAG workbook'} {meta.demandSheetName ? `/ ${meta.demandSheetName} + ${meta.earlyPipelineSheetName}` : ''}
          </p>
          <p>Loaded: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
        </div>
        <div className="page-actions">
          <Button variant="outlined" startIcon={<FolderOpen />} onClick={() => loadData(true)} disabled={loading}>
            Choose TAG Excel
          </Button>
          <Button variant="contained" startIcon={<Refresh />} onClick={() => loadData(false)} disabled={loading}>
            Refresh TAG
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="state-panel">
          <CircularProgress />
          <span>Loading TAG workbook...</span>
        </div>
      ) : error ? (
        <div className="state-panel error">{error}</div>
      ) : meta.warning ? (
        <div className="state-panel">
          <strong>{meta.warning}</strong>
          <span>Use Choose TAG Excel to load a workbook with Demand data and Early Pipeline sheets.</span>
        </div>
      ) : (
        <>
          <section className="plain-section tag-filter-section">
            <div className="page-title-row compact-row collapsible-section-header">
              <div>
                <h2>Filters</h2>
                <p>Defaults are ERS VDU and ERS VDU-MEGA-MFG-DIGITAL ENGG1.</p>
              </div>
              <div className="page-actions">
                <Button variant="outlined" size="small" onClick={resetDefaults}>Reset Defaults</Button>
                <Button variant="outlined" size="small" onClick={clearFilters}>Clear Filters</Button>
              </div>
            </div>
            <div className="fulfilment-filter-bar tag-filter-bar">
              <MultiSelect label="Project L1" value={filters.projectL1} options={options.projectL1} onChange={(event) => updateMultiFilter('projectL1', event)} />
              <MultiSelect label="Project L4" value={filters.projectL4} options={options.projectL4} onChange={(event) => updateMultiFilter('projectL4', event)} />
              <MultiSelect label="Demand Status" value={filters.statuses} options={options.statuses} onChange={(event) => updateMultiFilter('statuses', event)} />
              <MultiSelect label="Customer" value={filters.customers} options={options.customers} onChange={(event) => updateMultiFilter('customers', event)} />
              <MultiSelect label="Hiring Manager" value={filters.hiringManagers} options={options.hiringManagers} onChange={(event) => updateMultiFilter('hiringManagers', event)} />
              <MultiSelect label="Application Status" value={filters.applicationStatuses} options={options.applicationStatuses} onChange={(event) => updateMultiFilter('applicationStatuses', event)} />
              <MultiSelect label="Demand ID" value={filters.demandKeys} options={options.demandKeys} onChange={(event) => updateMultiFilter('demandKeys', event)} />
            </div>
          </section>

          <section className="kpi-grid compact fulfilment-kpi-grid">
            <KPIWidget label="Demand Rows" value={summary.demandCount} tone="blue" />
            <KPIWidget label="Actionable" value={summary.actionablePositions} tone="green" />
            <KPIWidget label="Balance" value={summary.balancePositions} tone="amber" />
            <KPIWidget label="Early Pipeline" value={summary.pipelineCandidates} />
            <KPIWidget label="Coverage" value={`${summary.coveragePct}%`} tone="green" />
            <KPIWidget label="Zero Pipeline" value={summary.zeroPipelineDemands} tone="red" />
            <KPIWidget label="Low Pipeline" value={summary.lowPipelineDemands} tone="amber" />
            <KPIWidget label="Aging >60" value={summary.aging60} tone="red" />
            <KPIWidget label="MTD Offered" value={summary.offered} tone="green" />
            <KPIWidget label="MTD Renege" value={summary.renege} tone="red" />
            <KPIWidget label="MTD Declined" value={summary.declined} tone="red" />
            <KPIWidget label="Rejected" value={summary.rejected} tone="amber" />
          </section>

          <section className="tag-dashboard-grid">
            <ChartPanel title="Early Pipeline Funnel" caption={`${filteredEarlyRows.length} candidate rows from Early Pipeline`}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="Candidates">
                    {funnelRows.map((row) => <Cell key={row.name} fill={funnelColors[row.name] || '#316b83'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Application Status Mix" caption="Top current statuses from Early Pipeline">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={applicationStatusRows} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={110} paddingAngle={2}>
                    {applicationStatusRows.map((row, index) => <Cell key={row.name} fill={palette[index % palette.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>

          <section className="tag-dashboard-grid">
            <HeatmapPanel title="Demand Coverage And Gaps" caption={`${coverageRows.length} demand rows ranked by total positions, showing first ${Math.min(coverageRows.length, 80)}`}>
              <div className="tag-demand-heatmap">
                {coverageRows.slice(0, 80).map((row) => <DemandHeatmapCard key={row.id} row={row} />)}
              </div>
            </HeatmapPanel>

            <HeatmapPanel title="Customer Hotspots" caption="Customers ranked by total positions, zero pipeline, ageing, and leakage">
              <div className="tag-customer-heatmap">
                {customerHotspots.slice(0, 80).map((row) => <CustomerHeatmapCard key={row.id} row={row} />)}
              </div>
            </HeatmapPanel>
          </section>

          <GridPanel title="Early Pipeline Candidate Details" caption={`${filteredEarlyRows.length} candidate rows, showing first ${Math.min(filteredEarlyRows.length, DETAIL_LIMIT)}`}>
            <DataGrid
              rows={filteredEarlyRows.slice(0, DETAIL_LIMIT)}
              columns={candidateColumns}
              autoHeight
              density="compact"
              rowHeight={34}
              columnHeaderHeight={44}
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            />
          </GridPanel>
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

function ChartPanel({ title, caption, children }) {
  return (
    <section className="plain-section tag-chart-panel">
      <div className="page-title-row compact-row">
        <div>
          <h2>{title}</h2>
          <p>{caption}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function GridPanel({ title, caption, children }) {
  return (
    <section className="plain-section tag-grid-panel">
      <div className="page-title-row compact-row">
        <div>
          <h2>{title}</h2>
          <p>{caption}</p>
        </div>
      </div>
      <div className="data-grid-shell">{children}</div>
    </section>
  );
}

function HeatmapPanel({ title, caption, children }) {
  return (
    <section className="plain-section tag-heatmap-panel">
      <div className="page-title-row compact-row">
        <div>
          <h2>{title}</h2>
          <p>{caption}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function DemandHeatmapCard({ row }) {
  const level = getDemandHeatmapLevel(row);
  return (
    <article className={`tag-demand-card ${level}`} title={`${row.legacyJobReqId || row.jobRequisitionId} / ${row.customer}`}>
      <div className="tag-card-title">
        <strong>{row.legacyJobReqId || row.jobRequisitionId || 'Demand'}</strong>
        <span>{row.status || '--'}</span>
      </div>
      <p>{row.customer || 'Unassigned Customer'}</p>
      <small>{formatRoleSkill(row)}</small>
      <div className="tag-card-metrics">
        <Metric label="Total" value={row.totalPositions} />
        <Metric label="Actionable" value={row.actionablePositions} />
        <Metric label="Candidates" value={row.candidateCount} />
        <Metric label="Ageing" value={row.demandAgeingDays} />
      </div>
      <b>{row.risk}</b>
    </article>
  );
}

function CustomerHeatmapCard({ row }) {
  const level = getCustomerHeatmapLevel(row);
  return (
    <article className={`tag-customer-card ${level}`} title={row.customer}>
      <div className="tag-card-title">
        <strong>{row.customer || 'Unassigned Customer'}</strong>
        <span>{row.coveragePct}%</span>
      </div>
      <div className="tag-card-metrics">
        <Metric label="Total" value={row.totalPositions} />
        <Metric label="Actionable" value={row.actionable} />
        <Metric label="Candidates" value={row.candidates} />
        <Metric label="Zero" value={row.zeroPipeline} />
        <Metric label="Aging >60" value={row.aging60} />
        <Metric label="Rejected" value={row.rejected} />
      </div>
      <small>{row.demands} demands / {row.renege} renege / {row.declined} declined</small>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <span>
      <b>{value ?? 0}</b>
      <i>{label}</i>
    </span>
  );
}

function buildDemandKeyMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.legacyJobReqId) map.set(String(row.legacyJobReqId).trim(), row);
    if (row.jobRequisitionId) map.set(String(row.jobRequisitionId).trim(), row);
  });
  return map;
}

function keyMatchesDemand(row, key) {
  const value = String(key || '').trim();
  return value && (row.legacyJobReqId === value || row.jobRequisitionId === value || row.demandKey === value);
}

function rowMatchesDemandKeys(row, demandKeyMap) {
  return Boolean(
    (row.legacyJobReqId && demandKeyMap.has(String(row.legacyJobReqId).trim())) ||
    (row.jobRequisitionId && demandKeyMap.has(String(row.jobRequisitionId).trim()))
  );
}

function buildCoverageRows(demands, candidates) {
  const candidateCountByDemand = new Map();
  candidates.forEach((row) => {
    const key = row.legacyJobReqId || row.jobRequisitionId || 'No Demand ID';
    candidateCountByDemand.set(key, (candidateCountByDemand.get(key) || 0) + 1);
  });

  return demands.map((row) => {
    const candidateCount = candidateCountByDemand.get(row.legacyJobReqId) || candidateCountByDemand.get(row.jobRequisitionId) || 0;
    const actionable = Number(row.actionablePositions || 0);
    return {
      ...row,
      id: row.id,
      totalPositions: Number(row.numberOfOpenings || 0),
      candidateCount,
      coverageRatio: actionable ? round(candidateCount / actionable) : 0,
      gap: actionable - candidateCount,
      risk: getCoverageRisk(row, candidateCount)
    };
  }).sort((a, b) => b.totalPositions - a.totalPositions || b.gap - a.gap || b.demandAgeingDays - a.demandAgeingDays);
}

function getCoverageRisk(row, candidateCount) {
  const actionable = Number(row.actionablePositions || 0);
  if (actionable > 0 && candidateCount === 0) return 'Zero Pipeline';
  if (actionable > 0 && candidateCount < actionable) return 'Low Pipeline';
  if (Number(row.demandAgeingDays || 0) > 60) return 'Aging >60';
  return 'Covered';
}

function getDemandHeatmapLevel(row) {
  if (row.risk === 'Zero Pipeline' || Number(row.gap || 0) >= 5) return 'high';
  if (row.risk === 'Low Pipeline' || Number(row.demandAgeingDays || 0) > 60) return 'medium';
  return 'low';
}

function getCustomerHeatmapLevel(row) {
  if (Number(row.gap || 0) >= 25 || Number(row.zeroPipeline || 0) >= 10) return 'high';
  if (Number(row.gap || 0) > 0 || Number(row.aging60 || 0) > 0 || Number(row.rejected || 0) >= 50) return 'medium';
  return 'low';
}

function buildSummary(demands, candidates, outcomes, coverageRows) {
  const actionablePositions = sum(demands, 'actionablePositions');
  const pipelineCandidates = candidates.length;
  return {
    demandCount: demands.length,
    actionablePositions,
    balancePositions: sum(demands, 'balancePositions'),
    pipelineCandidates,
    coveragePct: actionablePositions ? Math.round((pipelineCandidates / actionablePositions) * 100) : 0,
    zeroPipelineDemands: coverageRows.filter((row) => row.risk === 'Zero Pipeline').length,
    lowPipelineDemands: coverageRows.filter((row) => row.risk === 'Low Pipeline').length,
    aging60: demands.filter((row) => Number(row.demandAgeingDays || 0) > 60).length,
    offered: outcomes.offered?.length || 0,
    renege: outcomes.renege?.length || 0,
    declined: outcomes.declined?.length || 0,
    rejected: outcomes.rejected?.length || 0
  };
}

function buildFunnelRows(rows) {
  const counts = new Map(funnelOrder.map((bucket) => [bucket, 0]));
  rows.forEach((row) => {
    const bucket = getFunnelBucket(row.applicationStatus);
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  });
  return funnelOrder.map((name) => ({ name, count: counts.get(name) || 0 }));
}

function getFunnelBucket(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value || value === 'default') return 'Sourcing / Default';
  if (value.includes('phone screen')) return 'Phone Screen';
  if (value.includes('hiring manager')) return 'Hiring Manager';
  if (value.includes('interview 1')) return 'Interview 1';
  if (value.includes('interview 2')) return 'Interview 2';
  if (value.includes('client interview')) return 'Client Interview';
  if (value.includes('offer') || value.includes('prepare')) return 'Offer Stage';
  if (value.includes('repurpose') || value.includes('selectedonotherreq')) return 'Repurpose / Other Req';
  if (value.includes('unblock')) return 'Unblock';
  return 'Other';
}

function buildCustomerHotspots(coverageRows, outcomes) {
  const groups = new Map();
  const ensure = (customer) => {
    const key = String(customer || '').trim() || 'Unassigned';
    if (!groups.has(key)) {
      groups.set(key, { id: `customer-${key}`, customer: key, demands: 0, totalPositions: 0, actionable: 0, balance: 0, candidates: 0, gap: 0, zeroPipeline: 0, aging60: 0, renege: 0, declined: 0, rejected: 0 });
    }
    return groups.get(key);
  };

  coverageRows.forEach((row) => {
    const group = ensure(row.customer);
    group.demands += 1;
    group.totalPositions += Number(row.totalPositions || 0);
    group.actionable += Number(row.actionablePositions || 0);
    group.balance += Number(row.balancePositions || 0);
    group.candidates += Number(row.candidateCount || 0);
    group.gap += Number(row.gap || 0);
    group.zeroPipeline += row.risk === 'Zero Pipeline' ? 1 : 0;
    group.aging60 += Number(row.demandAgeingDays || 0) > 60 ? 1 : 0;
  });

  (outcomes.renege || []).forEach((row) => { ensure(row.customer).renege += 1; });
  (outcomes.declined || []).forEach((row) => { ensure(row.customer).declined += 1; });
  (outcomes.rejected || []).forEach((row) => { ensure(row.customer).rejected += 1; });

  return [...groups.values()]
    .map((row) => ({ ...row, coveragePct: row.actionable ? Math.round((row.candidates / row.actionable) * 100) : 0 }))
    .sort((a, b) => b.totalPositions - a.totalPositions || b.gap - a.gap || b.zeroPipeline - a.zeroPipeline);
}

function topGroups(rows, field, limit) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = String(row[field] || '').trim() || 'Unassigned';
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  return [...groups.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function uniqueOptions(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatRoleSkill(row) {
  const role = String(row.role || '').trim();
  const skill = String(row.skillCluster || '').trim();
  if (role && skill) return `${role} - ${skill}`;
  return role || skill || 'Role not available';
}

const palette = ['#316b83', '#a33a28', '#8a5a00', '#6d5a94', '#496d3a', '#245b73', '#1f6f55', '#607080', '#94a3b8', '#4b8f8c', '#9f5f80', '#785a28'];

const candidateColumns = [
  { field: 'legacyJobReqId', headerName: 'Legacy Job Req Id', width: 170 },
  { field: 'jobRequisitionId', headerName: 'Demand ID', width: 120 },
  { field: 'applicationId', headerName: 'Application ID', width: 145 },
  { field: 'candidateId', headerName: 'Candidate ID', width: 130 },
  { field: 'candidateName', headerName: 'Candidate Name', minWidth: 200, flex: 0.8 },
  { field: 'applicationStatus', headerName: 'Application Status', minWidth: 180, flex: 0.7 },
  { field: 'customer', headerName: 'Customer', minWidth: 190, flex: 0.7 },
  { field: 'recruiter', headerName: 'Recruiter', minWidth: 180, flex: 0.7 },
  { field: 'source', headerName: 'Source', minWidth: 220, flex: 0.8 },
  { field: 'projectL4', headerName: 'Project L4', minWidth: 230, flex: 0.8 },
  { field: 'geo', headerName: 'GEO', width: 90 },
  { field: 'offOn', headerName: 'OFF/ON', width: 90 },
  { field: 'hiringType', headerName: 'Hiring Type', width: 120 }
];
