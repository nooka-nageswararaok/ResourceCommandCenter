import KPIWidget from '../components/KPIWidget.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import { buildKpis } from '../services/dataDerivation.js';

export default function ExportReports({ records, meta }) {
  const kpis = buildKpis(records);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Export & Reports</h1>
          <p>{meta.fileName} / {meta.sheetName}</p>
        </div>
      </div>
      <section className="kpi-grid compact">
        <KPIWidget label="Headcount" value={kpis.totalHeadcount} />
        <KPIWidget label="Billable" value={kpis.billableCount} tone="green" />
        <KPIWidget label="Freshers" value={kpis.fresherCount} tone="green" />
        <KPIWidget label="Ending <=30 Days" value={kpis.endingThirtyDays} tone="blue" />
      </section>
      <ResourceTable rows={records} height={560} />
    </main>
  );
}
