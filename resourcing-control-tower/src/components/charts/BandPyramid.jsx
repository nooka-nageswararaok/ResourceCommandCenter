import { groupCount } from '../../services/dataDerivation.js';

export default function BandPyramid({ records }) {
  const data = groupCount(records, 'band')
    .filter((item) => item.name !== 'Unspecified')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="chart-card">
      <h2>Band Pyramid</h2>
      <div className="pyramid-chart">
        {data.length ? data.map((item) => {
          const width = Math.max(18, Math.round((item.value / max) * 100));
          return (
            <div className="pyramid-row" key={item.name}>
              <span className="pyramid-label">{item.name}</span>
              <div className="pyramid-track">
                <span className="pyramid-bar" style={{ width: `${width}%` }}>{item.value}</span>
              </div>
            </div>
          );
        }) : <span className="empty-chart">No band data available</span>}
      </div>
    </div>
  );
}
