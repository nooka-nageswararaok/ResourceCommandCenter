import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { FolderOpen, Refresh } from '@mui/icons-material';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';

const DEFAULT_PROJECT_L4 = 'ERS VDU-MEGA-MFG-DIGITAL ENGG1';
const emptyFilters = { statuses: [], customers: [], pms: [], projectL4: [] };
const defaultFilters = { ...emptyFilters, projectL4: [DEFAULT_PROJECT_L4] };

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'Candidate Tracker',
  refreshedAt: '',
  warning: ''
};

const stageSlas = {
  profilesourcing: 7,
  tp1: 5,
  tp2: 7,
  customerfeedback: 5,
  onboarding: 7
};

export default function StageDelayDashboard() {
  const [activeDemandRows, setActiveDemandRows] = useState([]);
  const [candidateRows, setCandidateRows] = useState([]);
  const [fulfilmentDetailRows, setFulfilmentDetailRows] = useState([]);
  const [stageClassification, setStageClassification] = useState({ groups: [], stages: [] });
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState(defaultFilters);
  const [trendMonths, setTrendMonths] = useState(3);
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
        setFulfilmentDetailRows(payload.fulfilmentDetailRows || []);
        setStageClassification(payload.stageClassification || { groups: [], stages: [] });
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

  const delayRows = useMemo(
    () => buildDelayRows(activeDemandRows, candidateRows, stageClassification),
    [activeDemandRows, candidateRows, stageClassification]
  );

  const filteredRows = useMemo(
    () =>
      delayRows.filter((row) => {
        if (filters.statuses.length && !filters.statuses.includes(row.demandStatus)) return false;
        if (filters.customers.length && !filters.customers.includes(row.customer)) return false;
        if (filters.pms.length && !filters.pms.includes(row.pm)) return false;
        if (filters.projectL4.length && !filters.projectL4.includes(row.projectL4)) return false;
        return true;
      }),
    [delayRows, filters]
  );

  const profileTrendRows = useMemo(() => buildTagProfileTrend(filteredRows), [filteredRows]);
  const trendDashboard = useMemo(
    () => buildFulfilmentTrendDashboard(activeDemandRows, candidateRows, fulfilmentDetailRows, filters, trendMonths),
    [activeDemandRows, candidateRows, fulfilmentDetailRows, filters, trendMonths]
  );

  const projectL4FilteredDemandRows = useMemo(
    () => activeDemandRows.filter((row) => !filters.projectL4.length || filters.projectL4.includes(row.projectL4)),
    [activeDemandRows, filters.projectL4]
  );

  const options = useMemo(() => ({
    statuses: uniqueOptions(projectL4FilteredDemandRows, 'status'),
    customers: uniqueOptions(projectL4FilteredDemandRows, 'customer'),
    pms: uniqueOptions(projectL4FilteredDemandRows, 'pm'),
    projectL4: uniqueOptions(activeDemandRows, 'projectL4')
  }), [activeDemandRows, projectL4FilteredDemandRows]);

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
          <h1>Trend Dashboard</h1>
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
          <section className="plain-section trend-filter-section">
            <div className="page-title-row compact-row collapsible-section-header">
              <div>
                <h2>Filters</h2>
                <p>Limit trend, profile supply, and delay rows by SF demand attributes.</p>
              </div>
              <Button variant="outlined" size="small" onClick={() => setFilters(emptyFilters)}>Clear Filters</Button>
            </div>
            <div className="fulfilment-filter-bar stage-delay-filter-bar">
              <MultiSelect label="Project L4" value={filters.projectL4} options={options.projectL4} onChange={(event) => updateMultiFilter('projectL4', event)} />
              <MultiSelect label="Demand Status" value={filters.statuses} options={options.statuses} onChange={(event) => updateMultiFilter('statuses', event)} />
              <MultiSelect label="Customer" value={filters.customers} options={options.customers} onChange={(event) => updateMultiFilter('customers', event)} />
              <MultiSelect label="Hiring Manager" value={filters.pms} options={options.pms} onChange={(event) => updateMultiFilter('pms', event)} />
            </div>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Fulfilment Trend Dashboard</h2>
                <p>Customer and month wise view of open demands, profile supply, and onboarding movement.</p>
              </div>
              <div className="segmented-control">
                {[3, 6].map((months) => (
                  <button
                    className={trendMonths === months ? 'active' : ''}
                    key={months}
                    type="button"
                    onClick={() => setTrendMonths(months)}
                  >
                    Last {months}M
                  </button>
                ))}
              </div>
            </div>
            <div className="trend-summary-grid">
              {trendDashboard.summaryCards.map((card) => (
                <div className="trend-summary-card" key={card.id}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.caption}</small>
                </div>
              ))}
            </div>
            <div className="trend-dashboard-stack">
              <div className="trend-chart-panel">
                <h3>Month Wise Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendDashboard.monthRows} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="count" type="monotone" dataKey="newDemands" name="New Demands" stroke="#316b83" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" type="monotone" dataKey="newPositions" name="New Positions" stroke="#1d5f8a" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" type="monotone" dataKey="openDemands" name="Open Demands" stroke="#6d5a94" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" type="monotone" dataKey="openPositions" name="Open Positions" stroke="#496d3a" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" type="monotone" dataKey="profilesInternal" name="Profiles Internal" stroke="#1f7a5f" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" type="monotone" dataKey="profilesExternal" name="Profiles External" stroke="#8a5a00" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" type="monotone" dataKey="onboardingInternal" name="Onboarding Internal" stroke="#5b6f95" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" type="monotone" dataKey="onboardingExternal" name="Onboarding External" stroke="#c95032" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="pct" type="monotone" dataKey="internalFulfilmentPct" name="Internal Fulfilment %" stroke="#4f46e5" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                    <Line yAxisId="pct" type="monotone" dataKey="externalFulfilmentPct" name="External Fulfilment %" stroke="#be123c" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="trend-heatmap-panel">
                <h3>Customer / Month Heatmap</h3>
                <div className="trend-customer-heatmap">
                  {trendDashboard.customerMonthRows.map((row) => (
                    <TrendHeatBlock key={`${row.customer}-${row.month}`} row={row} maxValue={trendDashboard.maxCustomerMonthTotal} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="plain-section">
              <div className="page-title-row compact-row">
                <div>
                  <h2>TAG Profile Supply Trend</h2>
                  <p>Month-wise TAG profiles for the selected demand status, customer, Hiring Manager, and Project L4 filters.</p>
                </div>
              </div>
              <div className="fulfilment-block-heatmap snapshot-blocks">
                {profileTrendRows.map((row) => (
                  <div className={`fulfilment-heat-block ${row.level}`} key={row.month}>
                    <strong>{row.tagProfiles}</strong>
                    <span>{row.month}</span>
                    <small>{row.totalProfiles} total profiles</small>
                  </div>
                ))}
              </div>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Candidate Stage Delay Queue</h2>
                <p>{filteredRows.length} candidate rows with current stage, SPOC, delay, and recommended action.</p>
              </div>
            </div>
            <div className="data-grid-shell">
              <DataGrid
                rows={filteredRows}
                columns={columns}
                autoHeight
                density="compact"
                rowHeight={38}
                columnHeaderHeight={46}
                disableRowSelectionOnClick
                getCellClassName={(params) => getDelayCellClass(params.field, params.value)}
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

function buildDelayRows(demandRows, candidateRows, stageClassification) {
  const demandMap = new Map(demandRows.map((row) => [row.legacyJobReqId, row]));
  return candidateRows.map((candidate, index) => {
    const demand = demandMap.get(candidate.sr) || {};
    const stage = classifyCandidateStage(candidate, stageClassification);
    const delayExcluded = isExcludedDelayCandidate(candidate);
    const delayDays = getDelayDays(candidate, stage.stageName);
    const slaDays = getSlaDays(stage.stageName);
    const severity = getDelaySeverity(delayDays, slaDays);
    const spoc = stage.spoc || getStageSpoc(stage);
    return {
      id: candidate.id || index + 1,
      candidateName: candidate.candidateName || '',
      sr: candidate.sr || '',
      demandId: demand.demandId || '',
      demandStatus: demand.status || candidate.candidateStatus || 'Unassigned',
      customer: candidate.customer || demand.customer || 'Unassigned',
      pm: demand.pm || 'Unassigned',
      projectL4: demand.projectL4 || 'Unassigned',
      role: demand.role || '',
      stageName: stage.stageName,
      stageCode: stage.stageCode,
      spoc,
      stageStatus: stage.stageStatus,
      stageDetail: stage.stageDetail,
      delayExcluded,
      profileReceivedDate: candidate.profileReceivedDate || '',
      stageDate: getStageDate(candidate, stage.stageName),
      delayDays,
      slaDays,
      severity,
      delayReason: getDelayReason(stage, delayDays, slaDays),
      recommendedAction: getRecommendedAction(stage.stageName, spoc, severity),
      sharedBy: candidate.sharedBy || ''
    };
  }).sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.delayDays - a.delayDays);
}

function isExcludedDelayCandidate(candidate) {
  const statusText = [
    candidate.candidateStatus,
    candidate.screenStatus,
    candidate.tp1Status,
    candidate.tp2Status,
    candidate.tp3Status,
    candidate.offerStatus
  ].map((value) => String(value || '').trim().toLowerCase()).join(' ');

  return (
    statusText.includes('drop') ||
    statusText.includes('reject') ||
    statusText.includes('cancel') ||
    statusText.includes('no show') ||
    statusText.includes('noshow')
  );
}

function classifyCandidateStage(row, stageClassification) {
  const offerStatus = normalize(row.offerStatus);
  if (offerStatus) return buildStageResult(stageClassification, 'Onboarding', row.offerStatus, 'offer');

  const tp3Status = normalize(row.tp3Status);
  if (tp3Status) return buildStageResult(stageClassification, 'TP2', row.tp3Status, 'tp3');

  const tp2Status = normalize(row.tp2Status);
  if (tp2Status) return buildStageResult(stageClassification, 'TP2', row.tp2Status, 'tp2');

  const tp1Status = normalize(row.tp1Status);
  if (tp1Status) return buildStageResult(stageClassification, 'TP1', row.tp1Status, 'tp1');

  const screenStatus = normalize(row.screenStatus);
  if (screenStatus) return buildStageResult(stageClassification, 'Profile Sourcing', row.screenStatus, 'screen');

  return buildStageResult(stageClassification, 'Profile Sourcing', 'No Stage Update', 'profile');
}

function buildStageResult(stageClassification, preferredGroup, status, processLabel) {
  const stage = findStageDefinition(stageClassification, preferredGroup, status, processLabel);
  return {
    stageName: stage?.group || preferredGroup,
    stageCode: stage?.stage || '',
    stageDetail: stage?.description || preferredGroup,
    stageStatus: status || 'No Stage Update',
    spoc: getStageSpoc(stage)
  };
}

function findStageDefinition(stageClassification, preferredGroup, status, processLabel) {
  const stages = stageClassification?.stages || [];
  const target = normalizeStageGroup(preferredGroup);
  const groupStages = stages.filter((stage) => normalizeStageGroup(stage.group) === target);
  if (!groupStages.length) return null;

  const matchedStage = groupStages
    .map((stage) => ({ stage, score: getStageMatchScore(stage, status, processLabel) }))
    .sort((a, b) => b.score - a.score)[0];

  return matchedStage?.score > 0 ? matchedStage.stage : groupStages[0];
}

function getStageMatchScore(stage, status, processLabel) {
  const statusText = normalize(status);
  const description = normalize(stage.description);
  const process = normalize(processLabel);
  let score = 0;

  if (process && description.includes(process)) score += 4;
  if (statusText.includes('select') && description.includes('select')) score += 8;
  if (statusText.includes('reject') && description.includes('reject')) score += 8;
  if (statusText.includes('pending') && description.includes('pending')) score += 8;
  if (statusText.includes('scheduled') && description.includes('scheduled')) score += 8;
  if (statusText.includes('tbd') && description.includes('tbd')) score += 8;
  if (statusText.includes('no show') && description.includes('no show')) score += 8;
  if (statusText.includes('drop') && description.includes('drop')) score += 8;
  if (statusText.includes('offer') && description.includes('offer')) score += 5;
  if (statusText && description.includes(statusText)) score += 6;

  return score;
}

function getDelayDays(candidate, stageName) {
  const explicitDelay = toNumber(candidate.stageDelayDays);
  if (explicitDelay > 0) return explicitDelay;
  if (normalizeStageGroup(stageName) === 'tp2' && toNumber(candidate.tp3AgingDays) > 0) return toNumber(candidate.tp3AgingDays);
  if (normalizeStageGroup(stageName) === 'tp2' && toNumber(candidate.tp2AgingDays) > 0) return toNumber(candidate.tp2AgingDays);
  return daysSince(getStageDate(candidate, stageName));
}

function getStageDate(candidate, stageName) {
  const group = normalizeStageGroup(stageName);
  if (group === 'onboarding') return candidate.offerDate || candidate.tp3Date || candidate.tp2Date || candidate.profileReceivedDate;
  if (group === 'customerfeedback') return candidate.customerFeedbackDate || candidate.tp3Date || candidate.tp2Date || candidate.profileReceivedDate;
  if (group === 'tp2') return candidate.tp3Date || candidate.tp2Date || candidate.tp1Date || candidate.profileReceivedDate;
  if (group === 'tp1') return candidate.tp1Date || candidate.screenDate || candidate.profileReceivedDate;
  return candidate.screenDate || candidate.profileReceivedDate;
}

function getSlaDays(stageName) {
  return stageSlas[normalizeStageGroup(stageName)] || 7;
}

function getDelaySeverity(delayDays, slaDays) {
  if (delayDays > slaDays * 2) return 'Critical';
  if (delayDays > slaDays) return 'Watch';
  return 'On Track';
}

function getDelayReason(stage, delayDays, slaDays) {
  if (delayDays <= slaDays) return `Within ${slaDays} day SLA`;
  return `${stage.stageName} is pending for ${delayDays} days against ${slaDays} day SLA`;
}

function getRecommendedAction(stageName, spoc, severity) {
  if (severity === 'On Track') return 'Monitor in regular fulfilment cadence';
  const group = normalizeStageGroup(stageName);
  if (group === 'profilesourcing') return `${spoc || 'TAG/CU/DU'} to confirm profile supply and next screening action`;
  if (group === 'tp1') return `${spoc || 'DU'} to schedule/close TP1 feedback`;
  if (group === 'tp2') return `${spoc || 'DU'} to close TP2/TP3 customer interview decision`;
  if (group === 'customerfeedback') return `${spoc || 'DU'} to obtain customer feedback and decision`;
  if (group === 'onboarding') return `${spoc || 'TAG/DU'} to close offer/onboarding follow-up`;
  return 'Review stage owner and close pending action';
}

function buildStageSummary(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.stageName)) {
      groups.set(row.stageName, { stageName: row.stageName, total: 0, delayed: 0, delaySum: 0, spocs: new Map() });
    }
    const group = groups.get(row.stageName);
    group.total += 1;
    group.delaySum += row.delayDays;
    if (row.severity !== 'On Track') group.delayed += 1;
    group.spocs.set(row.spoc, (group.spocs.get(row.spoc) || 0) + 1);
  });

  return [...groups.values()].map((row) => ({
    stageName: row.stageName,
    delayed: row.delayed,
    avgDelayDays: round(row.delaySum / Math.max(row.total, 1)),
    spoc: [...row.spocs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unassigned',
    level: row.delayed > row.total / 2 ? 'high' : row.delayed > 0 ? 'medium' : 'low'
  }));
}

