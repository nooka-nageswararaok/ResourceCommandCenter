import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircularProgress, ThemeProvider, createTheme } from '@mui/material';
import MainLayout from './layout/MainLayout.jsx';
import ResourcingLayout from './layout/ResourcingLayout.jsx';
import { defaultRouteKey, getRouteByKey, moduleRoutes, resolveRouteKey } from './routes.jsx';
import { getResourceData, selectExcelFile } from './services/excelService.js';
import { applyQuickFilters, normalizeCsvRows } from './services/dataDerivation.js';
import { getCommentsData, saveResourceComment } from './services/commentsService.js';

const theme = createTheme({
  typography: {
    fontFamily: 'Inter, Segoe UI, Arial, sans-serif'
  },
  palette: {
    primary: { main: '#245b73' }
  }
});

const initialMeta = {
  fileName: null,
  filePath: null,
  dataFolder: '',
  sheetName: null,
  refreshedAt: null,
  warning: ''
};

const emptyQuickFilters = {
  search: '',
  customer: '',
  project: '',
  pmName: [],
  location: ''
};

function buildResourceCommentKey(record) {
  return [
    record.empId,
    record.customer,
    record.projectCode || record.projectName,
    record.assignmentEnd ? new Date(record.assignmentEnd).toISOString().slice(0, 10) : ''
  ].map((part) => String(part || '').trim()).join('|');
}

function applyResourceComments(records, comments = {}) {
  return records.map((record) => {
    const commentKey = buildResourceCommentKey(record);
    return Object.prototype.hasOwnProperty.call(comments, commentKey)
      ? { ...record, pmoComments: comments[commentKey] }
      : record;
  });
}

