import ResourceTable from '../components/ResourceTable.jsx';

export default function AlertsActions({ records }) {
  const alertRows = records
    .filter((record) => record.endRiskFlag || (record.billingStatus === 'Non Billable' && record.agingDays > 30))
    .sort((a, b) => (a.daysToEnd ?? 9999) - (b.daysToEnd ?? 9999));

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Alerts & Actions</h1>
          <p>{alertRows.length} resources need attention</p>
        </div>
      </div>
      <ResourceTable rows={alertRows} height={650} />
    </main>
  );
}