function buildTagProfileTrend(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const month = toMonthLabel(row.profileReceivedDate) || 'No Date';
    if (!groups.has(month)) groups.set(month, { month, totalProfiles: 0, tagProfiles: 0 });
    const group = groups.get(month);
    group.totalProfiles += 1;
    if (isTagProfile(row)) group.tagProfiles += 1;
  });

  const maxTag = Math.max(...[...groups.values()].map((row) => row.tagProfiles), 1);
  return [...groups.values()]
    .sort((a, b) => monthOrder(a.month) - monthOrder(b.month))
    .map((row) => ({
      ...row,
      level: row.tagProfiles / maxTag > 0.75 ? 'high' : row.tagProfiles ? 'medium' : 'low'
    }));
}

function buildFulfilmentTrendDashboard(demandRows, candidateRows, fulfilmentDetailRows, filters, monthCount) {
  const filteredDemands = demandRows.filter((row) => matchesTrendFilters(row, filters));
  const demandMap = new Map(filteredDemands.map((row) => [row.legacyJobReqId, row]));
  const filteredCandidates = candidateRows.filter((row) => {
    const demand = demandMap.get(row.sr) || {};
    const customer = row.customer || demand.customer || 'Unassigned';
    if (filters.customers.length && !filters.customers.includes(customer)) return false;
    if (filters.statuses.length && !filters.statuses.includes(demand.status || row.candidateStatus || 'Unassigned')) return false;
    if (filters.pms.length && !filters.pms.includes(demand.pm || 'Unassigned')) return false;
    if (filters.projectL4.length && !filters.projectL4.includes(demand.projectL4 || 'Unassigned')) return false;
    return true;
  });
  const filteredFulfilments = fulfilmentDetailRows.filter((row) => {
    const demand = demandMap.get(row.sr) || {};
    const customer = row.customer || demand.customer || 'Unassigned';
    if (filters.customers.length && !filters.customers.includes(customer)) return false;
    if (filters.statuses.length && !filters.statuses.includes(demand.status || 'Unassigned')) return false;
    if (filters.pms.length && !filters.pms.includes(demand.pm || 'Unassigned')) return false;
    if (filters.projectL4.length && !filters.projectL4.includes(demand.projectL4 || row.projectL4 || 'Unassigned')) return false;
    return true;
  });
  const monthKeys = getLastMonthKeys([...filteredDemands, ...filteredCandidates, ...filteredFulfilments], monthCount);
  const monthLabels = monthKeys.map(formatMonthKey);
  const groups = new Map();

  monthLabels.forEach((month) => {
    groups.set(groupKey('All Customers', month), emptyTrendGroup('All Customers', month));
  });

  filteredDemands.forEach((demand) => {
    const customer = demand.customer || 'Unassigned';
    monthKeys.forEach((monthKey, index) => {
      addDemandTrendMetrics(groups, customer, demand, monthKey, monthLabels[index]);
    });
  });

  filteredCandidates.forEach((candidate) => {
    const demand = demandMap.get(candidate.sr) || {};
    const customer = candidate.customer || demand.customer || 'Unassigned';
    addCandidateTrendMetric(groups, customer, candidate, candidate.profileReceivedDate, monthLabels, 'profiles');
  });

  filteredFulfilments.forEach((fulfilment) => {
    const demand = demandMap.get(fulfilment.sr) || {};
    const customer = fulfilment.customer || demand.customer || 'Unassigned';
    addFulfilmentTrendMetric(groups, customer, fulfilment, monthLabels);
  });

  const allRows = [...groups.values()].map(finalizeTrendGroup);
  const monthRows = monthLabels.map((month) => allRows.find((row) => row.customer === 'All Customers' && row.month === month) || finalizeTrendGroup(emptyTrendGroup('All Customers', month)));
  const customerMonthRows = allRows
    .filter((row) => row.customer !== 'All Customers')
    .sort((a, b) => a.customer.localeCompare(b.customer) || monthOrder(a.month) - monthOrder(b.month));

  return {
    monthRows,
    customerMonthRows,
    maxCustomerMonthTotal: Math.max(...customerMonthRows.map((row) => row.total), 1),
    summaryCards: buildTrendSummaryCards(monthRows)
  };
}

