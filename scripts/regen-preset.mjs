// Regenerates PRESET_PALETTE with DEFAULT_PARAMS, recording cost history.
// Mirrors buildConfig/generatePalette in src/lib/algorithm.ts exactly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDefaultConfig,
  createDefaultState,
  energy,
  jnd,
  prepareInitialState,
  range,
  runWithOrderOptimization,
} from 'category-colors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = createDefaultConfig();
config.logProgress = false;
config.colorCount = 8;
config.jnd = 20;
config.maxIterations = 20000;
config.colorSpace = { mode: 'okhsl', ranges: [[0, 360], [0.2, 0.8], [0.3, 0.9]] };
config.similarityTarget = [];
config.evalFunctions = [
  { function: energy, weight: 0.15 },
  { function: range, weight: 0.15 },
  { function: jnd, weight: 0.15 },
  { function: jnd, weight: 0.15, cvd: { type: 'protanomaly', severity: 0.5 } },
  { function: jnd, weight: 0.5, cvd: { type: 'deuteranomaly', severity: 0.5 } },
];
config.recordHistory = true;

const state = createDefaultState();
state.colors = []; // random initialization — the defaults carry no seeds

const init = prepareInitialState(state, config);
const final = runWithOrderOptimization(init, config);

const history = final.costHistory.map(([i, c]) => [i, Number(c.toFixed(4))]);
const lines = [];
for (let i = 0; i < history.length; i += 6) {
  lines.push(
    '  ' + history.slice(i, i + 6).map(([a, b]) => `[${a}, ${b}]`).join(', ') + ','
  );
}
const ts = `import type { CostSample } from './palette'

// Loss curve captured when PRESET_PALETTE was generated — see the
// regeneration note on PRESET_PALETTE in palette.ts.
export const PRESET_COST_HISTORY: CostSample[] = [
${lines.join('\n')}
]
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'preset-history.ts'), ts);

console.log(JSON.stringify({
  colors: final.colors.map(String),
  cost: Number(final.cost.toFixed(4)),
  iterations: final.iterations,
  historyPoints: history.length,
}, null, 2));
