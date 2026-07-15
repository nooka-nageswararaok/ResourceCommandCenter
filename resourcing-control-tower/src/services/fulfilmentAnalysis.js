const agingBands = [
  { key: '0-15', label: '0-15', min: 0, max: 15 },
  { key: '16-30', label: '16-30', min: 16, max: 30 },
  { key: '31-60', label: '31-60', min: 31, max: 60 },
  { key: '61-90', label: '61-90', min: 61, max: 90 },
  { key: '>90', label: '>90', min: 91, max: Infinity }
];

export function getActiveDemands(rows = []) {
  return rows.filter((row) => isActiveDemandStatus(row.status));
}

export function isActiveDemandStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'open';
}

export function buildDemandSummary(rows = []) {
  const activeRows = getActiveDemands(rows);
  const totalPositions = sumField(activeRows, 'totalPositions');
  const remainingPositions = sumField(activeRows, 'remainingPositions');
  const profilesReceived = sumField(activeRows, 'profilesReceived');
  const onboarded = sumField(activeRows, 'onboarded');
  const fulfilledPositions = Math.max(totalPositions - remainingPositions, 0);

  return {
    activeDemandCount: activeRows.length,
    totalPositions,
    remainingPositions,
    profilesReceived,
    onboarded,
    fulfilmentPct: pct(fulfilledPositions, totalPositions),
    demandToOnboardPct: pct(onboarded, totalPositions),
    aging30: activeRows.filter((row) => toNumber(row.agingDays) > 30).length,
    aging60: activeRows.filter((row) => toNumber(row.agingDays) > 60).length,
    aging90: activeRows.filter((row) => toNumber(row.agingDays) > 90).length,
    zeroProfiles: activeRows.filter((row) => toNumber(row.remainingPositions) > 0 && toNumber(row.profilesReceived) === 0).length,
    staleDemands: activeRows.filter(isStaleDemand).length,
    highPriorityDemands: activeRows.filter((row) => /high|critical|p1|urgent/i.test(String(row.priority || row.prioritywise || ''))).length
  };
}

export function buildCandidateSummary(rows = []) {
  const totalCandidates = rows.length;
  const screenSelect = rows.filter((row) => statusEquals(row.screenStatus, 'select')).length;
  const tp1Selected = countStatusContains(rows, 'tp1Status', 'selected');
  const tp2Selected = countStatusContains(rows, 'tp2Status', 'selected');
  const tp3Selected = countStatusContains(rows, 'tp3Status', 'selected');
  const offers = rows.filter((row) => hasValue(row.offerStatus)).length;
  const rejectionCount = rows.filter((row) =>
    ['screenStatus', 'tp1Status', 'tp2Status', 'tp3Status'].some((field) => statusContains(row[field], 'reject'))
  ).length;
  const pendingInterviewCount = rows.filter((row) =>
    ['screenStatus', 'tp1Status', 'tp2Status', 'tp3Status'].some((field) => statusContains(row[field], 'pending'))
  ).length;

  return {
    totalCandidates,
    screenSelect,
    tp1Selected,
    tp2Selected,
    tp3Selected,
    offers,
    screenSelectPct: pct(screenSelect, totalCandidates),
    tp1SelectPct: pct(tp1Selected, totalCandidates),
    tp2SelectPct: pct(tp2Selected, totalCandidates),
    tp3SelectPct: pct(tp3Selected, totalCandidates),
    offerConversionPct: pct(offers, totalCandidates),
    rejectionCount,
    pendingInterviewCount,
    avgProfileToOfferDays: averageProfileToOfferDays(rows)
  };
}

export function buildDemandFunnel(rows = []) {
  const activeRows = getActiveDemands(rows);
  return [
    { id: 'remaining', stage: 'Remaining', count: sumField(activeRows, 'remainingPositions') },
    { id: 'profiles', stage: 'Profiles', count: sumField(activeRows, 'profilesReceived') },
    { id: 'screen', stage: 'Screen Select', count: null },
    { id: 'tp1', stage: 'TP-1 Selected', count: sumField(activeRows, 'tp1Selected') },
    { id: 'tp2', stage: 'TP-2 Selected', count: sumField(activeRows, 'tp2ClientSelected') },
    { id: 'tp3', stage: 'TP-3 Selected', count: sumField(activeRows, 'tp3ClientSelected') },
    { id: 'offers', stage: 'Offers', count: null },
    { id: 'onboarded', stage: 'Onboarded', count: sumField(activeRows, 'onboarded') }
  ];
}

