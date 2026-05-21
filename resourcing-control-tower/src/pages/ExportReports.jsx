import { useState } from 'react';
import { Button } from '@mui/material';
import KPIWidget from '../components/KPIWidget.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import { exportWeeklySnapshot } from '../services/excelService.js';
import { buildKpis, buildLeadershipActions, buildPmAccountability, formatDate } from '../services/dataDerivation.js';

export default function ExportReports({ records, meta }) {
  const kpis = buildKpis(records);
  const [exportStatus, setExportStatus] = useState('');

  const createSnapshotPayload = () => ({
    sheets: {
      Executive_KPIs: [
        { Metric: 'Source File', Value: meta.fileName || '' },
        { Metric: 'Sheet', Value: meta.sheetName || '' },
        { Metric: 'Refresh Timestamp', Value: meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : '' },
        { Metric: 'Total FTE', Value: kpis.totalHeadcount },
        { Metric: 'Utilization %', Value: kpis.utilizationPct },
        { Metric: 'Billable', Value: kpis.billableCount },
        { Metric: 'Contractual Shadow', Value: kpis.contractualShadowCount },
        { Metric: 'Non Billable', Value: kpis.nonBillableCount },
        { Metric: 'Y-Code', Value: kpis.yCodeCount },
        { Metric: 'C-Code', Value: kpis.cCodeCount },
        { Metric: 'Freshers', Value: kpis.fresherCount },
        { Metric: 'Ending <=30 Days', Value: kpis.endingThirtyDays }
      ],
      Leadership_Actions: buildLeadershipActions(records).map((action) => ({
        Priority: action.priority,
        Action_Type: action.actionType,
        Recommended_Action: action.recommendedAction,
        Employee_Code: action.empId,
        Employee_Name: action.employeeName,
        PM_Name: action.pmName,
        Customer: action.customer,
        Project: action.projectName,
        Days_To_End: action.daysToEnd,
        Billing_Status: action.billingStatus,
        WBS_Type: action.wbsCodeCategory,
        PMO_COMMENTS: action.pmoComments
      })),
      PM_Accountability: buildPmAccountability(records).map((row) => ({
        PM_Name: row.pmName,
        FTE_Count: row.headcount,
        Utilization_Pct: row.utilizationPct,
        Billable: row.billableCount,
        Non_Billable: row.nonBillableCount,
        Y_Code: row.yCodeCount,
        C_Code: row.cCodeCount,
        Ending_30_Days: row.endingThirtyDays,
        High_Priority_Actions: row.highPriorityActions
      })),
      Resource_Detail: records.map((record) => ({
        Employee_Code: record.empId,
        Employee_Name: record.employeeName,
        PM_Name: record.pmName,
        Customer: record.customer,
        Project: record.projectName,
        Billing_Status: record.billingStatus,
        WBS_Type: record.wbsCodeCategory,
        FTE: record.fte,
        Allocation_Pct: record.allocationPct,
        Band: record.band,
        HR_L4: record.capability,
        Location: record.location,
        Assignment_Start: formatDate(record.assignmentStart),
        Assignment_End: formatDate(record.assignmentEnd),
        Days_To_End: record.daysToEnd,
        Freshers: record.fresherFlag ? 'Yes' : 'No',
        PMO_COMMENTS: record.pmoComments
      }))
    }
  });

  const handleWeeklySnapshot = async () => {
    setExportStatus('Preparing snapshot...');
    try {
      const result = await exportWeeklySnapshot(createSnapshotPayload());
      setExportStatus(result.canceled ? 'Export cancelled.' : `Snapshot saved: ${result.filePath}`);
    } catch (err) {
      setExportStatus(err.message || 'Unable to export weekly snapshot.');
    }
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Export & Reports</h1>
          <p>{meta.fileName} / {meta.sheetName}</p>
        </div>
        <Button variant="contained" onClick={handleWeeklySnapshot}>
          Weekly Snapshot Export
        </Button>
      </div>
      {exportStatus && <div className="status-banner">{exportStatus}</div>}
      <section className="kpi-grid compact">
        <KPIWidget label="Total FTE" value={kpis.totalHeadcount} />
        <KPIWidget label="Billable" value={kpis.billableCount} tone="green" />
        <KPIWidget label="Freshers" value={kpis.fresherCount} tone="green" />
        <KPIWidget label="Ending <=30 Days" value={kpis.endingThirtyDays} tone="blue" />
      </section>
      <ResourceTable rows={records} height={560} />
    </main>
  );
}
