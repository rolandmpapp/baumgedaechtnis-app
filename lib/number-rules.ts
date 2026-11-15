export type EncodingRule={mode:'auto'|'single'|'pairs'|'triples'|'custom';useColors:boolean;pattern?:number[]};
export const LEGACY_RULE:EncodingRule={mode:'auto',useColors:true};
export function splitNumber(value:string,rule:EncodingRule=LEGACY_RULE):string[]{
 const num=value.replace(/[\s,;\-]/g,'');
 if(!/^\d{1,60}$/.test(num))throw new Error('Bitte 1 bis 60 Ziffern eingeben.');
 if(rule.mode==='auto'){
  if(num==='100'||num.length<=2)return [num];
  if(rule.useColors&&num.length===3)return [num];
  const chunks:string[]=[];let i=0;
  if(rule.useColors&&num.length%2){chunks.push(num.slice(0,3));i=3;}
  for(;i<num.length;i+=2)chunks.push(num.slice(i,i+2));return chunks;
 }
 const pattern=rule.mode==='single'?[1]:rule.mode==='pairs'?[2]:rule.mode==='triples'?[3]:rule.pattern;
 if(!pattern?.length||pattern.length>60||pattern.some(n=>!Number.isInteger(n)||n<1||n>3))throw new Error('Eine Gruppe darf 1 bis 3 Ziffern enthalten.');
 const chunks:string[]=[];let offset=0,index=0;
 while(offset<num.length){const width=pattern[index++%pattern.length];chunks.push(num.slice(offset,offset+width));offset+=width;}
 return chunks;
}
export function ruleLabel(rule:EncodingRule){const labels={auto:'Automatisch',single:'Einzelne Ziffern',pairs:'Zweiergruppen',triples:'Dreiergruppen',custom:`Eigene Gruppen (${rule.pattern?.join(' · ')})`};return `${labels[rule.mode]} · ${rule.useColors?'mit Farbliste':'ohne Farbliste'}`;}
