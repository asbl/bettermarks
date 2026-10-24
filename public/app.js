'use strict';
const $=id=>document.getElementById(id);
let data=null,worker=null,timer=null,requestId=0,filename='',selectedActivities=new Set();
let nameMapping=new Map(),mappingFilename='',baseStudents=[];
let settings={basis:'completion',two:80,three:50,four:null,weighted:false,excludeEmpty:false};
const classes={'++':'best','+':'good','~':'partial','-':'low','--':'none'};
const number=new Intl.NumberFormat('de',{maximumFractionDigits:2});
function el(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
function clearDetail(){if($('detail').open)$('detail').close();for(const id of ['detail-title','detail-text','detail-list'])$(id).replaceChildren();}
function mappingStatus(result){
 $('remove-names').hidden=!nameMapping.size;
 $('names-status').textContent=nameMapping.size?(data?`${mappingFilename}: ${result.matched} Namen zugeordnet, ${result.unmatched} Kürzel nicht gefunden. Ohne Zuordnung bleibt der Name aus dem Export sichtbar.`:`${mappingFilename}: ${nameMapping.size} Zuordnungen geladen. Jetzt den Aktivitäten-Export auswählen.`):'';
}
function resultFor(a,s){return a.results.get(s.key)||{symbol:'--',done:0,total:a.count,values:Array(a.count).fill(null)};}
function selected(){return data.activities.filter((a,i)=>selectedActivities.has(i));}
function averageFor(s){return Bettermarks.average(selected().map(a=>resultFor(a,s)),settings);}
function buildSelection(){
 $('activity-list').replaceChildren();$('selection-range').value=data.activities.length===1?'1':`1-${Math.min(3,data.activities.length)}`;$('selection-range').setCustomValidity('');
 data.activities.forEach((activity,index)=>{
  const label=el('label',''),input=document.createElement('input');input.type='checkbox';input.checked=selectedActivities.has(index);input.dataset.activity=index;
  input.onchange=()=>{if(input.checked)selectedActivities.add(index);else selectedActivities.delete(index);render();};
  label.append(input,document.createTextNode(`${index+1}. ${activity.title}`));$('activity-list').append(label);
 });
}
function chooseActivities(indices){
 selectedActivities=new Set(indices);
 for(const input of $('activity-list').querySelectorAll('input'))input.checked=selectedActivities.has(Number(input.dataset.activity));
 render();
}
function formatAverage(value){return value===null?'–':new Intl.NumberFormat('de',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
function displayResult(r){return $('display').value==='grades'?String(Bettermarks.schoolGrade(r,settings)):r.symbol;}
function basisText(){return settings.basis==='completion'?'Bearbeitungsanteil':'Erfolgsquote';}
function gradeText(){return `1: alle Übungen mit 100 % · 2: über ${settings.two} % · 3: ab ${settings.three} %${settings.four===null?'':` · 4: ab ${settings.four} %`} · 5: unterhalb dieser Grenzen · 6: nicht bearbeitet oder ausschließlich 0 %. Basis: ${basisText()}.${settings.four===null?' Note 4 wird nicht vergeben.':''}`;}
function averageText(){return `Ø ${settings.basis==='completion'?'Bearbeitungsnote':'Ergebnisnote'} · ${settings.weighted?'nach Übungsanzahl gewichtet':'alle Themen gleich gewichtet'} · unbearbeitete Themen ${settings.excludeEmpty?'ausgeschlossen':'als 6'} · ${selectedActivities.size} von ${data.activities.length} Aktivitäten ausgewählt${selectedActivities.size?'':' (kein Durchschnitt)'}`;}
function visibleStudents(){
 const students=data.students.filter(s=>s.name.toLocaleLowerCase('de').includes($('search').value.trim().toLocaleLowerCase('de')));
 const sort=$('sort').value;
 if(sort==='name')students.sort((a,b)=>a.name.localeCompare(b.name,'de'));
 if(sort==='best'||sort==='worst')students.sort((a,b)=>{
  const x=averageFor(a),y=averageFor(b);
  if(x===null)return y===null?0:1;if(y===null)return -1;
  return (sort==='best'?x-y:y-x)||a.name.localeCompare(b.name,'de');
 });
 return students;
}
function showDetail(s,a,result){
 clearDetail();$('detail-title').textContent=s.name+' · '+a.title;
 $('detail-text').textContent=`${result.done} von ${result.total} Übungen zählen als bearbeitet.${result.values.some(v=>v===0)&&!result.done?' Ausschließlich 0 % zählt als nicht bearbeitet.':''}`;
 result.values.forEach((v,i)=>$('detail-list').append(el('li',`${a.exercises[i]}: ${v===null?'nicht bearbeitet':number.format(v)+' %'}`)));
 $('detail').showModal();
}
function render(){
 const grades=$('display').value==='grades';$('grade-key').hidden=!grades;$('symbol-key').hidden=grades;
 $('grade-key').textContent=gradeText();$('average-key').textContent=averageText();
 $('selection-summary').textContent=`Aktivitäten für Gesamt: ${selectedActivities.size} von ${data.activities.length}`;
 $('thead').replaceChildren();$('tbody').replaceChildren();
 const tr=el('tr',''),name=el('th','Name');name.scope='col';tr.append(name);
 for(const [index,a] of data.activities.entries()){const th=el('th',a.title);th.scope='col';th.className=selectedActivities.has(index)?'included':'excluded';th.title=selectedActivities.has(index)?'Zählt für Gesamt':'Zählt nicht für Gesamt';th.append(el('small',`${a.count} ${a.count===1?'Übung':'Übungen'}`));tr.append(th);}
 const totalHead=el('th','Gesamt');totalHead.scope='col';totalHead.className='total';totalHead.append(el('small',settings.basis==='completion'?'Ø Bearbeitungsnote':'Ø Ergebnisnote'));tr.append(totalHead);$('thead').append(tr);
 const students=visibleStudents();
 for(const s of students){
  const row=el('tr',''),th=el('th',s.name);th.scope='row';row.append(th);
  for(const a of data.activities){
   const td=el('td',''),result=resultFor(a,s),b=el('button',displayResult(result));
   b.className='badge '+(grades?{1:'best',2:'good',3:'partial',4:'fair',5:'low',6:'none'}[Bettermarks.schoolGrade(result,settings)]:classes[result.symbol]);
   b.title=`${result.done} von ${result.total} Übungen bearbeitet`;
   b.setAttribute('aria-label',`${s.name}, ${a.title}: ${b.title}, ${displayResult(result)}`);
   b.onclick=()=>showDetail(s,a,result);td.append(b);row.append(td);
  }
  const total=el('td',formatAverage(averageFor(s)));total.className='total';row.append(total);$('tbody').append(row);
 }
 if(!students.length){const td=el('td','Keine passenden Namen gefunden.');td.colSpan=data.activities.length+2;const row=el('tr','');row.append(td);$('tbody').append(row);}
}
function stopWorker(){requestId++;if(worker)worker.terminate();worker=null;clearTimeout(timer);$('cancel').hidden=true;$('file').disabled=false;$('names-file').disabled=false;}
function importError(message){$('message').textContent=message+(data?' Die vorherige Auswertung „'+filename+'“ bleibt angezeigt.':'');}
async function load(file,kind='activities'){
 if(!file)return;
 stopWorker();clearDetail();const id=requestId;
 try{
  if(!/\.xlsx$/i.test(file.name))throw Error('Bitte eine XLSX-Datei auswählen.');
  const limit=kind==='names'?2:20;
  if(file.size>limit*1024*1024)throw Error(`Die Datei ist zu groß (maximal ${limit} MB).`);
  $('message').textContent='Datei wird ausgewertet …';$('cancel').hidden=false;$('file').disabled=true;$('names-file').disabled=true;
  const buffer=await file.arrayBuffer();if(id!==requestId)return;
  worker=new Worker('worker.js?v=6');
  timer=setTimeout(()=>{stopWorker();importError('Die Auswertung hat zu lange gedauert und wurde abgebrochen.');},15000);
  worker.onmessage=event=>{
   if(id!==requestId)return;
   const result=event.data;stopWorker();
   if(result.error){importError(result.error);return;}
   try{
    if(kind==='names'){
     const resolved=Bettermarks.resolveNames(baseStudents,result.data);
     nameMapping=result.data;mappingFilename=file.name;
     if(data){data.students=resolved.students;$('search').value='';render();}
     mappingStatus(resolved);$('message').textContent='Namenszuordnung geladen.';
    }else{
     const original=result.data.students,resolved=Bettermarks.resolveNames(original,nameMapping);
     data=result.data;baseStudents=original;data.students=resolved.students;filename=file.name;
     selectedActivities=new Set(data.activities.map((a,i)=>i));buildSelection();$('activity-selection').open=false;$('search').value='';$('sort').value='original';render();mappingStatus(resolved);
     $('title').textContent=data.title;$('summary').textContent=`${data.students.length} Schülerinnen und Schüler · ${data.activities.length} Aktivitäten · ${filename}`;
     $('results').hidden=false;$('message').textContent=['Datei ausgewertet.',...data.warnings].join(' ');
    }
   }catch(error){importError(error.message);}

  };
  worker.onerror=()=>{if(id!==requestId)return;stopWorker();importError('Die Datei konnte nicht gelesen werden.');};
  worker.postMessage({buffer,kind},[buffer]);
 }catch(error){if(id===requestId){stopWorker();importError(error.message||'Die Datei konnte nicht gelesen werden.');}}
 finally{$('file').value='';$('names-file').value='';}
}
function readSettings(){
 $('four').disabled=!$('use-four').checked;
 const two=$('two').valueAsNumber,three=$('three').valueAsNumber,four=$('use-four').checked?$('four').valueAsNumber:null;
 const valid=Number.isFinite(two)&&Number.isFinite(three)&&two>=0&&two<100&&three>=0&&three<=two&&(four===null||(Number.isFinite(four)&&four>=0&&four<three));
 $('settings-error').hidden=valid;$('csv').disabled=!valid;
 if(!valid){$('settings-error').textContent='Grenzen prüfen: 0 ≤ Note 4 < Note 3 ≤ Grenze für Note 2 < 100. Die Tabelle zeigt die letzten gültigen Einstellungen.';return;}
 settings={basis:$('basis').value,two,three,four,weighted:$('weighting').value==='exercises',excludeEmpty:$('exclude-empty').checked};
 clearDetail();if(data)render();
}
$('file').onchange=e=>load(e.target.files[0]);
$('names-file').onchange=e=>load(e.target.files[0],'names');
$('remove-names').onclick=()=>{
 stopWorker();clearDetail();nameMapping.clear();mappingFilename='';
 if(data){data.students=baseStudents.map(s=>({...s}));$('search').value='';render();}
 mappingStatus();$('message').textContent='Namenszuordnung entfernt.';
};
for(const event of ['dragover','dragenter'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('drag');});
$('drop').ondragleave=()=>$('drop').classList.remove('drag');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('drag');load(e.dataTransfer.files[0]);};
$('cancel').onclick=()=>{stopWorker();importError('Auswertung abgebrochen.');};
for(const id of ['basis','two','three','use-four','four','weighting','exclude-empty'])$(id).oninput=readSettings;
$('display').onchange=()=>{if(data)render();};$('sort').onchange=()=>{if(data)render();};$('search').oninput=()=>{if(data)render();};
$('select-all').onclick=()=>{if(data)chooseActivities(data.activities.map((a,i)=>i));};
$('select-none').onclick=()=>{if(data)chooseActivities([]);};
$('select-recent').onclick=()=>{
 if(!data)return;
 const input=$('selection-range');
 try{const indices=Bettermarks.parseSelection(input.value,data.activities.length);input.setCustomValidity('');chooseActivities(indices);}
 catch(error){input.setCustomValidity(error.message);input.reportValidity();}
};
$('selection-range').oninput=()=>$('selection-range').setCustomValidity('');
$('selection-range').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();$('select-recent').click();}};
$('reset').onclick=()=>{
 stopWorker();clearDetail();data=null;filename='';baseStudents=[];nameMapping.clear();mappingFilename='';mappingStatus();selectedActivities.clear();$('activity-list').replaceChildren();$('activity-selection').open=false;
 for(const id of ['thead','tbody','summary','title','grade-key','average-key'])$(id).replaceChildren();
 $('results').hidden=true;$('symbol-key').hidden=false;$('search').value='';$('sort').value='original';
 $('message').textContent='Auswertung entfernt.';$('file').focus();
};
$('csv').onclick=()=>{
 if(!data)return;
 const rows=[['Datei',filename],['Namenszuordnung',mappingFilename||'Keine zusätzliche Namensdatei'],['Anzeige',$('display').value==='grades'?'Noten':'Symbole'],['Notenschlüssel',gradeText()],['Durchschnitt',averageText()],['Für Gesamt ausgewählt',...data.activities.flatMap((a,i)=>selectedActivities.has(i)?[`${i+1}. ${a.title}`]:[])],['Exportumfang','Alle Schülerinnen und Schüler; Export-Reihenfolge'],[],['Name',...data.activities.map(a=>a.title),'Gesamt (Ø Note)'],...data.students.map(s=>[s.name,...data.activities.map(a=>displayResult(resultFor(a,s))),formatAverage(averageFor(s))])];
 const url=URL.createObjectURL(new Blob([Bettermarks.csvEncode(rows)],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=`bettermarks-${settings.basis}-${settings.weighted?'gewichtet':'gleich'}-${settings.excludeEmpty?'ohne-leere':'mit-leeren'}-${selectedActivities.size}-aktivitaeten.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
