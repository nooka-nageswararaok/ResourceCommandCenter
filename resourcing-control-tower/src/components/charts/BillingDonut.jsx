import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { groupCount } from '../../services/dataDerivation.js';

const colors = ['#1f7a5f', '#c95032', '#d19a28', '#5b6f95', '#7a5c99'];

export default function BillingDonut({ records }) {
  const data = groupCount(records, 'billingStatus');

  return (
    <div className="chart-card">
      <h2>Billing Status</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="legend-row">
        {data.map((item, index) => (
          <span key={item.name}>
            <i style={{ background: colors[index % colors.length] }} /> {item.name}: {item.value}
          </span>
        ))}
      </div>
    </div>
  );
}