function matchesTrendFilters(row, filters) {
  if (filters.statuses.length && !filters.statuses.includes(row.status || 'Unassigned')) return false;
  if (filters.customers.length && !filters.customers.includes(row.customer || 'Unassigned')) return false;
  if (filters.pms.length && !filters.pms.includes(row.pm || 'Unassigned')) return false;
  if (filters.projectL4.length && !filters.projectL4.includes(row.projectL4 || 'Unassigned')) return false;
  return true;
}

function addCandidateTrendMetric(groups, customer, candidate, dateValue, monthLabels, metric) {
  const month = toMonthLabel(dateValue);
  if (!month || !monthLabels.includes(month)) return;
  const type = getInternalExternalType(candidate.externalInternal);
  const row = ensureTrendGroup(groups, customer, month);
  const total = ensureTrendGroup(groups, 'All Customers', month);
  row[`${metric}${type}`] += 1;
  total[`${metric}${type}`] += 1;
}

function addDemandTrendMetrics(groups, customer, demand, monthKey, monthLabel) {
  const monthStart = getMonthStart(monthKey);
  const periodEndExclusive = getTrendPeriodEndExclusive(monthStart);
  const createdDate = parseDate(demand.reqDate);
  const closedDate = parseDate(demand.closedDate);
  const row = ensureTrendGroup(groups, customer, monthLabel);
  const total = ensureTrendGroup(groups, 'All Customers', monthLabel);
  const positions = getNumberOfOpenings(demand);

  if (createdDate && createdDate >= monthStart && createdDate < periodEndExclusive) {
    row.newDemands += 1;
    total.newDemands += 1;
    row.newPositions += positions;
    total.newPositions += positions;
  }

  if (isOpenAtPeriodEnd(demand, createdDate, closedDate, periodEndExclusive)) {
    row.openDemands += 1;
    total.openDemands += 1;
    row.openPositions += positions;
    total.openPositions += positions;
  }
}

