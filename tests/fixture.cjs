const XLSX=require('../public/vendor/xlsx.full.min.js');
const wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
 ['Klassenaktivität Testklasse'],['Aktivitäten'],[],['Neues Thema'],['','','','A','B','C'],['Übungen','','Übungscode'],
 ['Erste Übung','','ABC',100,0,0],[],['Zweite Übung','','DEF',100,0,100],[],
 ['Älteres Thema'],['','','','A','B','C'],['Übung','','Übungscode'],['Dritte Übung','','GHI',100,0,null]
]),'Aktivitäten');
XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
 ['Schülerinnen und Schüler'],['','Kürzel','Vorname','Nachname'],['','A','Anna','Beispiel'],['','B','Ben','Beispiel'],['','C','Clara','Beispiel'],['','D','Dana','Beispiel']
]),'Schüler');
if(require.main===module)require('node:fs').writeFileSync(process.argv[2],XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));
module.exports=wb;

if(require.main===module&&process.argv[3]){
 const names=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(names,XLSX.utils.aoa_to_sheet([['Kürzel','Klarname'],['a','Aneliese Lutaku'],['unbekannt','Niemand Beispiel']]),'Zuordnung');
 require('node:fs').writeFileSync(process.argv[3],XLSX.write(names,{type:'buffer',bookType:'xlsx'}));
}