export function buildFulfilmentActions(demandRows = [], candidateRows = []) {
  const candidatesBySr = groupBy(candidateRows, 'sr');
  const actions = [];
  let id = 1;

  getActiveDemands(demandRows).forEach((demand) => {
    const demandCandidates = candidatesBySr.get(demand.legacyJobReqId) || [];
    const base = {
      customer: demand.customer || 'Unassigned',
      pm: demand.pm || 'Unassigned',
      legacyJobReqId: demand.legacyJobReqId || '',
      role: demand.role || '',
      agingDays: toNumber(demand.agingDays),
      remainingPositions: toNumber(demand.remainingPositions)
    };

    const add = (action) => {
      actions.push({
        id: id++,
        status: 'Open',
        comments: '',
        ...base,
        ...action
      });
    };

    if (base.remainingPositions > 0 && base.agingDays > 60) {
      add({
        severity: 'Critical',
        actionType: 'Critical Aging',
        bottleneck: 'Demand aging exceeds 60 days',
        recommendedAction: 'Leadership escalation and PM fulfilment recovery plan required',
        owner: 'PM / Delivery',
        dueDate: dueDate(2)
      });
    }
    if (base.remainingPositions > 0 && toNumber(demand.profilesReceived) === 0 && base.agingDays > 7) {
      add({
        severity: 'High',
        actionType: 'No Profiles Received',
        bottleneck: 'No candidate pipeline against open positions',
        recommendedAction: 'Recruitment/TAG to submit profiles and confirm sourcing plan',
        owner: 'Recruitment',
        dueDate: dueDate(2)
      });
    }
    if (base.remainingPositions > 0 && toNumber(demand.profilesReceived) < base.remainingPositions && base.agingDays > 14) {
      add({
        severity: 'Medium',
        actionType: 'Low Pipeline',
        bottleneck: 'Profiles received are below remaining positions',
        recommendedAction: 'Increase sourcing volume and validate role calibration',
        owner: 'Recruitment / PM',
        dueDate: dueDate(5)
      });
    }
    if (isStaleDemand(demand)) {
      add({
        severity: 'High',
        actionType: 'Stale Demand',
        bottleneck: 'No visible movement across profile, interview, or onboarding stages',
        recommendedAction: 'Confirm whether demand is still valid and restart fulfilment actions',
        owner: 'PM',
        dueDate: dueDate(3)
      });
    }
    if (/onsite/i.test(String(demand.offshoreOnsite || '')) && base.agingDays > 30 && base.remainingPositions > 0) {
      add({
        severity: 'Medium',
        actionType: 'Onsite Aging Risk',
        bottleneck: 'Onsite demand remains open beyond 30 days',
        recommendedAction: 'Review onsite sourcing constraints and customer commitment date',
        owner: 'PM / Recruitment',
        dueDate: dueDate(5)
      });
    }

    const pendingScreen = demandCandidates.filter((candidate) => !hasValue(candidate.screenStatus) && candidateAge(candidate) > 7).length;
    if (pendingScreen) {
      add({
        severity: 'Medium',
        actionType: 'Screening Pending',
        bottleneck: `${pendingScreen} candidate(s) without screening decision`,
        recommendedAction: 'Complete screening decision and update candidate status',
        owner: 'PM / Screening Panel',
        dueDate: dueDate(3)
      });
    }

    const finalSelectedNoOffer = demandCandidates.filter((candidate) =>
      hasFinalSelection(candidate) && !hasValue(candidate.offerStatus)
    ).length;
    if (finalSelectedNoOffer) {
      add({
        severity: 'High',
        actionType: 'Final Select but No Offer',
        bottleneck: `${finalSelectedNoOffer} candidate(s) have final select at TP2/TP3 but no offer status`,
        recommendedAction: 'Confirm offer decision for TP2 final select, or TP3 final select where customer process requires TP3',
        owner: 'Offer Team / PM',
        dueDate: dueDate(2)
      });
    }

    const tp1SelectedNoFinal = demandCandidates.filter((candidate) =>
      statusContains(candidate.tp1Status, 'selected') &&
      !statusContains(candidate.tp2Status, 'selected') &&
      !statusContains(candidate.tp3Status, 'selected') &&
      !hasValue(candidate.offerStatus)
    ).length;
    if (tp1SelectedNoFinal) {
      add({
        severity: 'Medium',
        actionType: 'Awaiting Customer Interview Decision',
        bottleneck: `${tp1SelectedNoFinal} candidate(s) cleared TP1 and are awaiting TP2/TP3 final selection`,
        recommendedAction: 'PM/customer to complete TP2 interview feedback; proceed to TP3 only where that customer requires it',
        owner: 'PM / Customer Panel',
        dueDate: dueDate(3)
      });
    }

    const rejectionCount = demandCandidates.filter((candidate) =>
      ['screenStatus', 'tp1Status', 'tp2Status', 'tp3Status'].some((field) => statusContains(candidate[field], 'reject'))
    ).length;
    if (rejectionCount >= 3 && rejectionCount > demandCandidates.length / 2) {
      add({
        severity: 'Medium',
        actionType: 'High Rejection Pattern',
        bottleneck: `${rejectionCount} candidate rejection signals`,
        recommendedAction: 'Recalibrate role, skills, and customer screening criteria',
        owner: 'PM / Recruitment',
        dueDate: dueDate(5)
      });
    }
  });

  return actions.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.agingDays - a.agingDays);
}

