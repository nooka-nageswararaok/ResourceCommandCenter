import { getUniqueOptions } from '../services/dataDerivation.js';
import { Autocomplete, TextField } from '@mui/material';

const filterFields = [
  ['customer', 'Customer'],
  ['project', 'Project'],
  ['projectL4', 'Project L4'],
  ['billingStatus', 'Billing Status'],
  ['wbsCodeCategory', 'WBS Code Type'],
  ['band', 'Band'],
  ['location', 'Location'],
  ['capability', 'HR L4']
];

const fieldLookup = {
  project: 'projectName'
};

export default function FiltersPanel({ records, filters, onChange, onReset }) {
  const update = (field, value) => {
    const nextFilters = { ...filters, [field]: value };
    if (field === 'customer') {
      nextFilters.project = [];
    }
    onChange(nextFilters);
  };

  const optionRecords = (field) => {
    if (field === 'project' && normalizeMultiValue(filters.customer).length) {
      return records.filter((record) => normalizeMultiValue(filters.customer).includes(record.customer));
    }
    return records;
  };

  return (
    <aside className="filters-panel">
      <div className="panel-heading">
        <h2>Filters</h2>
        <button type="button" className="text-button" onClick={onReset}>
          Reset
        </button>
      </div>

      <label>
        Search
        <input
          value={filters.search}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Name or employee ID"
        />
      </label>

      {filterFields.map(([field, label]) => (
        <label key={field}>
          {label}
          <Autocomplete
            multiple
            size="small"
            limitTags={1}
            options={getUniqueOptions(optionRecords(field), fieldLookup[field] || field)}
            value={normalizeMultiValue(filters[field])}
            onChange={(_, value) => update(field, value)}
            renderInput={(params) => <TextField {...params} placeholder={`All ${label}`} />}
          />
        </label>
      ))}

      <label>
        PM Name
        <Autocomplete
          multiple
          size="small"
          options={getUniqueOptions(records, 'pmName')}
          value={Array.isArray(filters.pmName) ? filters.pmName : filters.pmName ? [filters.pmName] : []}
          onChange={(_, value) => update('pmName', value)}
          renderInput={(params) => <TextField {...params} placeholder="All PMs" />}
        />
      </label>
    </aside>
  );
}

function normalizeMultiValue(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
