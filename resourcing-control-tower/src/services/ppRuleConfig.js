const PP_RULE_CONFIG_KEY = 'rct.ppRuleConfig.v1';
export const PP_RULE_CONFIG_EVENT = 'pp-rule-config-updated';

export const colorOptions = [
  { value: '', label: 'None' },
  { value: 'red', label: 'Red' },
  { value: 'amber', label: 'Amber' },
  { value: 'green', label: 'Green' }
];

export const defaultPpRuleConfig = {
  global: {
    negativeColor: 'red'
  },
  totalRevenue: {
    label: 'Total Revenue',
    enabled: true,
    compareToRfs: true,
    message: 'Missing Revenue or UBR or RT based on RFS',
    color: 'amber',
    drilldown: true
  },
  revisedDrc: {
    label: 'Revised DRC',
    enabled: true,
    compareToIndicativeDrc: true,
    increaseMessage: 'Cost is increased (added high cost resources?)',
    decreaseMessage: 'Cost is decreased (high cost resources released?)',
    increaseColor: 'amber',
    decreaseColor: 'green'
  },
  revisedGm: {
    label: 'Revised GM',
    enabled: true,
    increaseMessage: 'Improved GM',
    decreaseMessage: 'Decreased GM',
    increaseColor: 'green',
    decreaseColor: 'red'
  },
  gmPct: {
    label: 'GM%',
    enabled: true,
    redMax: 25,
    amberMax: 35,
    greenMin: 36,
    increaseMessage: 'Improved GM',
    decreaseMessage: 'Decreased GM'
  },
  totalProjectExpenses: {
    label: 'Total Project Exp',
    enabled: true,
    deviationPct: 10,
    deviationMessage: 'Expense deviation above 10% - double-click for details',
    defaultMessage: 'Double-click for expense details',
    deviationColor: 'amber',
    drilldown: true
  },
  totalGfte: {
    label: 'Total GFTE',
    enabled: true,
    increaseMessage: 'Resource Ramp Up?',
    decreaseMessage: 'Resource Ramp down?',
    increaseColor: 'amber',
    decreaseColor: 'amber'
  },
  totalAfte: {
    label: 'Total AFTE',
    enabled: true,
    increaseMessage: 'Resource Ramp Up?',
    decreaseMessage: 'Resource Ramp down?',
    increaseColor: 'amber',
    decreaseColor: 'amber'
  },
  totalBfte: {
    label: 'Total BFTE',
    enabled: true,
    increaseMessage: 'Resource Ramp Up?',
    decreaseMessage: 'Resource Ramp down?',
    increaseColor: 'amber',
    decreaseColor: 'amber'
  },
  realization: {
    label: 'Realization',
    enabled: true,
    improvementPct: 10,
    improveMessage: 'Improving',
    decreaseMessage: 'Decreased - Missed revenue or unbilled resources',
    improveColor: 'green',
    decreaseColor: 'red'
  },
  totalArc: {
    label: 'Total ARC',
    enabled: true,
    increaseMessage: 'Cost is increased (added high cost resources?)',
    decreaseMessage: 'Cost is decreased (high cost resources released?)',
    increaseColor: 'amber',
    decreaseColor: 'green'
  },
  gfteUtilPct: {
    label: 'GFTE Utili %',
    enabled: true,
    redBelow: 80,
    amberBelow: 90,
    greenMin: 90
  },
  afteUtilPct: {
    label: 'AFTE Utili %',
    enabled: true,
    redBelow: 80,
    amberBelow: 90,
    greenMin: 90
  },
  unbilled: {
    label: 'Unbilled',
    enabled: true,
    thresholdPct: 10,
    message: 'Unbilled is >= 10% of Total GFTE',
    color: 'red'
  }
};

export const ppRuleSections = [
  'totalRevenue',
  'revisedDrc',
  'revisedGm',
  'gmPct',
  'totalProjectExpenses',
  'totalGfte',
  'totalAfte',
  'totalBfte',
  'realization',
  'totalArc',
  'gfteUtilPct',
  'afteUtilPct',
  'unbilled'
];

export const ppKpiRuleKeyByLabel = {
  'Total Revenue': 'totalRevenue',
  'Revised DRC': 'revisedDrc',
  'Revised GM': 'revisedGm',
  'GM%': 'gmPct',
  'Total Project Exp': 'totalProjectExpenses',
  'Total GFTE': 'totalGfte',
  'Total AFTE': 'totalAfte',
  'Total BFTE': 'totalBfte',
  Realization: 'realization',
  'Total ARC': 'totalArc',
  'GFTE Utili %': 'gfteUtilPct',
  'AFTE Utili %': 'afteUtilPct',
  Unbilled: 'unbilled'
};

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaults(defaults, saved) {
  return Object.entries(defaults).reduce((merged, [key, value]) => {
    if (isObject(value)) {
      merged[key] = mergeDefaults(value, isObject(saved?.[key]) ? saved[key] : {});
    } else {
      merged[key] = saved?.[key] ?? value;
    }
    return merged;
  }, {});
}

export function loadPpRuleConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(PP_RULE_CONFIG_KEY) || '{}');
    return mergeDefaults(defaultPpRuleConfig, saved);
  } catch {
    return defaultPpRuleConfig;
  }
}

export function savePpRuleConfig(config) {
  const merged = mergeDefaults(defaultPpRuleConfig, config);
  localStorage.setItem(PP_RULE_CONFIG_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(PP_RULE_CONFIG_EVENT, { detail: merged }));
  return merged;
}

export function resetPpRuleConfig() {
  localStorage.removeItem(PP_RULE_CONFIG_KEY);
  window.dispatchEvent(new CustomEvent(PP_RULE_CONFIG_EVENT, { detail: defaultPpRuleConfig }));
  return defaultPpRuleConfig;
}

export function getPpRuleForKpi(config, kpiLabel) {
  const ruleKey = ppKpiRuleKeyByLabel[kpiLabel];
  return ruleKey ? config[ruleKey] : null;
}

export function getPpRuleKeyForKpi(kpiLabel) {
  return ppKpiRuleKeyByLabel[kpiLabel] || '';
}

export function getPpColorClass(color) {
  if (color === 'red') return 'pp-rule-red';
  if (color === 'amber') return 'pp-rule-amber';
  if (color === 'green') return 'pp-rule-green';
  return '';
}
