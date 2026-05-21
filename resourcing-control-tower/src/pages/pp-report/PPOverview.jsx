import { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Button, CircularProgress, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Download, ExpandMore, FolderOpen, Refresh } from '@mui/icons-material';
import { exportPpAnalysis, getPpData, selectPpExcelFile } from '../../services/ppService.js';
import { getRfsData } from '../../services/rfsService.js';
import { getCommentsData, savePpComment } from '../../services/commentsService.js';
import {
  applyPpFilters,
  buildPpCustomerComparisonRows,
  buildPpGrandTotalRows,
  buildPpKpis,
  emptyPpFilters,
  formatPpMetric,
  formatPpNumber,
  getDefaultPpComparisonPeriods,
  getPpUniqueOptions,
  getPpPeriodField,
  sortPpPeriods
} from '../../services/ppAnalysis.js';
import {
  PP_RULE_CONFIG_EVENT,
  getPpColorClass,
  getPpRuleForKpi,
  loadPpRuleConfig
} from '../../services/ppRuleConfig.js';

const defaultL4SearchText = 'DIGITAL ENGG1';
const valueFields = new Set(['comparisonAverage', 'currentValue', 'change', 'changePct']);
const rfsQuarterKeys = ['AMJ', 'JAS', 'OND', 'JFM'];

function getPpValueClassName(params, ruleConfig) {
  const value = Number(params.value || 0);
  const isNumericValueField = valueFields.has(params.field) || params.field.startsWith('period');
  const rule = getPpRuleForKpi(ruleConfig, params.row.kpi);

  if (!isNumericValueField) return '';
  if (value < 0) return getPpColorClass(ruleConfig.global?.negativeColor) || 'pp-number-negative';
  if (params.row.kpi === 'Unbilled' && params.field === 'currentValue' && params.row.unbilledThresholdExceeded) {
    return getPpColorClass(rule?.color) || 'pp-unbilled-red';
  }
  if (params.row.kpi === 'Total Project Exp' && params.field === 'currentValue' && params.row.expenseDeviationExceeded) {
    return getPpColorClass(rule?.deviationColor) || 'pp-expense-deviation';
  }
  if ((params.row.kpi === 'GFTE Utili %' || params.row.kpi === 'AFTE Utili %') && rule?.enabled) {
    if (value < Number(rule.redBelow || 0)) return 'pp-rule-red';
    if (value < Number(rule.amberBelow || 0)) return 'pp-rule-amber';
    return 'pp-rule-green';
  }
  if (params.row.kpi === 'GM%' && rule?.enabled) {
    if (value <= Number(rule.redMax || 0)) return 'pp-rule-red';
    if (value <= Number(rule.amberMax || 0)) return 'pp-rule-amber';
    return 'pp-rule-green';
  }
  return '';
}

function buildPeriodColumns(comparisonPeriods, currentPeriod, ruleConfig, options = {}) {
  const periodColumns = comparisonPeriods.map((period, index) => ({
    field: `period${index}`,
    headerName: period,
    width: 115,
    type: 'number',
    cellClassName: (params) => getPpValueClassName(params, ruleConfig),
    renderCell: (params) => formatPpMetric(params.value, params.row.kind, params.row.digits)
  }));

  const columns = [
    ...periodColumns,
    {
      field: 'comparisonAverage',
      headerName: options.averageLabel || 'Comparison Avg',
      width: 135,
      type: 'number',
      cellClassName: (params) => getPpValueClassName(params, ruleConfig),
      renderCell: (params) => formatPpMetric(params.value, params.row.kind, params.row.digits)
    },
    {
      field: 'currentValue',
      headerName: currentPeriod || 'Current',
      width: 120,
      type: 'number',
      cellClassName: (params) => getPpValueClassName(params, ruleConfig),
      renderCell: (params) => formatPpMetric(params.value, params.row.kind, params.row.digits)
    },
    {
      field: 'change',
      headerName: 'Change',
      width: 120,
      type: 'number',
      cellClassName: (params) => getPpValueClassName(params, ruleConfig),
      renderCell: (params) => formatPpMetric(params.value, params.row.kind, params.row.digits)
    },
    {
      field: 'changePct',
      headerName: 'Change %',
      width: 115,
      type: 'number',
      cellClassName: (params) => getPpValueClassName(params, ruleConfig),
      valueFormatter: (value) => `${formatPpNumber(value, 1)}%`
    },
    { field: 'trend', headerName: 'Trend', width: 90 }
  ];

  if (!options.showRfsValue) return columns;

  return columns.map((column) =>
    column.field === 'changePct'
      ? {
          field: 'rfsValue',
          headerName: 'RFS Value',
          width: 125,
          type: 'number',
          renderCell: (params) => (params.value == null ? '' : formatPpNumber(params.value))
        }
      : column
  );
}

