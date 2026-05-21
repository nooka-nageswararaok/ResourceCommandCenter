import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { ArrowBack, FolderOpen, Refresh } from '@mui/icons-material';
import KPIWidget from '../../components/KPIWidget.jsx';
import { getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';
import { buildCandidateSummary } from '../../services/fulfilmentAnalysis.js';

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'Active SR',
  candidateSheetName: 'Candidate Tracker',
  refreshedAt: '',
  warning: ''
};

export default function CandidateDetailsDashboard({ navigate, initialState = {} }) {
  const [activeDemandRows, setActiveDemandRows] = useState([]);
  const [candidateRows, setCandidateRows] = useState([]);
  const [stageClassification, setStageClassification] = useState({ groups: [], stages: [] });
  const [selectedLegacyJobReqId, setSelectedLegacyJobReqId] = useState(initialState.legacyJobReqId || '');
  const [meta, setMeta] = useState(initialMeta);
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
        setStageClassification(payload.stageClassification || { groups: [], stages: [] });
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          sheetName: payload.sheetName || 'Active SR',
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

  useEffect(() => {
    if (initialState.legacyJobReqId) {
      setSelectedLegacyJobReqId(initialState.legacyJobReqId);
    }
  }, [initialState.legacyJobReqId]);

  const legacyJobReqOptions = useMemo(
    () =>
      [...new Set(
        activeDemandRows
          .filter((row) => String(row.status || '').trim().toLowerCase() === 'active')
          .map((row) => row.legacyJobReqId)
          .filter(Boolean)
      )].sort((a, b) => String(a).localeCompare(String(b))),
    [activeDemandRows]
  );

  const visibleCandidateRows = useMemo(
    () => {
      return candidateRows
        .filter((row) => row.sr === selectedLegacyJobReqId)
        .map((row, index) => {
          const stage = classifyCandidateStage(row, stageClassification);
          return {
            ...row,
            serialNumber: index + 1,
            stageName: stage.stageName,
            stageCode: stage.stageCode,
            stageDetail: stage.stageDetail,
            stageStatus: stage.stageStatus,
            stageBucket: stage.stageBucket
          };
        });
    },
    [activeDemandRows, candidateRows, selectedLegacyJobReqId, stageClassification]
  );

  const summary = useMemo(() => buildCandidateSummary(visibleCandidateRows), [visibleCandidateRows]);
  const stageCards = useMemo(
    () => buildStageCards(visibleCandidateRows, stageClassification),
    [visibleCandidateRows, stageClassification]
  );

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Candidate Details Dashboard</h1>
          <p>Child dashboard - view candidate details for selected demand from Active Demands Dashboard</p>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for fulfilment workbook'} {meta.candidateSheetName ? `/ ${meta.candidateSheetName}` : ''}
          </p>
          <p>Loaded: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
        </div>
        <div className="page-actions">
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate?.('resource-fulfilment/active-demands')}>
            Active Demands
          </Button>
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
          <span>Use Choose Fulfilment Excel to load a workbook that contains Active SR and Candidate Tracker.</span>
        </div>
      ) : (
        <>
          <section className="candidate-selector-panel">
            <label>
              Select Legacy Job Req Id
              <select value={selectedLegacyJobReqId} onChange={(event) => setSelectedLegacyJobReqId(event.target.value)}>
                <option value="">Select a demand</option>
                {legacyJobReqOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <span>Tip: double-click an Active Demands row or use its Candidates action to open this dashboard directly.</span>
          </section>

          <section className="kpi-grid compact fulfilment-kpi-grid">
            <KPIWidget label="Total Candidates" value={summary.totalCandidates} tone="blue" />
            <KPIWidget label="Screen Select %" value={`${summary.screenSelectPct}%`} tone="green" />
            <KPIWidget label="TP-1 Select %" value={`${summary.tp1SelectPct}%`} tone="amber" />
            <KPIWidget label="TP-2 Select %" value={`${summary.tp2SelectPct}%`} tone="amber" />
            <KPIWidget label="TP-3 Select %" value={`${summary.tp3SelectPct}%`} tone="amber" />
            <KPIWidget label="Offers" value={summary.offers} tone="green" />
            <KPIWidget label="Offer Conversion %" value={`${summary.offerConversionPct}%`} tone="green" />
            <KPIWidget label="Pending Interviews" value={summary.pendingInterviewCount} tone="amber" />
            <KPIWidget label="Rejected" value={summary.rejectionCount} tone="red" />
            <KPIWidget label="Avg Profile to Offer" value={`${summary.avgProfileToOfferDays}d`} />
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Candidate Stage Heatmap</h2>
                <p>
                  Stage classification is sourced from {stageClassification.sourceFileName || 'Stage_Classification.xlsx'}
                  {stageClassification.sheetName ? ` / ${stageClassification.sheetName}` : ''}.
                </p>
              </div>
            </div>
            <div className="candidate-stage-heatmap">
              {stageCards.map((stage) => (
                <div className={`candidate-stage-block ${stage.level}`} key={stage.key} title={`${stage.label}: ${stage.count}`}>
                  <div className="candidate-stage-heading">
                    <strong>{stage.count}</strong>
                    <span>{stage.label}</span>
                  </div>
                  <div className="candidate-status-blocks">
                    {stage.statuses.map((status) => (
                      <span className={`candidate-status-block ${status.level}`} key={status.key} title={status.description}>
                        <b>{status.count}</b>
                        <i>{status.label}</i>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Candidate Pipeline</h2>
                <p>
                  {selectedLegacyJobReqId
                    ? `${visibleCandidateRows.length} candidate rows for ${selectedLegacyJobReqId}`
                    : 'Select a Legacy Job Req Id to populate candidate details.'}
                </p>
              </div>
            </div>
            <div className="data-grid-shell">
              <DataGrid
                rows={visibleCandidateRows}
                columns={columns}
                autoHeight
                density="compact"
                rowHeight={34}
                columnHeaderHeight={46}
                disableRowSelectionOnClick
                getCellClassName={(params) => getStatusCellClass(params.field, params.value)}
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

function getStatusCellClass(field, value) {
  if (!['screenStatus', 'tp1Status', 'tp2Status', 'tp3Status', 'stageStatus'].includes(field)) return '';
  const status = String(value || '').toLowerCase();
  if (status.includes('selected') || status === 'select') return 'candidate-status-selected';
  if (status.includes('reject')) return 'candidate-status-rejected';
  if (status.includes('pending')) return 'candidate-status-pending';
  if (status.includes('scheduled')) return 'candidate-status-scheduled';
  return '';
}

function classifyCandidateStage(row, stageClassification) {
  const offerStatus = normalize(row.offerStatus);
  if (offerStatus) return buildStageResult(stageClassification, 'Onboarding', row.offerStatus, 'Selected', 'offer');

  const tp3Status = normalize(row.tp3Status);
  if (tp3Status) return buildStageResult(stageClassification, 'TP2', row.tp3Status, bucketStatus(tp3Status), 'tp3');

  const tp2Status = normalize(row.tp2Status);
  if (tp2Status) return buildStageResult(stageClassification, 'TP2', row.tp2Status, bucketStatus(tp2Status), 'tp2');

  const tp1Status = normalize(row.tp1Status);
  if (tp1Status) return buildStageResult(stageClassification, 'TP1', row.tp1Status, bucketStatus(tp1Status), 'tp1');

  const screenStatus = normalize(row.screenStatus);
  if (screenStatus) return buildStageResult(stageClassification, 'Profile Sourcing', row.screenStatus, bucketStatus(screenStatus), 'screen');

  return buildStageResult(stageClassification, 'Profile Sourcing', 'No Stage Update', 'No Update', 'profile');
}

function buildStageResult(stageClassification, preferredGroup, status, stageBucket, processLabel) {
  const fallbackLabel = getFallbackStageLabel(preferredGroup);
  const stage = findStageDefinition(stageClassification, preferredGroup, status, processLabel);
  return {
    stageName: stage?.group || fallbackLabel,
    stageCode: stage?.stage || '',
    stageDetail: stage?.description || fallbackLabel,
    stageStatus: status || 'No Stage Update',
    stageBucket
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

function getFallbackStageLabel(group) {
  const fallbackMap = {
    onboarding: 'Offer',
    customerfeedback: 'TP3 Interview',
    tp2: 'TP2 Interview',
    tp1: 'TP1 Interview',
    profilesourcing: 'Profile Received'
  };
  return fallbackMap[normalizeStageGroup(group)] || group;
}

function buildStageCards(rows, stageClassification) {
  const classifiedGroups = stageClassification?.groups?.length
    ? stageClassification.groups
    : ['Profile Received', 'Screening', 'TP1 Interview', 'TP2 Interview', 'TP3 Interview', 'Offer'];
  const counts = new Map(classifiedGroups.map((label) => [label, 0]));
  const stageCounts = new Map();

  rows.forEach((row) => {
    counts.set(row.stageName, (counts.get(row.stageName) || 0) + 1);
    if (row.stageCode) {
      stageCounts.set(row.stageCode, (stageCounts.get(row.stageCode) || 0) + 1);
    }
  });

  const maxCount = Math.max(...counts.values(), 1);
  return classifiedGroups.map((label) => {
    const count = counts.get(label) || 0;
    const intensity = count / maxCount;
    const stageDefinitions = getStageDefinitionsForGroup(stageClassification, label);
    return {
      key: label,
      label,
      count,
      statuses: stageDefinitions.map((stage) => ({
        key: stage.stage,
        label: stage.stage,
        description: stage.description,
        spoc: getStageSpoc(stage),
        count: stageCounts.get(stage.stage) || 0,
        level: `${getStageBlockLevel(stageCounts.get(stage.stage) || 0, count)} ${getStageSpocClass(stage)}`
      })),
      level: intensity > 0.75 ? 'high' : intensity > 0.4 ? 'medium' : 'low'
    };
  });
}

function getStageDefinitionsForGroup(stageClassification, group) {
  const stages = stageClassification?.stages || [];
  const target = normalizeStageGroup(group);
  const stagePrefix = getStagePrefixForGroup(group);
  const groupStages = stages.filter((stage) => {
    const stageCode = String(stage.stage || '').trim();
    const groupMatches = normalizeStageGroup(stage.group) === target;
    const prefixMatches = !stagePrefix || stageCode.startsWith(stagePrefix);
    return groupMatches && prefixMatches && stageCode;
  });
  const uniqueGroupStages = dedupeStageDefinitions(groupStages);
  if (uniqueGroupStages.length) return uniqueGroupStages;
  return [{ stage: group, description: group }];
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
  return 'OTHER';
}

function getStageSpocClass(stage) {
  return `spoc-${getStageSpoc(stage).toLowerCase()}`;
}

function dedupeStageDefinitions(stages) {
  const stageMap = new Map();
  stages.forEach((stage) => {
    const stageCode = String(stage.stage || '').trim();
    if (!stageCode || stageMap.has(stageCode)) return;
    stageMap.set(stageCode, stage);
  });

  return [...stageMap.values()].sort((a, b) => compareStageCodes(a.stage, b.stage));
}

function compareStageCodes(left, right) {
  const leftParts = String(left || '').split('.').map((part) => Number(part) || 0);
  const rightParts = String(right || '').split('.').map((part) => Number(part) || 0);
  return (leftParts[0] - rightParts[0]) || (leftParts[1] - rightParts[1]);
}

function getStagePrefixForGroup(group) {
  const prefixMap = {
    profilesourcing: '1.',
    tp1: '2.',
    tp2: '3.',
    customerfeedback: '4.',
    onboarding: '5.'
  };
  return prefixMap[normalizeStageGroup(group)] || '';
}

function getStageBlockLevel(count, stageTotal) {
  if (!count) return 'empty';
  const intensity = count / Math.max(stageTotal, 1);
  if (intensity > 0.5) return 'high';
  if (intensity > 0.2) return 'medium';
  return 'low';
}

function bucketStatus(status) {
  if (status.includes('selected') || status === 'select') return 'Selected';
  if (status.includes('reject')) return 'Rejected';
  if (status.includes('pending')) return 'Pending';
  if (status.includes('scheduled')) return 'Scheduled';
  return 'No Update';
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStageGroup(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

const columns = [
  { field: 'serialNumber', headerName: 'S.No', width: 72, align: 'right', headerAlign: 'right' },
  { field: 'profileReceivedDate', headerName: 'Profile Received Date', width: 165 },
  { field: 'customer', headerName: 'Customer', minWidth: 180, flex: 0.7 },
  { field: 'candidateName', headerName: 'Candidate Name', minWidth: 230, flex: 0.9 },
  { field: 'externalInternal', headerName: 'External/Internal', width: 150 },
  { field: 'sapId', headerName: 'SAP ID', width: 120 },
  { field: 'stageName', headerName: 'Current Stage', width: 150 },
  { field: 'stageCode', headerName: 'Stage', width: 90 },
  { field: 'stageDetail', headerName: 'Stage Detail', minWidth: 260, flex: 0.9 },
  { field: 'stageStatus', headerName: 'Stage Status', width: 170 },
  { field: 'screenStatus', headerName: 'Screen Status', width: 150 },
  { field: 'screenDate', headerName: 'Screen Date', width: 125 },
  { field: 'tp1Status', headerName: 'TP-1 Status', width: 150 },
  { field: 'tp1Date', headerName: 'TP-1 Date', width: 125 },
  { field: 'tp2Status', headerName: 'TP-2 Status', width: 180 },
  { field: 'tp2Date', headerName: 'TP-2 Date', width: 125 },
  { field: 'tp3Status', headerName: 'TP-3 Status', width: 180 },
  { field: 'tp3Date', headerName: 'TP-3 Date', width: 125 },
  { field: 'offerStatus', headerName: 'Offer Status', width: 150 },
  { field: 'comments', headerName: 'Comments', minWidth: 320, flex: 1.1 }
];
