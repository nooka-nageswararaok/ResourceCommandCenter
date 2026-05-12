import HomeDashboard from './pages/HomeDashboard.jsx';
import ResourceMaster from './pages/ResourceMaster.jsx';
import BillingDashboard from './pages/BillingDashboard.jsx';
import EndDateTracker from './pages/EndDateTracker.jsx';
import SkillCapabilityView from './pages/SkillCapabilityView.jsx';
import BenchCodeView from './pages/BenchCodeView.jsx';
import AlertsActions from './pages/AlertsActions.jsx';
import ExportReports from './pages/ExportReports.jsx';

export const routes = [
  { key: 'home', label: 'Home / Executive View', component: HomeDashboard },
  { key: 'resources', label: 'Resource Master Dashboard', component: ResourceMaster },
  { key: 'billing', label: 'Billing & Status Dashboard', component: BillingDashboard },
  { key: 'endDates', label: 'Assignment End-Date Tracker', component: EndDateTracker },
  { key: 'skills', label: 'Skill & Capability View', component: SkillCapabilityView },
  { key: 'bench', label: 'Bench / Y-Code / C-Code', component: BenchCodeView },
  { key: 'alerts', label: 'Alerts & Actions', component: AlertsActions },
  { key: 'exports', label: 'Export & Reports', component: ExportReports }
];
