import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { FolderOpen, OpenInNew, Refresh } from '@mui/icons-material';
import KPIWidget from '../../components/KPIWidget.jsx';
import { getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';
import { buildDemandFunnel, buildDemandSummary } from '../../services/fulfilmentAnalysis.js';

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'Active SR',
  refreshedAt: '',
  warning: ''
};

const emptyFilters = {
  customers: [],
  statuses: [],
  months: [],
  pms: [],
  offshoreOnsite: [],
  locations: [],
  bands: [],
  cuMappings: []
};

export default function ActiveDemandsDashboard({ navigate }) {
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
        setRows(payload.activeDemandRows || []);
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          sheetName: payload.sheetName || 'Active SR',
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

  const statusFilteredRows = useMemo(
    () => rows.filter((row) => !filters.statuses.length || filters.statuses.includes(row.status)),
    [filters.statuses, rows]
  );

  const customerFilteredRows = useMemo(
    () => statusFilteredRows.filter((row) => !filters.customers.length || filters.customers.includes(row.customer)),
    [filters.customers, statusFilteredRows]
  );

  const options = useMemo(() => ({
    statuses: uniqueOptions(rows, 'status'),
    customers: uniqueOptions(statusFilteredRows, 'customer'),
    months: sortMonths(uniqueOptions(customerFilteredRows, 'demandMonth')),
    pms: uniqueOptions(customerFilteredRows, 'pm'),
    offshoreOnsite: uniqueOptions(customerFilteredRows, 'offshoreOnsite'),
    locations: uniqueOptions(customerFilteredRows, 'location'),
    bands: uniqueOptions(customerFilteredRows, 'band'),
    cuMappings: uniqueOptions(customerFilteredRows, 'cuMapping')
  }), [customerFilteredRows, rows, statusFilteredRows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (filters.customers.length && !filters.customers.includes(row.customer)) return false;
        if (filters.statuses.length && !filters.statuses.includes(row.status)) return false;
        if (filters.months.length && !filters.months.includes(row.demandMonth)) return false;
        if (filters.pms.length && !filters.pms.includes(row.pm)) return false;
        if (filters.offshoreOnsite.length && !filters.offshoreOnsite.includes(row.offshoreOnsite)) return false;
        if (filters.locations.length && !filters.locations.includes(row.location)) return false;
        if (filters.bands.length && !filters.bands.includes(row.band)) return false;
        if (filters.cuMappings.length && !filters.cuMappings.includes(row.cuMapping)) return false;
        return true;
      }),
    [filters, rows]
  );

  const summary = useMemo(() => buildDemandSummary(filteredRows), [filteredRows]);
  const funnelRows = useMemo(() => buildDemandFunnel(filteredRows), [filteredRows]);

  const updateMultiFilter = (field, event) => {
    setFilters((current) => ({
      ...current,
      [field]: Array.from(event.target.selectedOptions).map((option) => option.value)
    }));
  };

  const openCandidateDetails = (legacyJobReqId) => {
    if (!legacyJobReqId || !navigate) return;
    navigate('resource-fulfilment/candidate-details', { legacyJobReqId });
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Active Demands Dashboard</h1>
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
          <span>Use Choose Fulfilment Excel to load a workbook that contains the Active SR sheet.</span>
        </div>
      ) : (
        <>
          <section className="kpi-grid compact fulfilment-kpi-grid">
            <KPIWidget label="Active Demands" value={summary.activeDemandCount} tone="blue" />
            <KPIWidget label="Total Positions" value={summary.totalPositions} tone="green" />
            <KPIWidget label="Remaining" value={summary.remainingPositions} tone="amber" />
            <KPIWidget label="Profiles" value={summary.profilesReceived} />
            <KPIWidget label="Onboarded" value={summary.onboarded} tone="green" />
            <KPIWidget label="Fulfilment %" value={`${summary.fulfilmentPct}%`} tone="green" />
            <KPIWidget label="Aging >30" value={summary.aging30} tone="amber" />
            <KPIWidget label="Aging >60" value={summary.aging60} tone="red" />
            <KPIWidget label="Zero Profiles" value={summary.zeroProfiles} tone="red" />
            <KPIWidget label="Stale Demands" value={summary.staleDemands} tone="red" />
          </section>

          <section className="plain-section compact-funnel-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Demand Funnel</h2>
                <p>Leadership view of open demand movement through fulfilment stages.</p>
              </div>
            </div>
            <div className="fulfilment-funnel">
              {funnelRows.map((stage) => (
                <div className="funnel-step" key={stage.id}>
                  <strong>{stage.count === null ? '--' : stage.count}</strong>
                  <span>{stage.stage}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="fulfilment-filter-bar active-demand-filter-bar">
            <MultiSelect label="Status" value={filters.statuses} options={options.statuses} onChange={(event) => updateMultiFilter('statuses', event)} />
            <MultiSelect label="Customer" value={filters.customers} options={options.customers} onChange={(event) => updateMultiFilter('customers', event)} />
            <MultiSelect label="Month" value={filters.months} options={options.months} onChange={(event) => updateMultiFilter('months', event)} />
            <MultiSelect label="PM" value={filters.pms} options={options.pms} onChange={(event) => updateMultiFilter('pms', event)} />
            <MultiSelect label="Offshore/Onsite" value={filters.offshoreOnsite} options={options.offshoreOnsite} onChange={(event) => updateMultiFilter('offshoreOnsite', event)} />
            <MultiSelect label="Location" value={filters.locations} options={options.locations} onChange={(event) => updateMultiFilter('locations', event)} />
            <MultiSelect label="Band" value={filters.bands} options={options.bands} onChange={(event) => updateMultiFilter('bands', event)} />
            <MultiSelect label="CU Mapping" value={filters.cuMappings} options={options.cuMappings} onChange={(event) => updateMultiFilter('cuMappings', event)} />
            <div className="filter-action-cell">
              <Button variant="outlined" onClick={() => setFilters(emptyFilters)}>Clear Filters</Button>
            </div>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Active Demand Heatmap</h2>
                <p>{filteredRows.length} visible demands. Filter-only fields are excluded from each card.</p>
              </div>
            </div>
            <div className="active-demand-card-heatmap">
              {filteredRows.map((row) => (
                <DemandCard key={row.id} row={row} onOpenCandidates={openCandidateDetails} />
              ))}
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

function DemandCard({ row, onOpenCandidates }) {
  const riskClass = Number(row.agingDays || 0) > 60 ? 'high' : Number(row.remainingPositions || 0) > 0 ? 'medium' : 'low';
  const demandType = isBillingLoss(row.billingLoss) ? 'Billing Loss' : 'Pro Active';
  const demandTitle = formatDemandTitle(row);

  return (
    <article className={`active-demand-card ${riskClass}`} title={row.role}>
      <div className="active-demand-card-title">
        <strong>{demandTitle}</strong>
        <Button
          size="small"
          startIcon={<OpenInNew fontSize="small" />}
          onClick={() => onOpenCandidates(row.legacyJobReqId)}
          disabled={!row.legacyJobReqId}
        >
          View
        </Button>
      </div>
      <span className={`active-demand-billing ${isBillingLoss(row.billingLoss) ? 'billing-loss' : 'pro-active'}`}>
        {demandType}
      </span>
      <span className="active-demand-role">{row.role || 'Role not available'}</span>
      <div className="active-demand-card-grid">
        <Metric label="Total" value={row.totalPositions} />
        <Metric label="Remaining" value={row.remainingPositions} />
        <Metric label="Aging" value={row.agingDays} />
        <Metric label="Profiles" value={row.profilesReceived} />
        <Metric label="TP1" value={row.tp1Selected} />
        <Metric label="TP2" value={row.tp2ClientSelected} />
        <Metric label="TP3" value={row.tp3ClientSelected} />
        <Metric label="Onboarded" value={row.onboarded} />
        <Metric label="Renege" value={row.renege} />
      </div>
    </article>
  );
}

function formatDemandTitle(row) {
  const legacyJobReqId = String(row.legacyJobReqId || '').trim();
  const demandId = String(row.demandId || '').trim();
  if (legacyJobReqId && demandId) return `${legacyJobReqId} (${demandId})`;
  return legacyJobReqId || demandId || 'Demand';
}

function isBillingLoss(value) {
  return /^y(es)?$/i.test(String(value || '').trim());
}

function Metric({ label, value }) {
  return (
    <span>
      <b>{value ?? '--'}</b>
      <i>{label}</i>
    </span>
  );
}
