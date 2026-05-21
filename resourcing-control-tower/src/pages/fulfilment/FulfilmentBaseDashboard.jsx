import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { FolderOpen, Refresh } from '@mui/icons-material';
import KPIWidget from '../../components/KPIWidget.jsx';
import { getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';

const initialMeta = {
  fileName: '',
  filePath: '',
  fulfilmentDetailsSheetName: 'Fulfillment Details 2025&2026',
  refreshedAt: '',
  warning: ''
};

const emptyFilters = {
  months: [],
  customers: [],
  locations: [],
  hiringModes: [],
  dms: [],
  psas: []
};

export default function FulfilmentBaseDashboard() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (picker = false) => {
    setLoading(true);
    setError('');
    try {
      const payload = picker ? await selectFulfilmentExcelFile() : await getFulfilmentData();
      if (!payload.canceled) {
        setRows(payload.fulfilmentDetailRows || []);
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          fulfilmentDetailsSheetName: payload.fulfilmentDetailsSheetName || 'Fulfillment Details 2025&2026',
          refreshedAt: payload.refreshedAt || '',
          warning: payload.warning || ''
        });
      }
    } catch (err) {
      setError(err.message || 'Unable to load fulfilment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const options = useMemo(() => ({
    months: sortMonths(uniqueOptions(rows, 'month')),
    customers: uniqueOptions(rows, 'customer'),
    locations: uniqueOptions(rows, 'location'),
    hiringModes: uniqueOptions(rows, 'hiringMode'),
    dms: uniqueOptions(rows, 'dm'),
    psas: uniqueOptions(rows, 'psa')
  }), [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (filters.months.length && !filters.months.includes(row.month)) return false;
        if (filters.customers.length && !filters.customers.includes(row.customer)) return false;
        if (filters.locations.length && !filters.locations.includes(row.location)) return false;
        if (filters.hiringModes.length && !filters.hiringModes.includes(row.hiringMode)) return false;
        if (filters.dms.length && !filters.dms.includes(row.dm)) return false;
        if (filters.psas.length && !filters.psas.includes(row.psa)) return false;
        return true;
      }),
    [filters, rows]
  );

  const summary = useMemo(() => ({
    totalFulfilments: sumField(filteredRows, 'count'),
    candidateCount: filteredRows.length,
    customerCount: uniqueOptions(filteredRows, 'customer').length,
    locationCount: uniqueOptions(filteredRows, 'location').length,
    internalHiring: filteredRows.filter((row) => /internal/i.test(row.hiringMode)).reduce((sum, row) => sum + Number(row.count || 0), 0),
    lateralHiring: filteredRows.filter((row) => /external|lateral/i.test(row.hiringMode)).reduce((sum, row) => sum + Number(row.count || 0), 0)
  }), [filteredRows]);

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
          <h1>Fulfilment Base Dashboard</h1>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for fulfilment workbook'} / {meta.fulfilmentDetailsSheetName}
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
          <span>Loading fulfilment details...</span>
        </div>
      ) : error ? (
        <div className="state-panel error">{error}</div>
      ) : meta.warning ? (
        <div className="state-panel">
          <strong>{meta.warning}</strong>
          <span>Use Choose Fulfilment Excel to load a workbook that contains Fulfillment Details 2025&2026.</span>
        </div>
      ) : (
        <>
          <section className="kpi-grid compact">
            <KPIWidget label="Total Fulfilments" value={summary.totalFulfilments} tone="green" />
            <KPIWidget label="Customers" value={summary.customerCount} />
            <KPIWidget label="Locations" value={summary.locationCount} />
            <KPIWidget label="Internal Hiring" value={summary.internalHiring} tone="amber" />
            <KPIWidget label="Lateral Hiring" value={summary.lateralHiring} tone="blue" />
          </section>

          <section className="fulfilment-filter-bar base-filter-bar">
            <MultiSelect label="Month" value={filters.months} options={options.months} onChange={(event) => updateMultiFilter('months', event)} />
            <MultiSelect label="Customer" value={filters.customers} options={options.customers} onChange={(event) => updateMultiFilter('customers', event)} />
            <MultiSelect label="Location" value={filters.locations} options={options.locations} onChange={(event) => updateMultiFilter('locations', event)} />
            <MultiSelect label="Hiring Mode" value={filters.hiringModes} options={options.hiringModes} onChange={(event) => updateMultiFilter('hiringModes', event)} />
            <MultiSelect label="DM" value={filters.dms} options={options.dms} onChange={(event) => updateMultiFilter('dms', event)} />
            <MultiSelect label="PSA" value={filters.psas} options={options.psas} onChange={(event) => updateMultiFilter('psas', event)} />
            <div className="filter-action-cell">
              <Button variant="outlined" onClick={() => setFilters(emptyFilters)}>Clear Filters</Button>
            </div>
          </section>

          <section className="chart-grid two-column">
            <BlockHeatmap title="Customer Wise Heatmap" rows={aggregateRows(filteredRows, 'customer', 'Customer')} />
            <BlockHeatmap title="DM Wise Heatmap" rows={aggregateRows(filteredRows, 'dm', 'DM')} />
          </section>

          <section className="chart-grid two-column">
            <GroupGrid title="Hiring Mode Wise" rows={aggregateRows(filteredRows, 'hiringMode', 'Hiring Mode')} />
            <GroupGrid title="Location Wise" rows={aggregateRows(filteredRows, 'location', 'Location')} />
          </section>

          <section className="chart-grid two-column">
            <BlockHeatmap title="PSA Wise Heatmap" rows={aggregateRows(filteredRows, 'psa', 'PSA')} />
            <BlockHeatmap title="Month Wise Heatmap" rows={aggregateRows(filteredRows, 'month', 'Month', true)} />
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Fulfilment Details</h2>
                <p>{filteredRows.length} visible rows from base sheet.</p>
              </div>
            </div>
            <div className="data-grid-shell">
              <DataGrid
                rows={filteredRows}
                columns={detailColumns}
                autoHeight
                density="compact"
                rowHeight={32}
                columnHeaderHeight={40}
                disableRowSelectionOnClick
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

function GroupGrid({ title, rows }) {
  return (
    <div className="plain-section">
      <h2>{title}</h2>
      <DataGrid
        rows={rows}
        columns={groupColumns}
        autoHeight
        density="compact"
        rowHeight={32}
        columnHeaderHeight={38}
        hideFooter
      />
    </div>
  );
}

function BlockHeatmap({ title, rows }) {
  const maxValue = Math.max(...rows.map((row) => row.fulfilments), 1);

  return (
    <div className="plain-section">
      <h2>{title}</h2>
      <div className="fulfilment-block-heatmap">
        {rows.slice(0, 60).map((row) => {
          const intensity = row.fulfilments / maxValue;
          const level = intensity > 0.75 ? 'high' : intensity > 0.4 ? 'medium' : 'low';
          return (
            <div className={`fulfilment-heat-block ${level}`} key={row.id} title={`${row.name}: ${row.fulfilments}`}>
              <strong>{row.fulfilments}</strong>
              <span>{row.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function aggregateRows(rows, field, label, monthSort = false) {
  const groups = new Map();
  rows.forEach((row) => {
    const name = row[field] || 'Unassigned';
    if (!groups.has(name)) {
      groups.set(name, {
        id: `${label}-${name}`,
        name,
        fulfilments: 0,
        candidateRows: 0,
        customers: new Set(),
        locations: new Set()
      });
    }
    const group = groups.get(name);
    group.fulfilments += Number(row.count || 0);
    group.candidateRows += 1;
    if (row.customer) group.customers.add(row.customer);
    if (row.location) group.locations.add(row.location);
  });

  const output = [...groups.values()].map((row) => ({
    ...row,
    customers: row.customers.size,
    locations: row.locations.size
  }));

  return output.sort((a, b) => monthSort ? monthOrder(a.name) - monthOrder(b.name) : b.fulfilments - a.fulfilments);
}

function uniqueOptions(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function sortMonths(months) {
  return [...months].sort((a, b) => monthOrder(a) - monthOrder(b));
}

function monthOrder(value) {
  const monthName = String(value || '').slice(0, 3).toLowerCase();
  const index = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName);
  const year = Number(String(value || '').match(/\d{2,4}/)?.[0] || 0);
  return (year * 12) + (index < 0 ? 99 : index);
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

const groupColumns = [
  { field: 'name', headerName: 'Group', minWidth: 220, flex: 1 },
  { field: 'fulfilments', headerName: 'Fulfilments', width: 130, type: 'number' },
  { field: 'customers', headerName: 'Customers', width: 120, type: 'number' },
  { field: 'locations', headerName: 'Locations', width: 120, type: 'number' }
];

const detailColumns = [
  { field: 'month', headerName: 'Month', width: 110 },
  { field: 'customer', headerName: 'Customer', minWidth: 190, flex: 0.8 },
  { field: 'location', headerName: 'Location', width: 130 },
  { field: 'hiringMode', headerName: 'Hiring Mode', width: 165 },
  { field: 'dm', headerName: 'DM', width: 140 },
  { field: 'psa', headerName: 'PSA', width: 130 },
  { field: 'count', headerName: 'Count', width: 90, type: 'number' },
  { field: 'candidateName', headerName: 'Candidate Name', minWidth: 220, flex: 1 },
  { field: 'sapId', headerName: 'SAP ID', width: 120 },
  { field: 'sr', headerName: 'SR#', width: 190 },
  { field: 'joiningDate', headerName: 'Joining/FS Date', width: 145 },
  { field: 'comments', headerName: 'Comments', minWidth: 220, flex: 1 }
];
