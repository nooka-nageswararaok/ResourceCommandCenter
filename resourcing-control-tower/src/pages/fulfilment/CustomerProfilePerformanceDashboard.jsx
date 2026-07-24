import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, CircularProgress, TextField } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { FolderOpen, OpenInNew, Refresh } from '@mui/icons-material';
import KPIWidget from '../../components/KPIWidget.jsx';
import { getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';
import { isActiveDemandStatus } from '../../services/fulfilmentAnalysis.js';

const DEFAULT_PROJECT_L4 = 'ERS VDU-MEGA-MFG-DIGITAL ENGG1';

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'SF Datadump',
  candidateSheetName: 'Candidate Tracker',
  refreshedAt: '',
  warning: ''
};

const emptyFilters = {
  customer: '',
  projectL4: [DEFAULT_PROJECT_L4],
  statuses: ['Open'],
  pms: [],
  locations: [],
  drilldown: ''
};

const stageGroups = {
  rejected: new Set([
    '3.05',
    '3.13'
  ]),
  selected: new Set([
    '3.11',
    '3.12',
    '4.01',
    '4.02',
    '4.03',
    '4.05',
    '4.07',
    '4.08',
    '4.09',
    '5.1',
    '5.2',
    '5.3',
    '5.4',
    '5.5',
    '5.6'
  ]),
  pendingFeedback: new Set([
    '3.08',
    '3.14'
  ]),
  dropped: new Set([
    '3.07'
  ]),
  noShow: new Set([
    '3.06'
  ])
};