function addFulfilmentTrendMetric(groups, customer, fulfilment, monthLabels) {
  const month = normalizeFulfilmentMonth(fulfilment.month) || toMonthLabel(fulfilment.joiningDate);
  if (!month || !monthLabels.includes(month)) return;
  const type = getHiringModeTrendType(fulfilment.hiringMode);
  if (!type) return;
  const count = Number(fulfilment.count || 0) || 1;
  const row = ensureTrendGroup(groups, customer, month);
  const total = ensureTrendGroup(groups, 'All Customers', month);
  row[`onboarding${type}`] += count;
  total[`onboarding${type}`] += count;
}

function ensureTrendGroup(groups, customer, month) {
  const key = groupKey(customer, month);
  if (!groups.has(key)) groups.set(key, emptyTrendGroup(customer, month));
  return groups.get(key);
}

function emptyTrendGroup(customer, month) {
  return {
    customer,
    month,
    newDemands: 0,
    newPositions: 0,
    openDemands: 0,
    openPositions: 0,
    profilesInternal: 0,
    profilesExternal: 0,
    onboardingInternal: 0,
    onboardingExternal: 0
  };
}

function finalizeTrendGroup(row) {
  const total = row.newDemands +
    row.newPositions +
    row.openDemands +
    row.openPositions +
    row.profilesInternal +
    row.profilesExternal +
    row.onboardingInternal +
    row.onboardingExternal;

  return {
    customer: row.customer,
    month: row.month,
    newDemands: row.newDemands,
    newPositions: row.newPositions,
    openDemands: row.openDemands,
    openPositions: row.openPositions,
    profilesInternal: row.profilesInternal,
    profilesExternal: row.profilesExternal,
    onboardingInternal: row.onboardingInternal,
    onboardingExternal: row.onboardingExternal,
    internalFulfilmentPct: pct(row.onboardingInternal, row.profilesInternal),
    externalFulfilmentPct: pct(row.onboardingExternal, row.profilesExternal),
    total
  };
}

