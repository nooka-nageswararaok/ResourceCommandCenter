import { useMemo } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import KPIWidget from '../components/KPIWidget.jsx';
import { buildPmAccountability } from '../services/dataDerivation.js';

const columns = [
  { field: 'pmName', headerName: 'PM Name', flex: 1, minWidth: 220 },
  { field: 'headcount', headerName: 'FTE Count', type: 'number', minWidth: 110 },
  { field: 'utilizationPct', headerName: 'Utilization %', type: 'number', minWidth: 130 },
  { field: 'billableCount', headerName: 'Billable', type: 'number', minWidth: 110 },
  { field: 'nonBillableCount', headerName: 'Non Billable', type: 'number', minWidth: 130 },
  { field: 'yCodeCount', headerName: 'Y-Code', type: 'number', minWidth: 100 },
  { field: 'cCodeCount', headerName: 'C-Code', type: 'number', minWidth: 100 },
  { field: 'endingThirtyDays', headerName: 'Ending <=30', type: 'number', minWidth: 130 },
  { field: 'highPriorityActions', headerName: 'High Priority Actions', type: 'number', minWidth: 170 }
];

export default function PmAccountabilityView({ records }) {
  const rows = useMemo(() => buildPmAccountability(records), [records]);
  const totals = useMemo(() => ({
    pms: rows.length,
    highActions: rows.reduce((sum, row) => sum + row.highPriorityActions, 0),
    endingThirty: rows.reduce((sum, row) => sum + row.endingThirtyDays, 0)
  }), [rows]);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>PM Accountability View</h1>
          <p>PM-level ownership metrics for leadership follow-up</p>
        </div>
      </div>

      <section className="kpi-grid compact">
        <KPIWidget label="PMs" value={totals.pms} />
        <KPIWidget label="High Priority Actions" value={totals.highActions} tone="red" />
        <KPIWidget label="Ending <=30 Days" value={totals.endingThirty} tone="blue" />
      </section>

      <div className="data-grid-shell" style={{ height: 650 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
        />
      </div>
    </main>
  );
}