export default function CustomerProfilePerformanceDashboard({ navigate, initialState = {} }) {
  const [activeDemandRows, setActiveDemandRows] = useState([]);
  const [candidateRows, setCandidateRows] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState({ ...emptyFilters, customer: initialState.customer || '' });
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
          sheetName: payload.sheetName || 'SF Datadump',
          candidateSheetName: payload.candidateSheetName || 'Candidate Tracker',
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

  const projectL4FilteredRows = useMemo(
    () => activeDemandRows.filter((row) => !filters.projectL4.length || filters.projectL4.includes(row.projectL4)),
    [activeDemandRows, filters.projectL4]
  );

  const statusFilteredRows = useMemo(
    () => projectL4FilteredRows.filter((row) => !filters.statuses.length || filters.statuses.includes(row.status)),
    [filters.statuses, projectL4FilteredRows]
  );

  const customerFilteredRows = useMemo(
    () => statusFilteredRows.filter((row) => !filters.customer || row.customer === filters.customer),
    [filters.customer, statusFilteredRows]
  );

  const options = useMemo(() => ({
    customers: uniqueOptions(statusFilteredRows, 'customer'),
    projectL4: uniqueOptions(activeDemandRows, 'projectL4'),
    statuses: uniqueOptions(projectL4FilteredRows, 'status'),
    pms: uniqueOptions(customerFilteredRows, 'pm'),
    locations: uniqueOptions(customerFilteredRows, 'location')
  }), [activeDemandRows, customerFilteredRows, projectL4FilteredRows, statusFilteredRows]);

  const filteredDemandRows = useMemo(
    () =>
      activeDemandRows.filter((row) => {
        if (!filters.customer || row.customer !== filters.customer) return false;
        if (filters.projectL4.length && !filters.projectL4.includes(row.projectL4)) return false;
        if (filters.statuses.length && !filters.statuses.includes(row.status)) return false;
        if (filters.pms.length && !filters.pms.includes(row.pm)) return false;
        if (filters.locations.length && !filters.locations.includes(row.location)) return false;
        return true;
      }),
    [activeDemandRows, filters]
  );

  const performanceRows = useMemo(
    () => buildCustomerDemandPerformanceRows(filteredDemandRows, candidateRows, filters.drilldown),
    [candidateRows, filteredDemandRows, filters.drilldown]
  );

  const summary = useMemo(() => buildSummary(performanceRows), [performanceRows]);
  const tableRows = useMemo(() => appendTotalRow(performanceRows, summary), [performanceRows, summary]);

  const updateMultiFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, drilldown: '' }));
  };

  const updateCustomer = (value) => {
    setFilters((current) => ({ ...current, customer: value || '', pms: [], locations: [], drilldown: '' }));
  };

  const toggleDrilldown = (field) => {
    setFilters((current) => ({ ...current, drilldown: current.drilldown === field ? '' : field }));
  };

  const openCandidateDetails = (legacyJobReqId) => {
    if (!legacyJobReqId || !navigate) return;
    navigate('resource-fulfilment/candidate-details', { legacyJobReqId });
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Customer Profile Performance</h1>
          <p>Post-TP1 customer screening and TP2/TP3 interview outcomes by demand.</p>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for fulfilment workbook'} {meta.sheetName ? `/ ${meta.sheetName} + ${meta.candidateSheetName}` : ''}
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
          <span>Use Choose Fulfilment Excel to load a workbook that contains SF Datadump and Candidate Tracker.</span>
        </div>
      ) : (
        <>
          <section className="plain-section customer-profile-filter-section">
            <div className="page-title-row compact-row collapsible-section-header">
              <div>
                <h2>Filters</h2>
                <p>Select one customer to review demand-level profile movement after TP1 selection.</p>
              </div>
              <Button variant="outlined" size="small" onClick={() => setFilters(emptyFilters)}>Clear Filters</Button>
            </div>
            <div className="fulfilment-filter-bar customer-profile-filter-bar">
              <MultiSelect label="Project L4" value={filters.projectL4} options={options.projectL4} onChange={(value) => updateMultiFilter('projectL4', value)} />
              <SingleSelect label="Customer" value={filters.customer} options={options.customers} onChange={updateCustomer} required />
              <MultiSelect label="Demand Status" value={filters.statuses} options={options.statuses} onChange={(value) => updateMultiFilter('statuses', value)} />
              <MultiSelect label="PM" value={filters.pms} options={options.pms} onChange={(value) => updateMultiFilter('pms', value)} />
              <MultiSelect label="Location" value={filters.locations} options={options.locations} onChange={(value) => updateMultiFilter('locations', value)} />
            </div>
          </section>

          <section className="kpi-grid compact fulfilment-kpi-grid customer-profile-kpi-grid">
            <KPIWidget label="Demands" value={summary.demands} tone="blue" onClick={() => toggleDrilldown('')} />
            <KPIWidget label="Total Positions" value={summary.totalPositions} tone="green" />
            <KPIWidget label="Open Positions" value={summary.openPositions} tone="amber" />
            <KPIWidget label="Submitted" value={summary.submitted} onClick={() => toggleDrilldown('submitted')} />
            <KPIWidget label="Selected" value={summary.selected} tone="green" onClick={() => toggleDrilldown('selected')} />
            <KPIWidget label="Rejected" value={summary.rejected} tone="red" onClick={() => toggleDrilldown('rejected')} />
            <KPIWidget label="Pending Feedback" value={summary.pendingFeedback} tone="amber" onClick={() => toggleDrilldown('pendingFeedback')} />
            <KPIWidget label="Dropped" value={summary.dropped} tone="red" onClick={() => toggleDrilldown('dropped')} />
            <KPIWidget label="No Show" value={summary.noShow} tone="red" onClick={() => toggleDrilldown('noShow')} />
            <KPIWidget label="Selection %" value={`${summary.selectionPct}%`} tone="green" />
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Customer Demand Profile Performance</h2>
                <p>
                  {filters.customer
                    ? `${performanceRows.length} visible demands for ${filters.customer}${filters.drilldown ? ` / ${formatMetricLabel(filters.drilldown)} > 0` : ''}.`
                    : 'Select a customer to populate demand performance.'}
                </p>
              </div>
              {filters.drilldown ? (
                <Button variant="outlined" size="small" onClick={() => toggleDrilldown(filters.drilldown)}>
                  Clear KPI Drilldown
                </Button>
              ) : null}
            </div>
            <div className="data-grid-shell customer-profile-grid-shell">
              <DataGrid
                rows={tableRows}
                columns={getColumns(openCandidateDetails)}
                autoHeight
                density="compact"
                rowHeight={38}
                columnHeaderHeight={46}
                disableRowSelectionOnClick
                getCellClassName={(params) => getPerformanceCellClass(params.field, params.value)}
                getRowClassName={(params) => params.row.isTotalRow ? 'customer-profile-total-row' : ''}
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                slots={{ toolbar: GridToolbar }}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function SingleSelect({ label, value, options, onChange, required = false }) {
  return (
    <label>
      {label}{required ? ' *' : ''}
      <Autocomplete
        size="small"
        options={options}
        value={value || null}
        onChange={(_, nextValue) => onChange(nextValue || '')}
        renderInput={(params) => <TextField {...params} placeholder={`Select ${label}`} />}
      />
    </label>
  );
}

function MultiSelect({ label, value, options, onChange }) {
  return (
    <label>
      {label}
      <Autocomplete
        multiple
        size="small"
        limitTags={1}
        options={options}
        value={value}
        onChange={(_, nextValue) => onChange(nextValue)}
        renderInput={(params) => <TextField {...params} placeholder={`All ${label}`} />}
      />
    </label>
  );
}

function buildCustomerDemandPerformanceRows(demandRows, candidateRows, drilldown) {
  const candidatesByDemand = groupCandidatesByDemand(candidateRows);

  return demandRows
    .filter((row) => isActiveDemandStatus(row.status) || row.status)
    .map((demand, index) => {
      const demandCandidates = candidatesByDemand.get(String(demand.legacyJobReqId || '').trim()) || [];
      const counts = countCustomerProfileStages(demandCandidates);
      const selected = counts.selected;
      const pendingFeedback = counts.pendingFeedback;
      const submitted = counts.rejected + selected + pendingFeedback + counts.dropped + counts.noShow;
      return {
        id: `${demand.legacyJobReqId || demand.demandId || index}-${index}`,
        serialNumber: index + 1,
        legacyJobReqId: demand.legacyJobReqId || '',
        demandId: demand.demandId || demand.legacyJobReqId || '',
        demandTitle: formatDemandTitle(demand),
        roleSkillCluster: formatRoleSkillCluster(demand),
        customer: demand.customer || '',
        pm: demand.pm || '',
        location: demand.location || '',
        status: demand.status || '',
        totalPositions: Number(demand.totalPositions || 0),
        openPositions: Number(demand.remainingPositions || 0),
        submitted,
        rejected: counts.rejected,
        selected,
        pendingFeedback,
        dropped: counts.dropped,
        noShow: counts.noShow,
        selectionPct: pct(selected, submitted)
      };
    })
    .filter((row) => !drilldown || Number(row[drilldown] || 0) > 0);
}

function groupCandidatesByDemand(candidateRows) {
  const groups = new Map();
  candidateRows.forEach((row) => {
    const key = String(row.sr || '').trim();
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function countCustomerProfileStages(rows) {
  const counts = {
    rejected: 0,
    selected: 0,
    pendingFeedback: 0,
    dropped: 0,
    noShow: 0
  };

  rows.forEach((row) => {
    const status = getStageStatusCode(row.stageStatus);
    Object.entries(stageGroups).forEach(([field, statuses]) => {
      if (statuses.has(status)) counts[field] += 1;
    });
  });

  return counts;
}

function buildSummary(rows) {
  const totalPositions = sumField(rows, 'totalPositions');
  const openPositions = sumField(rows, 'openPositions');
  const submitted = sumField(rows, 'submitted');
  const selected = sumField(rows, 'selected');
  const pendingFeedback = sumField(rows, 'pendingFeedback');

  return {
    demands: rows.length,
    totalPositions,
    openPositions,
    submitted,
    selected,
    rejected: sumField(rows, 'rejected'),
    pendingFeedback,
    dropped: sumField(rows, 'dropped'),
    noShow: sumField(rows, 'noShow'),
    selectionPct: pct(selected, submitted)
  };
}

function appendTotalRow(rows, summary) {
  if (!rows.length) return rows;
  return [
    ...rows,
    {
      id: 'customer-profile-total-row',
      isTotalRow: true,
      serialNumber: '',
      legacyJobReqId: '',
      demandId: '',
      demandTitle: 'Total',
      roleSkillCluster: '',
      totalPositions: summary.totalPositions,
      openPositions: summary.openPositions,
      submitted: summary.submitted,
      rejected: summary.rejected,
      selected: summary.selected,
      pendingFeedback: summary.pendingFeedback,
      dropped: summary.dropped,
      noShow: summary.noShow,
      selectionPct: summary.selectionPct
    }
  ];
}

function getColumns(onOpenCandidates) {
  return [
    { field: 'serialNumber', headerName: 'S No', width: 74, align: 'right', headerAlign: 'right' },
    { field: 'demandTitle', headerName: 'DemandId', minWidth: 170, flex: 0.7 },
    { field: 'roleSkillCluster', headerName: 'Role + Skill Cluster', minWidth: 260, flex: 1.2 },
    { field: 'totalPositions', headerName: 'Total Positions', width: 118, type: 'number' },
    { field: 'openPositions', headerName: 'Open Positions', width: 118, type: 'number' },
    { field: 'submitted', headerName: 'Submitted', width: 104, type: 'number' },
    { field: 'rejected', headerName: 'Rejected', width: 98, type: 'number' },
    { field: 'selected', headerName: 'Selected', width: 96, type: 'number' },
    { field: 'pendingFeedback', headerName: 'Pending Feedback', width: 142, type: 'number' },
    { field: 'dropped', headerName: 'Dropped', width: 96, type: 'number' },
    { field: 'noShow', headerName: 'No Show', width: 96, type: 'number' },
    { field: 'selectionPct', headerName: 'Selection %', width: 108, type: 'number', valueFormatter: (value) => `${value}%` },
    {
      field: 'profiles',
      headerName: 'Profiles',
      width: 116,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button
          size="small"
          startIcon={<OpenInNew fontSize="small" />}
          onClick={() => onOpenCandidates(params.row.legacyJobReqId)}
          disabled={!params.row.legacyJobReqId || params.row.isTotalRow}
        >
          View
        </Button>
      )
    }
  ];
}

function getPerformanceCellClass(field, value) {
  if (field === 'selected' && Number(value || 0) > 0) return 'customer-profile-selected';
  if (['rejected', 'dropped', 'noShow'].includes(field) && Number(value || 0) > 0) return 'customer-profile-rejected';
  if (field === 'pendingFeedback' && Number(value || 0) > 0) return 'customer-profile-pending';
  if (field === 'selectionPct' && Number(value || 0) >= 50) return 'customer-profile-selected';
  return '';
}

function formatRoleSkillCluster(row) {
  const role = String(row.role || '').trim();
  const skillCluster = String(row.skillCluster || '').trim();
  if (role && skillCluster) return `${role} - ${skillCluster}`;
  return role || skillCluster || 'Role not available';
}

function formatDemandTitle(row) {
  const legacyJobReqId = String(row.legacyJobReqId || '').trim();
  const demandId = String(row.demandId || '').trim();
  if (legacyJobReqId && demandId) return `${legacyJobReqId} (${demandId})`;
  return demandId || legacyJobReqId || 'Demand';
}

function getStageStatusCode(value) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)/);
  return match ? match[1] : '';
}

function uniqueOptions(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

function pct(part, whole) {
  const denominator = Number(whole || 0);
  if (!denominator) return 0;
  return Math.round((Number(part || 0) / denominator) * 100);
}

function formatMetricLabel(field) {
  const labels = {
    submitted: 'Submitted',
    rejected: 'Rejected',
    selected: 'Selected',
    pendingFeedback: 'Pending Feedback',
    dropped: 'Dropped',
    noShow: 'No Show'
  };
  return labels[field] || field;
}