function buildTrendSummaryCards(monthRows) {
  const totals = monthRows.reduce((sum, row) => ({
    newDemands: sum.newDemands + row.newDemands,
    newPositions: sum.newPositions + row.newPositions,
    openDemands: sum.openDemands + row.openDemands,
    openPositions: sum.openPositions + row.openPositions,
    profilesInternal: sum.profilesInternal + row.profilesInternal,
    profilesExternal: sum.profilesExternal + row.profilesExternal,
    onboardingInternal: sum.onboardingInternal + row.onboardingInternal,
    onboardingExternal: sum.onboardingExternal + row.onboardingExternal
  }), { newDemands: 0, newPositions: 0, openDemands: 0, openPositions: 0, profilesInternal: 0, profilesExternal: 0, onboardingInternal: 0, onboardingExternal: 0 });
  const internalFulfilmentPct = pct(totals.onboardingInternal, totals.profilesInternal);
  const externalFulfilmentPct = pct(totals.onboardingExternal, totals.profilesExternal);

  return [
    { id: 'new-demands', label: 'New Demands', value: totals.newDemands, caption: 'Created in month' },
    { id: 'new-positions', label: 'New Positions', value: totals.newPositions, caption: 'Number of Openings' },
    { id: 'open-demands', label: 'Open Demands', value: totals.openDemands, caption: 'Backlog at month-end' },
    { id: 'open-positions', label: 'Open Positions', value: totals.openPositions, caption: 'Backlog at month-end' },
    { id: 'profiles-internal', label: 'Profiles Internal', value: totals.profilesInternal, caption: 'Profile received' },
    { id: 'profiles-external', label: 'Profiles External', value: totals.profilesExternal, caption: 'Profile received' },
    { id: 'onboarding-internal', label: 'Onboarding Internal', value: totals.onboardingInternal, caption: 'Internal Hiring' },
    { id: 'onboarding-external', label: 'Onboarding External', value: totals.onboardingExternal, caption: 'Lateral Hiring' },
    { id: 'fulfilment-internal', label: 'Internal Fulfilment %', value: `${internalFulfilmentPct}%`, caption: 'Onboarding Internal / Profiles Internal' },
    { id: 'fulfilment-external', label: 'External Fulfilment %', value: `${externalFulfilmentPct}%`, caption: 'Onboarding External / Profiles External' }
  ];
}

