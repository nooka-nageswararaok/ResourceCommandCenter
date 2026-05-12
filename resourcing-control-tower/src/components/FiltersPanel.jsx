import { getUniqueOptions } from '../services/dataDerivation.js';
import { Autocomplete, TextField } from '@mui/material';

const filterFields = [
  ['customer', 'Customer'],
  ['project', 'Project'],
  ['billingStatus', 'Billing Status'],
  ['wbsCodeCategory', 'WBS Code Type'],
  ['band', 'Band'],
  ['location', 'Location']
];

const fieldLookup = {
  project: 'projectName'
};

export default function FiltersPanel({ records, filters, onChange, onReset }) {
  const update = (field, value) => {
    const nextFilters = { ...filters, [field]: value };
    if (field === 'customer') {
      nextFilters.project = '';
    }
    onChange(nextFilters);
  };

  const optionRecords = (field) => {
    if (field === 'project' && filters.customer) {
      return records.filter((record) => record.customer === filters.customer);
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
          <select value={filters[field]} onChange={(event) => update(field, event.target.value)}>
            <option value="">All</option>
            {getUniqueOptions(optionRecords(field), fieldLookup[field] || field).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
