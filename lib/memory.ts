import { splitNumber, LEGACY_RULE, type EncodingRule } from "./number-rules.ts";
export type SymbolItem={n:number;name:string;icon:string;group:string};
const names='Baum|Licht|Hocker|Auto|Hand|Würfel|Zwerg|Achterbahn|Katze|Bibel|Fußball|Geist|Fahrstuhl|Herz|Ritter|Teenager|Karten|Verkehr|Abendessen|Schlafzimmer|Bett|Kissen|Decke|Nachttisch|Wecker|Buch|Vorhang|Kommode|Teddybär|Badezimmer|Badewanne|Badeente|Dusche|Seife|Handtuch|Medizinschrank|Waschbecken|Zahnbürste|Waage|Küche|Herd|Kaffeemaschine|Spülmaschine|Müll|Kühlschrank|Milch|Toaster|Teller|Besteck|Wohnzimmer|Sofa|Zeitungsständer|Gemälde|Bücherregal|TV|Sessel|Klavier|Pflanze|Teppich|Garten|Terrasse|Gartenliege|Grill|Wiese|Rasenmäher|Blumenbeet|Gartenschlauch|Schaukel|Zaun|Büro|Schreibtisch|Papier|Stift|Handy|Mac|Drucker|Papierkorb|Ordner|Rollladen|Garage|Kennzeichen|Stoßstange|Motorhaube|Scheibenwischer|Lenkrad|Hupe|Radio|Kofferraum|Reifen|GYM|Füße|Knie|Oberschenkel|Po|Bauch|Brust|Schulter|Hals|Gesicht|Haare'.split('|');
const icons=[
  'TreePine','Lightbulb','ThreeLeggedStool','Car','Hand','Dice6','Dwarf','RollerCoaster','Cat','Bible',
  'Football','Ghost','Elevator','Heart','Knight','Teenager','PlayingCards','Traffic','DinnerPlate','Bedroom',
  'Bed','Pillow','Blanket','BedsideTable','AlarmClock','BookOpen','Curtains','Dresser','TeddyBear','Bathroom',
  'Bath','RubberDuck','ShowerHead','Soap','Towel','MedicineCabinet','Washbasin','Toothbrush','BathroomScale','Kitchen',
  'Stove','CoffeeMachine','Dishwasher','TrashBag','Refrigerator','Milk','Toaster','Plate','Utensils','LivingRoom',
  'Sofa','NewspaperRack','FramedPainting','Bookshelf','Tv','Armchair','Piano','PottedPlant','Rug','Garden',
  'Patio','DeckChair','Barbecue','Meadow','LawnMower','Flowerbed','GardenHose','Swing','Fence','Office',
  'Desk','FileText','PenLine','Smartphone','DesktopMac','Printer','WasteBasket','RingBinder','RollerShutter','Garage',
  'LicensePlate','Bumper','CarHood','WindshieldWipers','SteeringWheel','CarHorn','RadioReceiver','CarTrunk','Tire','Dumbbell',
  'Footprints','Knee','Thigh','Hips','Abdomen','Chest','Shoulder','Neck','FaceSlightlySmiling','Hair',
];
export const groups=['Baumliste','Schlafzimmer','Badezimmer','Küche','Wohnzimmer','Garten','Büro','Garage','Körper'];
export const symbols:SymbolItem[]=names.map((name,i)=>({n:i+1,name,icon:icons[i],group:i<19?'Baumliste':groups[Math.min(8,Math.floor((i+1)/10)-1)]}));
export type ColorItem={n:number;name:string;hex:string};
export const colors:ColorItem[]=[['Schwarz','#20242b'],['Braun','#895437'],['Rot','#cf383c'],['Orange','#db751f'],['Gelb','#e1b929'],['Grün','#278350'],['Blau','#2871be'],['Lila','#8b55ac'],['Grau','#7b8390'],['Weiß','#ffffff']].map(([name,hex],n)=>({n,name,hex}));
export type Entry={id:string;number:string;title:string;note:string;created_at:string;encoding?:EncodingRule|null};
export type Mapping={kind:'symbol'|'color'|'default';n:number;name:string;hex?:string};
export type MemoryPart={digits:string;symbol:SymbolItem; color?:ColorItem};
export function cleanNumber(value:string){return value.replace(/[\s,;\-]/g,'');}
export function encode(value:string,ss=symbols,cs=colors,rule:EncodingRule=LEGACY_RULE):MemoryPart[]{
 const chunks=splitNumber(value,rule);
 return chunks.map(digits=>{
  if(digits==='0')return {digits,symbol:{n:0,name:'Null',icon:'Circle',group:'Sonderfall'}};
  const colored=digits.length===3&&digits!=='100';
  if(colored&&!rule.useColors)throw new Error(`„${digits}“ braucht die Farbliste. Teile diese Gruppe in ein oder zwei Ziffern auf. Nur 100 hat ein eigenes Bild.`);
  const tail=colored?digits.slice(1):digits;const n=Number(tail)||100;
  return {digits,symbol:ss.find(s=>s.n===n)!,color:colored?cs[Number(digits[0])]:undefined};
 });
}
export function applyMappings(ms:Mapping[]){return {defaultColor:ms.find(m=>m.kind==='default')?.hex??'#262626',symbols:symbols.map(s=>({...s,name:ms.find(m=>m.kind==='symbol'&&m.n===s.n)?.name??s.name})),colors:colors.map(c=>({...c,...ms.find(m=>m.kind==='color'&&m.n===c.n)}))};}

// Keep pale symbols legible without changing the remembered color.
export function symbolBackground(hex:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return (rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255>.65?"#444444":"#ffffff";}
