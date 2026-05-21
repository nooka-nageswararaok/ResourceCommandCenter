import KPIWidget from '../../components/KPIWidget.jsx';

export default function ExpenseOverview() {
  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Project Expense Dashboard</h1>
          <p>Project expense analytics will be enabled using Excel uploads</p>
        </div>
      </div>
      <section className="kpi-grid compact">
        <KPIWidget label="Budget" value="--" tone="blue" />
        <KPIWidget label="Actual" value="--" tone="amber" />
        <KPIWidget label="Variance" value="--" tone="red" />
      </section>
    </main>
  );
}