function getLastMonthKeys(rows, monthCount) {
  const monthValues = rows.flatMap((row) => [
    parseDate(row.reqDate),
    parseDate(row.profileReceivedDate),
    parseDate(row.onboardingDate),
    parseDate(row.offerDate),
    parseDate(row.joiningDate),
    parseFulfilmentMonth(row.month)
  ]).filter(Boolean);
  const anchor = monthValues.sort((a, b) => b.getTime() - a.getTime())[0] || new Date();
  const anchorMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return Array.from({ length: monthCount }, (_item, index) => {
    const date = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - (monthCount - index - 1), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function formatMonthKey(value) {
  const [year, month] = String(value).split('-').map(Number);
  return toMonthLabel(new Date(year, month - 1, 1));
}

function getMonthStart(value) {
  const [year, month] = String(value).split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getNextMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function getTrendPeriodEndExclusive(monthStart) {
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  if (monthStart.getFullYear() === currentMonthStart.getFullYear() && monthStart.getMonth() === currentMonthStart.getMonth()) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  }
  return getNextMonthStart(monthStart);
}

function normalizeFulfilmentMonth(value) {
  const parsed = parseFulfilmentMonth(value);
  return parsed ? toMonthLabel(parsed) : toMonthLabel(value);
}

function parseFulfilmentMonth(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^([A-Za-z]{3,9})[' -]?(\d{2,4})$/);
  if (match) {
    const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[1].slice(0, 3).toLowerCase());
    if (monthIndex >= 0) {
      const year = Number(match[2].length === 2 ? `20${match[2]}` : match[2]);
      return new Date(year, monthIndex, 1);
    }
  }
  return parseDate(text);
}

function groupKey(customer, month) {
  return `${customer}__${month}`;
}

function isOpenAtPeriodEnd(row, createdDate, closedDate, periodEndExclusive) {
  if (!createdDate || createdDate >= periodEndExclusive) return false;
  const status = normalize(row.status);
  if (status === 'on hold') return false;
  return !closedDate || closedDate >= periodEndExclusive;
}

function getNumberOfOpenings(row) {
  const openings = toNumber(row.numberOfOpenings);
  return openings || 0;
}

function getInternalExternalType(value) {
  return /internal/i.test(String(value || '')) ? 'Internal' : 'External';
}

function getHiringModeTrendType(value) {
  const text = String(value || '').trim();
  if (/internal/i.test(text)) return 'Internal';
  if (/external|lateral/i.test(text)) return 'External';
  return '';
}

function TrendHeatBlock({ row, maxValue }) {
  const intensity = row.total / Math.max(maxValue, 1);
  const level = intensity > 0.7 ? 'high' : intensity > 0.25 ? 'medium' : 'low';
  const color = getCustomerHeatColor(row.customer);
  return (
    <div
      className={`trend-heat-block ${level}`}
      style={{ '--customer-heat': color.base, '--customer-heat-soft': color.soft, '--customer-heat-border': color.border }}
      title={`${row.customer} / ${row.month}`}
    >
      <div className="trend-heat-heading">
        <strong>{row.total}</strong>
        <span>{row.month}</span>
      </div>
      <b>{row.customer}</b>
      <div className="trend-heat-metrics">
        <span><i>New D</i>{row.newDemands}</span>
        <span><i>New P</i>{row.newPositions}</span>
        <span><i>Open D</i>{row.openDemands}</span>
        <span><i>Open P</i>{row.openPositions}</span>
        <span><i>Prof I</i>{row.profilesInternal}</span>
        <span><i>Prof E</i>{row.profilesExternal}</span>
        <span><i>Onb I</i>{row.onboardingInternal}</span>
        <span><i>Onb E</i>{row.onboardingExternal}</span>
      </div>
    </div>
  );
}

function getCustomerHeatColor(customer) {
  const palette = [
    { base: '#316b83', soft: '#e8f4ff', border: '#93c5fd' },
    { base: '#1f7a5f', soft: '#e8f5ef', border: '#8fd0b3' },
    { base: '#8a5a00', soft: '#fff7d6', border: '#edc37d' },
    { base: '#5b6f95', soft: '#eef2ff', border: '#a5b4fc' },
    { base: '#a33a28', soft: '#fde9e4', border: '#f0b2a1' },
    { base: '#6d5a94', soft: '#f1e8ff', border: '#c4a3ff' },
    { base: '#496d3a', soft: '#eef8e8', border: '#a7d28f' },
    { base: '#7a4f38', soft: '#fff1dc', border: '#e2b071' }
  ];
  const hash = String(customer || 'Unassigned').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
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

function getDelayCellClass(field, value) {
  if (field !== 'severity') return '';
  if (value === 'Critical') return 'fulfilment-severity-critical';
  if (value === 'Watch') return 'fulfilment-severity-high';
  return 'risk-flag-stable';
}

function isTagProfile(row) {
  return /tag/i.test(String(row.sharedBy || ''));
}

function getStageSpoc(stage) {
  const spoc = String(stage?.spoc || '').trim().toUpperCase();
  if (['TAG', 'CU', 'DU'].includes(spoc)) return spoc;
  const description = String(stage?.description || '').trim();
  const bracketMatch = description.match(/\[([^\]]+)\]/);
  const candidate = String(bracketMatch?.[1] || '').toUpperCase();
  if (candidate.includes('TAG')) return 'TAG';
  if (candidate.includes('CU')) return 'CU';
  if (candidate.includes('DU')) return 'DU';
  return 'Unassigned';
}

function uniqueOptions(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function daysSince(value) {
  const date = parseDate(value);
  if (!date) return 0;
  const today = new Date();
  return Math.max(0, Math.floor((today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86400000));
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialDateToLocalDate(value);
  }
  const text = String(value).trim();
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    return excelSerialDateToLocalDate(Number(text));
  }
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const first = Number(match[1]);
  const second = Number(match[2]);
  const day = first > 12 ? first : second;
  const month = first > 12 ? second : first;
  return new Date(year, month - 1, day);
}

function excelSerialDateToLocalDate(value) {
  const excelEpoch = new Date(1899, 11, 30);
  return new Date(excelEpoch.getFullYear(), excelEpoch.getMonth(), excelEpoch.getDate() + Math.floor(Number(value)));
}

function toMonthLabel(value) {
  const date = parseDate(value);
  if (!date) return '';
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = String(date.getFullYear()).slice(-2);
  return `${month}'${year}`;
}

function monthOrder(value) {
  const monthName = String(value || '').slice(0, 3).toLowerCase();
  const index = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName);
  const year = Number(String(value || '').match(/\d{2,4}/)?.[0] || 0);
  return (year * 12) + (index < 0 ? 99 : index);
}

function severityRank(severity) {
  return { Critical: 3, Watch: 2, 'On Track': 1 }[severity] || 0;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStageGroup(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return Number(String(value || '').replace(/,/g, '').trim()) || 0;
}

function avg(values) {
  const cleanValues = values.map(toNumber).filter((value) => Number.isFinite(value));
  if (!cleanValues.length) return 0;
  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function pct(numerator, denominator) {
  return denominator ? Math.round((Number(numerator || 0) / Number(denominator || 0)) * 100) : 0;
}

const columns = [
  { field: 'candidateName', headerName: 'Candidate', minWidth: 210, flex: 0.8 },
  { field: 'customer', headerName: 'Customer', minWidth: 150, flex: 0.6 },
  { field: 'demandStatus', headerName: 'Demand Status', width: 130 },
  { field: 'sr', headerName: 'Legacy Job Req Id', minWidth: 190, flex: 0.7 },
  { field: 'demandId', headerName: 'Demand ID', minWidth: 160, flex: 0.6 },
  { field: 'role', headerName: 'Role', minWidth: 220, flex: 0.9 },
  { field: 'stageName', headerName: 'Current Stage', width: 150 },
  { field: 'stageCode', headerName: 'Stage', width: 90 },
  { field: 'spoc', headerName: 'SPOC', width: 90 },
  { field: 'stageStatus', headerName: 'Stage Status', minWidth: 150, flex: 0.5 },
  { field: 'stageDate', headerName: 'Stage Date', width: 125 },
  { field: 'delayDays', headerName: 'Days', width: 80, type: 'number' },
  { field: 'slaDays', headerName: 'SLA', width: 80, type: 'number' },
  { field: 'severity', headerName: 'Severity', width: 110 },
  { field: 'delayReason', headerName: 'Delay Reason', minWidth: 260, flex: 1 },
  { field: 'recommendedAction', headerName: 'Recommended Action', minWidth: 300, flex: 1.1 },
  { field: 'pm', headerName: 'PM', minWidth: 140, flex: 0.5 },
  { field: 'sharedBy', headerName: 'Shared By', minWidth: 140, flex: 0.5 }
];
