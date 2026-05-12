import { useMemo, useState } from 'react';
import ResourceTable from '../components/ResourceTable.jsx';

function inRange(record, range, customStart, customEnd) {
  if (range === 'custom') {
    const end = record.assignmentEnd;
    if (!end) return false;
    const startOk = customStart ? end >= new Date(customStart) : true;
    const endOk = customEnd ? end <= new Date(customEnd) : true;
    return startOk && endOk;
  }

  const days = Number(range);
  return typeof record.daysToEnd === 'number' && record.daysToEnd >= 0 && record.daysToEnd <= days;
}

export default function EndDateTracker({ records, initialFilters = {} }) {
  const [range, setRange] = useState(String(initialFilters.range || 30));
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filtered = useMemo(
    () => records.filter((record) => inRange(record, range, customStart, customEnd)).sort((a, b) => a.daysToEnd - b.daysToEnd),
    [records, range, customStart, customEnd]
  );

  const riskCounts = {
    red: filtered.filter((record) => record.daysToEnd <= 15).length,
    orange: filtered.filter((record) => record.daysToEnd > 15 && record.daysToEnd <= 30).length,
    yellow: filtered.filter((record) => record.daysToEnd > 30 && record.daysToEnd <= 60).length
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>End Date Tracker</h1>
          <p>{filtered.length} assignments in selected end-date window</p>
        </div>
      </div>

      <div className="toolbar">
        {[
          ['15', 'Ending <=15 days'],
          ['30', 'Ending <=30 days'],
          ['60', 'Ending <=60 days'],
          ['custom', 'Custom range']
        ].map(([value, label]) => (
          <button key={value} className={range === value ? 'active' : ''} type="button" onClick={() => setRange(value)}>
            {label}
          </button>
        ))}
        {range === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
          </>
        )}
      </div>

      <div className="risk-strip">
        <span className="risk-red">Red &lt;=15: <b>{riskCounts.red}</b></span>
        <span className="risk-orange">Orange 16-30: <b>{riskCounts.orange}</b></span>
        <span className="risk-yellow">Yellow 31-60: <b>{riskCounts.yellow}</b></span>
      </div>

      <ResourceTable rows={filtered} height={590} showPmoComments />
    </main>
  );
}
