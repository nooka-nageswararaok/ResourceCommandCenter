export default function SkillHeatMap({ records }) {
  const skillCounts = records.reduce((acc, record) => {
    record.skills.forEach((skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
    });
    return acc;
  }, {});

  const data = Object.entries(skillCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 24);
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="chart-card">
      <h2>Skill Heat Map - Employee Skill Name</h2>
      <div className="skill-heat-map">
        {data.length ? data.map((item) => {
          const intensity = item.value / max;
          return (
            <span
              key={item.name}
              className="skill-heat-cell"
              style={{
                backgroundColor: `rgba(49, 107, 131, ${0.18 + intensity * 0.72})`,
                color: intensity > 0.55 ? '#ffffff' : '#1f2d36'
              }}
              title={`${item.name}: ${item.value}`}
            >
              <b>{item.value}</b>
              {item.name}
            </span>
          );
        }) : <span className="empty-chart">No skill data available</span>}
      </div>
    </div>
  );
}