export function buildCustomerRiskRows(demandRows = []) {
  return buildRiskRows(demandRows, 'customer', 'Customer');
}

export function buildPmRiskRows(demandRows = []) {
  return buildRiskRows(demandRows, 'pm', 'PM');
}

export function buildRoleHotspotRows(demandRows = [], candidateRows = []) {
  const candidatesBySr = groupBy(candidateRows, 'sr');
  const rows = aggregate(getActiveDemands(demandRows), 'role', 'Role');
  rows.forEach((row) => {
    const relatedDemands = getActiveDemands(demandRows).filter((demand) => (demand.role || 'Unassigned') === row.name);
    const relatedCandidates = relatedDemands.flatMap((demand) => candidatesBySr.get(demand.legacyJobReqId) || []);
    row.rejectionCount = relatedCandidates.filter((candidate) =>
      ['screenStatus', 'tp1Status', 'tp2Status', 'tp3Status'].some((field) => statusContains(candidate[field], 'reject'))
    ).length;
    row.avgAging = round(avg(relatedDemands.map((demand) => toNumber(demand.agingDays))));
    row.fulfilmentPct = pct(row.totalPositions - row.remainingPositions, row.totalPositions);
    row.riskFlag = row.remainingPositions > 0 && (row.avgAging > 45 || row.profilesReceived < row.remainingPositions) ? 'Needs Attention' : 'Stable';
  });
  return rows.sort((a, b) => b.riskScore - a.riskScore || b.remainingPositions - a.remainingPositions);
}

export function buildAgingHeatmapRows(demandRows = [], groupField = 'customer') {
  const groups = new Map();
  getActiveDemands(demandRows).forEach((demand) => {
    const groupName = demand[groupField] || 'Unassigned';
    if (!groups.has(groupName)) {
      groups.set(groupName, {
        id: groupName,
        name: groupName,
        total: 0,
        '0-15': 0,
        '16-30': 0,
        '31-60': 0,
        '61-90': 0,
        '>90': 0
      });
    }
    const row = groups.get(groupName);
    const band = getAgingBand(toNumber(demand.agingDays));
    row[band] += toNumber(demand.remainingPositions) || 1;
    row.total += toNumber(demand.remainingPositions) || 1;
  });
  return [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 25);
}

export function buildWeeklySnapshot(demandRows = [], candidateRows = [], actions = []) {
  const summary = buildDemandSummary(demandRows);
  const candidateSummary = buildCandidateSummary(candidateRows);
  return [
    { Metric: 'Active Demands', Value: summary.activeDemandCount },
    { Metric: 'Total Positions', Value: summary.totalPositions },
    { Metric: 'Remaining Positions', Value: summary.remainingPositions },
    { Metric: 'Fulfilment %', Value: `${summary.fulfilmentPct}%` },
    { Metric: 'Zero Profile Demands', Value: summary.zeroProfiles },
    { Metric: 'Critical Aging >60', Value: summary.aging60 },
    { Metric: 'Total Candidates', Value: candidateSummary.totalCandidates },
    { Metric: 'Offers', Value: candidateSummary.offers },
    { Metric: 'Open Actions', Value: actions.length },
    { Metric: 'Critical Actions', Value: actions.filter((action) => action.severity === 'Critical').length }
  ];
}

export function buildFulfilmentExportSheets(demandRows = [], candidateRows = []) {
  const actions = buildFulfilmentActions(demandRows, candidateRows);
  return {
    'Weekly Snapshot': buildWeeklySnapshot(demandRows, candidateRows, actions),
    'Action Queue': actions,
    'Customer Risk': buildCustomerRiskRows(demandRows),
    'PM Risk': buildPmRiskRows(demandRows),
    'Role Hotspots': buildRoleHotspotRows(demandRows, candidateRows),
    'Active Demands': demandRows,
    'Candidate Details': candidateRows
  };
}

