(function(root){
'use strict';
function grade(values){
 const done=values.filter(v=>v!==null);
 if(!done.some(v=>v>0))return '--';
 if(done.length===values.length&&done.every(v=>v>0))return done.every(v=>v===100)?'++':'+';
 return done.length>values.length/2?'~':'-';
}
function makeResult(values){
 const active=values.some(v=>v!==null&&v>0);
 return {symbol:grade(values),done:active?values.filter(v=>v!==null).length:0,total:values.length,values};
}
const defaults={basis:'completion',two:80,three:50,four:null};
function schoolGrade(result,settings={}){
 const cfg={...defaults,...settings};
 if(!result.done||result.symbol==='--')return 6;
 if(result.symbol==='++')return 1;
 const percent=cfg.basis==='success'?result.values.reduce((sum,v)=>sum+(v||0),0)/result.total:result.done/result.total*100;
 if(percent>cfg.two)return 2;
 if(percent>=cfg.three)return 3;
 if(cfg.four!==null&&percent>=cfg.four)return 4;
 return 5;
}
function average(results,{weighted=false,excludeEmpty=false,...settings}={}){
 let sum=0,weight=0;
 for(const r of results){
  if(excludeEmpty&&!r.done)continue;
  const w=weighted?r.total:1;
  sum+=schoolGrade(r,settings)*w;weight+=w;
 }
 return weight?sum/weight:null;
}
function parseWorkbook(wb,XLSX){
 const names=new Map(),warnings=[];
 if(wb.SheetNames.length>20)throw Error('Maximal 20 Tabellenblätter erlaubt.');
 let cells=0;
 const sheets=Object.entries(wb.Sheets).map(([name,sheet])=>{
  const range=XLSX.utils.decode_range(sheet['!ref']||'A1');
  cells+=(range.e.r+1)*(range.e.c+1);
  if(cells>500000||range.e.r>20000||range.e.c>1000)throw Error('Die Datei enthält zu viele Zeilen oder Zellen.');
  return {name,rows:XLSX.utils.sheet_to_json(sheet,{header:1,defval:''})};
 });
 const text=v=>String(v??'').trim();
 for(const {rows} of sheets){
  const h=rows.findIndex(r=>r.includes('Kürzel')&&r.includes('Vorname'));
  if(h<0)continue;
  const head=rows[h];
  for(const r of rows.slice(h+1)){
   const key=text(r[head.indexOf('Kürzel')]);
   if(!key)continue;
   if(names.has(key))throw Error('Doppeltes Schülerkürzel im Schülerblatt: '+key);
   const name=[r[head.indexOf('Vorname')],r[head.indexOf('Nachname')]].filter(Boolean).join(' ').trim();
   names.set(key,name||key);
  }
 }
 const activities=[],students=new Map(names);let title='Klassenübersicht';
 for(const {name,rows} of sheets){
  const sections=[];
  for(let i=0;i<rows.length;i++){
   if(!rows[i].some(v=>text(v)==='Übungscode'))continue;
   if(!/^Übung(?:en)?$/.test(text(rows[i][0]))||text(rows[i][2])!=='Übungscode')throw Error('Unbekannter Themenkopf in „'+name+'“, Zeile '+(i+1)+'.');
   let studentRow=i-1;while(studentRow>=0&&!rows[studentRow].some(v=>text(v)))studentRow--;
   let headingRow=studentRow-1;while(headingRow>=0&&!rows[headingRow].some(v=>text(v)))headingRow--;
   if(headingRow<0||!text(rows[headingRow][0])||!rows[studentRow].slice(3).some(v=>text(v)))throw Error('Unvollständiger Themenkopf in Zeile '+(i+1)+'.');
   sections.push({header:i,headingRow,studentRow});
  }
  if(!sections.length){
   if(rows.some(r=>/^Aktivitäten$/.test(text(r[0]))))throw Error('Aktivitätenblatt ohne lesbare Themen: '+name);
   continue;
  }
  for(let n=0;n<sections.length;n++){
   const section=sections[n],heading=text(rows[section.headingRow][0]);
   const end=sections[n+1]?.headingRow??rows.length;
   const exerciseRows=[];
   for(let j=section.header+1;j<end;j++){
    const row=rows[j];if(!row.some(v=>text(v)))continue;
    if(!text(row[0]))throw Error('Übung ohne Titel in Zeile '+(j+1)+'.');
    if(!text(row[2])&&!row.slice(3).some(v=>text(v)))throw Error('Nicht zuordenbare Zeile '+(j+1)+' im Thema „'+heading+'“.');
    exerciseRows.push(row);
   }
   if(!exerciseRows.length){warnings.push('Thema „'+heading+'“ enthält keine Übungen und wird nicht bewertet.');continue;}
   if(!activities.length)title=text(rows[0]?.[0])||title;
   const columns=rows[section.studentRow],seen=new Set();
   const activity={title:heading,count:exerciseRows.length,exercises:exerciseRows.map(r=>text(r[0])),results:new Map()};
   for(let c=3;c<Math.max(columns.length,...exerciseRows.map(r=>r.length));c++){
    const key=text(columns[c]);
    if(!key){if(exerciseRows.some(r=>text(r[c])))throw Error('Ergebnisse ohne Schülerkürzel im Thema „'+heading+'“.');continue;}
    if(seen.has(key))throw Error('Doppeltes Schülerkürzel im Thema „'+heading+'“: '+key);
    seen.add(key);students.set(key,names.get(key)||key);
    const values=exerciseRows.map(r=>{
     if(!text(r[c]))return null;
     const raw=r[c];
     if(typeof raw!=='number'&&typeof raw!=='string')throw Error('Ungültiger Prozentwert im Thema „'+heading+'“.');
     const value=Number(text(raw).replace(/%$/,'').replace(',','.'));
     if(!Number.isFinite(value)||value<0||value>100)throw Error('Ungültiger Prozentwert im Thema „'+heading+'“.');
     return value;
    });
    activity.results.set(key,makeResult(values));
   }
   activities.push(activity);
  }
 }
 if(!activities.length||!students.size)throw Error('Keine Klassenaktivitäten gefunden. Bitte einen Bettermarks-Export „Klassenaktivität“ als XLSX-Datei auswählen.');
 if(activities.length*students.size>20000)throw Error('Die Übersicht ist zu groß (maximal 20.000 Bewertungen).');
 return {title,activities,students:[...students].map(([key,name])=>({key,name})),warnings};
}
function csvEncode(rows){return '\uFEFF'+rows.map(r=>r.map(value=>{
 let s=String(value??'');
 if(/^\s*[=+@\-]/.test(s)&&!['++','+','-','--'].includes(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
 }).join(';')).join('\r\n');}
function parseSelection(text,count){
 const selected=new Set();
 for(const part of text.split(',')){
  const match=part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if(!match)throw Error('Positionen angeben, z. B. 1-3, 2-5 oder 1, 3-5.');
  const start=Number(match[1]),end=Number(match[2]||match[1]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>count)throw Error(`Bitte Positionen von 1 bis ${count} in aufsteigenden Bereichen angeben.`);
  for(let i=start;i<=end;i++)selected.add(i-1);
 }
 return [...selected].sort((a,b)=>a-b);
}
function normalizeAlias(value){return String(value).normalize('NFC').toLocaleLowerCase('de').replace(/[.\s_–-]/g,'');}
function parseNameMapping(wb,XLSX){
 const mapping=new Map();let cells=0;
 for(const sheet of Object.values(wb.Sheets)){
  const range=XLSX.utils.decode_range(sheet['!ref']||'A1');cells+=(range.e.r+1)*(range.e.c+1);
  if(cells>20000)throw Error('Die Namensdatei ist zu groß (maximal 20.000 Zellen).');
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
  const h=rows.findIndex(r=>r.some(v=>String(v).trim()==='Kürzel')&&r.some(v=>['Klarname','Name'].includes(String(v).trim())));
  if(h<0)continue;
  const header=rows[h].map(v=>String(v).trim()),aliasColumn=header.indexOf('Kürzel'),nameColumn=header.findIndex(v=>['Klarname','Name'].includes(v));
  for(const r of rows.slice(h+1)){
   const alias=String(r[aliasColumn]??'').trim(),name=String(r[nameColumn]??'').trim();
   if(!alias&&!name)continue;
   if(!alias||!name)throw Error('Jede Zuordnung braucht Kürzel und Klarname.');
   const key=normalizeAlias(alias);
   if(!key||mapping.has(key))throw Error('Leeres oder doppeltes Kürzel in der Namensdatei: '+alias);
   mapping.set(key,name);
  }
 }
 if(!mapping.size)throw Error('Keine Zuordnungen gefunden. Die Spalten müssen „Kürzel“ und „Klarname“ heißen.');
 return mapping;
}
function resolveNames(students,mapping){
 const replacements=new Map();let unmatched=0;
 for(const [alias,name] of mapping){
  let matches=students.filter(s=>normalizeAlias(s.key)===alias);
  if(!matches.length)matches=students.filter(s=>normalizeAlias(s.name)===alias);
  if(matches.length>1)throw Error('Kürzel nicht eindeutig zuordenbar: '+alias);
  if(!matches.length){unmatched++;continue;}
  const key=matches[0].key;
  if(replacements.has(key))throw Error('Mehrere Zuordnungen für denselben Schüler: '+key);
  replacements.set(key,name);
 }
 return {students:students.map(s=>({...s,name:replacements.get(s.key)||s.name})),matched:replacements.size,unmatched};
}
root.Bettermarks={normalizeAlias,parseNameMapping,resolveNames,parseSelection,grade,makeResult,schoolGrade,average,parseWorkbook,csvEncode};
})(typeof window==='undefined'?globalThis:window);