function getActionFlag(row, ruleConfig) {
  const context = row.ruleContext || {};
  const currentValue = Number(row.currentValue || 0);
  const averageValue = Number(row.comparisonAverage || 0);
  const change = Number(row.change || 0);
  const indicativeDrc = Number(context.indicativeDrc || 0);
  const rule = getPpRuleForKpi(ruleConfig, row.kpi);

  if (!rule?.enabled) return '';

  if (row.kpi === 'Total Revenue' && rule.compareToRfs && context.rfsValue > 0 && currentValue < context.rfsValue) {
    return rule.message;
  }
  if (row.kpi === 'Revised DRC' && rule.compareToIndicativeDrc && indicativeDrc > 0) {
    if (currentValue > indicativeDrc) return rule.increaseMessage;
    if (currentValue < indicativeDrc) return rule.decreaseMessage;
  }
  if (row.kpi === 'Revised GM') {
    if (change > 0) return rule.increaseMessage;
    if (change < 0) return rule.decreaseMessage;
  }
  if (row.kpi === 'Total Project Exp' && row.expenseDeviationExceeded) {
    return rule.deviationMessage;
  }
  if (row.kpi === 'Total Project Exp' && rule.drilldown && currentValue !== 0) {
    return rule.defaultMessage;
  }
  if (row.kpi === 'Total GFTE' || row.kpi === 'Total AFTE' || row.kpi === 'Total BFTE') {
    if (change < 0) return rule.decreaseMessage;
    if (change > 0) return rule.increaseMessage;
  }
  if (row.kpi === 'Realization') {
    if (averageValue && currentValue > averageValue * (1 + Number(rule.improvementPct || 0) / 100)) return rule.improveMessage;
    if (currentValue < averageValue) return rule.decreaseMessage;
  }
  if (row.kpi === 'Total ARC') {
    if (change > 0) return rule.increaseMessage;
    if (change < 0) return rule.decreaseMessage;
  }
  if (row.kpi === 'GM%') {
    if (change > 0) return rule.increaseMessage;
    if (change < 0) return rule.decreaseMessage;
  }
  if (row.kpi === 'Unbilled' && row.unbilledThresholdExceeded) {
    return rule.message;
  }
  return '';
}

function getActionColor(row, ruleConfig) {
  const rule = getPpRuleForKpi(ruleConfig, row.kpi);
  const change = Number(row.change || 0);

  if (!row.actionFlag || !rule) return '';
  if (row.kpi === 'Total Revenue') return rule.color;
  if (row.kpi === 'Revised DRC' || row.kpi === 'Total ARC') return change > 0 ? rule.increaseColor : rule.decreaseColor;
  if (row.kpi === 'Revised GM' || row.kpi === 'GM%') return change > 0 ? rule.increaseColor : rule.decreaseColor;
  if (row.kpi === 'Total Project Exp') return row.expenseDeviationExceeded ? rule.deviationColor : 'amber';
  if (row.kpi === 'Total GFTE' || row.kpi === 'Total AFTE' || row.kpi === 'Total BFTE') return change > 0 ? rule.increaseColor : rule.decreaseColor;
  if (row.kpi === 'Realization') return change > 0 ? rule.improveColor : rule.decreaseColor;
  if (row.kpi === 'Unbilled') return rule.color;
  return '';
}

