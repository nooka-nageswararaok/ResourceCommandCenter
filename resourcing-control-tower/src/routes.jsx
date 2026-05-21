import HomeDashboard from './pages/resourcing/HomeDashboard.jsx';
import LeadershipActionQueue from './pages/resourcing/LeadershipActionQueue.jsx';
import PMAccountability from './pages/resourcing/PMAccountability.jsx';
import ResourceMaster from './pages/resourcing/ResourceMaster.jsx';
import BillingDashboard from './pages/resourcing/BillingDashboard.jsx';
import EndDateTracker from './pages/resourcing/EndDateTracker.jsx';
import SkillCapability from './pages/resourcing/SkillCapability.jsx';
import BenchDashboard from './pages/resourcing/BenchDashboard.jsx';
import Alerts from './pages/resourcing/Alerts.jsx';
import ExportReports from './pages/resourcing/ExportReports.jsx';
import PPOverview from './pages/pp-report/PPOverview.jsx';
import PPRuleConfig from './pages/pp-report/PPRuleConfig.jsx';
import RFSOverview from './pages/rfs/RFSOverview.jsx';
import ActiveDemandsDashboard from './pages/fulfilment/ActiveDemandsDashboard.jsx';
import CandidateDetailsDashboard from './pages/fulfilment/CandidateDetailsDashboard.jsx';
import StageDelayDashboard from './pages/fulfilment/StageDelayDashboard.jsx';
import FulfilmentLeadershipReview from './pages/fulfilment/FulfilmentLeadershipReview.jsx';
import FulfilmentBaseDashboard from './pages/fulfilment/FulfilmentBaseDashboard.jsx';

export const resourcingRoutes = [
  { key: 'resourcing/home', legacyKey: 'home', path: '/resourcing/home', module: 'resourcing', label: 'Home / Executive View', component: HomeDashboard },
  { key: 'resourcing/leadership-actions', legacyKey: 'actions', path: '/resourcing/leadership-actions', module: 'resourcing', label: 'Leadership Action Queue', component: LeadershipActionQueue },
  { key: 'resourcing/pm-accountability', legacyKey: 'pmAccountability', path: '/resourcing/pm-accountability', module: 'resourcing', label: 'PM Accountability View', component: PMAccountability },
  { key: 'resourcing/resource-master', legacyKey: 'resources', path: '/resourcing/resource-master', module: 'resourcing', label: 'RAS Master', component: ResourceMaster },
  { key: 'resourcing/billing-status', legacyKey: 'billing', path: '/resourcing/billing-status', module: 'resourcing', label: 'Billing & Status Dashboard', component: BillingDashboard },
  { key: 'resourcing/end-date-tracker', legacyKey: 'endDates', path: '/resourcing/end-date-tracker', module: 'resourcing', label: 'Assignment End-Date Tracker', component: EndDateTracker },
  { key: 'resourcing/skill-capability', legacyKey: 'skills', path: '/resourcing/skill-capability', module: 'resourcing', label: 'Skill & Capability View', component: SkillCapability },
  { key: 'resourcing/bench', legacyKey: 'bench', path: '/resourcing/bench', module: 'resourcing', label: 'Bench / Y-Code / C-Code', component: BenchDashboard },
  { key: 'resourcing/alerts', legacyKey: 'alerts', path: '/resourcing/alerts', module: 'resourcing', label: 'Alerts & Actions', component: Alerts },
  { key: 'resourcing/export', legacyKey: 'exports', path: '/resourcing/export', module: 'resourcing', label: 'Export & Reports', component: ExportReports }
];

export const moduleRoutes = [
  { key: 'resourcing', label: 'RAS', basePath: '/resourcing', children: resourcingRoutes },
  {
    key: 'pp-report',
    label: 'PP Report Analysis',
    basePath: '/pp-report',
    children: [
      { key: 'pp-report/overview', path: '/pp-report/overview', module: 'pp-report', label: 'Overview', component: PPOverview },
      { key: 'pp-report/rule-config', path: '/pp-report/rule-config', module: 'pp-report', label: 'Rule Configuration', component: PPRuleConfig }
    ]
  },
  {
    key: 'rfs-tracker',
    label: 'RFS Tracker',
    basePath: '/rfs-tracker',
    children: [{ key: 'rfs-tracker/overview', path: '/rfs-tracker/overview', module: 'rfs-tracker', label: 'Overview', component: RFSOverview }]
  },
  {
    key: 'resource-fulfilment',
    label: 'Resource Fulfilment',
    basePath: '/resource-fulfilment',
    children: [
      {
        key: 'resource-fulfilment/active-demands',
        path: '/resource-fulfilment/active-demands',
        module: 'resource-fulfilment',
        label: 'Active Demands Dashboard',
        component: ActiveDemandsDashboard
      },
      {
        key: 'resource-fulfilment/candidate-details',
        path: '/resource-fulfilment/candidate-details',
        module: 'resource-fulfilment',
        label: 'Candidate Details Dashboard',
        component: CandidateDetailsDashboard
      },
      {
        key: 'resource-fulfilment/stage-delay',
        path: '/resource-fulfilment/stage-delay',
        module: 'resource-fulfilment',
        label: 'Stage Delay Dashboard',
        component: StageDelayDashboard
      },
      {
        key: 'resource-fulfilment/base-dashboard',
        path: '/resource-fulfilment/base-dashboard',
        module: 'resource-fulfilment',
        label: 'Fulfilment Base Dashboard',
        component: FulfilmentBaseDashboard
      },
      {
        key: 'resource-fulfilment/leadership-review',
        path: '/resource-fulfilment/leadership-review',
        module: 'resource-fulfilment',
        label: 'Fulfilment Leadership Review',
        component: FulfilmentLeadershipReview
      }
    ]
  }
];

export const routes = moduleRoutes.flatMap((module) => module.children);
export const defaultRouteKey = 'resourcing/home';

export function resolveRouteKey(routeKey) {
  return routes.find((route) => route.key === routeKey || route.legacyKey === routeKey)?.key || defaultRouteKey;
}

export function getRouteByKey(routeKey) {
  const resolvedKey = resolveRouteKey(routeKey);
  return routes.find((route) => route.key === resolvedKey) || routes[0];
}
