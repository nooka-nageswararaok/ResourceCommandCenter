import { useMemo, useState } from 'react';
import KPIWidget from '../components/KPIWidget.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import { buildKpis } from '../services/dataDerivation.js';

const tabs = [
  ['All', 'all'],
  ['Bench', 'bench'],
  ['Y-Code', 'Y-Code'],
  ['C-Code', 'C-Code'],
  ['Non Billable', 'Non Billable']
];

export default function BenchCodeView({ records }) {
  const [active, setActive] = useState('all');
  const filtered = useMemo(() => {
    if (active === 'all') return records;
    if (active === 'bench') return records.filter((record) => record.benchFlag);
    if (active === 'Non Billable') return records.filter((record) => record.billingStatus === 'Non Billable');
    return records.filter((record) => record.wbsCodeCategory === active);
  }, [records, active]);
  const kpis = buildKpis(filtered);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Bench / Y-Code / C-Code</h1>
          <p>{filtered.length} resources in selected bucket</p>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([label, value]) => (
          <button key={value} className={active === value ? 'active' : ''} type="button" onClick={() => setActive(value)}>
            {label}
          </button>
        ))}
      </div>
      <section className="kpi-grid compact">
        <KPIWidget label="Bench FTE" value={filtered.reduce((sum, record) => sum + (record.benchFlag ? Number(record.fte || 0) : 0), 0)} tone="red" />
        <KPIWidget label="Y-Code" value={kpis.yCodeCount} tone="amber" />
        <KPIWidget label="C-Code" value={kpis.cCodeCount} tone="blue" />
        <KPIWidget label="Non Billable" value={kpis.nonBillableCount} tone="red" />
      </section>
      <ResourceTable rows={filtered} height={560} />
    </main>
  );
}
