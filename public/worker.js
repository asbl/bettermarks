'use strict';
importScripts('vendor/xlsx.full.min.js','parser.js');
self.onmessage=event=>{
 try{
  const {buffer,kind}=event.data;
  // Inspect ZIP central directory before decompression (XLSX does not need ZIP64).
  const view=new DataView(buffer);let end=-1;
  for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
  if(end<0)throw Error('Keine gültige XLSX-Datei (ZIP-Struktur fehlt).');
  const entries=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true),size=0;
  if(entries>2000)throw Error('Die Datei enthält zu viele ZIP-Einträge.');
  for(let i=0;i<entries;i++){
   if(offset+46>buffer.byteLength||view.getUint32(offset,true)!==0x02014b50)throw Error('Ungültige ZIP-Struktur.');
   const length=view.getUint32(offset+24,true);size+=length;
   if(length===0xffffffff||size>50*1024*1024)throw Error('Die entpackte Datei ist zu groß (maximal 50 MB).');
   offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
  }
  const workbook=XLSX.read(buffer,{type:'array'});
  self.postMessage({data:kind==='names'?Bettermarks.parseNameMapping(workbook,XLSX):Bettermarks.parseWorkbook(workbook,XLSX)});
 }catch(error){self.postMessage({error:error.message||'Die Datei konnte nicht gelesen werden.'});}
};
