export default function KPIWidget({ label, value, tone = 'neutral', onClick }) {
  return (
    <button className={`kpi-widget kpi-${tone}`} onClick={onClick} type="button">
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}
