import { readFileSync } from 'node:fs';
const index=readFileSync('index.html','utf8');
const app=readFileSync('app.js','utf8');
const css=readFileSync('styles.css','utf8');

const requiredIndex=[
  'app.js',
  'styles.css',
  'manifest.webmanifest',
  'datenschutz.html',
  'impressum.html',
  'quickCalc()',
  'requestPasswordReset()',
  'deleteAccount()'
];
const requiredApp=[
  'function saveCloud()',
  'function loadUserData()',
  'function syncCommuteDaySnapshot(',
  'function exportPendlyJSON()',
  'function exportPendlyCSV()',
  'function deleteAccount()',
  'function applyCommutePattern()',
  'function updateScenario()',
  'function updateBreakEven()',
  'function updateAnnualReport()'
];
for(const needle of requiredIndex) if(!index.includes(needle)) throw new Error('index.html fehlt: '+needle);
for(const needle of requiredApp) if(!app.includes(needle)) throw new Error('app.js fehlt: '+needle);
if(!css.includes('.card')) throw new Error('styles.css scheint nicht geladen zu sein.');
if((index.match(/<style[\s\S]*?<\/style>/g)||[]).length!==0) throw new Error('Inline-CSS gefunden.');
console.log('Pendly structure check: OK');
