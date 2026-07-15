import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { Download, FolderOpen, Refresh } from '@mui/icons-material';
import KPIWidget from '../../components/KPIWidget.jsx';
import { exportFulfilmentSnapshot, getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';
import {
  buildAgingHeatmapRows,
  buildCustomerRiskRows,
  buildFulfilmentActions,
  buildFulfilmentExportSheets,
  buildPmRiskRows,
  buildRoleHotspotRows,
  buildWeeklySnapshot
} from '../../services/fulfilmentAnalysis.js';

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'SF Datadump',
  candidateSheetName: 'Candidate Tracker',
  refreshedAt: '',
  warning: ''
};

export default function FulfilmentLeadershipReview() {
  const [demandRows, setDemandRows] = useState([]);
  const [candidateRows, setCandidateRows] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const loadData = async (picker = false) => {
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const payload = picker ? await selectFulfilmentExcelFile() : await getFulfilmentData();
      if (!payload.canceled) {
        setDemandRows(payload.activeDemandRows || []);
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

  const actions = useMemo(() => buildFulfilmentActions(demandRows, candidateRows), [candidateRows, demandRows]);
  const customerRiskRows = useMemo(() => buildCustomerRiskRows(demandRows), [demandRows]);
  const pmRiskRows = useMemo(() => buildPmRiskRows(demandRows), [demandRows]);
  const roleHotspotRows = useMemo(() => buildRoleHotspotRows(demandRows, candidateRows), [candidateRows, demandRows]);
  const customerHeatmapRows = useMemo(() => buildAgingHeatmapRows(demandRows, 'customer'), [demandRows]);
  const pmHeatmapRows = useMemo(() => buildAgingHeatmapRows(demandRows, 'pm'), [demandRows]);
  const weeklySnapshot = useMemo(() => buildWeeklySnapshot(demandRows, candidateRows, actions), [actions, candidateRows, demandRows]);

  const handleExport = async () => {
    setStatus('Preparing fulfilment leadership snapshot...');
    try {
      const result = await exportFulfilmentSnapshot({ sheets: buildFulfilmentExportSheets(demandRows, candidateRows) });
      setStatus(result.canceled ? 'Export cancelled.' : `Fulfilment snapshot saved: ${result.filePath}`);
    } catch (err) {
      setStatus(err.message || 'Unable to export fulfilment snapshot.');
    }
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Fulfilment Leadership Review</h1>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for fulfilment workbook'} / {meta.sheetName} + {meta.candidateSheetName}
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
          <Button variant="outlined" startIcon={<Download />} onClick={handleExport} disabled={loading || !demandRows.length}>
            Export Snapshot
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
          {status && <div className="status-banner">{status}</div>}
          <section className="kpi-grid compact">
            <KPIWidget label="Open Actions" value={actions.length} tone="amber" />
            <KPIWidget label="Critical Actions" value={actions.filter((action) => action.severity === 'Critical').length} tone="red" />
            <KPIWidget label="High Actions" value={actions.filter((action) => action.severity === 'High').length} tone="red" />
            <KPIWidget label="Customer Risk Items" value={customerRiskRows.filter((row) => row.riskFlag !== 'Stable').length} tone="amber" />
            <KPIWidget label="PM Risk Items" value={pmRiskRows.filter((row) => row.riskFlag !== 'Stable').length} tone="amber" />
            <KPIWidget label="Role Hotspots" value={roleHotspotRows.filter((row) => row.riskFlag !== 'Stable').length} tone="blue" />
          </section>

          <GridSection
            title="Fulfilment Action Queue"
            subtitle="Rule-based leadership action items across active demands and candidate pipeline."
            rows={actions}
            columns={actionColumns}
            getRowClassName={(params) => `fulfilment-severity-${String(params.row.severity || '').toLowerCase()}`}
          />

          <section className="chart-grid two-column">
            <div className="plain-section">
              <h2>Customer Risk Board</h2>
              <DataGrid
                rows={customerRiskRows.slice(0, 20)}
                columns={riskColumns('Customer')}
                autoHeight
                density="compact"
                rowHeight={32}
                columnHeaderHeight={38}
                hideFooter
                getCellClassName={(params) => params.field === 'riskFlag' ? `risk-flag-${String(params.value || '').toLowerCase()}` : ''}
              />
            </div>
            <Heatmap title="Customer Aging Heatmap" rows={customerHeatmapRows} />
          </section>

          <section className="chart-grid two-column">
            <div className="plain-section">
              <h2>PM Accountability Board</h2>
              <DataGrid
                rows={pmRiskRows.slice(0, 20)}
                columns={riskColumns('PM', true)}
                autoHeight
                density="compact"
                rowHeight={32}
                columnHeaderHeight={38}
                hideFooter
                getCellClassName={(params) => params.field === 'riskFlag' ? `risk-flag-${String(params.value || '').toLowerCase()}` : ''}
              />
            </div>
            <Heatmap title="PM Aging Heatmap" rows={pmHeatmapRows} compact />
          </section>

          <GridSection
            title="Role Hotspot View"
            subtitle="Roles with aging, low pipeline, rejection, or conversion concerns."
            rows={roleHotspotRows.slice(0, 50)}
            columns={roleColumns}
          />

          <SnapshotBlocks title="Weekly Snapshot" rows={weeklySnapshot} />
        </>
      )}
    </main>
  );
}

