import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, TextField, Tooltip } from '@mui/material';
import { Email, FolderOpen, OpenInNew, Refresh } from '@mui/icons-material';
import KPIWidget from '../../components/KPIWidget.jsx';
import ResourceTable from '../../components/ResourceTable.jsx';
import { draftHtmlEmail, getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';

const DEFAULT_PROJECT_L4 = 'ERS VDU-MEGA-MFG-DIGITAL ENGG1';
const MAX_HEATMAP_CARDS = 600;

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'SF Datadump',
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
  projectL4: [],
  cuMappings: [],
  billingTypes: [],
  billingLossAging: [],
  billingLossProfileStates: []
};

const defaultFilters = {
  ...emptyFilters,
  projectL4: [DEFAULT_PROJECT_L4]
};

const stageMetricCodes = {
  tp1: new Set([
    '2.01', '2.02', '2.03', '2.04', '2.05', '2.06', '2.07',
    '2.08', '2.09', '2.10', '2.13', '2.14', '2.15', '2.16'
  ]),
  tp2: new Set(['3.01', '3.02', '3.03', '3.04', '3.08', '3.09', '3.10', '3.11']),
  customer: new Set(['3.12', '3.14', '3.15']),
  onboarding: new Set([
    '4.01', '4.02', '4.03', '4.04', '4.05', '4.06', '4.07', '4.08', '4.09', '4.1', '4.10',
    '5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'
  ]),
  renege: new Set(['5.7'])
};