export default function App() {
  const [activeRoute, setActiveRoute] = useState(defaultRouteKey);
  const [routeState, setRouteState] = useState({});
  const [records, setRecords] = useState([]);
  const [resourceComments, setResourceComments] = useState({});
  const [meta, setMeta] = useState(initialMeta);
  const [quickFilters, setQuickFilters] = useState(emptyQuickFilters);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const updatePmoComment = (recordId, value) => {
    const record = records.find((item) => item.id === recordId);
    const commentKey = record ? buildResourceCommentKey(record) : '';
    setRecords((currentRecords) =>
      currentRecords.map((record) => (record.id === recordId ? { ...record, pmoComments: value } : record))
    );
    if (commentKey) {
      setResourceComments((current) => ({ ...current, [commentKey]: value }));
      saveResourceComment(commentKey, value).catch((err) => console.error(err));
    }
  };

  const applyPayload = (payload, comments = resourceComments) => {
    const normalized = normalizeCsvRows(payload.rows);
    setRecords(applyResourceComments(normalized.records, comments));
    setMeta({
      fileName: payload.fileName,
      filePath: payload.filePath,
      dataFolder: payload.dataFolder,
      sheetName: payload.sheetName,
      refreshedAt: payload.refreshedAt,
      warning: payload.warning || ''
    });
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getResourceData();
      const comments = await getCommentsData();
      setResourceComments(comments.resource || {});
      applyPayload(payload, comments.resource || {});
    } catch (err) {
      setError(err.message || 'Unable to load Excel data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const chooseExcelFile = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await selectExcelFile();
      if (!payload.canceled) {
        const comments = await getCommentsData();
        setResourceComments(comments.resource || {});
        applyPayload(payload, comments.resource || {});
      }
    } catch (err) {
      setError(err.message || 'Unable to select Excel file.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  const navigate = (routeKey, state = {}) => {
    const resolvedKey = resolveRouteKey(routeKey);
    setRouteState(state);
    setActiveRoute(resolvedKey);
  };

  const route = useMemo(() => getRouteByKey(activeRoute), [activeRoute]);
  const Page = route.component;
  const isResourcingRoute = route.module === 'resourcing';
  const filteredRecords = useMemo(() => applyQuickFilters(records, quickFilters), [records, quickFilters]);
  const quickProjectRecords = useMemo(
    () => (quickFilters.customer ? records.filter((record) => record.customer === quickFilters.customer) : records),
    [records, quickFilters.customer]
  );

  const updateQuickFilter = (field, value) => {
    setQuickFilters((current) => {
      const next = { ...current, [field]: value };
      if (field === 'customer') {
        next.project = '';
      }
      return next;
    });
  };

  const renderResourcingContent = () => {
    if (loading) {
      return (
        <div className="state-panel">
          <CircularProgress />
          <span>Loading Excel workbook...</span>
        </div>
      );
    }

    if (error) {
      return <div className="state-panel error">{error}</div>;
    }

    if (meta.warning) {
      return (
        <div className="state-panel">
          <strong>{meta.warning}</strong>
          <span>Choose an Excel file from the top bar, or place Resource_Data.xlsx in the data folder, then refresh.</span>
        </div>
      );
    }

    return (
      <Page
        records={filteredRecords}
        allRecords={records}
        meta={meta}
        navigate={navigate}
        initialFilters={routeState}
        onUpdatePmoComment={updatePmoComment}
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <div className="app-shell">
        <MainLayout
          modules={moduleRoutes}
          activeRouteKey={route.key}
          activeModuleKey={route.module}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          onNavigate={navigate}
        >
          {isResourcingRoute ? (
            <ResourcingLayout
              meta={meta}
              records={records}
              quickFilters={quickFilters}
              quickProjectRecords={quickProjectRecords}
              loading={loading}
              onQuickFilterChange={updateQuickFilter}
              onChooseExcelFile={chooseExcelFile}
              onRefresh={refresh}
            >
              {renderResourcingContent()}
            </ResourcingLayout>
          ) : (
            <Page navigate={navigate} initialState={routeState} />
          )}
        </MainLayout>
      </div>
      <style>{styles}</style>
    </ThemeProvider>
  );
}

const styles = `
* { box-sizing: border-box; }
body { margin: 0; background: #f5f7fa; color: #17202a; font-family: Inter, Segoe UI, Arial, sans-serif; }
button, input, select { font: inherit; }
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { min-height: 92px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 12px 24px; background: #ffffff; border-bottom: 1px solid #dce3ea; }
.topbar-title { min-width: 260px; }
.topbar h1 { font-size: 22px; margin: 0 0 4px; }
.topbar p { margin: 0; color: #607080; font-size: 13px; }
.topbar span { display: block; color: #7a8794; font-size: 12px; margin-top: 3px; }
.topbar-controls { display: grid; grid-template-columns: minmax(190px, 1.2fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) auto auto; gap: 10px; align-items: center; flex: 1; }
.topbar-controls input, .topbar-controls select { border: 1px solid #cfd8e2; border-radius: 6px; padding: 10px; min-width: 0; background: #ffffff; }
.topbar-controls .MuiAutocomplete-root { min-width: 0; }
.topbar-controls .MuiInputBase-root { background: #ffffff; min-height: 42px; }
.workspace { flex: 1; display: grid; grid-template-columns: 288px minmax(0, 1fr); min-height: 100vh; transition: grid-template-columns 160ms ease; }
.workspace.nav-collapsed { grid-template-columns: 64px minmax(0, 1fr); }
.side-nav { background: #1f2d36; padding: 18px 12px; display: flex; flex-direction: column; gap: 8px; }
.side-nav button { color: #d7e4ec; background: transparent; border: 0; text-align: left; padding: 12px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 42px; overflow: hidden; width: 100%; }
.side-nav button b { display: none; flex: 0 0 26px; width: 26px; height: 26px; border-radius: 6px; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); font-size: 13px; }
.side-nav button.active, .side-nav button:hover { color: #ffffff; background: #315164; }
.side-nav .nav-toggle { justify-content: space-between; color: #ffffff; background: #263d4c; margin-bottom: 4px; }
.module-group { display: grid; gap: 6px; }
.module-button { font-weight: 700; }
.sub-nav { display: grid; gap: 4px; padding-left: 12px; border-left: 1px solid rgba(255,255,255,0.16); margin-left: 12px; }
.sub-nav button { min-height: 36px; padding: 9px 12px; font-size: 13px; }
.workspace.nav-collapsed .side-nav { padding: 18px 8px; }
.workspace.nav-collapsed .side-nav button { justify-content: center; padding: 10px 8px; }
.workspace.nav-collapsed .side-nav button b { display: flex; }
.workspace.nav-collapsed .side-nav button span, .workspace.nav-collapsed .sub-nav { display: none; }
.workspace.nav-collapsed .side-nav .nav-toggle b { display: none; }
.content { min-width: 0; overflow: auto; }
.page { padding: 24px; }
.page-title-row { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
.page-title-row h1 { margin: 0 0 6px; font-size: 26px; }
.page-title-row p { margin: 0; color: #607080; }
.page-title-row.compact-row { margin-bottom: 12px; align-items: center; }
.page-title-row.compact-row h2 { margin: 0 0 4px; font-size: 18px; }
.page-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; }
.file-pill { background: #e5edf2; color: #244354; padding: 8px 12px; border-radius: 6px; font-size: 13px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 18px; }
.kpi-grid.compact { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.kpi-widget { border: 1px solid #dce3ea; background: #ffffff; border-left: 5px solid #6b7d8d; border-radius: 8px; padding: 16px; text-align: left; cursor: pointer; min-height: 98px; }
.kpi-widget span { display: block; color: #536474; font-size: 13px; margin-bottom: 14px; }
.kpi-widget strong { font-size: 31px; line-height: 1; }
.kpi-green { border-left-color: #1f7a5f; }
.kpi-red { border-left-color: #c95032; }
.kpi-amber { border-left-color: #d19a28; }
.kpi-blue { border-left-color: #316b83; }
.chart-grid { display: grid; grid-template-columns: minmax(300px, 0.8fr) minmax(360px, 1fr) minmax(300px, 0.8fr); gap: 18px; }
.chart-grid.two-column { grid-template-columns: repeat(2, minmax(320px, 1fr)); }
.chart-card, .plain-section, .data-grid-shell { background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; padding: 16px; }
.chart-card h2, .plain-section h2, .filters-panel h2 { margin: 0 0 12px; font-size: 18px; }
.legend-row, .location-list, .risk-strip { display: flex; flex-wrap: wrap; gap: 12px; color: #506170; font-size: 13px; }
.legend-row i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
.pyramid-chart { display: grid; gap: 10px; padding-top: 8px; }
.pyramid-row { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 10px; align-items: center; }
.pyramid-label { color: #536474; font-size: 13px; text-align: right; }
.pyramid-track { height: 24px; display: flex; justify-content: center; align-items: stretch; }
.pyramid-bar { display: flex; align-items: center; justify-content: center; background: #5b6f95; color: #ffffff; border-radius: 4px; min-width: 38px; font-size: 12px; }
.empty-chart, .rank-list span { color: #536474; font-size: 13px; }
.rank-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
.skill-heat-map { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 8px; }
.skill-heat-cell { min-height: 58px; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; font-size: 12px; line-height: 1.2; }
.skill-heat-cell b { font-size: 18px; line-height: 1; }
.inline-filter { display: grid; gap: 6px; min-width: 280px; color: #4c5f70; font-size: 13px; }
.inline-filter select { border: 1px solid #cfd8e2; border-radius: 6px; padding: 10px; background: #ffffff; min-width: 0; }
.plain-section { margin-top: 18px; }
.split-page { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; align-items: start; }
.filters-panel { background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; padding: 16px; position: sticky; top: 18px; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; }
.text-button { border: 0; background: transparent; color: #245b73; cursor: pointer; }
.filters-panel label { display: grid; gap: 6px; margin-top: 14px; font-size: 13px; color: #4c5f70; }
.filters-panel input, .filters-panel select, .toolbar input { border: 1px solid #cfd8e2; border-radius: 6px; padding: 10px; background: #ffffff; min-width: 0; }
.table-section { min-width: 0; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; padding-top: 6px; }
.detail-wide { grid-column: 1 / -1; }
.skills-list { grid-column: 1 / -1; }
.tabs, .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; align-items: center; }
.tabs button, .toolbar button { border: 1px solid #cfd8e2; background: #ffffff; border-radius: 6px; padding: 10px 13px; cursor: pointer; }
.tabs button.active, .toolbar button.active { background: #245b73; border-color: #245b73; color: #ffffff; }
.risk-strip { margin-bottom: 14px; }
.risk-strip span { padding: 8px 10px; border-radius: 6px; border: 1px solid transparent; }
.risk-red { background: #fde9e4; border-color: #f0b2a1 !important; }
.risk-orange { background: #fff1dc; border-color: #edc37d !important; }
.risk-yellow { background: #fff9d9; border-color: #e7d878 !important; }
.risk-row { background: #fff7ed; }
.priority-high { background: #fde9e4; }
.priority-medium { background: #fff7ed; }
.status-banner { background: #e5edf2; border: 1px solid #cbd9e2; border-radius: 6px; color: #244354; margin-bottom: 16px; padding: 10px 12px; font-size: 13px; }
.pp-filter-bar { display: grid; grid-template-columns: minmax(340px, 2fr) minmax(210px, 1.1fr) minmax(150px, 0.8fr) minmax(150px, 0.8fr) minmax(105px, 0.5fr) minmax(110px, 0.5fr) minmax(125px, 0.6fr) minmax(100px, 0.45fr); gap: 12px; margin-bottom: 18px; background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; padding: 14px; }
.pp-filter-bar label { display: grid; gap: 6px; color: #4c5f70; font-size: 13px; }
.pp-filter-bar select { border: 1px solid #cfd8e2; border-radius: 6px; padding: 10px; background: #ffffff; min-width: 0; }
.pp-filter-l4 { min-width: 0; }
.pp-filter-month select, .pp-filter-comparison-months select { padding-left: 7px; padding-right: 7px; }
.pp-filter-bar .multi-select { min-height: 88px; padding: 6px; }
.comparison-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.comparison-grid span { background: #f5f7fa; border: 1px solid #e3e9ef; border-radius: 6px; padding: 10px 12px; color: #536474; }
.comparison-grid b { color: #17202a; }
.pp-customer-accordion-list { display: grid; gap: 10px; }
.pp-customer-accordion-list .MuiAccordion-root { border: 1px solid #dce3ea; border-radius: 8px; box-shadow: none; overflow: hidden; }
.pp-customer-accordion-list .MuiAccordion-root:before { display: none; }
.pp-customer-accordion-list .MuiAccordionSummary-root { min-height: 44px; background: #f5f7fa; }
.pp-customer-accordion-list .MuiAccordionSummary-content { margin: 8px 0; }
.pp-customer-accordion-list .MuiAccordionDetails-root { padding: 0; }
.pp-customer-summary { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; color: #536474; }
.pp-customer-summary strong { color: #17202a; }
.pp-compact-grid { border: 0; border-radius: 0; }
.pp-number-negative { color: #a33a28; font-weight: 700; }
.pp-action-flag { color: #8a5a00; font-weight: 700; background: #fff7ed; }
.pp-unbilled-red { color: #a33a28; font-weight: 700; background: #fde9e4; }
.pp-expense-deviation { color: #8a5a00; font-weight: 700; background: #fff1dc; }
.pp-rule-red { color: #a33a28; font-weight: 700; background: #fde9e4; }
.pp-rule-amber { color: #8a5a00; font-weight: 700; background: #fff1dc; }
.pp-rule-green { color: #1f6f55; font-weight: 700; background: #e8f5ef; }
.pp-gm-red { color: #a33a28; font-weight: 700; background: #fde9e4; }
.pp-gm-amber { color: #8a5a00; font-weight: 700; background: #fff1dc; }
.pp-gm-green { color: #1f6f55; font-weight: 700; background: #e8f5ef; }
.pp-rule-global { display: grid; grid-template-columns: minmax(220px, 320px); }
.pp-rule-global label, .pp-rule-fields label { display: grid; gap: 6px; color: #4c5f70; font-size: 13px; }
.pp-rule-global input, .pp-rule-global select, .pp-rule-fields input, .pp-rule-fields select { border: 1px solid #cfd8e2; border-radius: 6px; padding: 9px 10px; background: #ffffff; min-width: 0; }
.pp-rule-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; }
.pp-rule-card { background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; padding: 14px; display: grid; gap: 14px; }
.pp-rule-card-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; border-bottom: 1px solid #edf1f4; padding-bottom: 12px; }
.pp-rule-card-header h2 { margin: 0 0 4px; font-size: 17px; }
.pp-rule-card-header p { margin: 0; color: #607080; font-size: 13px; }
.pp-rule-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.pp-rule-check, .pp-rule-toggle { display: flex !important; grid-template-columns: none !important; flex-direction: row; gap: 8px; align-items: center; color: #4c5f70; font-size: 13px; }
.pp-rule-check input, .pp-rule-toggle input { width: 16px; height: 16px; min-width: 16px; }
.expense-detail-list { display: grid; gap: 8px; padding-top: 4px; }
.expense-detail-row { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 16px; align-items: center; border-bottom: 1px solid #edf1f4; padding: 8px 0; color: #536474; }
.expense-detail-row.header { background: #f5f7fa; border: 1px solid #e3e9ef; border-radius: 6px; color: #244354; font-weight: 700; padding: 10px 12px; }
.expense-detail-row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.expense-detail-row strong { color: #17202a; text-align: right; }
.rfs-grand-total-row { background: #eef3f7; font-weight: 700; }
.rfs-filter-bar { display: grid; grid-template-columns: minmax(120px, 0.35fr) minmax(260px, 1fr) minmax(180px, 0.55fr) minmax(130px, 0.4fr) minmax(120px, 0.4fr); gap: 12px; margin-bottom: 18px; background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; padding: 14px; }
.rfs-filter-bar label { display: grid; gap: 6px; color: #4c5f70; font-size: 13px; }
.rfs-filter-bar select { border: 1px solid #cfd8e2; border-radius: 6px; padding: 10px; background: #ffffff; min-width: 0; }
.rfs-filter-bar .multi-select { min-height: 88px; padding: 6px; }
.fulfilment-filter-bar { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)) auto; gap: 12px; margin-bottom: 18px; background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; padding: 14px; align-items: end; }
.fulfilment-filter-bar label { display: grid; gap: 6px; color: #4c5f70; font-size: 13px; }
.fulfilment-filter-bar select { border: 1px solid #cfd8e2; border-radius: 6px; background: #ffffff; min-width: 0; }
.fulfilment-filter-bar .multi-select { min-height: 86px; padding: 6px; }
.fulfilment-kpi-grid.kpi-grid { grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); gap: 8px; margin-bottom: 12px; }
.fulfilment-kpi-grid .kpi-widget { min-height: 68px; padding: 10px 10px 10px 12px; border-left-width: 4px; }
.fulfilment-kpi-grid .kpi-widget span { font-size: 11px; margin-bottom: 8px; line-height: 1.15; }
.fulfilment-kpi-grid .kpi-widget strong { font-size: 22px; }
.active-demand-filter-bar { grid-template-columns: minmax(94px, 0.7fr) minmax(145px, 1fr) minmax(94px, 0.65fr) minmax(96px, 0.65fr) minmax(108px, 0.7fr) minmax(114px, 0.7fr) minmax(82px, 0.5fr) minmax(132px, 0.9fr) auto; gap: 8px; padding: 10px; }
.active-demand-filter-bar label { font-size: 12px; }
.active-demand-filter-bar .multi-select { min-height: 66px; padding: 5px; font-size: 12px; }
.filter-action-cell { display: flex; align-items: end; }
.candidate-selector-panel { display: grid; grid-template-columns: minmax(280px, 420px) minmax(260px, 1fr); gap: 16px; align-items: end; margin-bottom: 18px; background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; padding: 14px; }
.candidate-selector-panel label { display: grid; gap: 6px; color: #4c5f70; font-size: 13px; font-weight: 700; }
.candidate-selector-panel select { border: 1px solid #cfd8e2; border-radius: 6px; background: #fff8d8; min-width: 0; padding: 10px; }
.candidate-selector-panel span { color: #607080; font-size: 13px; padding-bottom: 10px; }
.candidate-status-selected { color: #1f6f55; font-weight: 700; background: #e8f5ef; }
.candidate-status-rejected { color: #a33a28; font-weight: 700; background: #fde9e4; }
.candidate-status-pending { color: #8a5a00; font-weight: 700; background: #fff7d6; }
.candidate-status-scheduled { color: #1d5f8a; font-weight: 700; background: #e4f1fb; }
.candidate-stage-heatmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.candidate-stage-block { min-height: 132px; border: 1px solid #dce3ea; border-radius: 8px; padding: 10px; display: grid; align-content: start; gap: 9px; overflow: hidden; }
.candidate-stage-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid rgba(80,97,112,0.16); padding-bottom: 7px; }
.candidate-stage-heading strong { color: #17202a; font-size: 24px; line-height: 1; }
.candidate-stage-heading span { color: #334454; font-size: 12px; font-weight: 700; line-height: 1.15; text-align: right; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.candidate-status-blocks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.candidate-status-block { background: rgba(255,255,255,0.68); border: 1px solid rgba(80,97,112,0.14); border-radius: 6px; padding: 6px; display: grid; gap: 2px; min-width: 0; }
.candidate-status-block b { color: #17202a; font-size: 14px; line-height: 1; }
.candidate-status-block i { color: #607080; font-size: 9px; font-style: normal; line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.candidate-status-block.empty { background: rgba(255,255,255,0.42); opacity: 0.72; }
.candidate-status-block.low { background: #e8f4ff; }
.candidate-status-block.medium { background: #f1e8ff; }
.candidate-status-block.high { background: #e8f5ef; }
.candidate-status-block.spoc-tag { background: #dbeafe; border-color: #60a5fa; }
.candidate-status-block.spoc-cu { background: #f3e8ff; border-color: #c084fc; }
.candidate-status-block.spoc-du { background: #dcfce7; border-color: #4ade80; }
.candidate-status-block.spoc-other { background: #f1f5f9; border-color: #cbd5e1; }
.candidate-status-block.empty.spoc-tag,
.candidate-status-block.empty.spoc-cu,
.candidate-status-block.empty.spoc-du,
.candidate-status-block.empty.spoc-other { opacity: 0.62; }
.candidate-status-block.selected { background: #e8f5ef; }
.candidate-status-block.rejected { background: #fde9e4; }
.candidate-status-block.pending { background: #fff7d6; }
.candidate-status-block.scheduled { background: #e4f1fb; }
.candidate-status-block.no-update { background: #f1f5f9; }
.candidate-stage-block.low { background: #e8f4ff; border-color: #93c5fd; }
.candidate-stage-block.medium { background: #f1e8ff; border-color: #c4a3ff; }
.candidate-stage-block.high { background: #e8f5ef; border-color: #8fd0b3; }
.compact-funnel-section { padding: 12px; }
.compact-funnel-section .page-title-row { margin-bottom: 8px; }
.fulfilment-funnel { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.funnel-step { min-height: 62px; border: 1px solid #dce3ea; border-radius: 8px; background: #f8fafc; padding: 9px; display: grid; align-content: center; gap: 4px; text-align: center; }
.funnel-step strong { color: #17202a; font-size: 20px; line-height: 1; }
.funnel-step span { color: #607080; font-size: 11px; line-height: 1.15; }
.fulfilment-block-heatmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; max-height: 360px; overflow: auto; padding-right: 2px; }
.fulfilment-heat-block { min-height: 72px; border: 1px solid #dce3ea; border-radius: 8px; padding: 9px; display: grid; align-content: space-between; gap: 6px; overflow: hidden; }
.fulfilment-heat-block strong { font-size: 22px; line-height: 1; color: #17202a; }
.fulfilment-heat-block span { color: #334454; font-size: 12px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.fulfilment-heat-block small { color: #607080; font-size: 10px; line-height: 1.1; }
.fulfilment-heat-block.low { background: #e8f4ff; border-color: #93c5fd; }
.fulfilment-heat-block.medium { background: #f1e8ff; border-color: #c4a3ff; }
.fulfilment-heat-block.high { background: #e8f5ef; border-color: #8fd0b3; }
.snapshot-blocks { grid-template-columns: repeat(auto-fit, minmax(124px, 1fr)); max-height: none; }
.active-demand-card-heatmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(245px, 1fr)); gap: 10px; max-height: 680px; overflow: auto; padding-right: 2px; }
.active-demand-card { border: 1px solid #dce3ea; border-radius: 8px; padding: 11px; display: grid; gap: 9px; min-height: 174px; }
.active-demand-card.low { background: #e8f5ef; border-color: #8fd0b3; }
.active-demand-card.medium { background: #f1e8ff; border-color: #c4a3ff; }
.active-demand-card.high { background: #e8f4ff; border-color: #93c5fd; }
.active-demand-card-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.active-demand-card-title strong { color: #17202a; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.active-demand-billing { justify-self: start; border: 1px solid rgba(80,97,112,0.16); border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 800; line-height: 1; }
.active-demand-billing.billing-loss { color: #a33a28; background: #fde9e4; }
.active-demand-billing.pro-active { color: #1f6f55; background: #e8f5ef; }
.active-demand-role { color: #334454; font-size: 12px; line-height: 1.25; min-height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.active-demand-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.active-demand-card-grid span { background: rgba(255,255,255,0.65); border: 1px solid rgba(80,97,112,0.12); border-radius: 6px; padding: 7px; display: grid; gap: 3px; min-width: 0; }
.active-demand-card-grid b { color: #17202a; font-size: 16px; line-height: 1; }
.active-demand-card-grid i { color: #607080; font-size: 10px; font-style: normal; line-height: 1; }
.stage-delay-filter-bar { grid-template-columns: repeat(3, minmax(160px, 1fr)) auto; }
.stage-delay-panels { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
.fulfilment-severity-critical { background: #fde9e4; }
.fulfilment-severity-high { background: #fff1dc; }
.fulfilment-severity-medium { background: #fff9d9; }
.risk-flag-critical { color: #a33a28; font-weight: 700; background: #fde9e4; }
.risk-flag-watch { color: #8a5a00; font-weight: 700; background: #fff1dc; }
.risk-flag-stable { color: #1f6f55; font-weight: 700; background: #e8f5ef; }
.aging-cell-3160 { color: #8a5a00; font-weight: 700; background: #fff9d9; }
.aging-cell-6190 { color: #8a5a00; font-weight: 700; background: #fff1dc; }
.aging-cell-90 { color: #a33a28; font-weight: 700; background: #fde9e4; }
.prompt-panel { display: grid; gap: 4px; max-height: 360px; overflow: auto; background: #fbfcfd; border: 1px solid #e3e9ef; border-radius: 6px; padding: 12px; color: #536474; font-family: Consolas, monospace; font-size: 12px; }
.prompt-heading { color: #17202a; font-weight: 700; margin-top: 8px; }
.placeholder-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px; }
.placeholder-table { display: grid; gap: 8px; }
.placeholder-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 12px; padding: 12px; border: 1px solid #e3e9ef; border-radius: 6px; color: #607080; }
.placeholder-row.header { background: #eef3f7; color: #244354; font-weight: 700; }
.state-panel { margin: 48px auto; max-width: 720px; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; color: #536474; }
.state-panel.error { color: #a33a28; }
@media (max-width: 1100px) {
  .workspace { grid-template-columns: 1fr; }
  .topbar { align-items: stretch; flex-direction: column; }
  .topbar-controls { grid-template-columns: 1fr 1fr; width: 100%; }
  .side-nav { flex-direction: row; overflow-x: auto; }
  .module-group { display: flex; gap: 6px; }
  .sub-nav { display: flex; border-left: 0; padding-left: 0; margin-left: 0; }
  .pp-filter-bar { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
  .rfs-filter-bar { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
  .fulfilment-filter-bar { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
  .candidate-selector-panel { grid-template-columns: 1fr; }
  .kpi-grid, .kpi-grid.compact, .chart-grid, .split-page { grid-template-columns: 1fr; }
  .filters-panel { position: static; }
}
`;
