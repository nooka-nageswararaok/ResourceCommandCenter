import { Autocomplete, Button, TextField } from '@mui/material';
import { FolderOpen, Refresh } from '@mui/icons-material';
import { getUniqueOptions } from '../services/dataDerivation.js';

export default function ResourcingLayout({
  meta,
  records,
  quickFilters,
  quickProjectRecords,
  loading,
  onQuickFilterChange,
  onChooseExcelFile,
  onRefresh,
  children
}) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Resource Assignation System (RAS)</h1>
          <p>Latest Excel loaded: {meta.refreshedAt ? new Date(meta.refreshedAt).toLocaleString() : 'Not loaded'}</p>
          <span title={meta.filePath || ''}>{meta.fileName || 'Waiting for Excel input file'}</span>
        </div>
        <div className="topbar-controls">
          <input
            className="global-search"
            value={quickFilters.search}
            onChange={(event) => onQuickFilterChange('search', event.target.value)}
            placeholder="Employee Code / Name"
          />
          <select value={quickFilters.customer} onChange={(event) => onQuickFilterChange('customer', event.target.value)}>
            <option value="">Customer</option>
            {getUniqueOptions(records, 'customer').map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={quickFilters.project} onChange={(event) => onQuickFilterChange('project', event.target.value)}>
            <option value="">Project</option>
            {getUniqueOptions(quickProjectRecords, 'projectName').map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <Autocomplete
            multiple
            size="small"
            limitTags={1}
            options={getUniqueOptions(records, 'pmName')}
            value={quickFilters.pmName}
            onChange={(_, value) => onQuickFilterChange('pmName', value)}
            renderInput={(params) => <TextField {...params} placeholder="PM Name" />}
          />
          <select value={quickFilters.location} onChange={(event) => onQuickFilterChange('location', event.target.value)}>
            <option value="">Location</option>
            {getUniqueOptions(records, 'location').map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <Button variant="outlined" startIcon={<FolderOpen />} onClick={onChooseExcelFile} disabled={loading}>
            Choose Excel
          </Button>
          <Button variant="contained" startIcon={<Refresh />} onClick={onRefresh} disabled={loading}>
            Refresh Excel
          </Button>
        </div>
      </header>
      {children}
    </>
  );
}
