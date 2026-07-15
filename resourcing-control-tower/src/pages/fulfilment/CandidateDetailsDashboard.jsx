import { useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { ArrowBack, Email, FolderOpen, Refresh } from '@mui/icons-material';
import { draftHtmlEmail, getFulfilmentData, selectFulfilmentExcelFile } from '../../services/fulfilmentService.js';
import { isActiveDemandStatus } from '../../services/fulfilmentAnalysis.js';

const initialMeta = {
  fileName: '',
  filePath: '',
  sheetName: 'SF Datadump',
  candidateSheetName: 'Candidate Tracker',
  refreshedAt: '',
  warning: ''
};

export default function CandidateDetailsDashboard({ navigate, initialState = {} }) {
  const [activeDemandRows, setActiveDemandRows] = useState([]);
  const [candidateRows, setCandidateRows] = useState([]);
  const [stageClassification, setStageClassification] = useState({ groups: [], stages: [] });
  const [selectedLegacyJobReqId, setSelectedLegacyJobReqId] = useState(initialState.legacyJobReqId || '');
  const [selectedStageCode, setSelectedStageCode] = useState('');
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

  useEffect(() => {
    if (initialState.legacyJobReqId) {
      setSelectedLegacyJobReqId(initialState.legacyJobReqId);
    }
  }, [initialState.legacyJobReqId]);

  const legacyJobReqOptions = useMemo(
    () =>
      [...new Set(
        activeDemandRows
          .filter((row) => isActiveDemandStatus(row.status))
          .map((row) => row.legacyJobReqId)
          .filter(Boolean)
      )].sort((a, b) => String(a).localeCompare(String(b))),
    [activeDemandRows]
  );

  const selectedDemand = useMemo(
    () => activeDemandRows.find((row) => row.legacyJobReqId === selectedLegacyJobReqId) || {},
    [activeDemandRows, selectedLegacyJobReqId]
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

  const stageCards = useMemo(
    () => buildStageCards(visibleCandidateRows, stageClassification),
    [visibleCandidateRows, stageClassification]
  );
  const selectedSkillCluster = String(selectedDemand.skillCluster || '').trim();

  const draftCandidateStageEmail = async (status) => {
    const draft = buildCandidateStageEmailDraft({
      stageStatus: status.label,
      selectedLegacyJobReqId,
      selectedDemand,
      rows: getCandidatePipelineRows(visibleCandidateRows, status.stageCode)
    });
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
          <span>Use Choose Fulfilment Excel to load a workbook that contains SF Datadump and Candidate Tracker.</span>
        </div>
      ) : (
        <>
          <section className="candidate-selector-panel">
            <div className="candidate-selector-card">
              <label>
                Select Legacy Job Req Id
                <select
                  value={selectedLegacyJobReqId}
                  onChange={(event) => {
                    setSelectedLegacyJobReqId(event.target.value);
                    setSelectedStageCode('');
                  }}
                >
                  <option value="">Select a demand</option>
                  {legacyJobReqOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="candidate-demand-kpi">
              <span>Job Requisition ID/Demand ID</span>
              <strong title={selectedDemand.demandId || ''}>{selectedDemand.demandId || '--'}</strong>
            </div>
            <span className="candidate-selector-tip">Tip: double-click an Active Demands row or use its Candidates action to open this dashboard directly.</span>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Candidate Stage Heatmap</h2>
                <p>
                  Stage classification is sourced from {stageClassification.sourceFileName || 'Stage_Classification.xlsx'}
                  {stageClassification.sheetName ? ` / ${stageClassification.sheetName}` : ''}.
                </p>
                <p className="candidate-stage-skill-cluster">
                  Skill Cluster: {selectedSkillCluster || '--'}
                </p>
              </div>
              {selectedStageCode ? <Button variant="outlined" size="small" onClick={() => setSelectedStageCode('')}>Clear Stage Drilldown</Button> : null}
            </div>
            <div className="candidate-stage-heatmap">
              {stageCards.map((stage) => (
                <div className="candidate-stage-block" key={stage.key} title={`${stage.label}: ${stage.count}`}>
                  <div className="candidate-stage-heading">
                    <strong>{stage.count}</strong>
                    <span>{stage.label}</span>
                  </div>
                  <div className="candidate-status-blocks">
                    {stage.statuses.map((status) => (
                      <div
                        className={`candidate-status-card ${selectedStageCode === status.stageCode ? 'selected-drilldown' : ''}`}
                        key={status.key}
                      >
                        <button
                          className={`candidate-status-block ${status.level}`}
                          type="button"
                          title={status.description}
                          onClick={() => setSelectedStageCode(status.stageCode)}
                        >
                          <b>{status.count}</b>
                          <span>
                            <i>{status.label}</i>
                            {status.lastProfileReceivedDate ? (
                              <small className="candidate-profile-date-badge" title={`Last Profile Received Date: ${status.lastProfileReceivedDate}`}>
                                Last Profile: {status.lastProfileReceivedDate}
                              </small>
                            ) : null}
                          </span>
                        </button>
                        <Tooltip title="Draft email">
                          <span>
                            <IconButton
                              aria-label={`Draft email for ${status.label}`}
                              className="candidate-status-email"
                              disabled={!status.count}
                              onClick={() => draftCandidateStageEmail(status)}
                              size="small"
                            >
                              <Email fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </div>
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
                    ? `${getCandidatePipelineRows(visibleCandidateRows, selectedStageCode).length} candidate rows for ${selectedLegacyJobReqId}${selectedStageCode ? ` / stage ${selectedStageCode}` : ''}`
                    : 'Select a Legacy Job Req Id to populate candidate details.'}
                </p>
              </div>
            </div>
            <div className="data-grid-shell">
              <DataGrid
                rows={getCandidatePipelineRows(visibleCandidateRows, selectedStageCode)}
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

function getCandidatePipelineRows(rows, selectedStageCode) {
  if (!selectedStageCode) return rows;
  return rows.filter((row) => row.stageCode === selectedStageCode);
}

function buildCandidateStageEmailDraft({ stageStatus, selectedLegacyJobReqId, selectedDemand, rows }) {
  const subject = stageStatus || 'Candidate Stage Status';
  const fallbackCustomer = rows.find((row) => row.customer)?.customer || '';
  const filters = [
    ['Legacy Job Req Id', selectedLegacyJobReqId],
    ['Job Requisition ID/Demand ID', selectedDemand.demandId],
    ['Customer', selectedDemand.customer || fallbackCustomer],
    ['Stage Status', stageStatus],
    ['Filtered Candidate Count', rows.length]
  ];
  const headers = [
    'S.No',
    'Candidate Name',
    'Customer',
    'External/Internal',
    'SAP ID',
    'Stage',
    'Stage Detail'
  ];
  const rowValues = rows.map((row, index) => [
    index + 1,
    row.candidateName,
    row.customer,
    row.externalInternal,
    row.sapId,
    row.stageCode,
    row.stageDetail
  ]);

  return {
    subject,
    htmlBody: buildHtmlEmailBody({ stageStatus, filters, headers, rowValues })
  };
}

function formatEmailValue(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || '--';
}

function buildHtmlEmailBody({ stageStatus, filters, headers, rowValues }) {
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
  const candidateRows = rowValues.length
    ? rowValues
      .map((values, index) => `
        <tr style="background:${index % 2 ? '#f8fafc' : '#ffffff'};">
          ${values.map((value) => `<td style="padding:8px 10px;border:1px solid #d9e2ec;color:#17202a;vertical-align:top;">${escapeHtml(formatEmailValue(value))}</td>`).join('')}
        </tr>
      `)
      .join('')
    : `<tr><td colspan="${headers.length}" style="padding:10px;border:1px solid #d9e2ec;color:#607080;">No candidate rows matched this stage status.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
    <div style="font-size:14px;line-height:1.45;">
      <p>Hi Team,</p>
      <p>Please find below the candidate details filtered from the Candidate Stage Heatmap for <strong>${escapeHtml(formatEmailValue(stageStatus))}</strong>.</p>

      <h3 style="margin:18px 0 8px;color:#244354;font-size:16px;">Filter Summary</h3>
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:760px;margin-bottom:18px;">
        <tbody>${summaryRows}</tbody>
      </table>

      <h3 style="margin:18px 0 8px;color:#244354;font-size:16px;">Filtered Candidate Details</h3>
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${candidateRows}</tbody>
      </table>

      <p style="margin-top:18px;">Regards,<br/>Resource Fulfilment Team</p>
    </div>
  </body>
</html>`.trim();
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

function classifyCandidateStage(row, stageClassification) {
  const trackerStage = parseTrackerStageStatus(row.stageStatus, stageClassification);
  if (trackerStage.stageCode || trackerStage.stageDetail) {
    return trackerStage;
  }

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

function parseTrackerStageStatus(value, stageClassification) {
  const text = String(value || '').trim();
  if (!text) {
    return { stageName: '', stageCode: '', stageDetail: '', stageStatus: '', stageBucket: 'No Update' };
  }

  const [stageCodePart, ...detailParts] = text.split('-');
  const stageCode = String(stageCodePart || '').trim();
  const stageDetail = detailParts.join('-').trim();
  const stageName = getStageGroupFromCode(stageCode, stageClassification) || getFallbackStageLabel(stageCode);

  return {
    stageName,
    stageCode,
    stageDetail,
    stageStatus: text,
    stageBucket: bucketStatus(normalize(stageDetail || text))
  };
}

function getStageGroupFromCode(stageCode, stageClassification) {
  const code = String(stageCode || '').trim();
  if (!code) return '';
  const matchedStage = (stageClassification?.stages || []).find((stage) => String(stage.stage || '').trim() === code);
  if (matchedStage?.group) return matchedStage.group;
  if (code.startsWith('1.')) return 'Profile Sourcing';
  if (code.startsWith('2.')) return 'TP1';
  if (code.startsWith('3.')) return 'TP2';
  if (code.startsWith('4.')) return 'Customer Feedback';
  if (code.startsWith('5.')) return 'Onboarding';
  return '';
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
  const classifiedGroups = ['Profile Sourcing', 'TP1', 'TP2', 'Customer Feedback', 'Onboarding'];
  const counts = new Map(classifiedGroups.map((label) => [label, 0]));
  const stageRows = new Map();

  rows.forEach((row) => {
    const group = normalizeHeatmapStageGroup(row.stageName);
    if (group) counts.set(group, (counts.get(group) || 0) + 1);
    if (row.stageCode) {
      if (!stageRows.has(row.stageCode)) {
        stageRows.set(row.stageCode, {
          stage: row.stageCode,
          description: row.stageDetail || row.stageStatus || row.stageCode,
          count: 0,
          lastProfileReceivedDate: ''
        });
      }
      const stageRow = stageRows.get(row.stageCode);
      stageRow.count += 1;
      stageRow.lastProfileReceivedDate = getLatestProfileReceivedDate(stageRow.lastProfileReceivedDate, row.profileReceivedDate);
    }
  });

  return classifiedGroups.map((label) => {
    const count = counts.get(label) || 0;
    const stageDefinitions = getStageDefinitionsForGroup(stageClassification, label);
    return {
      key: label,
      label,
      count,
      statuses: getVisibleStageDefinitions(stageDefinitions, stageRows, label)
        .map((stage) => {
          const stageCount = stage.count ?? 0;
          return {
            key: stage.stage,
            label: formatStageStatusLabel(stage),
            description: formatStageStatusLabel(stage),
            stageCode: stage.stage,
            spoc: getStageSpoc(stage),
            count: stageCount,
            lastProfileReceivedDate: stage.lastProfileReceivedDate || '',
            level: `${getStageBlockLevel(stageCount, count)} ${getStageSpocClass(stage)}`
          };
        })
        .filter((stage) => stage.count > 0)
    };
  });
}

function normalizeHeatmapStageGroup(value) {
  const group = normalizeStageGroup(value);
  if (group === 'profilesourcing' || group === 'profilereceived' || group === 'screening') return 'Profile Sourcing';
  if (group === 'tp1' || group === 'tp1interview') return 'TP1';
  if (group === 'tp2' || group === 'tp2interview') return 'TP2';
  if (group === 'customerfeedback' || group === 'tp3interview') return 'Customer Feedback';
  if (group === 'onboarding' || group === 'offer') return 'Onboarding';
  return '';
}

function getVisibleStageDefinitions(stageDefinitions, stageRows, group) {
  const activeStages = [...stageRows.values()]
    .filter((stage) => normalizeStageGroup(getStageGroupFromCode(stage.stage, { stages: [] })) === normalizeStageGroup(group));

  return activeStages.length ? activeStages.sort((a, b) => compareStageCodes(a.stage, b.stage)) : stageDefinitions;
}

function formatStageStatusLabel(stage) {
  const stageCode = String(stage?.stage || '').trim();
  const description = String(stage?.description || '').trim();
  if (!stageCode) return description;
  if (!description) return stageCode;
  if (description.toLowerCase().startsWith(stageCode.toLowerCase())) return description;
  return `${stageCode}-${description}`;
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

function getLatestProfileReceivedDate(currentValue, nextValue) {
  const current = normalizeProfileDate(currentValue);
  const next = normalizeProfileDate(nextValue);
  if (!next.label) return current.label;
  if (!current.label) return next.label;
  if (next.timestamp !== null && current.timestamp !== null) {
    return next.timestamp >= current.timestamp ? next.label : current.label;
  }
  if (next.timestamp !== null) return next.label;
  if (current.timestamp !== null) return current.label;
  return String(next.label).localeCompare(String(current.label)) >= 0 ? next.label : current.label;
}

function normalizeProfileDate(value) {
  const label = String(value || '').trim();
  if (!label) return { label: '', timestamp: null };
  const timestamp = parseProfileDateTimestamp(label);
  return { label, timestamp };
}

function parseProfileDateTimestamp(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const nativeTimestamp = Date.parse(text);
  if (!Number.isNaN(nativeTimestamp)) return nativeTimestamp;

  const dateParts = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dateParts) {
    const first = Number(dateParts[1]);
    const second = Number(dateParts[2]);
    const yearPart = Number(dateParts[3]);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    const dayFirst = first > 12;
    const month = dayFirst ? second : first;
    const day = dayFirst ? first : second;
    const timestamp = new Date(year, month - 1, day).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  return null;
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
