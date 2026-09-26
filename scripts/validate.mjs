import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('app.js');
new Function(app);

const html=read('index.html');
if(!/<link rel="manifest" href="\/pendly\/manifest\.webmanifest">/.test(html)) throw new Error('Manifest link fehlt');
if(!/<link rel="canonical" href="https:\/\/fkikood\.github\.io\/pendly\/">/.test(html)) throw new Error('Canonical fehlt');

const ld=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if(!ld) throw new Error('JSON-LD fehlt');
JSON.parse(ld[1]);

const manifest=JSON.parse(read('manifest.webmanifest'));
if(manifest.start_url!=='/pendly/'||manifest.scope!=='/pendly/') throw new Error('Manifest ist inkonsistent');

const robots=read('robots.txt');
if(!robots.includes('Sitemap: https://fkikood.github.io/pendly/sitemap.xml')) throw new Error('Sitemap-Verweis fehlt');

const sitemap=read('sitemap.xml');
if(!sitemap.includes('https://fkikood.github.io/pendly/')) throw new Error('Startseite fehlt in Sitemap');

for(const f of ['impressum.html','datenschutz.html','nutzungsbedingungen.html']) {
  if(!read(f).includes('<title>')) throw new Error(f+' ist unvollständig');
}

console.log('Pendly CI validation passed.');