function groupRowsByCustomer(rows) {
  return rows.reduce((groups, row) => {
    const customer = row.customer || 'Unassigned';
    if (!groups[customer]) groups[customer] = [];
    groups[customer].push(row);
    return groups;
  }, {});
}

export default function PPOverview() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ fileName: '', filePath: '', sheetName: '', refreshedAt: '', warning: '' });
  const [filters, setFilters] = useState(emptyPpFilters);
  const [comparisonPeriods, setComparisonPeriods] = useState([]);
  const [pmRemarks, setPmRemarks] = useState({});
  const [rfsRows, setRfsRows] = useState([]);
  const [detailDialog, setDetailDialog] = useState(null);
  const [exportStatus, setExportStatus] = useState('');
  const [ruleConfig, setRuleConfig] = useState(() => loadPpRuleConfig());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (picker = false) => {
    setLoading(true);
    setError('');
    try {
      const payload = picker ? await selectPpExcelFile() : await getPpData();
      if (!payload.canceled) {
        setRows(payload.rows || []);
        setMeta({
          fileName: payload.fileName || '',
          filePath: payload.filePath || '',
          sheetName: payload.sheetName || '',
          refreshedAt: payload.refreshedAt || '',
          warning: payload.warning || ''
        });
      }
    } catch (err) {
      setError(err.message || 'Unable to load PP Analysis workbook.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    async function loadSavedRemarks() {
      const comments = await getCommentsData();
      setPmRemarks(comments.pp || {});
    }

    loadSavedRemarks();
  }, []);

  useEffect(() => {
    const handleConfigUpdate = (event) => setRuleConfig(event.detail || loadPpRuleConfig());
    window.addEventListener(PP_RULE_CONFIG_EVENT, handleConfigUpdate);
    window.addEventListener('storage', handleConfigUpdate);
    return () => {
      window.removeEventListener(PP_RULE_CONFIG_EVENT, handleConfigUpdate);
      window.removeEventListener('storage', handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    async function loadRfsContext() {
      const payloads = await Promise.all(
        rfsQuarterKeys.map(async (quarter) => {
          try {
            return await getRfsData({ quarter });
          } catch {
            return null;
          }
        })
      );
      setRfsRows(
        payloads.flatMap((payload) =>
          (payload?.summaryRows || []).map((row) => ({
            ...row,
            quarter: payload.quarter
          }))
        )
      );
    }

    loadRfsContext();
  }, []);

  const periodType = filters.periodType || 'month';
  const periodField = getPpPeriodField(periodType);
  const periodOptions = useMemo(() => sortPpPeriods(periodType, getPpUniqueOptions(rows, periodField)), [periodField, periodType, rows]);
  const defaultPeriod = periodOptions[periodOptions.length - 1] || '';
  const currentPeriod = filters.periodValue || defaultPeriod;
  const comparisonAverageLabel = periodType === 'month' ? '3-Month Avg' : 'Comparison Avg';

  useEffect(() => {
    if (!filters.periodValue && defaultPeriod) {
      setFilters((current) => ({ ...current, periodValue: defaultPeriod }));
    }
  }, [defaultPeriod, filters.periodValue]);

  useEffect(() => {
    if (!comparisonPeriods.length && currentPeriod) {
      setComparisonPeriods(getDefaultPpComparisonPeriods(periodOptions, currentPeriod, periodType));
    }
  }, [comparisonPeriods.length, currentPeriod, periodOptions, periodType]);

  useEffect(() => {
    if (!rows.length || filters.l4Mappings.length) return;
    const digitalEnggL4Options = getPpUniqueOptions(rows, 'l4Mapping').filter((option) =>
      option.toUpperCase().includes(defaultL4SearchText)
    );
    if (digitalEnggL4Options.length) {
      setFilters((current) => ({ ...current, l4Mappings: digitalEnggL4Options }));
    }
  }, [filters.l4Mappings.length, rows]);

  const rowsForTrends = useMemo(
    () => applyPpFilters(rows, { ...filters, month: '', periodValue: '', fiscal: periodType === 'fiscal' ? '' : filters.fiscal }),
    [rows, filters, periodType]
  );
  const previousPeriod = useMemo(() => {
    const currentIndex = periodOptions.findIndex((period) => period === currentPeriod);
    return currentIndex > 0 ? periodOptions[currentIndex - 1] : '';
  }, [currentPeriod, periodOptions]);
  const customerRuleContext = useMemo(
    () => buildCustomerRuleContext(rowsForTrends, currentPeriod, previousPeriod, rfsRows, periodType),
    [currentPeriod, periodType, previousPeriod, rfsRows, rowsForTrends]
  );
  const customerComparisonRows = useMemo(
    () =>
      buildPpCustomerComparisonRows(rowsForTrends, currentPeriod, comparisonPeriods, periodType).map((row) => {
        const ruleContext = customerRuleContext[row.customer] || {};
        const averageValue = Number(row.comparisonAverage || 0);
        const currentValue = Number(row.currentValue || 0);
        const kpiRule = getPpRuleForKpi(ruleConfig, row.kpi);
        const commentKey = buildPpCommentKey(row, periodType, currentPeriod);
        const enrichedRow = {
          ...row,
          commentKey,
          ruleContext,
          rfsValue: row.kpi === 'Total Revenue' && ruleContext.rfsValue ? ruleContext.rfsValue : null,
          unbilledThresholdExceeded:
            row.kpi === 'Unbilled' &&
            Number(row.currentValue || 0) >= Number(ruleContext.currentKpis?.totalGfte || 0) * (Number(kpiRule?.thresholdPct || 0) / 100),
          expenseDeviationExceeded:
            row.kpi === 'Total Project Exp' &&
            averageValue !== 0 &&
            Math.abs(currentValue - averageValue) / Math.abs(averageValue) > Number(kpiRule?.deviationPct || 0) / 100,
          pmRemarks: pmRemarks[commentKey] || ''
        };
        const actionFlag = getActionFlag(enrichedRow, ruleConfig);
        return {
          ...enrichedRow,
          actionFlag,
          actionColor: getActionColor({ ...enrichedRow, actionFlag }, ruleConfig)
        };
      }),
    [comparisonPeriods, currentPeriod, customerRuleContext, pmRemarks, periodType, rowsForTrends, ruleConfig]
  );
  const customerComparisonGroups = useMemo(() => groupRowsByCustomer(customerComparisonRows), [customerComparisonRows]);
  const selectedCustomerLabel = useMemo(() => {
    if (filters.customerName) return filters.customerName;
    if (filters.customerGroupings.length) return filters.customerGroupings.join(', ');
    return 'Selected Customers';
  }, [filters.customerGroupings, filters.customerName]);
  const grandTotalRows = useMemo(
    () =>
      buildPpGrandTotalRows(rowsForTrends, currentPeriod, comparisonPeriods, periodType).map((row, index) => ({
        ...row,
        customer: index === 0 ? selectedCustomerLabel : ''
      })),
    [rowsForTrends, currentPeriod, comparisonPeriods, periodType, selectedCustomerLabel]
  );
  const detailedComparisonColumns = useMemo(
    () => [
      { field: 'kpi', headerName: 'KPI', minWidth: 165 },
      ...buildPeriodColumns(comparisonPeriods, currentPeriod, ruleConfig, { showRfsValue: true, averageLabel: comparisonAverageLabel }),
      { field: 'actionFlag', headerName: 'Action Flag', minWidth: 230, flex: 0.8, cellClassName: (params) => params.value ? getPpColorClass(params.row.actionColor) || 'pp-action-flag' : '' },
      { field: 'pmRemarks', headerName: 'PM Remarks', minWidth: 220, flex: 1, editable: true }
    ],
    [comparisonPeriods, currentPeriod, ruleConfig, comparisonAverageLabel]
  );
  const grandTotalColumns = useMemo(
    () => [
      { field: 'customer', headerName: 'Customer', minWidth: 180 },
      { field: 'kpi', headerName: 'KPI', minWidth: 165, flex: 1 },
      ...buildPeriodColumns(comparisonPeriods, currentPeriod, ruleConfig, { averageLabel: comparisonAverageLabel })
    ],
    [comparisonPeriods, currentPeriod, ruleConfig, comparisonAverageLabel]
  );

  const customerNameRows = filters.customerGroupings.length
    ? rows.filter((row) => filters.customerGroupings.includes(row.customerGrouping))
    : rows;
  const projectRows = filters.customerName
    ? rows.filter((row) => row.customerName === filters.customerName)
    : customerNameRows;

  const updateFilter = (field, value) => {
    setFilters((current) => {
      const next = { ...current, [field]: value };
      if (field === 'l4Mappings') {
        next.customerName = '';
        next.projectName = '';
      }
      if (field === 'customerGroupings') {
        next.customerName = '';
        next.projectName = '';
      }
      if (field === 'customerName') {
        next.projectName = '';
      }
      if (field === 'periodType') {
        const nextField = getPpPeriodField(value);
        const nextOptions = sortPpPeriods(value, getPpUniqueOptions(rows, nextField));
        const nextPeriod = nextOptions[nextOptions.length - 1] || '';
        next.periodValue = nextPeriod;
        next.month = '';
        if (value === 'fiscal') next.fiscal = '';
        setComparisonPeriods(getDefaultPpComparisonPeriods(nextOptions, nextPeriod, value));
      }
      if (field === 'periodValue') {
        setComparisonPeriods(getDefaultPpComparisonPeriods(periodOptions, value, periodType));
      }
      return next;
    });
  };

  const updateComparisonPeriods = (event) => {
    setComparisonPeriods(Array.from(event.target.selectedOptions).map((option) => option.value));
  };

  const updateCustomerGroupings = (event) => {
    updateFilter('customerGroupings', Array.from(event.target.selectedOptions).map((option) => option.value));
  };

  const updateL4Mappings = (event) => {
    updateFilter('l4Mappings', Array.from(event.target.selectedOptions).map((option) => option.value));
  };

  const updatePmRemarks = (updatedRow) => {
    const commentKey = updatedRow.commentKey || buildPpCommentKey(updatedRow, periodType, currentPeriod);
    const value = updatedRow.pmRemarks || '';
    setPmRemarks((current) => ({ ...current, [commentKey]: value }));
    savePpComment(commentKey, value).catch((err) => console.error(err));
    return updatedRow;
  };

  const handleKpiDoubleClick = (params) => {
    const context = customerRuleContext[params.row.customer] || {};
    if (params.row.kpi === 'Total Revenue') {
      setDetailDialog({
        title: `Total Revenue - ${params.row.customer}`,
        amountLabel: 'Total Revenue',
        valueKey: 'totalRevenue',
        details: context.revenueDetails || []
      });
      return;
    }
    if (params.row.kpi === 'Total Project Exp') {
      setDetailDialog({
        title: `Total Project Expenses - ${params.row.customer}`,
        amountLabel: 'Total Project Expenses',
        valueKey: 'totalProjectExpenses',
        details: context.expenseDetails || []
      });
    }
  };

  const handleExport = async () => {
    setExportStatus('Preparing PP Analysis export...');
    try {
      const result = await exportPpAnalysis({
        sheets: {
          'Detailed KPI Comparison': buildDetailedExportRows(customerComparisonRows, comparisonPeriods, currentPeriod, comparisonAverageLabel),
          'Grand Total Summary': buildGrandTotalExportRows(grandTotalRows, comparisonPeriods, currentPeriod, comparisonAverageLabel),
          'Filters and Source': buildFilterExportRows(filters, comparisonPeriods, meta, currentPeriod)
        }
      });
      setExportStatus(result.canceled ? 'Export cancelled.' : `PP Analysis saved: ${result.filePath}`);
    } catch (err) {
      setExportStatus(err.message || 'Unable to export PP Analysis.');
    }
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>PP Report Analysis</h1>
          <p title={meta.filePath}>
            {meta.fileName || 'Waiting for PP Excel workbook'} {meta.sheetName ? `/ ${meta.sheetName}` : ''}
          </p>
          <p>Loaded: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
        </div>
        <div className="page-actions">
          <Button variant="outlined" startIcon={<FolderOpen />} onClick={() => loadData(true)} disabled={loading}>
            Choose PP Excel
          </Button>
          <Button variant="contained" startIcon={<Refresh />} onClick={() => loadData()} disabled={loading}>
            Refresh PP
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExport} disabled={loading || !customerComparisonRows.length}>
            Export PP
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="state-panel">
          <CircularProgress />
          <span>Loading PP Analysis workbook...</span>
        </div>
      ) : error ? (
        <div className="state-panel error">{error}</div>
      ) : meta.warning ? (
        <div className="state-panel">
          <strong>{meta.warning}</strong>
          <span>Choose a PP Excel file to continue.</span>
        </div>
      ) : (
        <>
          {exportStatus && <div className="status-banner">{exportStatus}</div>}
          <section className="pp-filter-bar">
            <label className="pp-filter-l4">
              L4 Mapping Contains
              <select className="multi-select" multiple value={filters.l4Mappings} onChange={updateL4Mappings}>
                {getPpUniqueOptions(rows, 'l4Mapping').map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Customer Groupings
              <select className="multi-select" multiple value={filters.customerGroupings} onChange={updateCustomerGroupings}>
                {getPpUniqueOptions(rows, 'customerGrouping').map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Customer
              <select value={filters.customerName} onChange={(event) => updateFilter('customerName', event.target.value)}>
                <option value="">All</option>
                {getPpUniqueOptions(customerNameRows, 'customerName').map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Project
              <select value={filters.projectName} onChange={(event) => updateFilter('projectName', event.target.value)}>
                <option value="">All</option>
                {getPpUniqueOptions(projectRows, 'projectName').map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="pp-filter-period-type">
              Period Type
              <select value={periodType} onChange={(event) => updateFilter('periodType', event.target.value)}>
                <option value="month">Month</option>
                <option value="quarter">Qtr</option>
                <option value="fiscal">Fiscal</option>
              </select>
            </label>
            <label className="pp-filter-month">
              Current {getPeriodTypeLabel(periodType)}
              <select value={currentPeriod} onChange={(event) => updateFilter('periodValue', event.target.value)}>
                {periodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="pp-filter-comparison-months">
              Comparison {getPeriodTypeLabel(periodType)}s
              <select className="multi-select" multiple value={comparisonPeriods} onChange={updateComparisonPeriods}>
                {periodOptions.filter((option) => option !== currentPeriod).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Fiscal Filter
              <select value={filters.fiscal} onChange={(event) => updateFilter('fiscal', event.target.value)} disabled={periodType === 'fiscal'}>
                <option value="">All</option>
                {getPpUniqueOptions(rows, 'fiscal').map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Detailed KPI Comparison by Customer</h2>
                <p>{customerComparisonRows.length} KPI rows across current customer scope</p>
              </div>
            </div>
            <div className="pp-customer-accordion-list">
              {Object.entries(customerComparisonGroups).map(([customer, customerRows], index) => {
                const actionCount = customerRows.filter((row) => row.actionFlag).length;
                return (
                  <Accordion key={customer} defaultExpanded={index === 0} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <div className="pp-customer-summary">
                        <strong>{customer}</strong>
                        <span>{customerRows.length} KPI rows</span>
                        {actionCount > 0 && <span>{actionCount} action flags</span>}
                      </div>
                    </AccordionSummary>
                    <AccordionDetails>
                      <div className="data-grid-shell pp-compact-grid">
                        <DataGrid
                          rows={customerRows}
                          columns={detailedComparisonColumns}
                          autoHeight
                          hideFooter
                          density="compact"
                          rowHeight={30}
                          columnHeaderHeight={36}
                          processRowUpdate={updatePmRemarks}
                          onCellDoubleClick={handleKpiDoubleClick}
                        />
                      </div>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </div>
          </section>

          <section className="plain-section">
            <div className="page-title-row compact-row">
              <div>
                <h2>Grand Total Summary</h2>
                <p>{selectedCustomerLabel}</p>
              </div>
            </div>
            <div className="data-grid-shell">
              <DataGrid rows={grandTotalRows} columns={grandTotalColumns} autoHeight hideFooter density="compact" rowHeight={32} columnHeaderHeight={38} />
            </div>
          </section>

          <Dialog open={Boolean(detailDialog)} onClose={() => setDetailDialog(null)} maxWidth="md" fullWidth>
            <DialogTitle>{detailDialog?.title}</DialogTitle>
            <DialogContent>
              <div className="expense-detail-list">
                <div className="expense-detail-row header">
                  <span>Cost Element</span>
                  <span>{detailDialog?.amountLabel}</span>
                </div>
                {(detailDialog?.details || []).map((row) => (
                  <div className="expense-detail-row" key={row.costElement}>
                    <span>{row.costElement}</span>
                    <strong>{formatPpNumber(row[detailDialog?.valueKey])}</strong>
                  </div>
                ))}
                {!detailDialog?.details?.length && <div className="status-banner">No details found for the current scope.</div>}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
  );
}

function buildDetailedExportRows(rows, comparisonPeriods, currentPeriod, comparisonAverageLabel) {
  return rows.map((row) => {
    const exportRow = {
      Customer: row.customer,
      KPI: row.kpi
    };

    comparisonPeriods.forEach((period, index) => {
      exportRow[period] = row[`period${index}`] ?? '';
    });

    exportRow[comparisonAverageLabel] = row.comparisonAverage ?? '';
    exportRow[currentPeriod || 'Current'] = row.currentValue ?? '';
    exportRow.Change = row.change ?? '';
    exportRow['RFS Value'] = row.rfsValue ?? '';
    exportRow.Trend = row.trend || '';
    exportRow['Action Flag'] = row.actionFlag || '';
    exportRow['PM Remarks'] = row.pmRemarks || '';

    return exportRow;
  });
}

function buildGrandTotalExportRows(rows, comparisonPeriods, currentPeriod, comparisonAverageLabel) {
  return rows.map((row) => {
    const exportRow = {
      Customer: row.customer,
      KPI: row.kpi
    };

    comparisonPeriods.forEach((period, index) => {
      exportRow[period] = row[`period${index}`] ?? '';
    });

    exportRow[comparisonAverageLabel] = row.comparisonAverage ?? '';
    exportRow[currentPeriod || 'Current'] = row.currentValue ?? '';
    exportRow.Change = row.change ?? '';
    exportRow['Change %'] = row.changePct ?? '';
    exportRow.Trend = row.trend || '';

    return exportRow;
  });
}

function buildFilterExportRows(filters, comparisonPeriods, meta, currentPeriod) {
  return [
    { Field: 'Source File', Value: meta.fileName || '' },
    { Field: 'Source Path', Value: meta.filePath || '' },
    { Field: 'Source Sheet', Value: meta.sheetName || '' },
    { Field: 'Loaded Timestamp', Value: meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : '' },
    { Field: 'L4 Mapping', Value: filters.l4Mappings.join(', ') || 'All' },
    { Field: 'Customer Groupings', Value: filters.customerGroupings.join(', ') || 'All' },
    { Field: 'Customer', Value: filters.customerName || 'All' },
    { Field: 'Project', Value: filters.projectName || 'All' },
    { Field: 'Period Type', Value: getPeriodTypeLabel(filters.periodType || 'month') },
    { Field: 'Current Period', Value: currentPeriod || '' },
    { Field: 'Comparison Periods', Value: comparisonPeriods.join(', ') },
    { Field: 'Fiscal', Value: filters.fiscal || 'All' }
  ];
}

function buildPpCommentKey(row, periodType, currentPeriod) {
  return [
    periodType,
    currentPeriod,
    row.customer,
    row.kpi
  ].map((part) => String(part || '').trim()).join('|');
}

function getPeriodTypeLabel(periodType) {
  if (periodType === 'quarter') return 'Qtr';
  if (periodType === 'fiscal') return 'Fiscal';
  return 'Month';
}

function buildCustomerRuleContext(rows, currentPeriod, previousPeriod, rfsRows, periodType = 'month') {
  const periodField = getPpPeriodField(periodType);
  const customers = [...new Set(rows.map((row) => row.customerGrouping || row.customerName || 'Unassigned').filter(Boolean))];
  return customers.reduce((context, customer) => {
    const currentRows = rows.filter((row) => row[periodField] === currentPeriod && (row.customerGrouping || row.customerName || 'Unassigned') === customer);
    const previousRows = rows.filter((row) => row[periodField] === previousPeriod && (row.customerGrouping || row.customerName || 'Unassigned') === customer);
    const currentKpis = buildPpKpis(currentRows);
    const previousKpis = buildPpKpis(previousRows);
    const matchingRfsRows = rfsRows.filter((row) => String(row.customerGroup || '').toLowerCase() === String(customer || '').toLowerCase());
    const revenueMap = new Map();
    const expenseMap = new Map();

    currentRows.forEach((row) => {
      const costElement = row.costElement || 'Unassigned';
      revenueMap.set(costElement, (revenueMap.get(costElement) || 0) + Number(row.totalRevenue || 0));
      expenseMap.set(costElement, (expenseMap.get(costElement) || 0) + Number(row.totalProjectExpenses || 0));
    });

    context[customer] = {
      currentKpis,
      previousKpis,
      indicativeDrc: Number(previousKpis.totalArc || 0) * Number(currentKpis.totalGfte || 0),
      rfsValue: getRfsValueForPeriod(matchingRfsRows, currentPeriod, periodType),
      revenueDetails: [...revenueMap.entries()]
        .map(([costElement, totalRevenue]) => ({ costElement, totalRevenue }))
        .filter((row) => row.totalRevenue !== 0)
        .sort((a, b) => Math.abs(b.totalRevenue) - Math.abs(a.totalRevenue)),
      expenseDetails: [...expenseMap.entries()]
        .map(([costElement, totalProjectExpenses]) => ({ costElement, totalProjectExpenses }))
        .filter((row) => row.totalProjectExpenses !== 0)
        .sort((a, b) => Math.abs(b.totalProjectExpenses) - Math.abs(a.totalProjectExpenses))
    };
    return context;
  }, {});
}

function getRfsValueForPeriod(rows, period, periodType = 'month') {
  const rfsRows = Array.isArray(rows) ? rows : rows ? [rows] : [];
  if (!rfsRows.length) return 0;
  if (periodType === 'fiscal') {
    return rfsRows.reduce((sum, row) => sum + Number(row.totalRfs || 0), 0);
  }
  if (periodType === 'quarter') {
    const quarterKey = getRfsQuarterKeyFromPeriod(period);
    const row = rfsRows.find((item) => item.quarter === quarterKey) || rfsRows[0];
    return Number(row.totalRfs || 0);
  }
  const monthName = String(period || '').slice(0, 3).toLowerCase();
  const row = rfsRows.find((item) => item[`${monthName}Rfs`] != null) || rfsRows[0];
  return Number(row[`${monthName}Rfs`] || row.totalRfs || 0);
}

function getRfsQuarterKeyFromPeriod(period) {
  const value = String(period || '').toUpperCase();
  if (value.includes('AMJ') || value.includes('Q1')) return 'AMJ';
  if (value.includes('JAS') || value.includes('Q2')) return 'JAS';
  if (value.includes('OND') || value.includes('Q3')) return 'OND';
  if (value.includes('JFM') || value.includes('Q4')) return 'JFM';
  return 'AMJ';
}
