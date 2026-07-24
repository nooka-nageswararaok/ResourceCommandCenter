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
          <div className="topbar-filter-grid">
            <input
              className="global-search"
              value={quickFilters.search}
              onChange={(event) => onQuickFilterChange('search', event.target.value)}
              placeholder="Employee Code / Name"
            />
            <Autocomplete
              multiple
              size="small"
              limitTags={1}
              options={getUniqueOptions(records, 'customer')}
              value={quickFilters.customer}
              onChange={(_, value) => onQuickFilterChange('customer', value)}
              renderInput={(params) => <TextField {...params} placeholder="Customer" />}
            />
            <Autocomplete
              multiple
              size="small"
              limitTags={1}
              options={getUniqueOptions(quickProjectRecords, 'projectName')}
              value={quickFilters.project}
              onChange={(_, value) => onQuickFilterChange('project', value)}
              renderInput={(params) => <TextField {...params} placeholder="Project" />}
            />
            <Autocomplete
              multiple
              size="small"
              limitTags={1}
              options={getUniqueOptions(records, 'projectL4')}
              value={quickFilters.projectL4}
              onChange={(_, value) => onQuickFilterChange('projectL4', value)}
              renderInput={(params) => <TextField {...params} placeholder="Project L4" />}
            />
            <Autocomplete
              multiple
              size="small"
              limitTags={1}
              options={getUniqueOptions(records, 'pmName')}
              value={quickFilters.pmName}
              onChange={(_, value) => onQuickFilterChange('pmName', value)}
              renderInput={(params) => <TextField {...params} placeholder="PM Name" />}
            />
            <Autocomplete
              multiple
              size="small"
              limitTags={1}
              options={getUniqueOptions(records, 'location')}
              value={quickFilters.location}
              onChange={(_, value) => onQuickFilterChange('location', value)}
              renderInput={(params) => <TextField {...params} placeholder="Location" />}
            />
            <Autocomplete
              multiple
              size="small"
              limitTags={1}
              options={getUniqueOptions(records, 'capability')}
              value={quickFilters.capability}
              onChange={(_, value) => onQuickFilterChange('capability', value)}
              renderInput={(params) => <TextField {...params} placeholder="HR L4" />}
            />
          </div>
          <div className="topbar-actions">
            <Button variant="outlined" startIcon={<FolderOpen />} onClick={onChooseExcelFile} disabled={loading}>
              Choose Excel
            </Button>
            <Button variant="contained" startIcon={<Refresh />} onClick={onRefresh} disabled={loading}>
              Refresh Excel
            </Button>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
