const {test}=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('./public/vendor/xlsx.full.min.js');
require('./public/parser.js');
const {grade,parseWorkbook}=globalThis.Bettermarks;
test('Bewertungsgrenzen und bearbeitete Übungen mit 0 Prozent',()=>{
 for(const [values,expected] of [[[100,100],'++'],[[100,75],'+'],[[100,null,75],'~'],[[100,null],'-'],[[null,null],'--'],[[0,0],'--'],[[0,null],'--'],[[0,100],'~']])assert.equal(grade(values),expected);
});
test('Anonymisierter Export: Namen, Themen, Reihenfolge und alle Schüler',()=>{
 const data=parseWorkbook(require('./tests/fixture.cjs'),XLSX);
 assert.equal(data.activities.length,2);assert.equal(data.students.length,4);
 assert.equal(data.activities[0].title,'Neues Thema');
 assert.equal(data.activities[1].title,'Älteres Thema');
 assert.equal(data.students[0].name,'Anna Beispiel');
 for(const [key,symbol] of [['A','++'],['B','--'],['C','~']])assert.equal(data.activities[0].results.get(key).symbol,symbol);
 assert.equal(data.activities[1].results.get('C').symbol,'--');
});
test('Nicht unterstützte Arbeitsmappen werden zurückgewiesen',()=>assert.throws(()=>parseWorkbook(XLSX.utils.book_new(),XLSX),/Keine Klassenaktivitäten/));
test('Noten: Grenzen 0, 50, 80, vollständige Bearbeitung und perfekte Ergebnisse',()=>{
 const result=(done,total,symbol='~')=>({done,total,symbol});
 for(const [r,n] of [[result(0,10,'--'),6],[result(4,10,'-'),5],[result(5,10,'-'),3],[result(8,10),3],[result(9,10),2],[result(10,10,'+'),2],[result(10,10,'++'),1]])assert.equal(globalThis.Bettermarks.schoolGrade(r),n);
});
test('Gesamtnote: Gewichtung und unbearbeitete Themen',()=>{
 const results=[{done:2,total:2,symbol:'++'},{done:0,total:4,symbol:'--'}];
 const {average}=globalThis.Bettermarks;
 assert.equal(average(results),3.5);
 assert.equal(average(results,{weighted:true}),26/6);
 assert.equal(average(results,{excludeEmpty:true}),1);
 assert.equal(average(results,{weighted:true,excludeEmpty:true}),1);
 assert.equal(average([results[1]],{excludeEmpty:true}),null);
 assert.equal(average([]),null);
});
test('Alle Schüler des Schülerblatts erscheinen auch ohne Aktivitätsspalte',()=>{
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
  ['Klassenaktivität'],['Aktivitäten'],[],['Thema'],['','','','aktiv'],['Übung','','Übungscode'],['Aufgabe','','ABC',100]
 ]),'Aktivitäten');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
  ['Schülerinnen und Schüler'],['','Kürzel','Vorname','Nachname'],['','aktiv','Anna','Aktiv'],['','ohne','Ben','Ohne'],['','leer','Clara','Leer']
 ]),'Schüler');
 const data=globalThis.Bettermarks.parseWorkbook(wb,XLSX);
 assert.deepEqual(data.students,[{key:'aktiv',name:'Anna Aktiv'},{key:'ohne',name:'Ben Ohne'},{key:'leer',name:'Clara Leer'}]);
 assert.equal(data.activities[0].results.has('ohne'),false);
});
function synthetic(rows){
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
  ['Klassenaktivität'],['Aktivitäten'],[],['Thema'],['','','','A'],['Übungen','','Übungscode'],...rows
 ]),'Aktivitäten');return wb;
}
test('Leerzeilen im Thema verlieren keine Übungen',()=>{
 const d=parseWorkbook(synthetic([['Erste','','ABC',100],[],['Zweite','','DEF','']]),XLSX);
 assert.equal(d.activities[0].count,2);assert.equal(d.activities[0].results.get('A').symbol,'-');
});
test('Doppelte Kürzel und nicht zuordenbare Ergebnisse werden zurückgewiesen',()=>{
 const wb=synthetic([['Erste','','ABC',100,0]]);wb.Sheets.Aktivitäten.E5={t:'s',v:'A'};
 assert.throws(()=>parseWorkbook(wb,XLSX),/Doppeltes Schülerkürzel/);
 assert.throws(()=>parseWorkbook(synthetic([['Erste','','ABC',100,0]]),XLSX),/ohne Schülerkürzel/);
});
test('0 Prozent einzeln bearbeitet, ausschließlich 0 Prozent nicht bearbeitet',()=>{
 const {makeResult,schoolGrade,average}=globalThis.Bettermarks;
 for(const values of [[0],[0,0],[0,null],[null,null]]){
  const r=makeResult(values);assert.equal(r.done,0);assert.equal(r.symbol,'--');assert.equal(schoolGrade(r),6);assert.equal(average([r],{excludeEmpty:true}),null);
 }
 const mixed=makeResult([0,100,null]);assert.equal(mixed.done,2);assert.equal(mixed.symbol,'~');assert.equal(schoolGrade(mixed),3);
});
test('Konfigurierbare Notenbasis und Note 4',()=>{
 const {makeResult,schoolGrade}=globalThis.Bettermarks;
 assert.equal(schoolGrade(makeResult([10,10])),2);
 assert.equal(schoolGrade(makeResult([10,10]),{basis:'success'}),5);
 assert.equal(schoolGrade(makeResult([30,30]),{basis:'success',four:25}),4);
});
test('Überdimensionierte Tabellenbereiche werden vor Umwandlung abgewiesen',()=>{
 const wb=synthetic([['Erste','','ABC',100]]);wb.Sheets.Aktivitäten['!ref']='A1:XFD1048576';
 assert.throws(()=>parseWorkbook(wb,XLSX),/zu viele Zeilen oder Zellen/);
});
test('CSV schützt Formeln in Namen und zitiert Semikolon und Anführungszeichen',()=>{
 const csv=globalThis.Bettermarks.csvEncode([['=SUM(A1)','  @x','A;B','"Name"','++']]);
 assert(csv.includes('"\'=SUM(A1)"'));assert(csv.includes('"\'  @x"'));assert(csv.includes('"A;B"'));assert(csv.includes('"""Name"""'));assert(csv.includes('"++"'));
});
test('Auswahl einzelner Positionen und inklusiver Bereiche',()=>{
 const {parseSelection}=globalThis.Bettermarks;
 assert.deepEqual(parseSelection('1-4',6),[0,1,2,3]);
 assert.deepEqual(parseSelection('1-5',6),[0,1,2,3,4]);
 assert.deepEqual(parseSelection('2-5',6),[1,2,3,4]);
 assert.deepEqual(parseSelection('1, 3-5, 4',6),[0,2,3,4]);
 assert.deepEqual(parseSelection('2–5',6),[1,2,3,4]);
 for(const value of ['', '0', '3-2', '1-7', '1.5', '-1', '1,', 'text'])assert.throws(()=>parseSelection(value,6));
});
test('Plus verlangt in jeder Übung ein positives Ergebnis',()=>{
 assert.equal(grade([100,0]),'~');assert.equal(grade([1,2]),'+');
 assert.equal(grade([0,0]),'--');assert.equal(grade([100,100]),'++');
});
test('Namenszuordnung aus Vorlage: Punkte und Großschreibung',()=>{
 const {parseNameMapping,resolveNames}=globalThis.Bettermarks;
 const fs=require('node:fs');const workbook=XLSX.read(fs.readFileSync(__dirname+'/public/namenszuordnung-vorlage.xlsx'));
 const mapping=parseNameMapping(workbook,XLSX);
 const original=[{key:'AnLu',name:'AnLu'},{key:'XX',name:'Vorher'}];
 const result=resolveNames(original,mapping);
 assert.equal(result.students[0].name,'Aneliese Lutaku');assert.equal(result.students[1].name,'Vorher');assert.equal(original[0].name,'AnLu');assert.equal(result.matched,1);
 assert.equal(resolveNames(original,new Map([['unbekannt','Name']])).unmatched,1);
 assert.throws(()=>resolveNames([{key:'an.lu',name:'a'},{key:'AnLu',name:'b'}],mapping),/nicht eindeutig/);
});
test('Ungültige Namensdatei und doppelte normalisierte Kürzel werden zurückgewiesen',()=>{
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Kürzel','Klarname'],['an.lu','Person A'],['AnLu','Person B']]),'Namen');
 assert.throws(()=>globalThis.Bettermarks.parseNameMapping(wb,XLSX),/doppeltes Kürzel/);
 assert.throws(()=>globalThis.Bettermarks.parseNameMapping(XLSX.utils.book_new(),XLSX),/Keine Zuordnungen/);
});
