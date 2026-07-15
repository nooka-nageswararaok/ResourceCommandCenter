import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Download, FolderOpen, Refresh } from '@mui/icons-material';
import KPIWidget from '../../components/KPIWidget.jsx';
import { exportRfsSummary, getRfsData, selectRfsExcelFile } from '../../services/rfsService.js';
import { formatPpNumber } from '../../services/ppAnalysis.js';

const rfsQuarters = ['AMJ', 'JAS', 'OND', 'JFM'];

const defaultRfsMonths = [
  { key: 'apr', label: 'APR' },
  { key: 'may', label: 'MAY' },
  { key: 'jun', label: 'JUN' }
];

const initialMeta = {
  fileName: '',
  filePath: '',
  sourceSheetName: '',
  outputSheetName: 'RFS Summary AMJ26',
  promptSheetName: 'RFS Summary Prompt',
  quarter: 'AMJ',
  months: defaultRfsMonths,
  refreshedAt: '',
  warning: ''
};

export default function RFSOverview() {
  const [detailRows, setDetailRows] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [quarter, setQuarter] = useState('AMJ');
  const [filters, setFilters] = useState({ year: '', customerGroups: [], pm: '', eeEnNn: '', onOff: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const loadData = async (picker = false, selectedQuarter = quarter) => {
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const payload = picker ? await selectRfsExcelFile({ quarter: selectedQuarter }) : await getRfsData({ quarter: selectedQuarter });
      if (!payload.canceled) {
        setDetailRows(payload.detailRows || []);
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          sourceSheetName: payload.sourceSheetName || '',
          outputSheetName: payload.outputSheetName || 'RFS Summary AMJ26',
          promptSheetName: payload.promptSheetName || 'RFS Summary Prompt',
          quarter: payload.quarter || selectedQuarter,
          months: payload.months || defaultRfsMonths,
          refreshedAt: payload.refreshedAt || '',
          warning: payload.warning || ''
        });
      }
    } catch (err) {
      setError(err.message || 'Unable to load RFS Tracker workbook.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const monthConfig = meta.months?.length ? meta.months : defaultRfsMonths;
  const summaryColumns = useMemo(() => buildSummaryColumns(monthConfig), [monthConfig]);
  const detailColumns = useMemo(() => buildDetailColumns(monthConfig), [monthConfig]);

  const activeDetailRows = useMemo(
    () => detailRows.filter((row) => String(row.projectStatus).trim().toLowerCase() === 'active'),
    [detailRows]
  );
  const filteredDetailRows = useMemo(
    () =>
      activeDetailRows.filter((row) => {
        if (filters.year && String(row.year || '') !== filters.year) return false;
        if (filters.customerGroups.length && !filters.customerGroups.includes(row.customerGroup)) return false;
        if (filters.pm && row.pm !== filters.pm) return false;
        if (filters.eeEnNn && row.eeEnNn !== filters.eeEnNn) return false;
        if (filters.onOff && row.onOff !== filters.onOff) return false;
        return true;
      }),
    [activeDetailRows, filters.customerGroups, filters.eeEnNn, filters.onOff, filters.pm, filters.year]
  );
  const yearOptions = useMemo(
    () => [...new Set(activeDetailRows.map((row) => String(row.year || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [activeDetailRows]
  );
  const customerGroupOptions = useMemo(
    () => [...new Set(activeDetailRows.map((row) => row.customerGroup).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [activeDetailRows]
  );
  const pmOptions = useMemo(
    () => [...new Set(activeDetailRows.map((row) => row.pm).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [activeDetailRows]
  );
  const eeEnNnOptions = useMemo(
    () => [...new Set(activeDetailRows.map((row) => row.eeEnNn).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [activeDetailRows]
  );
  const onOffOptions = useMemo(
    () => [...new Set(activeDetailRows.map((row) => row.onOff).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [activeDetailRows]
  );
  const filteredSummaryRows = useMemo(() => buildRfsSummary(filteredDetailRows, monthConfig), [filteredDetailRows, monthConfig]);
  const filteredGrandTotal = useMemo(() => buildRfsGrandTotal(filteredSummaryRows, monthConfig), [filteredSummaryRows, monthConfig]);
  const outputRows = useMemo(
    () => buildOutputRows(filteredSummaryRows, filteredGrandTotal, monthConfig),
    [filteredGrandTotal, filteredSummaryRows, monthConfig]
  );
  const detailOutputRows = useMemo(
    () => buildDetailOutputRows(filteredDetailRows, monthConfig),
    [filteredDetailRows, monthConfig]
  );
  const gridRows = useMemo(
    () => (filteredGrandTotal ? [...filteredSummaryRows, filteredGrandTotal] : filteredSummaryRows),
    [filteredGrandTotal, filteredSummaryRows]
  );

  const updateCustomerGroups = (event) => {
    setFilters((current) => ({ ...current, customerGroups: Array.from(event.target.selectedOptions).map((option) => option.value) }));
  };

  const updateYear = (value) => {
    setFilters((current) => ({ ...current, year: value }));
  };

  const updatePm = (value) => {
    setFilters((current) => ({ ...current, pm: value }));
  };

  const updateEeEnNn = (value) => {
    setFilters((current) => ({ ...current, eeEnNn: value }));
  };

  const updateOnOff = (value) => {
    setFilters((current) => ({ ...current, onOff: value }));
  };

  const updateQuarter = (value) => {
    setQuarter(value);
    setFilters({ year: '', customerGroups: [], pm: '', eeEnNn: '', onOff: '' });
    loadData(false, value);
  };

  const handleExport = async () => {
    setStatus('Preparing RFS export...');
    try {
      const result = await exportRfsSummary({
        rows: outputRows,
        detailRows: detailOutputRows,
        outputSheetName: meta.outputSheetName
      });
      setStatus(result.canceled ? 'Export cancelled.' : `RFS workbook saved: ${result.filePath}`);
    } catch (err) {
      setStatus(err.message || 'Unable to export RFS summary.');
    }
  };

  const handleDetailExport = async () => {
    setStatus('Preparing Active Source Detail export...');
    try {
      const result = await exportRfsSummary({
        rows: detailOutputRows,
        outputSheetName: 'Active Source Detail'
      });
      setStatus(result.canceled ? 'Export cancelled.' : `Active Source Detail saved: ${result.filePath}`);
    } catch (err) {
      setStatus(err.message || 'Unable to export Active Source Detail.');
    }
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>RFS Tracker</h1>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for RFS Tracker workbook'} {meta.sourceSheetName ? `/ ${meta.sourceSheetName}` : ''}
          </p>
          <p>Loaded: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
        </div>
        <div className="page-actions">
          <Button variant="outlined" startIcon={<FolderOpen />} onClick={() => loadData(true, quarter)} disabled={loading}>
            Choose RFS Excel
          </Button>
          <Button variant="contained" startIcon={<Refresh />} onClick={() => loadData(false, quarter)} disabled={loading}>
            Refresh RFS
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExport} disabled={loading || !filteredSummaryRows.length}>
            Export RFS
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="state-panel">
          <CircularProgress />
          <span>Loading RFS Tracker workbook...</span>
        </div>
      ) : error ? (
        <div className="state-panel error">{error}</div>
      ) : meta.warning ? (
        <div className="state-panel">
          <strong>{meta.warning}</strong>
          <span>Choose an RFS Tracker Excel file to continue.</span>
        </div>
      ) : (
        <>
          {status && <div className="status-banner">{status}</div>}

          <section className="rfs-filter-bar">
            <label>
              RFS Quarter
              <select value={quarter} onChange={(event) => updateQuarter(event.target.value)}>
                {rfsQuarters.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Year
              <select value={filters.year} onChange={(event) => updateYear(event.target.value)}>
                <option value="">All</option>
                {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Customer Group
              <select className="multi-select" multiple value={filters.customerGroups} onChange={updateCustomerGroups}>
                {customerGroupOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Project Manager
              <select value={filters.pm} onChange={(event) => updatePm(event.target.value)}>
                <option value="">All</option>
                {pmOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              EE/EN/NN
              <select value={filters.eeEnNn} onChange={(event) => updateEeEnNn(event.target.value)}>
                <option value="">All</option>
                {eeEnNnOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              On/Off
              <select value={filters.onOff} onChange={(event) => updateOnOff(event.target.value)}>
                <option value="">All</option>
                {onOffOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </section>

          <section className="kpi-grid compact">
            <KPIWidget label="Customer Groups" value={filteredSummaryRows.length} />
            <KPIWidget label="Active Projects" value={filteredDetailRows.length} tone="blue" />
            {monthConfig.map((month) => (
              <KPIWidget key={month.key} label={`${month.label} RFS`} value={formatPpNumber(filteredGrandTotal?.[`${month.key}Rfs`])} tone="green" />
            ))}
            <KPIWidget label="Total RFS" value={formatPpNumber(filteredGrandTotal?.totalRfs)} tone="amber" />
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>{meta.outputSheetName}</h2>
                <p>Project Status = Active; RFS = Firm + Most Probable by month</p>
              </div>
            </div>
            <div className="data-grid-shell">
              <DataGrid
                rows={gridRows}
                columns={summaryColumns}
                autoHeight
                hideFooter
                density="compact"
                rowHeight={34}
                columnHeaderHeight={38}
                getRowClassName={(params) => params.row.id === 'grand-total' ? 'rfs-grand-total-row' : ''}
              />
            </div>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Active Source Detail</h2>
                <p>{filteredDetailRows.length} active rows from {meta.sourceSheetName}</p>
              </div>
              <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleDetailExport} disabled={loading || !filteredDetailRows.length}>
                Export Detail
              </Button>
            </div>
            <div className="data-grid-shell">
              <DataGrid
                rows={filteredDetailRows}
                columns={detailColumns}
                autoHeight
                density="compact"
                rowHeight={32}
                columnHeaderHeight={38}
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              />
            </div>
          </section>

        </>
      )}
    </main>
  );
}

function buildSummaryColumns(months) {
  return [
    { field: 'customerGroup', headerName: 'Customer Group', minWidth: 260, flex: 1 },
    ...months.map((month) => ({
      field: `${month.key}Rfs`,
      headerName: `${month.label} RFS`,
      width: 140,
      type: 'number',
      valueFormatter: (value) => formatPpNumber(value)
    })),
    { field: 'totalRfs', headerName: 'Total RFS', width: 150, type: 'number', valueFormatter: (value) => formatPpNumber(value) }
  ];
}

function buildDetailColumns(months) {
  return [
    { field: 'year', headerName: 'Year', width: 100 },
    { field: 'customerGroup', headerName: 'Customer Group', minWidth: 220 },
    { field: 'customerName', headerName: 'Customer Name', minWidth: 230, flex: 1 },
    { field: 'projectStatus', headerName: 'Status', width: 110 },
    { field: 'projectCode', headerName: 'Project Code', width: 130 },
    { field: 'projectName', headerName: 'Project Name', minWidth: 260, flex: 1 },
    { field: 'pm', headerName: 'PM', width: 130 },
    { field: 'eeEnNn', headerName: 'EE/EN/NN', width: 120 },
    { field: 'onOff', headerName: 'On/Off', width: 110 },
    ...months.flatMap((month) => [
      {
        field: `${month.key}Firm`,
        headerName: `${month.label} Firm`,
        width: 120,
        type: 'number',
        valueFormatter: (value) => formatPpNumber(value)
      },
      {
        field: `${month.key}Mp`,
        headerName: `${month.label} MP`,
        width: 120,
        type: 'number',
        valueFormatter: (value) => formatPpNumber(value)
      }
    ])
  ];
}

function buildDetailOutputRows(rows, months) {
  return rows.map((row) => {
    const output = {
      Year: row.year || '',
      'Customer Group': row.customerGroup || '',
      'Customer Name': row.customerName || '',
      Status: row.projectStatus || '',
      'Project Code': row.projectCode || '',
      'Project Name': row.projectName || '',
      PM: row.pm || '',
      'EE/EN/NN': row.eeEnNn || '',
      'On/Off': row.onOff || ''
    };
    months.forEach((month) => {
      output[`${month.label} Firm`] = Math.round(row[`${month.key}Firm`] || 0);
      output[`${month.label} MP`] = Math.round(row[`${month.key}Mp`] || 0);
    });
    return output;
  });
}

function buildOutputRows(summaryRows, grandTotal, months) {
  const formatRow = (row) => {
    const output = { 'Customer Group': row.customerGroup };
    months.forEach((month) => {
      output[`${month.label} RFS`] = Math.round(row[`${month.key}Rfs`] || 0);
    });
    output['Total RFS'] = Math.round(row.totalRfs || 0);
    return output;
  };

  return [
    ...summaryRows.map(formatRow),
    ...(grandTotal ? [formatRow(grandTotal)] : [])
  ];
}

function buildRfsSummary(rows, months) {
  const groups = new Map();
  rows.forEach((row) => {
    const customerGroup = row.customerGroup || 'Unassigned';
    if (!groups.has(customerGroup)) {
      const summary = { id: customerGroup, customerGroup, totalRfs: 0 };
      months.forEach((month) => {
        summary[`${month.key}Rfs`] = 0;
      });
      groups.set(customerGroup, summary);
    }
    const summary = groups.get(customerGroup);
    months.forEach((month) => {
      summary[`${month.key}Rfs`] += Number(row[`${month.key}Firm`] || 0) + Number(row[`${month.key}Mp`] || 0);
    });
    summary.totalRfs = months.reduce((sum, month) => sum + Number(summary[`${month.key}Rfs`] || 0), 0);
  });

  return [...groups.values()].sort((a, b) => a.customerGroup.localeCompare(b.customerGroup));
}

function buildRfsGrandTotal(rows, months) {
  if (!rows.length) return null;
  const total = { id: 'grand-total', customerGroup: 'Grand Total', totalRfs: 0 };
  months.forEach((month) => {
    total[`${month.key}Rfs`] = 0;
  });
  rows.forEach((row) => {
    months.forEach((month) => {
      total[`${month.key}Rfs`] += Number(row[`${month.key}Rfs`] || 0);
    });
    total.totalRfs += Number(row.totalRfs || 0);
  });
  return total;
}
