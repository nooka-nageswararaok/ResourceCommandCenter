import { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Dialog, DialogContent, DialogTitle, Chip, Stack, Typography } from '@mui/material';
import { formatDate } from '../services/dataDerivation.js';

const baseColumns = [
  { field: 'empId', headerName: 'Emp ID', minWidth: 110 },
  { field: 'employeeName', headerName: 'Employee Name', flex: 1.2, minWidth: 180 },
  { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 150 },
  { field: 'projectName', headerName: 'Project', flex: 1.2, minWidth: 180 },
  { field: 'pmName', headerName: 'PM Name', minWidth: 150 },
  { field: 'billingStatus', headerName: 'Billing', minWidth: 140 },
  { field: 'wbsCodeCategory', headerName: 'WBS Type', minWidth: 110 },
  { field: 'fte', headerName: 'FTE', type: 'number', minWidth: 90 },
  { field: 'allocationPct', headerName: 'Allocation %', type: 'number', minWidth: 120 },
  { field: 'band', headerName: 'Band', minWidth: 100 },
  { field: 'location', headerName: 'Location', minWidth: 130 },
  {
    field: 'assignmentEnd',
    headerName: 'End Date',
    minWidth: 130,
    valueFormatter: (value) => formatDate(value)
  },
  { field: 'daysToEnd', headerName: 'Days To End', type: 'number', minWidth: 130 }
];

const pmoCommentsColumn = { field: 'pmoComments', headerName: 'PMO_COMMENTS', flex: 1.4, minWidth: 220 };

export default function ResourceTable({ rows, height = 620, showPmoComments = false }) {
  const [selected, setSelected] = useState(null);
  const tableRows = useMemo(() => rows.map((row) => ({ ...row, assignmentEnd: row.assignmentEnd || null })), [rows]);
  const columns = useMemo(
    () => showPmoComments
      ? [
          ...baseColumns.slice(0, 2),
          pmoCommentsColumn,
          ...baseColumns.slice(2)
        ]
      : baseColumns,
    [showPmoComments]
  );

  return (
    <>
      <div style={{ height, width: '100%' }} className="data-grid-shell">
        <DataGrid
          rows={tableRows}
          columns={columns}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          onRowClick={(params) => setSelected(params.row)}
          getRowClassName={(params) => (params.row.endRiskFlag ? 'risk-row' : '')}
        />
      </div>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>{selected?.employeeName}</DialogTitle>
        <DialogContent>
          {selected && (
            <div className="detail-grid">
              <Typography><b>Employee ID:</b> {selected.empId}</Typography>
              <Typography><b>Manager:</b> {selected.manager || 'Unspecified'}</Typography>
              <Typography><b>Capability:</b> {selected.capability || 'Unspecified'}</Typography>
              <Typography><b>Band:</b> {[selected.band, selected.subBand].filter(Boolean).join(' / ') || 'Unspecified'}</Typography>
              <Typography><b>Location:</b> {selected.location || 'Unspecified'}</Typography>
              <Typography><b>Customer:</b> {selected.customer}</Typography>
              <Typography><b>PM Name:</b> {selected.pmName || 'Unspecified'}</Typography>
              <Typography><b>Project:</b> {selected.projectName || 'Unassigned'}</Typography>
              <Typography><b>Project Code:</b> {selected.projectCode || 'Unspecified'}</Typography>
              <Typography><b>WBS Code:</b> {selected.wbsCode || 'Unspecified'}</Typography>
              <Typography><b>WBS Type:</b> {selected.wbsCodeCategory || 'Unspecified'}</Typography>
              <Typography><b>Billing:</b> {selected.billingStatus}</Typography>
              <Typography><b>FTE:</b> {selected.fte}</Typography>
              <Typography><b>Allocation:</b> {selected.allocationPct}%</Typography>
              <Typography><b>Start:</b> {formatDate(selected.assignmentStart) || 'Unspecified'}</Typography>
              <Typography><b>End:</b> {formatDate(selected.assignmentEnd) || 'Unspecified'}</Typography>
              {showPmoComments && <Typography className="detail-wide"><b>PMO_COMMENTS:</b> {selected.pmoComments || 'No comments'}</Typography>}
              <Stack direction="row" gap={1} flexWrap="wrap" className="skills-list">
                {selected.skills.length ? selected.skills.map((skill) => <Chip key={skill} label={skill} size="small" />) : <Chip label="No skills listed" size="small" />}
              </Stack>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
