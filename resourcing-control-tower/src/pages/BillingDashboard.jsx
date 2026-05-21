import { useMemo, useState } from 'react';
import KPIWidget from '../components/KPIWidget.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import { buildKpis } from '../services/dataDerivation.js';

const tabs = [
  ['All', 'all'],
  ['Billable', 'billing:Billable'],
  ['Contractual Shadow', 'billing:Contractual Shadow'],
  ['Non Billable', 'billing:Non Billable'],
  ['Y-Code', 'wbs:Y-Code'],
  ['C-Code', 'wbs:C-Code']
];

export default function BillingDashboard({ records, initialFilters = {} }) {
  const initialTab = initialFilters.wbsCodeCategory
    ? `wbs:${initialFilters.wbsCodeCategory}`
    : initialFilters.billingStatus
      ? `billing:${initialFilters.billingStatus}`
      : 'all';
  const [active, setActive] = useState(initialTab);
  const filtered = useMemo(() => {
    if (active === 'all') return records;
    const [scope, value] = active.split(':');
    return records.filter((record) => (scope === 'wbs' ? record.wbsCodeCategory === value : record.billingStatus === value));
  }, [records, active]);
  const kpis = buildKpis(filtered);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Billing Dashboard</h1>
          <p>Review billing posture across active assignments</p>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(([label, value]) => (
          <button key={label} className={active === value ? 'active' : ''} type="button" onClick={() => setActive(value)}>
            {label}
          </button>
        ))}
      </div>

      <section className="kpi-grid compact">
        <KPIWidget label="Total FTE" value={kpis.totalHeadcount} />
        <KPIWidget label="Billable" value={kpis.billableCount} tone="green" />
        <KPIWidget label="Contractual Shadow" value={kpis.contractualShadowCount} tone="blue" />
        <KPIWidget label="Non Billable" value={kpis.nonBillableCount} tone="red" />
        <KPIWidget label="Y-Code" value={kpis.yCodeCount} tone="amber" />
        <KPIWidget label="C-Code" value={kpis.cCodeCount} tone="blue" />
      </section>

      <ResourceTable rows={filtered} height={560} />
    </main>
  );
}
