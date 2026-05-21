import { useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { RestartAlt, Save } from '@mui/icons-material';
import {
  colorOptions,
  defaultPpRuleConfig,
  loadPpRuleConfig,
  ppRuleSections,
  resetPpRuleConfig,
  savePpRuleConfig
} from '../../services/ppRuleConfig.js';

const ruleFields = {
  totalRevenue: [
    { key: 'compareToRfs', label: 'Compare current month to RFS value', type: 'checkbox' },
    { key: 'message', label: 'Action flag message', type: 'text' },
    { key: 'color', label: 'Action flag color', type: 'color' },
    { key: 'drilldown', label: 'Enable revenue drill-down', type: 'checkbox' }
  ],
  revisedDrc: [
    { key: 'compareToIndicativeDrc', label: 'Compare to last month ARC x current GFTE', type: 'checkbox' },
    { key: 'increaseMessage', label: 'Increase message', type: 'text' },
    { key: 'increaseColor', label: 'Increase color', type: 'color' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' },
    { key: 'decreaseColor', label: 'Decrease color', type: 'color' }
  ],
  revisedGm: [
    { key: 'increaseMessage', label: 'Increase message', type: 'text' },
    { key: 'increaseColor', label: 'Increase color', type: 'color' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' },
    { key: 'decreaseColor', label: 'Decrease color', type: 'color' }
  ],
  gmPct: [
    { key: 'redMax', label: 'Red if <=', type: 'number' },
    { key: 'amberMax', label: 'Amber if <=', type: 'number' },
    { key: 'greenMin', label: 'Green if >=', type: 'number' },
    { key: 'increaseMessage', label: 'Increase message', type: 'text' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' }
  ],
  totalProjectExpenses: [
    { key: 'deviationPct', label: 'Deviation threshold %', type: 'number' },
    { key: 'deviationMessage', label: 'Deviation action message', type: 'text' },
    { key: 'deviationColor', label: 'Deviation color', type: 'color' },
    { key: 'defaultMessage', label: 'Default drill-down message', type: 'text' },
    { key: 'drilldown', label: 'Enable expense drill-down', type: 'checkbox' }
  ],
  totalGfte: [
    { key: 'increaseMessage', label: 'Increase message', type: 'text' },
    { key: 'increaseColor', label: 'Increase color', type: 'color' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' },
    { key: 'decreaseColor', label: 'Decrease color', type: 'color' }
  ],
  totalAfte: [
    { key: 'increaseMessage', label: 'Increase message', type: 'text' },
    { key: 'increaseColor', label: 'Increase color', type: 'color' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' },
    { key: 'decreaseColor', label: 'Decrease color', type: 'color' }
  ],
  totalBfte: [
    { key: 'increaseMessage', label: 'Increase message', type: 'text' },
    { key: 'increaseColor', label: 'Increase color', type: 'color' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' },
    { key: 'decreaseColor', label: 'Decrease color', type: 'color' }
  ],
  realization: [
    { key: 'improvementPct', label: 'Improving if above avg by %', type: 'number' },
    { key: 'improveMessage', label: 'Improve message', type: 'text' },
    { key: 'improveColor', label: 'Improve color', type: 'color' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' },
    { key: 'decreaseColor', label: 'Decrease color', type: 'color' }
  ],
  totalArc: [
    { key: 'increaseMessage', label: 'Increase message', type: 'text' },
    { key: 'increaseColor', label: 'Increase color', type: 'color' },
    { key: 'decreaseMessage', label: 'Decrease message', type: 'text' },
    { key: 'decreaseColor', label: 'Decrease color', type: 'color' }
  ],
  gfteUtilPct: [
    { key: 'redBelow', label: 'Red if <', type: 'number' },
    { key: 'amberBelow', label: 'Amber if <', type: 'number' },
    { key: 'greenMin', label: 'Green if >=', type: 'number' }
  ],
  afteUtilPct: [
    { key: 'redBelow', label: 'Red if <', type: 'number' },
    { key: 'amberBelow', label: 'Amber if <', type: 'number' },
    { key: 'greenMin', label: 'Green if >=', type: 'number' }
  ],
  unbilled: [
    { key: 'thresholdPct', label: 'Threshold % of Total GFTE', type: 'number' },
    { key: 'message', label: 'Action flag message', type: 'text' },
    { key: 'color', label: 'Threshold color', type: 'color' }
  ]
};

export default function PPRuleConfig() {
  const [config, setConfig] = useState(() => loadPpRuleConfig());
  const [status, setStatus] = useState('');
  const sections = useMemo(() => ppRuleSections.map((key) => ({ key, rule: config[key] })), [config]);

  const updateGlobal = (key, value) => {
    setConfig((current) => ({ ...current, global: { ...current.global, [key]: value } }));
  };

  const updateRule = (sectionKey, fieldKey, value) => {
    setConfig((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [fieldKey]: value
      }
    }));
  };

  const saveConfig = () => {
    setConfig(savePpRuleConfig(config));
    setStatus('PP rule configuration saved.');
  };

  const resetConfig = () => {
    setConfig(resetPpRuleConfig());
    setStatus('PP rule configuration reset to defaults.');
  };

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>PP Rule Configuration</h1>
          <p>Control KPI action flags, thresholds, drill-down availability, and color markings for PP Report Analysis.</p>
        </div>
        <div className="page-actions">
          <Button variant="outlined" startIcon={<RestartAlt />} onClick={resetConfig}>
            Reset Defaults
          </Button>
          <Button variant="contained" startIcon={<Save />} onClick={saveConfig}>
            Save Rules
          </Button>
        </div>
      </div>

      {status && <div className="status-banner">{status}</div>}

      <section className="plain-section">
        <div className="pp-rule-global">
          <label>
            Negative number color
            <select value={config.global.negativeColor} onChange={(event) => updateGlobal('negativeColor', event.target.value)}>
              {colorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="pp-rule-grid">
        {sections.map(({ key, rule }) => (
          <article className="pp-rule-card" key={key}>
            <div className="pp-rule-card-header">
              <div>
                <h2>{rule.label}</h2>
                <p>{defaultPpRuleConfig[key].label} rule controls</p>
              </div>
              <label className="pp-rule-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(rule.enabled)}
                  onChange={(event) => updateRule(key, 'enabled', event.target.checked)}
                />
                Enabled
              </label>
            </div>

            <div className="pp-rule-fields">
              {(ruleFields[key] || []).map((field) => (
                <RuleField
                  field={field}
                  key={field.key}
                  value={rule[field.key]}
                  onChange={(value) => updateRule(key, field.key, value)}
                />
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function RuleField({ field, value, onChange }) {
  if (field.type === 'checkbox') {
    return (
      <label className="pp-rule-check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    );
  }

  if (field.type === 'color') {
    return (
      <label>
        {field.label}
        <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
          {colorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }

  return (
    <label>
      {field.label}
      <input
        type={field.type}
        value={value ?? ''}
        onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)}
      />
    </label>
  );
}
