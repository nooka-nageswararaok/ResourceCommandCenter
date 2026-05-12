import { useCallback, useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, CircularProgress, TextField, ThemeProvider, createTheme } from '@mui/material';
import { FolderOpen, Refresh } from '@mui/icons-material';
import { routes } from './routes.jsx';
import { getResourceData, selectExcelFile } from './services/csvService.js';
import { applyQuickFilters, getUniqueOptions, normalizeCsvRows } from './services/dataDerivation.js';

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

export default function App() {
  const [activeRoute, setActiveRoute] = useState('home');
  const [routeState, setRouteState] = useState({});
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [quickFilters, setQuickFilters] = useState(emptyQuickFilters);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyPayload = (payload) => {
    const normalized = normalizeCsvRows(payload.rows);
    setRecords(normalized.records);
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
      applyPayload(payload);
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
        applyPayload(payload);
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
    setRouteState(state);
    setActiveRoute(routeKey);
  };

  const route = useMemo(() => routes.find((item) => item.key === activeRoute) || routes[0], [activeRoute]);
  const Page = route.component;
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

  return (
    <ThemeProvider theme={theme}>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-title">
            <h1>Resourcing Control Tower</h1>
            <p>Latest Excel loaded: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
            <span title={meta.filePath || ''}>{meta.fileName || 'Waiting for Excel input file'}</span>
          </div>
          <div className="topbar-controls">
            <input
              className="global-search"
              value={quickFilters.search}
              onChange={(event) => updateQuickFilter('search', event.target.value)}
              placeholder="Employee Code / Name"
            />
            <select value={quickFilters.customer} onChange={(event) => updateQuickFilter('customer', event.target.value)}>
              <option value="">Customer</option>
              {getUniqueOptions(records, 'customer').map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={quickFilters.project} onChange={(event) => updateQuickFilter('project', event.target.value)}>
              <option value="">Project</option>
              {getUniqueOptions(quickProjectRecords, 'projectName').map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <Autocomplete
              multiple
              size="small"
              limitTags={1}
              options={getUniqueOptions(records, 'pmName')}
              value={quickFilters.pmName}
              onChange={(_, value) => updateQuickFilter('pmName', value)}
              renderInput={(params) => <TextField {...params} placeholder="PM Name" />}
            />
            <select value={quickFilters.location} onChange={(event) => updateQuickFilter('location', event.target.value)}>
              <option value="">Location</option>
              {getUniqueOptions(records, 'location').map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <Button variant="outlined" startIcon={<FolderOpen />} onClick={chooseExcelFile} disabled={loading}>
              Choose Excel
            </Button>
            <Button variant="contained" startIcon={<Refresh />} onClick={refresh} disabled={loading}>
              Refresh Excel
            </Button>
          </div>
        </header>

        <div className={`workspace ${sidebarCollapsed ? 'nav-collapsed' : ''}`}>
          <nav className="side-nav">
            <button
              className="nav-toggle"
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {sidebarCollapsed ? '>' : '<'}
              <span>{sidebarCollapsed ? '' : 'Collapse'}</span>
            </button>
            {routes.map((item) => (
              <button key={item.key} className={activeRoute === item.key ? 'active' : ''} type="button" onClick={() => navigate(item.key)} title={item.label}>
                <b>{item.label.charAt(0)}</b>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <section className="content">
            {loading ? (
              <div className="state-panel"><CircularProgress /><span>Loading Excel workbook...</span></div>
            ) : error ? (
              <div className="state-panel error">{error}</div>
            ) : meta.warning ? (
              <div className="state-panel">
                <strong>{meta.warning}</strong>
                <span>Choose an Excel file from the top bar, or place Resource_Data.xlsx in the data folder, then refresh.</span>
              </div>
            ) : (
              <Page records={filteredRecords} allRecords={records} meta={meta} navigate={navigate} initialFilters={routeState} />
            )}
          </section>
        </div>
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
.workspace { flex: 1; display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 0; transition: grid-template-columns 160ms ease; }
.workspace.nav-collapsed { grid-template-columns: 64px minmax(0, 1fr); }
.side-nav { background: #1f2d36; padding: 18px 12px; display: flex; flex-direction: column; gap: 8px; }
.side-nav button { color: #d7e4ec; background: transparent; border: 0; text-align: left; padding: 12px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 42px; overflow: hidden; }
.side-nav button b { display: none; flex: 0 0 26px; width: 26px; height: 26px; border-radius: 6px; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); font-size: 13px; }
.side-nav button.active, .side-nav button:hover { color: #ffffff; background: #315164; }
.side-nav .nav-toggle { justify-content: space-between; color: #ffffff; background: #263d4c; margin-bottom: 4px; }
.workspace.nav-collapsed .side-nav { padding: 18px 8px; }
.workspace.nav-collapsed .side-nav button { justify-content: center; padding: 10px 8px; }
.workspace.nav-collapsed .side-nav button b { display: flex; }
.workspace.nav-collapsed .side-nav button span { display: none; }
.workspace.nav-collapsed .side-nav .nav-toggle b { display: none; }
.content { min-width: 0; overflow: auto; }
.page { padding: 24px; }
.page-title-row { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
.page-title-row h1 { margin: 0 0 6px; font-size: 26px; }
.page-title-row p { margin: 0; color: #607080; }
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
.state-panel { margin: 48px auto; max-width: 720px; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #ffffff; border: 1px solid #dce3ea; border-radius: 8px; color: #536474; }
.state-panel.error { color: #a33a28; }
@media (max-width: 1100px) {
  .workspace { grid-template-columns: 1fr; }
  .topbar { align-items: stretch; flex-direction: column; }
  .topbar-controls { grid-template-columns: 1fr 1fr; width: 100%; }
  .side-nav { flex-direction: row; overflow-x: auto; }
  .kpi-grid, .kpi-grid.compact, .chart-grid, .split-page { grid-template-columns: 1fr; }
  .filters-panel { position: static; }
}
`;
