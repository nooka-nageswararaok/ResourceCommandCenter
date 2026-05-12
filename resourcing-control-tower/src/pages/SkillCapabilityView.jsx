import { useMemo, useState } from 'react';
import ResourceTable from '../components/ResourceTable.jsx';
import SkillHeatMap from '../components/charts/SkillHeatMap.jsx';
import { getUniqueOptions, groupCount } from '../services/dataDerivation.js';

export default function SkillCapabilityView({ records }) {
  const [selectedHrL4, setSelectedHrL4] = useState('');
  const hrL4Options = useMemo(() => getUniqueOptions(records, 'capability'), [records]);
  const filtered = useMemo(
    () => (selectedHrL4 ? records.filter((record) => record.capability === selectedHrL4) : records),
    [records, selectedHrL4]
  );
  const capabilityRows = useMemo(() => groupCount(filtered, 'capability').sort((a, b) => b.value - a.value), [filtered]);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Skill & Capability View</h1>
          <p>{filtered.length} resources in current scope</p>
        </div>
        <label className="inline-filter">
          HR L4
          <select value={selectedHrL4} onChange={(event) => setSelectedHrL4(event.target.value)}>
            <option value="">All HR L4</option>
            {hrL4Options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <section className="chart-grid two-column">
        <div className="chart-card">
          <h2>Resources by Capability - HR L4</h2>
          <div className="rank-list">
            {capabilityRows.slice(0, 12).map((item) => <span key={item.name}>{item.name}: <b>{item.value}</b></span>)}
          </div>
        </div>
        <SkillHeatMap records={filtered} />
      </section>
      <ResourceTable rows={filtered} height={500} />
    </main>
  );
}
