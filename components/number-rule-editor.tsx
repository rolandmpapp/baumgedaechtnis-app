"use client";
import { useId } from 'react';
import { RadioGroup,RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { encode,cleanNumber,type SymbolItem,type ColorItem } from '@/lib/memory';
import { splitNumber,type EncodingRule } from '@/lib/number-rules';
import { toast } from 'sonner';
export function NumberRuleEditor({number,rule,onChange,symbols,colors}:{number:string;rule:EncodingRule;onChange:(rule:EncodingRule)=>void;symbols:SymbolItem[];colors:ColorItem[]}){
 const id=useId();let chunks:string[]=[];let parts:ReturnType<typeof encode>=[];let error='';
 try{chunks=splitNumber(number,rule);parts=encode(number,symbols,colors,rule);}catch(e){error=(e as Error).message;}
 const digits=cleanNumber(number);const cuts=new Set<number>();let position=0;for(const chunk of chunks.slice(0,-1)){position+=chunk.length;cuts.add(position);}
 function toggleCut(after:number){const next=new Set(cuts);if(next.has(after))next.delete(after);else next.add(after);const boundaries=[0,...[...next].sort((a,b)=>a-b),digits.length];const pattern=boundaries.slice(1).map((end,i)=>end-boundaries[i]);if(pattern.some(n=>n>3)){toast.error('Höchstens drei Ziffern pro Gruppe.');return;}onChange({...rule,mode:'custom',pattern});}
 function changeMode(mode:EncodingRule['mode']){onChange({...rule,mode,...(mode==='custom'?{pattern:chunks.length?chunks.map(c=>c.length):[2]}:{pattern:undefined})});}
 return <div className="rule-editor"><div className="rule-switch"><div><label htmlFor={id+'-colors'}>Farbliste verwenden</label><p>Eine dritte Ziffer bestimmt die Farbe.</p></div><Switch id={id+'-colors'} checked={rule.useColors} onCheckedChange={useColors=>onChange({...rule,useColors,...(!useColors&&rule.mode==='triples'?{mode:'pairs',pattern:undefined}:{})})}/></div><RadioGroup aria-label="Aufteilung der Ziffern" className="rule-modes" value={rule.mode} onValueChange={v=>changeMode(v as EncodingRule['mode'])}>{([['auto','Automatisch'],['single','Einzeln'],['pairs','Zweiergruppen'],['triples','Dreiergruppen'],['custom','Selbst festlegen']] as const).map(([value,label])=><label key={value} className="rule-option" data-active={rule.mode===value} data-disabled={value==='triples'&&!rule.useColors}><RadioGroupItem id={id+'-'+value} value={value} disabled={value==='triples'&&!rule.useColors}/><span>{label}</span></label>)}</RadioGroup>
 {digits&&/^\d{1,60}$/.test(digits)&&<div className="rule-boundaries"><h3>Ziffern verbinden oder trennen</h3><p>Tippe zwischen die Ziffern: „|“ trennt, „–“ verbindet.</p><div className="digit-editor" role="group" aria-label="Gruppengrenzen bearbeiten">{[...digits].map((digit,i)=><span className="digit-unit" key={i}><span className="individual-digit">{digit}</span>{i<digits.length-1&&<button type="button" className="cut-button" data-cut={cuts.has(i+1)} aria-pressed={cuts.has(i+1)} aria-label={cuts.has(i+1)?`Gruppen nach Ziffer ${i+1} verbinden`:`Nach Ziffer ${i+1} trennen`} onClick={()=>toggleCut(i+1)}>{cuts.has(i+1)?'|':'–'}</button>}</span>)}</div></div>}
 <div className="rule-preview" aria-live="polite"><h3>So wird deine Zahl gelesen</h3>{error?<p className="rule-error" role="alert">{error}</p>:<div className="rule-preview-parts">{parts.map((part,i)=><div className="rule-preview-part" key={i}><b>{part.digits}</b><span>{part.symbol.name}</span>{part.color&&<small><i style={{background:part.color.hex}}/>{part.color.name}</small>}</div>)}</div>}</div>
 {rule.mode==='custom'&&<p className="rule-note">Gruppengrößen: {rule.pattern?.join(' · ')}. Bei längeren Zahlen wird diese Reihenfolge wiederholt.</p>}
 {!rule.useColors&&<p className="rule-note">Ohne Farbliste passen 1–2 Ziffern in ein Bild. 100 ist die Ausnahme: Haare. Es geht keine Ziffer verloren.</p>}
 </div>;
}
