import KPIWidget from '../components/KPIWidget.jsx';
import BillingDonut from '../components/charts/BillingDonut.jsx';
import CustomerBar from '../components/charts/CustomerBar.jsx';
import BandPyramid from '../components/charts/BandPyramid.jsx';
import { buildKpis, groupCount } from '../services/dataDerivation.js';

export default function HomeDashboard({ records, meta, navigate }) {
  const kpis = buildKpis(records);
  const locationData = groupCount(records, 'location');

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Executive Dashboard</h1>
          <p>Last Excel refresh: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
        </div>
        <span className="file-pill">{[meta.fileName, meta.sheetName].filter(Boolean).join(' / ') || 'No Excel loaded'}</span>
      </div>

      <section className="kpi-grid">
        <KPIWidget label="Total Headcount" value={kpis.totalHeadcount} onClick={() => navigate('resources')} />
        <KPIWidget label="Utilization %" value={`${kpis.utilizationPct}%`} tone="blue" onClick={() => navigate('resources')} />
        <KPIWidget label="Billable Count" value={kpis.billableCount} tone="green" onClick={() => navigate('billing', { billingStatus: 'Billable' })} />
        <KPIWidget label="Contractual Shadow" value={kpis.contractualShadowCount} tone="blue" onClick={() => navigate('billing', { billingStatus: 'Contractual Shadow' })} />
        <KPIWidget label="Non Billable Count" value={kpis.nonBillableCount} tone="red" onClick={() => navigate('billing', { billingStatus: 'Non Billable' })} />
        <KPIWidget label="Y-Code Count" value={kpis.yCodeCount} tone="amber" onClick={() => navigate('billing', { wbsCodeCategory: 'Y-Code' })} />
        <KPIWidget label="C-Code Count" value={kpis.cCodeCount} tone="blue" onClick={() => navigate('billing', { wbsCodeCategory: 'C-Code' })} />
        <KPIWidget label="Freshers" value={kpis.fresherCount} tone="green" onClick={() => navigate('resources', { fresherOnly: true })} />
        <KPIWidget label="Ending <=30 Days" value={kpis.endingThirtyDays} tone="blue" onClick={() => navigate('endDates', { range: 30 })} />
      </section>

      <section className="chart-grid">
        <BillingDonut records={records} />
        <CustomerBar records={records} />
        <BandPyramid records={records} />
      </section>

      <section className="plain-section">
        <h2>Offshore vs Onsite</h2>
        <div className="location-list">
          {locationData.length ? locationData.map((item) => (
            <span key={item.name}>{item.name}: <b>{item.value}</b></span>
          )) : <span>No location data available</span>}
        </div>
      </section>
    </main>
  );
}