function GridSection({ title, subtitle, rows, columns, getRowClassName, hideToolbar = false }) {
  return (
    <section className="plain-section">
      <div className="page-title-row compact-row">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="data-grid-shell">
        <DataGrid
          rows={rows}
          columns={columns}
          autoHeight
          density="compact"
          rowHeight={34}
          columnHeaderHeight={40}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          slots={hideToolbar ? {} : { toolbar: GridToolbar }}
          getRowClassName={getRowClassName}
        />
      </div>
    </section>
  );
}

function Heatmap({ title, rows, compact = false }) {
  return (
    <div className="plain-section">
      <h2>{title}</h2>
      <DataGrid
        rows={rows}
        columns={compact ? compactHeatmapColumns : heatmapColumns}
        autoHeight
        density="compact"
        rowHeight={32}
        columnHeaderHeight={38}
        hideFooter
        getCellClassName={(params) => ['31-60', '61-90', '>90'].includes(params.field) && Number(params.value) > 0 ? `aging-cell-${params.field.replace(/[^0-9]/g, '') || '90'}` : ''}
      />
    </div>
  );
}

function SnapshotBlocks({ title, rows }) {
  const numericValues = rows.map((row) => Number(String(row.Value).replace(/[^0-9.-]/g, '')) || 0);
  const maxValue = Math.max(...numericValues, 1);

  return (
    <section className="plain-section">
      <h2>{title}</h2>
      <div className="fulfilment-block-heatmap snapshot-blocks">
        {rows.map((row) => {
          const value = Number(String(row.Value).replace(/[^0-9.-]/g, '')) || 0;
          const intensity = value / maxValue;
          const level = intensity > 0.75 ? 'high' : intensity > 0.4 ? 'medium' : 'low';
          return (
            <div className={`fulfilment-heat-block ${level}`} key={row.Metric} title={`${row.Metric}: ${row.Value}`}>
              <strong>{row.Value}</strong>
              <span>{row.Metric}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const actionColumns = [
  { field: 'severity', headerName: 'Severity', width: 105 },
  { field: 'actionType', headerName: 'Action Type', minWidth: 190 },
  { field: 'customer', headerName: 'Customer', minWidth: 190 },
  { field: 'pm', headerName: 'PM', width: 140 },
  { field: 'legacyJobReqId', headerName: 'Legacy Job Req Id', width: 190 },
  { field: 'role', headerName: 'Role', minWidth: 240, flex: 1 },
  { field: 'agingDays', headerName: 'Aging', width: 95, type: 'number' },
  { field: 'remainingPositions', headerName: 'Remaining', width: 120, type: 'number' },
  { field: 'bottleneck', headerName: 'Current Bottleneck', minWidth: 280, flex: 1 },
  { field: 'recommendedAction', headerName: 'Recommended Action', minWidth: 320, flex: 1.2 },
  { field: 'owner', headerName: 'Owner', width: 160 },
  { field: 'dueDate', headerName: 'Due Date', width: 120 },
  { field: 'status', headerName: 'Status', width: 110 },
  { field: 'comments', headerName: 'Comments', width: 220, editable: true }
];

function riskColumns(nameHeader, compact = false) {
  if (compact) {
    return [
      { field: 'name', headerName: nameHeader, minWidth: 130, flex: 1 },
      { field: 'riskFlag', headerName: 'Risk', width: 78 },
      { field: 'riskScore', headerName: 'Score', width: 66, type: 'number' },
      { field: 'demandCount', headerName: 'Dem', width: 62, type: 'number' },
      { field: 'remainingPositions', headerName: 'Rem', width: 66, type: 'number' },
      { field: 'aged60', headerName: '>60', width: 58, type: 'number' },
      { field: 'zeroProfileDemands', headerName: '0 Prof', width: 68, type: 'number' },
      { field: 'fulfilmentPct', headerName: 'Ful %', width: 68, type: 'number', valueFormatter: (value) => `${value}%` }
    ];
  }

  return [
    { field: 'name', headerName: nameHeader, minWidth: 220, flex: 1 },
    { field: 'riskFlag', headerName: 'Risk', width: 105 },
    { field: 'riskScore', headerName: 'Score', width: 85, type: 'number' },
    { field: 'demandCount', headerName: 'Demands', width: 100, type: 'number' },
    { field: 'remainingPositions', headerName: 'Remaining', width: 115, type: 'number' },
    { field: 'aged60', headerName: '>60', width: 75, type: 'number' },
    { field: 'zeroProfileDemands', headerName: 'Zero Profiles', width: 120, type: 'number' },
    { field: 'fulfilmentPct', headerName: 'Fulfil %', width: 100, type: 'number', valueFormatter: (value) => `${value}%` }
  ];
}

const roleColumns = [
  { field: 'name', headerName: 'Role', minWidth: 260, flex: 1 },
  { field: 'riskFlag', headerName: 'Risk', width: 130 },
  { field: 'demandCount', headerName: 'Demands', width: 105, type: 'number' },
  { field: 'remainingPositions', headerName: 'Remaining', width: 120, type: 'number' },
  { field: 'profilesReceived', headerName: 'Profiles', width: 110, type: 'number' },
  { field: 'rejectionCount', headerName: 'Rejected', width: 110, type: 'number' },
  { field: 'avgAging', headerName: 'Avg Aging', width: 110, type: 'number' },
  { field: 'fulfilmentPct', headerName: 'Fulfil %', width: 100, type: 'number', valueFormatter: (value) => `${value}%` }
];

const heatmapColumns = [
  { field: 'name', headerName: 'Group', minWidth: 220, flex: 1 },
  { field: '0-15', headerName: '0-15', width: 90, type: 'number' },
  { field: '16-30', headerName: '16-30', width: 90, type: 'number' },
  { field: '31-60', headerName: '31-60', width: 90, type: 'number' },
  { field: '61-90', headerName: '61-90', width: 90, type: 'number' },
  { field: '>90', headerName: '>90', width: 90, type: 'number' },
  { field: 'total', headerName: 'Total', width: 90, type: 'number' }
];

const compactHeatmapColumns = [
  { field: 'name', headerName: 'Group', minWidth: 130, flex: 1 },
  { field: '0-15', headerName: '0-15', width: 58, type: 'number' },
  { field: '16-30', headerName: '16-30', width: 64, type: 'number' },
  { field: '31-60', headerName: '31-60', width: 64, type: 'number' },
  { field: '61-90', headerName: '61-90', width: 64, type: 'number' },
  { field: '>90', headerName: '>90', width: 58, type: 'number' },
  { field: 'total', headerName: 'Total', width: 64, type: 'number' }
];
