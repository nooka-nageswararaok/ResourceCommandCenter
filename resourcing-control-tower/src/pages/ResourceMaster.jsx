import { useMemo, useState } from 'react';
import FiltersPanel from '../components/FiltersPanel.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import { applyResourceFilters } from '../services/dataDerivation.js';

const emptyFilters = {
  search: '',
  customer: [],
  project: [],
  pmName: [],
  billingStatus: [],
  wbsCodeCategory: [],
  band: [],
  location: [],
  capability: [],
  fresherOnly: false
};

export default function ResourceMaster({ records, initialFilters = {} }) {
  const [filters, setFilters] = useState({ ...emptyFilters, ...initialFilters });
  const filtered = useMemo(() => applyResourceFilters(records, filters), [records, filters]);

  return (
    <main className="page split-page">
      <FiltersPanel records={records} filters={filters} onChange={setFilters} onReset={() => setFilters(emptyFilters)} />
      <section className="table-section">
        <div className="page-title-row">
          <div>
            <h1>RAS Master</h1>
            <p>{filtered.length} resources match current filters</p>
          </div>
        </div>
        <ResourceTable rows={filtered} />
      </section>
    </main>
  );
}