export default function ActiveDemandsDashboard({ navigate, resourceRecords = [] }) {
  const [rows, setRows] = useState([]);
  const [candidateRows, setCandidateRows] = useState([]);
  const [demandMasterRows, setDemandMasterRows] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState(defaultFilters);
  const [collapsedPanels, setCollapsedPanels] = useState({ dataQuality: false, billingLoss: false });
  const [selectedMatchDemand, setSelectedMatchDemand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (picker = false) => {
    setLoading(true);
    setError('');
    try {
      const payload = picker ? await selectFulfilmentExcelFile() : await getFulfilmentData();
      if (!payload.canceled) {
        setRows(payload.activeDemandRows || []);
        setCandidateRows(payload.candidateRows || []);
        setDemandMasterRows(payload.demandMasterRows || []);
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          sheetName: payload.sheetName || 'SF Datadump',
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
    () => rows.filter((row) => !filters.projectL4.length || filters.projectL4.includes(row.projectL4)),
    [filters.projectL4, rows]
  );

  const statusFilteredRows = useMemo(
    () => projectL4FilteredRows.filter((row) => !filters.statuses.length || filters.statuses.includes(row.status)),
    [filters.statuses, projectL4FilteredRows]
  );

  const customerFilteredRows = useMemo(
    () => statusFilteredRows.filter((row) => !filters.customers.length || filters.customers.includes(row.customer)),
    [filters.customers, statusFilteredRows]
  );

  const options = useMemo(() => ({
    projectL4: uniqueOptions(rows, 'projectL4'),
    statuses: uniqueOptions(projectL4FilteredRows, 'status'),
    customers: uniqueOptions(statusFilteredRows, 'customer'),
    months: sortMonths(uniqueOptions(customerFilteredRows, 'demandMonth')),
    pms: uniqueOptions(customerFilteredRows, 'pm'),
    offshoreOnsite: uniqueOptions(customerFilteredRows, 'offshoreOnsite'),
    locations: uniqueOptions(customerFilteredRows, 'location'),
    bands: uniqueOptions(customerFilteredRows, 'band'),
    cuMappings: uniqueOptions(customerFilteredRows, 'cuMapping')
  }), [customerFilteredRows, projectL4FilteredRows, rows, statusFilteredRows]);

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
        if (filters.projectL4.length && !filters.projectL4.includes(row.projectL4)) return false;
        if (filters.cuMappings.length && !filters.cuMappings.includes(row.cuMapping)) return false;
        if (filters.billingTypes.length && !filters.billingTypes.includes(getBillingType(row))) return false;
        if (filters.billingLossAging.length && !filters.billingLossAging.some((bucket) => matchesBillingLossAging(row, bucket))) return false;
        if (filters.billingLossProfileStates.length && !filters.billingLossProfileStates.some((state) => matchesBillingLossProfileState(row, state))) return false;
        return true;
      }),
    [filters, rows]
  );

  const summary = useMemo(() => buildSfDemandSummary(filteredRows), [filteredRows]);
  const stageMetricCounts = useMemo(() => buildStageMetricCounts(candidateRows), [candidateRows]);
  const funnelRows = useMemo(() => buildDemandFunnelFromSfRows(filteredRows), [filteredRows]);
  const billingLossSummary = useMemo(() => buildBillingLossSummary(filteredRows), [filteredRows]);
  const filteredCandidateRows = useMemo(
    () => (hasDemandFilters(filters) ? filterCandidateRowsByDemands(candidateRows, filteredRows) : candidateRows),
    [candidateRows, filteredRows, filters]
  );
  const dataReadiness = useMemo(
    () => buildDataReadiness(filteredRows, filteredCandidateRows, demandMasterRows),
    [demandMasterRows, filteredCandidateRows, filteredRows]
  );
  const internalMatchMap = useMemo(
    () => buildInternalMatchMap(filteredRows, resourceRecords),
    [filteredRows, resourceRecords]
  );
  const heatmapRows = useMemo(() => filteredRows.slice(0, MAX_HEATMAP_CARDS), [filteredRows]);
  const selectedMatchRows = selectedMatchDemand
    ? internalMatchMap.get(getDemandMatchKey(selectedMatchDemand)) || []
    : [];

  const updateMultiFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  };

  const openCandidateDetails = (legacyJobReqId) => {
    if (!legacyJobReqId || !navigate) return;
    navigate('resource-fulfilment/candidate-details', { legacyJobReqId });
  };

  const openInternalMatches = (demand) => {
    setSelectedMatchDemand(demand);
  };

  const applyBillingLossDrilldown = (filterPatch) => {
    setFilters((current) => ({
      ...current,
      billingTypes: [],
      billingLossAging: [],
      billingLossProfileStates: [],
      ...filterPatch
    }));
  };

  const clearBillingLossDrilldown = () => {
    setFilters((current) => ({
      ...current,
      billingTypes: [],
      billingLossAging: [],
      billingLossProfileStates: []
    }));
  };

  const togglePanel = (panel) => {
    setCollapsedPanels((current) => ({ ...current, [panel]: !current[panel] }));
  };

  const draftBillingLossEmail = async (item) => {
    const matchingRows = getBillingLossSummaryRows(filteredRows, item);
    const draft = buildBillingLossEmailDraft({
      item,
      rows: matchingRows,
      stageMetricCounts,
      meta
    });
    try {
      await draftHtmlEmail({ subject: draft.subject, htmlBody: draft.htmlBody });
    } catch {
      window.location.href = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(stripHtmlToText(draft.htmlBody))}`;
    }
  };

  const draftActiveDemandEmail = async () => {
    const draft = buildActiveDemandEmailDraft(filteredRows);
    try {
      await draftHtmlEmail({ subject: draft.subject, htmlBody: draft.htmlBody });
    } catch {
      window.location.href = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(stripHtmlToText(draft.htmlBody))}`;
    }
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
          <span>Use Choose Fulfilment Excel to load a workbook that contains the SF Datadump sheet.</span>
        </div>
      ) : (
        <>
          <section className="kpi-grid compact fulfilment-kpi-grid">
            <KPIWidget label="Filtered Demands" value={summary.activeDemandCount} tone="blue" />
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
                <p>Leadership view of filtered SF demand movement through fulfilment stages.</p>
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

          <section className="plain-section">
            <div className="page-title-row compact-row collapsible-section-header">
              <div>
                <h2>Data Quality Panel</h2>
                <p>Weighted readiness checks across SF Datadump, Candidate Tracker, and Demand Master.</p>
              </div>
              <Button variant="outlined" size="small" onClick={() => togglePanel('dataQuality')}>
                {collapsedPanels.dataQuality ? 'Expand' : 'Collapse'}
              </Button>
            </div>
            {!collapsedPanels.dataQuality ? (
              <div className="data-readiness-panel">
                <div className={`data-readiness-score ${dataReadiness.level}`} title={dataReadiness.caption}>
                  <span>Data Readiness Score</span>
                  <strong>{dataReadiness.displayScore}</strong>
                  <b>{dataReadiness.status}</b>
                  <small>{dataReadiness.caption}</small>
                </div>
                <div className="fulfilment-block-heatmap data-quality-panel">
                  {dataReadiness.checks.map((item) => (
                    <div className={`fulfilment-heat-block ${item.level}`} key={item.id} title={item.caption}>
                      <strong>{item.displayValue}</strong>
                      <span>{item.label}</span>
                      <small>{item.caption}</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row collapsible-section-header">
              <div>
                <h2>Billing Loss Summary</h2>
                <p>Click a card to drill into the matching Active Demand Heatmap scope.</p>
              </div>
              <div className="page-actions">
                {hasBillingLossDrilldown(filters) ? <Button variant="outlined" size="small" onClick={clearBillingLossDrilldown}>Clear Billing Drilldown</Button> : null}
                <Button variant="outlined" size="small" onClick={() => togglePanel('billingLoss')}>
                  {collapsedPanels.billingLoss ? 'Expand' : 'Collapse'}
                </Button>
              </div>
            </div>
            {!collapsedPanels.billingLoss ? (
              <div className="fulfilment-block-heatmap billing-loss-summary">
                {billingLossSummary.map((item) => {
                  const emailRows = getBillingLossSummaryRows(filteredRows, item);
                  return (
                    <div className={`billing-loss-summary-card ${item.level}`} key={item.id}>
                      <button
                        className={`fulfilment-heat-block ${item.level}`}
                        type="button"
                        title={`${item.label}: ${item.displayValue}`}
                        onClick={() => applyBillingLossDrilldown(item.filterPatch)}
                      >
                        <strong>{item.displayValue}</strong>
                        <span>{item.label}</span>
                        {item.caption ? <small>{item.caption}</small> : null}
                      </button>
                      <Tooltip title="Draft email">
                        <span>
                          <IconButton
                            aria-label={`Draft email for ${item.label}`}
                            className="billing-loss-email"
                            disabled={!emailRows.length}
                            onClick={() => draftBillingLossEmail(item)}
                            size="small"
                          >
                            <Email fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="plain-section active-demand-filter-section">
            <div className="page-title-row compact-row collapsible-section-header">
              <div>
                <h2>Filters</h2>
                <p>Limit active demand cards by SF demand attributes.</p>
              </div>
              <Button variant="outlined" size="small" onClick={() => setFilters(emptyFilters)}>Clear Filters</Button>
            </div>
            <div className="fulfilment-filter-bar active-demand-filter-bar">
              <MultiSelect label="Project L4" value={filters.projectL4} options={options.projectL4} onChange={(value) => updateMultiFilter('projectL4', value)} />
              <MultiSelect label="Status" value={filters.statuses} options={options.statuses} onChange={(value) => updateMultiFilter('statuses', value)} />
              <MultiSelect label="Customer" value={filters.customers} options={options.customers} onChange={(value) => updateMultiFilter('customers', value)} />
              <MultiSelect label="Month" value={filters.months} options={options.months} onChange={(value) => updateMultiFilter('months', value)} />
              <MultiSelect label="Hiring Manager" value={filters.pms} options={options.pms} onChange={(value) => updateMultiFilter('pms', value)} />
              <MultiSelect label="Offshore/Onsite" value={filters.offshoreOnsite} options={options.offshoreOnsite} onChange={(value) => updateMultiFilter('offshoreOnsite', value)} />
              <MultiSelect label="Location" value={filters.locations} options={options.locations} onChange={(value) => updateMultiFilter('locations', value)} />
              <MultiSelect label="Band" value={filters.bands} options={options.bands} onChange={(value) => updateMultiFilter('bands', value)} />
              <MultiSelect label="CU Mapping" value={filters.cuMappings} options={options.cuMappings} onChange={(value) => updateMultiFilter('cuMappings', value)} />
            </div>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Active Demand Heatmap</h2>
                <p>
                  {filteredRows.length} visible demands
                  {filteredRows.length > heatmapRows.length ? `, showing first ${heatmapRows.length}` : ''}.
                  Filter-only fields are excluded from each card.
                </p>
              </div>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Email />}
                onClick={draftActiveDemandEmail}
                disabled={!filteredRows.length}
              >
                Email Demands
              </Button>
            </div>
            <div className="active-demand-card-heatmap">
              {heatmapRows.map((row) => (
                <DemandCard
                  key={row.id}
                  row={row}
                  stageCounts={stageMetricCounts.get(String(row.legacyJobReqId || '').trim())}
                  internalMatchCount={(internalMatchMap.get(getDemandMatchKey(row)) || []).length}
                  onOpenCandidates={openCandidateDetails}
                  onOpenInternalMatches={openInternalMatches}
                />
              ))}
            </div>
          </section>

          <Dialog open={Boolean(selectedMatchDemand)} onClose={() => setSelectedMatchDemand(null)} maxWidth="xl" fullWidth>
            <DialogTitle>
              Potential Internal Matches - {selectedMatchDemand ? formatDemandTitle(selectedMatchDemand) : ''}
            </DialogTitle>
            <DialogContent>
              <p className="internal-match-dialog-caption">
                {selectedMatchDemand ? formatRoleSkillCluster(selectedMatchDemand) : ''}
              </p>
              {selectedMatchRows.length ? (
                <ResourceTable rows={selectedMatchRows} height={520} />
              ) : (
                <div className="state-panel internal-match-empty">
                  No matching internal bench/Y-Code resources found.
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
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

function buildBillingLossSummary(rows) {
  const billingRows = rows.filter((row) => isBillingLoss(row.billingLoss));
  const totalValue = billingRows.reduce((sum, row) => sum + parseDollarValue(row.billingLossValue), 0);
  const topCustomer = topGroup(billingRows, 'customer');
  const aging30 = billingRows.filter((row) => Number(row.agingDays || 0) > 30).length;
  const aging60 = billingRows.filter((row) => Number(row.agingDays || 0) > 60).length;
  const zeroProfiles = billingRows.filter((row) => Number(row.profilesReceived || 0) === 0).length;

  return [
    {
      id: 'billing-loss-count',
      label: 'Billing Loss Demands',
      displayValue: billingRows.length,
      caption: `${rows.length} visible demands`,
      filterPatch: { billingTypes: ['Billing Loss'] },
      level: billingRows.length ? 'high' : 'low'
    },
    {
      id: 'billing-loss-value',
      label: 'Billing Loss Value',
      displayValue: formatDollarValue(totalValue),
      caption: 'Column Q total',
      filterPatch: { billingTypes: ['Billing Loss'] },
      level: totalValue > 0 ? 'high' : 'low'
    },
    {
      id: 'billing-loss-aging-30',
      label: 'Aging >30',
      displayValue: aging30,
      caption: 'Billing loss demands',
      filterPatch: { billingTypes: ['Billing Loss'], billingLossAging: ['gt30'] },
      level: aging30 ? 'medium' : 'low'
    },
    {
      id: 'billing-loss-aging-60',
      label: 'Aging >60',
      displayValue: aging60,
      caption: 'Billing loss demands',
      filterPatch: { billingTypes: ['Billing Loss'], billingLossAging: ['gt60'] },
      level: aging60 ? 'medium' : 'low'
    },
    {
      id: 'billing-loss-zero-profiles',
      label: 'Zero Profiles',
      displayValue: zeroProfiles,
      caption: 'Billing loss demands',
      filterPatch: { billingTypes: ['Billing Loss'], billingLossProfileStates: ['zeroProfiles'] },
      level: zeroProfiles ? 'high' : 'low'
    },
    {
      id: 'billing-loss-customer',
      label: topCustomer.name || 'Top Customer',
      displayValue: topCustomer.count,
      caption: 'Billing loss demand count',
      filterPatch: {
        billingTypes: ['Billing Loss'],
        customers: topCustomer.name ? [topCustomer.name] : []
      },
      level: topCustomer.count ? 'medium' : 'low'
    }
  ];
}

function buildDataReadiness(demandRows = [], candidateRows = [], demandMasterRows = []) {
  const sfRequired = buildSfRequiredFieldsCheck(demandRows);
  const stageDateChain = buildStageDateChainCheck(candidateRows);
  const closedDate = buildClosedDateCheck(demandRows);
  const srMatch = buildSrMatchCheck(demandRows, candidateRows);
  const demandMaster = buildDemandMasterCoverageCheck(demandRows, demandMasterRows);
  const checks = [sfRequired, stageDateChain, closedDate, srMatch, demandMaster];
  const scoredChecks = checks.filter((check) => check.score !== null);
  const totalWeight = scoredChecks.reduce((sum, check) => sum + check.weight, 0);
  const score = totalWeight
    ? Math.round(scoredChecks.reduce((sum, check) => sum + (check.score * check.weight), 0) / totalWeight)
    : null;

  return {
    displayScore: score === null ? 'N/A' : `${score}%`,
    status: getReadinessStatus(score),
    level: getReadinessLevel(score),
    caption: scoredChecks.length
      ? 'Weighted score across source-field, stage-date, closure, SR-match, and Demand Master checks.'
      : 'No readiness inputs available.',
    checks
  };
}

function hasDemandFilters(filters) {
  return Boolean(
    filters.customers.length ||
    filters.statuses.length ||
    filters.months.length ||
    filters.pms.length ||
    filters.offshoreOnsite.length ||
    filters.locations.length ||
    filters.bands.length ||
    filters.projectL4.length ||
    filters.cuMappings.length ||
    filters.billingTypes.length ||
    filters.billingLossAging.length ||
    filters.billingLossProfileStates.length
  );
}

function filterCandidateRowsByDemands(candidateRows = [], demandRows = []) {
  const demandIds = buildDemandIdSet(demandRows);
  if (!demandIds.size) return [];
  return candidateRows.filter((row) => demandIds.has(normalizeDemandKey(row.sr)));
}

function buildSfRequiredFieldsCheck(demandRows) {
  const issues = demandRows.reduce((sum, row) => {
    let rowIssues = 0;
    if (!String(row.pm || '').trim()) rowIssues += 1;
    if (!String(row.customer || '').trim()) rowIssues += 1;
    if (isBillingLoss(row.billingLoss) && !String(row.billingLossValue ?? '').trim()) rowIssues += 1;
    return sum + rowIssues;
  }, 0);
  const totalChecks = demandRows.reduce((sum, row) => sum + (isBillingLoss(row.billingLoss) ? 3 : 2), 0);
  const score = totalChecks ? pct(totalChecks - issues, totalChecks) : null;
  return {
    id: 'sf-required-fields',
    label: 'SF Required Fields',
    displayValue: score === null ? 'N/A' : `${score}%`,
    caption: score === null ? 'No SF Datadump rows' : `${issues} issues / ${demandRows.length} rows`,
    score,
    weight: 25,
    level: getReadinessLevel(score)
  };
}

function buildStageDateChainCheck(candidateRows) {
  const scopedRows = candidateRows.filter((row) => String(row.stageStatus || '').trim());
  const incomplete = scopedRows.filter((row) => !hasCompleteStageDateChain(row)).length;
  const score = scopedRows.length ? pct(scopedRows.length - incomplete, scopedRows.length) : null;
  return {
    id: 'stage-date-chain',
    label: 'Stage Date Chain',
    displayValue: score === null ? 'N/A' : `${score}%`,
    caption: score === null ? 'No Candidate Tracker stage rows' : `${incomplete} issues / ${scopedRows.length} candidates`,
    score,
    weight: 25,
    level: getReadinessLevel(score)
  };
}

function buildClosedDateCheck(demandRows) {
  const closedRows = demandRows.filter((row) => isClosedDemand(row.status));
  const missing = closedRows.filter((row) => !String(row.closedDate || '').trim()).length;
  const score = closedRows.length ? pct(closedRows.length - missing, closedRows.length) : null;
  return {
    id: 'closed-date',
    label: 'Closed Date',
    displayValue: score === null ? 'N/A' : `${score}%`,
    caption: score === null ? 'No closed SF demands' : `${missing} missing / ${closedRows.length} closed demands`,
    score,
    weight: 20,
    level: getReadinessLevel(score)
  };
}

function buildSrMatchCheck(demandRows, candidateRows) {
  const demandIds = buildDemandIdSet(demandRows);
  const candidateRowsWithSr = candidateRows.filter((row) => String(row.sr || '').trim());
  const mismatches = candidateRowsWithSr.filter((row) => !demandIds.has(normalizeDemandKey(row.sr))).length;
  const score = candidateRowsWithSr.length ? pct(candidateRowsWithSr.length - mismatches, candidateRowsWithSr.length) : null;
  return {
    id: 'sr-match-rate',
    label: 'SR Match Rate',
    displayValue: score === null ? 'N/A' : `${score}%`,
    caption: score === null ? 'No Candidate Tracker SR values' : `${mismatches} mismatches / ${candidateRowsWithSr.length} candidate SRs`,
    score,
    weight: 20,
    level: getReadinessLevel(score)
  };
}

function buildDemandMasterCoverageCheck(demandRows, demandMasterRows) {
  if (!demandMasterRows.length) {
    return {
      id: 'demand-master-coverage',
      label: 'Demand Master Coverage',
      displayValue: 'N/A',
      caption: 'Demand Master sheet not found or empty',
      score: null,
      weight: 10,
      level: 'medium'
    };
  }

  const masterIds = buildDemandIdSet(demandMasterRows);
  const openHoldRows = demandRows.filter((row) => isOpenOrHoldDemand(row.status));
  const missing = openHoldRows.filter((row) => !rowMatchesDemandIdSet(row, masterIds)).length;
  const score = openHoldRows.length ? pct(openHoldRows.length - missing, openHoldRows.length) : null;
  return {
    id: 'demand-master-coverage',
    label: 'Demand Master Coverage',
    displayValue: score === null ? 'N/A' : missing,
    caption: score === null ? 'No open/hold SF demands' : `${score}% covered; open/hold SF demands not in Demand Master`,
    score,
    weight: 10,
    level: getReadinessLevel(score)
  };
}

function hasCompleteStageDateChain(row) {
  const stageCode = getStageStatusCode(row.stageStatus);
  const requiredFields = getRequiredStageDateFields(stageCode);
  return requiredFields.every((field) => String(row[field] || '').trim());
}

function getRequiredStageDateFields(stageCode) {
  if (!stageCode) return ['profileReceivedDate'];
  const stageNumber = Number(stageCode);
  if (!Number.isFinite(stageNumber)) return ['profileReceivedDate'];
  if (stageNumber >= 5) return ['profileReceivedDate', 'screenDate', 'tp1Date', 'tp2Date', 'offerDate'];
  if (stageNumber >= 4) return ['profileReceivedDate', 'screenDate', 'tp1Date', 'tp2Date', 'customerFeedbackDate'];
  if (stageNumber >= 3) return ['profileReceivedDate', 'screenDate', 'tp1Date', 'tp2Date'];
  if (stageNumber >= 2) return ['profileReceivedDate', 'screenDate', 'tp1Date'];
  return ['profileReceivedDate'];
}

function buildDemandIdSet(rows) {
  const ids = new Set();
  rows.forEach((row) => {
    [row.legacyJobReqId, row.demandId].forEach((value) => {
      const key = normalizeDemandKey(value);
      if (key) ids.add(key);
    });
  });
  return ids;
}

function rowMatchesDemandIdSet(row, idSet) {
  return idSet.has(normalizeDemandKey(row.legacyJobReqId)) || idSet.has(normalizeDemandKey(row.demandId));
}

function normalizeDemandKey(value) {
  return String(value || '').trim().toUpperCase();
}

function getReadinessStatus(score) {
  if (score === null) return 'Not Available';
  if (score >= 95) return 'Ready';
  if (score >= 80) return 'Watch';
  return 'Action Needed';
}

function getReadinessLevel(score) {
  if (score === null) return 'medium';
  if (score >= 95) return 'low';
  if (score >= 80) return 'medium';
  return 'high';
}

function buildSfDemandSummary(rows = []) {
  const totalPositions = sumRowField(rows, 'totalPositions');
  const remainingPositions = sumRowField(rows, 'remainingPositions');
  const profilesReceived = sumRowField(rows, 'profilesReceived');
  const onboarded = sumRowField(rows, 'onboarded');
  const fulfilledPositions = Math.max(totalPositions - remainingPositions, 0);

  return {
    activeDemandCount: rows.length,
    totalPositions,
    remainingPositions,
    profilesReceived,
    onboarded,
    fulfilmentPct: pct(fulfilledPositions, totalPositions),
    aging30: rows.filter((row) => Number(row.agingDays || 0) > 30).length,
    aging60: rows.filter((row) => Number(row.agingDays || 0) > 60).length,
    zeroProfiles: rows.filter((row) => Number(row.remainingPositions || 0) > 0 && Number(row.profilesReceived || 0) === 0).length,
    staleDemands: rows.filter(isStaleDemand).length
  };
}

function buildDemandFunnelFromSfRows(rows) {
  return [
    { id: 'remaining', stage: 'Remaining', count: sumRowField(rows, 'remainingPositions') },
    { id: 'profiles', stage: 'Profiles', count: sumRowField(rows, 'profilesReceived') },
    { id: 'tp1', stage: 'TP1', count: sumRowField(rows, 'tp1Selected') },
    { id: 'tp2', stage: 'TP2', count: sumRowField(rows, 'tp2ClientSelected') },
    { id: 'customer', stage: 'Customer', count: sumRowField(rows, 'tp3ClientSelected') },
    { id: 'onboarded', stage: 'Onboarded', count: sumRowField(rows, 'onboarded') },
    { id: 'renege', stage: 'Renege', count: sumRowField(rows, 'renege') }
  ];
}

function buildStageMetricCounts(candidateRows) {
  const countMap = new Map();

  candidateRows.forEach((row) => {
    const demandId = String(row.sr || '').trim();
    const stageCode = getStageStatusCode(row.stageStatus);
    if (!demandId || !stageCode) return;

    const counts = countMap.get(demandId) || { tp1: 0, tp2: 0, customer: 0, onboarding: 0, renege: 0 };
    if (stageMetricCodes.tp1.has(stageCode)) counts.tp1 += 1;
    if (stageMetricCodes.tp2.has(stageCode)) counts.tp2 += 1;
    if (stageMetricCodes.customer.has(stageCode)) counts.customer += 1;
    if (stageMetricCodes.onboarding.has(stageCode)) counts.onboarding += 1;
    if (stageMetricCodes.renege.has(stageCode)) counts.renege += 1;
    countMap.set(demandId, counts);
  });

  return countMap;
}

function buildInternalMatchMap(demandRows = [], resourceRows = []) {
  const internalPool = resourceRows.filter((resource) => resource.benchFlag);
  const matchMap = new Map();

  demandRows.forEach((demand) => {
    const matches = internalPool.filter((resource) => resourceMatchesDemand(demand, resource));
    matchMap.set(getDemandMatchKey(demand), matches);
  });

  return matchMap;
}

function resourceMatchesDemand(demand, resource) {
  if (!matchesLocation(demand.location, resource.location)) return false;
  if (!matchesBand(demand.band, resource)) return false;

  const demandTokens = tokenizeMatchText(`${demand.role || ''} ${demand.skillCluster || ''}`);
  if (!demandTokens.size) return false;

  const resourceTokens = tokenizeMatchText([
    ...(Array.isArray(resource.skills) ? resource.skills : []),
    resource.capability,
    resource.skillCluster
  ].join(' '));

  return [...demandTokens].some((token) => resourceTokens.has(token));
}

function matchesLocation(demandLocation, resourceLocation) {
  const demandValue = normalizeMatchText(demandLocation);
  const resourceValue = normalizeMatchText(resourceLocation);
  return Boolean(demandValue && resourceValue && demandValue === resourceValue);
}

function matchesBand(demandBand, resource) {
  const demandValue = normalizeBandValue(demandBand);
  if (!demandValue) return false;

  const resourceBand = normalizeBandValue(resource.band);
  const resourceSubBand = normalizeBandValue(resource.subBand);
  if (demandValue.includes('.')) return demandValue === resourceSubBand;
  return demandValue === resourceBand || resourceSubBand.startsWith(`${demandValue}.`);
}

function getDemandMatchKey(row) {
  return normalizeDemandKey(row?.legacyJobReqId) || normalizeDemandKey(row?.demandId) || String(row?.id || '');
}

function normalizeMatchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeBandValue(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').trim();
}

function tokenizeMatchText(value) {
  const stopWords = new Set([
    'and', 'the', 'for', 'with', 'ltd', 'hcl', 'senior', 'lead', 'engineer',
    'developer', 'specialist', 'consultant', 'associate', 'technical', 'resource',
    'role', 'l1', 'l2', 'l3', 'l4'
  ]);

  return new Set(
    normalizeMatchText(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stopWords.has(token))
  );
}

function getBillingLossSummaryRows(rows, item) {
  return rows.filter((row) => matchesBillingLossSummaryItem(row, item));
}

function matchesBillingLossSummaryItem(row, item) {
  const patch = item?.filterPatch || {};
  if (patch.billingTypes?.length && !patch.billingTypes.includes(getBillingType(row))) return false;
  if (patch.billingLossAging?.length && !patch.billingLossAging.some((bucket) => matchesBillingLossAging(row, bucket))) return false;
  if (patch.billingLossProfileStates?.length && !patch.billingLossProfileStates.some((state) => matchesBillingLossProfileState(row, state))) return false;
  if (patch.customers?.length && !patch.customers.includes(row.customer)) return false;
  return true;
}

function buildBillingLossEmailDraft({ item, rows, stageMetricCounts, meta }) {
  const subject = `Billing Loss Summary - ${item.label}`;
  const filters = [
    ['Summary Card', item.label],
    ['Card Value', item.displayValue],
    ['Matching Demand Count', rows.length],
    ['Source Sheet', meta.sheetName || 'SF Datadump'],
    ['Workbook', meta.fileName]
  ];
  const headers = [
    'Demand',
    'Billing',
    'Billing Loss Value',
    'Role / Skill Cluster',
    'Total',
    'Remaining',
    'Aging',
    'Profiles',
    'TP1',
    'TP2',
    'Customer',
    'Onboarded',
    'Renege',
    'Demand Customer',
    'Status'
  ];
  const rowValues = rows.map((row) => {
    const stageCounts = stageMetricCounts.get(String(row.legacyJobReqId || '').trim()) || {};
    return [
      formatDemandTitle(row),
      getBillingType(row),
      isBillingLoss(row.billingLoss) ? formatDollarValue(row.billingLossValue) : '',
      formatRoleSkillCluster(row),
      row.totalPositions,
      row.remainingPositions,
      row.agingDays,
      row.profilesReceived,
      stageCounts.tp1 || 0,
      stageCounts.tp2 || 0,
      stageCounts.customer || 0,
      stageCounts.onboarding || 0,
      stageCounts.renege || 0,
      row.customer,
      isOnHoldDemand(row.status) ? 'ON HOLD' : row.status
    ];
  });

  return {
    subject,
    htmlBody: buildHtmlEmailBody({ title: item.label, filters, headers, rowValues })
  };
}

function buildActiveDemandEmailDraft(rows) {
  const headers = ['Demand', 'Role / Skill Cluster', 'Band', 'Remaining', 'Location', 'Status'];
  const rowValues = rows.map((row) => [
    formatDemandTitle(row),
    formatRoleSkillCluster(row),
    row.band,
    row.remainingPositions,
    row.location,
    isOnHoldDemand(row.status) ? 'ON HOLD' : row.status
  ]);

  return {
    subject: 'Active Positions - Referral Request',
    htmlBody: buildActiveDemandEmailBody({ headers, rowValues })
  };
}

function buildHtmlEmailBody({ title, filters, headers, rowValues }) {
  const summaryRows = filters
    .map(([label, value]) => `
      <tr>
        <th style="text-align:left;padding:8px 10px;border:1px solid #d9e2ec;background:#f4f7fb;color:#334454;width:220px;">${escapeHtml(label)}</th>
        <td style="padding:8px 10px;border:1px solid #d9e2ec;color:#17202a;">${escapeHtml(formatEmailValue(value))}</td>
      </tr>
    `)
    .join('');
  const headerCells = headers
    .map((header) => `<th style="padding:8px 10px;border:1px solid #c8d3df;background:#244354;color:#ffffff;text-align:left;font-weight:700;">${escapeHtml(header)}</th>`)
    .join('');
  const demandRows = rowValues.length
    ? rowValues
      .map((values, index) => `
        <tr style="background:${index % 2 ? '#f8fafc' : '#ffffff'};">
          ${values.map((value) => `<td style="padding:8px 10px;border:1px solid #d9e2ec;color:#17202a;vertical-align:top;">${escapeHtml(formatEmailValue(value))}</td>`).join('')}
        </tr>
      `)
      .join('')
    : `<tr><td colspan="${headers.length}" style="padding:10px;border:1px solid #d9e2ec;color:#607080;">No demand rows matched this Billing Loss Summary card.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
    <div style="font-size:14px;line-height:1.45;">
      <p>Hi Team,</p>
      <p>Please find below the active demand heatmap details filtered from the Billing Loss Summary card for <strong>${escapeHtml(formatEmailValue(title))}</strong>.</p>

      <h3 style="margin:18px 0 8px;color:#244354;font-size:16px;">Filter Summary</h3>
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:760px;margin-bottom:18px;">
        <tbody>${summaryRows}</tbody>
      </table>

      <h3 style="margin:18px 0 8px;color:#244354;font-size:16px;">Active Demand Heatmap Details</h3>
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${demandRows}</tbody>
      </table>

      <p style="margin-top:18px;">Regards,<br/>Resource Fulfilment Team</p>
    </div>
  </body>
</html>`.trim();
}

function buildActiveDemandEmailBody({ headers, rowValues }) {
  const intro = "We have several active positions within our Delivery Unit that require immediate onboarding. We encourage you to refer qualified candidates from your network, both internal and external. When sharing profiles, please provide the candidate's updated resume along with their availability (earliest joining date) to help us expedite the hiring process.\n\nYour referrals can help us quickly identify the right talent and strengthen our team. Please find the list of open positions below.";
  const headerCells = headers
    .map((header) => `<th style="padding:8px 10px;border:1px solid #c8d3df;background:#244354;color:#ffffff;text-align:left;font-weight:700;">${escapeHtml(header)}</th>`)
    .join('');
  const demandRows = rowValues.length
    ? rowValues
      .map((values, index) => `
        <tr style="background:${index % 2 ? '#f8fafc' : '#ffffff'};">
          ${values.map((value) => `<td style="padding:8px 10px;border:1px solid #d9e2ec;color:#17202a;vertical-align:top;">${escapeHtml(formatEmailValue(value))}</td>`).join('')}
        </tr>
      `)
      .join('')
    : `<tr><td colspan="${headers.length}" style="padding:10px;border:1px solid #d9e2ec;color:#607080;">No demand rows available.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
    <div style="font-size:14px;line-height:1.45;">
      <p>Hi Team,</p>
      ${intro.split('\n\n').map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${demandRows}</tbody>
      </table>
    </div>
  </body>
</html>`.trim();
}

function formatEmailValue(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || '--';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtmlToText(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/tr>|<\/h3>/gi, '\n')
    .replace(/<\/td>|<\/th>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sumRowField(rows, field) {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

function getStageStatusCode(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d+(?:\.\d+)?)/);
  return match ? match[1] : '';
}

function topGroup(rows, field) {
  const groups = new Map();
  rows.forEach((row) => {
    const name = String(row[field] || '').trim();
    if (!name) return;
    groups.set(name, (groups.get(name) || 0) + 1);
  });
  return [...groups.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)[0] || { name: '', count: 0 };
}

function getBillingType(row) {
  return isBillingLoss(row.billingLoss) ? 'Billing Loss' : String(row.requestRequisitionType || '').trim() || 'Pro Active';
}

function matchesBillingLossAging(row, bucket) {
  const agingDays = Number(row.agingDays || 0);
  if (bucket === 'gt30') return agingDays > 30;
  if (bucket === 'gt60') return agingDays > 60;
  return false;
}

function matchesBillingLossProfileState(row, state) {
  if (state === 'zeroProfiles') return Number(row.profilesReceived || 0) === 0;
  return false;
}

function hasBillingLossDrilldown(filters) {
  return Boolean(
    filters.billingTypes.length ||
    filters.billingLossAging.length ||
    filters.billingLossProfileStates.length
  );
}

function DemandCard({ row, stageCounts = {}, internalMatchCount = 0, onOpenCandidates, onOpenInternalMatches }) {
  const riskClass = Number(row.agingDays || 0) > 60 ? 'high' : Number(row.remainingPositions || 0) > 0 ? 'medium' : 'low';
  const billingLossDemand = isBillingLoss(row.billingLoss);
  const demandType = getBillingType(row);
  const demandTitle = formatDemandTitle(row);
  const roleSkillCluster = formatRoleSkillCluster(row);

  return (
    <article className={`active-demand-card ${riskClass}`} title={roleSkillCluster}>
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
      <div className="active-demand-badges">
        <span className={`active-demand-billing ${billingLossDemand ? 'billing-loss' : 'pro-active'}`}>
          {demandType}
          {billingLossDemand ? <b>{formatDollarValue(row.billingLossValue)}</b> : null}
        </span>
        <span className="active-demand-offshore-onsite" title={row.offshoreOnsite || ''}>
          {row.offshoreOnsite || 'Onsite/Offshore not available'}
        </span>
        <button
          className="active-demand-match-badge"
          type="button"
          onClick={() => onOpenInternalMatches(row)}
          disabled={!internalMatchCount}
          title={internalMatchCount ? 'View matching bench/Y-Code resources' : 'No matching bench/Y-Code resources'}
        >
          <b>{internalMatchCount}</b> Potential Matches
        </button>
      </div>
      <span className="active-demand-role">{roleSkillCluster}</span>
      <div className="active-demand-card-grid">
        <Metric label="Total" value={row.totalPositions} />
        <Metric label="Remaining" value={row.remainingPositions} />
        <Metric label="Aging" value={row.agingDays} />
        <Metric label="Profiles" value={row.profilesReceived} />
        <Metric label="TP1" value={stageCounts.tp1 || 0} />
        <Metric label="TP2" value={stageCounts.tp2 || 0} />
        <Metric label="Customer" value={stageCounts.customer || 0} />
        <Metric label="Onboarded" value={stageCounts.onboarding || 0} />
        <Metric label="Renege" value={stageCounts.renege || 0} />
      </div>
      <div className="active-demand-card-footer">
        <span className="active-demand-customer" title={row.customer || ''}>{row.customer || 'Customer not available'}</span>
        {isOnHoldDemand(row.status) ? <span className="active-demand-status on-hold">ON HOLD</span> : null}
      </div>
    </article>
  );
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
  return legacyJobReqId || demandId || 'Demand';
}

function isBillingLoss(value) {
  return /^y(es)?$/i.test(String(value || '').trim());
}

function isOnHoldDemand(value) {
  return String(value || '').trim().toLowerCase() === 'on hold';
}

function isOpenOrHoldDemand(value) {
  const status = String(value || '').trim().toLowerCase();
  return status === 'open' || status === 'on hold';
}

function isClosedDemand(value) {
  return String(value || '').trim().toLowerCase() === 'closed';
}

function formatDollarValue(value) {
  const numericValue = parseDollarValue(value);
  if (Number.isFinite(numericValue)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(numericValue);
  }
  return '$0';
}

function parseDollarValue(value) {
  const rawValue = String(value ?? '').trim();
  const numericValue = Number(rawValue.replace(/[$,]/g, ''));
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function isStaleDemand(row) {
  return Number(row.remainingPositions || 0) > 0 &&
    Number(row.profilesReceived || 0) === 0 &&
    Number(row.agingDays || 0) > 14;
}

function Metric({ label, value }) {
  return (
    <span>
      <b>{value ?? '--'}</b>
      <i>{label}</i>
    </span>
  );
}
