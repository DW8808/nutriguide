const XLSX = require('../node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '食品營養成分資料庫2024UPDATE2.xlsx');
const buf = fs.readFileSync(file);
const wb = XLSX.read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '', range: 1 });

console.log('Total rows:', rows.length);
if (rows[0]) console.log('Columns:', Object.keys(rows[0]).slice(0, 20));

const n = v => { const f = parseFloat(String(v).replace(/[^\d.-]/g, '')); return isNaN(f) ? 0 : +f.toFixed(3); };
const s = v => String(v || '').trim();

const foods = rows.map((row, i) => ({
  id: s(row['整合編號']) || `F${i}`,
  cat: s(row['食品分類']),
  name: s(row['樣品名稱']),
  alias: s(row['俗名']),
  kcal: Math.round(n(row['熱量(kcal)'])),
  prot: n(row['粗蛋白(g)']),
  fat: n(row['粗脂肪(g)']),
  satFat: n(row['飽和脂肪(g)']),
  carb: n(row['總碳水化合物(g)']),
  fib: n(row['膳食纖維(g)']),
  sug: n(row['糖質總量(g)']),
  sod: n(row['鈉(mg)']),
  pot: n(row['鉀(mg)']),
  cal: n(row['鈣(mg)']),
  pho: n(row['磷(mg)']),
  iro: n(row['鐵(mg)']),
  zin: n(row['鋅(mg)']),
  vitA: n(row['維生素A總量(IU)']),
  vitC: n(row['維生素C(mg)']),
  vitE: n(row['維生素E總量(mg)']),
  vitB1: n(row['維生素B1(mg)']),
  vitB2: n(row['維生素B2(mg)']),
})).filter(f => f.name);

const cats = [...new Set(foods.map(f => f.cat))].filter(Boolean).sort();
console.log('Categories:', cats);
console.log('Food count:', foods.length);

const out = `// Auto-generated from 食品營養成分資料庫2024UPDATE2.xlsx\nexport default ${JSON.stringify(foods)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'foodData.js'), out);
console.log('Written to src/foodData.js');