function buildRiskRows(demandRows, field, label) {
  const rows = aggregate(getActiveDemands(demandRows), field, label);
  rows.forEach((row) => {
    row.fulfilmentPct = pct(row.totalPositions - row.remainingPositions, row.totalPositions);
    row.riskScore = computeRiskScore(row);
    row.riskFlag = row.riskScore >= 80 ? 'Critical' : row.riskScore >= 50 ? 'Watch' : 'Stable';
  });
  return rows.sort((a, b) => b.riskScore - a.riskScore || b.remainingPositions - a.remainingPositions);
}

function aggregate(rows, field, label) {
  const groups = new Map();
  rows.forEach((demand) => {
    const name = demand[field] || 'Unassigned';
    if (!groups.has(name)) {
      groups.set(name, {
        id: `${label}-${name}`,
        name,
        demandCount: 0,
        totalPositions: 0,
        remainingPositions: 0,
        aged30: 0,
        aged60: 0,
        aged90: 0,
        zeroProfileDemands: 0,
        profilesReceived: 0,
        onboarded: 0,
        riskScore: 0,
        riskFlag: 'Stable'
      });
    }
    const row = groups.get(name);
    row.demandCount += 1;
    row.totalPositions += toNumber(demand.totalPositions);
    row.remainingPositions += toNumber(demand.remainingPositions);
    row.profilesReceived += toNumber(demand.profilesReceived);
    row.onboarded += toNumber(demand.onboarded);
    row.aged30 += toNumber(demand.agingDays) > 30 ? 1 : 0;
    row.aged60 += toNumber(demand.agingDays) > 60 ? 1 : 0;
    row.aged90 += toNumber(demand.agingDays) > 90 ? 1 : 0;
    row.zeroProfileDemands += toNumber(demand.remainingPositions) > 0 && toNumber(demand.profilesReceived) === 0 ? 1 : 0;
  });
  return [...groups.values()];
}

function computeRiskScore(row) {
  const openWeight = Math.min(row.remainingPositions * 4, 35);
  const agingWeight = Math.min(row.aged30 * 5 + row.aged60 * 8 + row.aged90 * 10, 35);
  const pipelineWeight = Math.min(row.zeroProfileDemands * 8, 20);
  const conversionPenalty = row.fulfilmentPct < 30 ? 10 : row.fulfilmentPct < 60 ? 5 : 0;
  return Math.min(100, Math.round(openWeight + agingWeight + pipelineWeight + conversionPenalty));
}

function isStaleDemand(row) {
  return (
    toNumber(row.remainingPositions) > 0 &&
    toNumber(row.agingDays) > 14 &&
    toNumber(row.profilesReceived) === 0 &&
    toNumber(row.tp1Selected) === 0 &&
    toNumber(row.tp2ClientSelected) === 0 &&
    toNumber(row.tp3ClientSelected) === 0 &&
    toNumber(row.onboarded) === 0
  );
}

function hasFinalSelection(candidate) {
  return statusContains(candidate.tp2Status, 'selected') || statusContains(candidate.tp3Status, 'selected');
}

function averageProfileToOfferDays(rows) {
  const values = rows
    .filter((row) => hasValue(row.offerStatus))
    .map((row) => {
      const start = parseDate(row.profileReceivedDate);
      const end = parseDate(row.tp3Date) || parseDate(row.tp2Date) || parseDate(row.tp1Date) || parseDate(row.screenDate);
      return start && end ? Math.max(0, Math.round((end - start) / 86400000)) : null;
    })
    .filter((value) => value !== null);
  return values.length ? round(avg(values)) : 0;
}

function candidateAge(candidate) {
  const start = parseDate(candidate.profileReceivedDate);
  if (!start) return 0;
  return Math.max(0, Math.round((Date.now() - start.getTime()) / 86400000));
}

function getAgingBand(days) {
  return agingBands.find((band) => days >= band.min && days <= band.max)?.key || '>90';
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dueDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function severityRank(severity) {
  return { Low: 1, Medium: 2, High: 3, Critical: 4 }[severity] || 0;
}

function groupBy(rows, field) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row[field] || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function countStatusContains(rows, field, phrase) {
  return rows.filter((row) => statusContains(row[field], phrase)).length;
}

function statusContains(value, phrase) {
  return String(value || '').toLowerCase().includes(phrase);
}

function statusEquals(value, phrase) {
  return String(value || '').trim().toLowerCase() === phrase;
}

function hasValue(value) {
  return String(value || '').trim() !== '';
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + toNumber(row[field]), 0);
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function pct(numerator, denominator) {
  const base = toNumber(denominator);
  return base ? round((toNumber(numerator) / base) * 100) : 0;
}

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function toNumber(value) {
  return Number(value) || 0;
}
