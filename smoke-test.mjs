import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const scripts=[fs.readFileSync('app.js','utf8')];
if(!scripts.length) throw new Error('app.js fehlt.');

for(const [index,script] of scripts.entries()){
  try{ new Function(script); }
  catch(error){
    console.error('JavaScript-Syntaxfehler in Script #'+(index+1));
    throw error;
  }
}

const required=[
  'resetPasswordForEmail',
  'exportPendlyJSON',
  'exportPendlyCSV',
  'syncCommuteDaySnapshot',
  'historicalDayEconomics',
  'quickCalc'
];
for(const name of required){
  if(!html.includes(name)) throw new Error('Erwartete Funktion/Integration fehlt: '+name);
}

JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
new Function(fs.readFileSync('sw.js','utf8'));
console.log('Pendly smoke test OK:', scripts.length, 'App-Script geprüft.');
