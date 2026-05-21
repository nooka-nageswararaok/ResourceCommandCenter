import { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import KPIWidget from '../components/KPIWidget.jsx';
import { buildLeadershipActions } from '../services/dataDerivation.js';

export default function LeadershipActionQueue({ records, onUpdatePmoComment }) {
  const [priority, setPriority] = useState('');
  const actions = useMemo(() => buildLeadershipActions(records), [records]);
  const filtered = useMemo(
    () => (priority ? actions.filter((action) => action.priority === priority) : actions),
    [actions, priority]
  );

  const columns = useMemo(() => [
    { field: 'priority', headerName: 'Priority', minWidth: 110 },
    { field: 'actionType', headerName: 'Action Type', minWidth: 170 },
    { field: 'recommendedAction', headerName: 'Recommended Action', flex: 1.4, minWidth: 260 },
    { field: 'employeeName', headerName: 'Employee Name', minWidth: 180 },
    { field: 'pmName', headerName: 'Owner / PM', minWidth: 170 },
    { field: 'customer', headerName: 'Customer', minWidth: 150 },
    { field: 'projectName', headerName: 'Project', minWidth: 180 },
    { field: 'daysToEnd', headerName: 'Days To End', type: 'number', minWidth: 120 },
    { field: 'billingStatus', headerName: 'Billing', minWidth: 140 },
    { field: 'wbsCodeCategory', headerName: 'WBS Type', minWidth: 110 },
    {
      field: 'pmoComments',
      headerName: 'PM Comments',
      editable: true,
      flex: 1.2,
      minWidth: 240
    }
  ], []);

  const processRowUpdate = (updatedRow) => {
    onUpdatePmoComment?.(updatedRow.recordId, updatedRow.pmoComments || '');
    return updatedRow;
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Leadership Action Queue</h1>
          <p>{filtered.length} prioritized actions from current filters</p>
        </div>
        <label className="inline-filter">
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>
      </div>

      <section className="kpi-grid compact">
        <KPIWidget label="High Priority" value={actions.filter((action) => action.priority === 'High').length} tone="red" />
        <KPIWidget label="End-Date Actions" value={actions.filter((action) => action.actionType.includes('End Date')).length} tone="blue" />
        <KPIWidget label="Non Billable Actions" value={actions.filter((action) => action.actionType.includes('Non Billable')).length} tone="amber" />
        <KPIWidget label="Y/C Code Actions" value={actions.filter((action) => action.actionType.includes('Code')).length} tone="blue" />
      </section>

      <div className="data-grid-shell" style={{ height: 650 }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          getRowClassName={(params) => `priority-${String(params.row.priority).toLowerCase()}`}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={(error) => console.error(error)}
          disableRowSelectionOnClick
        />
      </div>
    </main>
  );
}
