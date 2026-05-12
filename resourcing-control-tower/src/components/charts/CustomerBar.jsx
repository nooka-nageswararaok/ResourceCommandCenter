import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { groupCount } from '../../services/dataDerivation.js';

export default function CustomerBar({ records }) {
  const data = groupCount(records, 'customer').sort((a, b) => b.value - a.value).slice(0, 12);

  return (
    <div className="chart-card">
      <h2>Resources by Customer</h2>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 78, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#316b83" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
