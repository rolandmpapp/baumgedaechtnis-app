import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, GraduationCap } from 'lucide-react';
import { readMemory, recordReview } from '../lib/local-store';
import type { MemoryState } from '../lib/local-data';
import { applyMappings } from '../lib/memory';
import { symbolIcons } from '../lib/symbol-icons';
import { availableCards, buildStudyCards, cardsInDeck, intervalLabel, matchingReview, nextReadyId, scheduleReview, sessionCards, type Deck, type Rating, type StudyCard } from '../lib/repetition';

type Session = {mode:'scheduled'|'free'; remaining:string[]; current:string|null; initial:number; answered:number};
const deckNames:Record<Deck,string>={all:'Alle Karten',symbols:'Symbole',colors:'Farben',collection:'Meine Zahlen'};
const ratings:{value:Rating;label:string}[]=[{value:'again',label:'Nochmal'},{value:'hard',label:'Schwer'},{value:'good',label:'Gut'},{value:'easy',label:'Leicht'}];

function dateLabel(iso:string) {
  return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
}
function countdown(iso:string,now:number){const seconds=Math.ceil(Math.max(0,Date.parse(iso)-now)/1000);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
function CardPrompt({card}: {card:StudyCard}) {
  if (card.kind==='symbols') {
    const Icon=symbolIcons[card.symbol.icon as keyof typeof symbolIcons]??symbolIcons.Circle;
    return <><div className="study-symbol"><Icon size={108} strokeWidth={1.5} aria-hidden/></div><h3>{card.symbol.name}</h3></>;
  }
  if (card.kind==='colors') return <><div className="study-color" style={{background:card.color.hex}} aria-hidden/><h3>{card.color.name}</h3></>;
  return <><div className="study-own-icon"><GraduationCap size={48} aria-hidden/></div><h3 className="study-own-title">{card.entry.title}</h3></>;
}

export function SpacedPractice({onSessionChange}:{onSessionChange?:(active:boolean)=>void}) {
  const [data,setData]=useState<MemoryState|null>(null);
  const [error,setError]=useState('');
  const [deck,setDeck]=useState<Deck>('all');
  const [now,setNow]=useState(Date.now);
  const [session,setSession]=useState<Session|null>(null);
  const [revealed,setRevealed]=useState(false);
  const inSession=!!session;
  useEffect(()=>{onSessionChange?.(inSession);return()=>onSessionChange?.(false);},[inSession,onSessionChange]);
  const [busy,setBusy]=useState(false);
  const saving=useRef(false);
  const [lastSaved,setLastSaved]=useState('');
  const revealButton=useRef<HTMLButtonElement>(null);
  const gradeButton=useRef<HTMLButtonElement>(null);
  const cards=useMemo(()=>{
    const mappings=applyMappings(data?.mappings??[]);
    return buildStudyCards(data?.entries??[],mappings.symbols,mappings.colors);
  },[data?.entries,data?.mappings]);
  const cardMap=useMemo(()=>new Map(cards.map(c=>[c.id,c])),[cards]);
  const reviewMap=useMemo(()=>new Map((data?.reviews??[]).map(r=>[r.cardId,r])),[data?.reviews]);
  const selected=useMemo(()=>cardsInDeck(cards,deck),[cards,deck]);
  const available=useMemo(()=>availableCards(selected,reviewMap,now),[selected,reviewMap,now]);
  const unseen=selected.filter(c=>!matchingReview(c,reviewMap)).length;
  const due=available.length-unseen;
  const later=selected.length-available.length;
  const nextDue=selected.map(c=>matchingReview(c,reviewMap)?.dueAt).filter((d):d is string=>!!d && Date.parse(d)>now).sort()[0];
  const current=session?.current?cardMap.get(session.current):undefined;
  const currentProgress=current?matchingReview(current,reviewMap):undefined;
  const waitingAt=session?.remaining.map(id=>{
    const card=cardMap.get(id);return card?matchingReview(card,reviewMap)?.dueAt:undefined;
  }).filter((d):d is string=>!!d).sort()[0];

  async function refresh() {
    try {setError('');setData(await readMemory());setSession(null);setRevealed(false);setNow(Date.now());}
    catch (e) {setError((e as Error).message);}
  }
  useEffect(()=>{let active=true;readMemory().then(s=>{if(active)setData(s)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false};},[]);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    const timer=window.setInterval(tick,session&&!session.current&&session.remaining.length?1000:30000);
    window.addEventListener('focus',tick);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',tick);};
  },[session?.current,session?.remaining.length]);
  useEffect(()=>{
    if(!session||session.current||!session.remaining.length)return;
    const id=nextReadyId(session.remaining,cardMap,reviewMap,now,session.mode==='free');
    if(id)setSession(s=>s&&!s.current?{...s,current:id}:s);
  },[now,session,cardMap,reviewMap]);
  useEffect(()=>{if(current&&!revealed)revealButton.current?.focus({preventScroll:true});},[current?.id,session?.answered]);
  useEffect(()=>{if(revealed)gradeButton.current?.focus({preventScroll:true});},[revealed]);

  function start(mode:Session['mode']) {
    const time=Date.now();
    const list=sessionCards(selected,reviewMap,time,mode==='free');
    if(!list.length)return;
    setSession({mode,remaining:list.map(c=>c.id),current:list[0].id,initial:list.length,answered:0});
    setNow(time);setRevealed(false);setLastSaved('');setError('');
  }
  async function grade(rating:Rating) {
    if(!current||!session||!revealed||saving.current||session.mode!=='scheduled')return;
    saving.current=true;setBusy(true);setError('');
    const card=current;
    try {
      const result=await recordReview(card.id,card.fingerprint,rating,currentProgress?.reviews??0);
      const progress=new Map(result.reviews.map(r=>[r.cardId,r]));
      const time=Date.now();
      setData(d=>d?{...d,reviews:result.reviews}:d);
      setSession(s=>{
        if(!s)return s;
        const remaining=s.remaining.filter(id=>id!==card.id);
        if(result.review.intervalDays===0)remaining.push(card.id);
        return {...s,remaining,current:nextReadyId(remaining,cardMap,progress,time),answered:s.answered+1};
      });
      setLastSaved('Gespeichert. Diese Karte kommt am '+dateLabel(result.review.dueAt)+' wieder.');
      setRevealed(false);setNow(time);
    } catch(e) {setError((e as Error).message);}
    finally {saving.current=false;setBusy(false);}
  }
  function nextFree() {
    if(!session||session.mode!=='free')return;
    setSession(s=>{
      if(!s)return s;
      const remaining=s.remaining.filter(id=>id!==s.current);
      return {...s,remaining,current:nextReadyId(remaining,cardMap,reviewMap,Date.now(),true),answered:s.answered+1};
    });
    setRevealed(false);
  }
  function finish() {setSession(null);setRevealed(false);setNow(Date.now());}

  return <section className="study-page" data-session={inSession} aria-labelledby="study-title">
    <div className="study-heading"><h2 id="study-title">Üben</h2></div>
    {error&&<div className="notice error" role="alert"><span>{error}</span><button className="textbutton" disabled={busy} onClick={refresh}>Lernstand neu laden</button></div>}
    {!data&&!error&&<p role="status">Dein Lernstand wird geladen …</p>}
    {!session?<>
      <div className="study-decks" role="group" aria-label="Kartenstapel auswählen">{(Object.keys(deckNames) as Deck[]).map(value=><button key={value} aria-pressed={deck===value} onClick={()=>setDeck(value)}>{deckNames[value]}<span>{cardsInDeck(cards,value).length}</span></button>)}</div>
      <div className="study-stats" aria-label="Dein Lernstand">
        <div><strong>{data?due:'–'}</strong><span>Jetzt fällig</span></div>
        <div><strong>{data?unseen:'–'}</strong><span>Neue Karten</span></div>
        <div><strong>{data?later:'–'}</strong><span>Für später</span></div>
      </div>
      <div className="study-start-panel">

        {!available.length&&<h3>{!selected.length?'Dein eigener Kartenstapel wartet.':'Für jetzt ist alles wiederholt.'}</h3>}
        <p>{!selected.length?'Speichere zuerst eine Zahl in deiner Sammlung. Sie erscheint anschließend auch hier.':available.length?'Fällige Karten zuerst, danach neue.':nextDue?'Die nächste Karte ist am '+dateLabel(nextDue)+' fällig.':'Du kannst jederzeit eine freie Runde starten.'}</p>
        {!!available.length&&<button className="primary study-start" disabled={!data||!!error} onClick={()=>start('scheduled')}>{available.length} {available.length===1?'Karte':'Karten'} üben <ArrowRight/></button>}
        {!!selected.length&&<button className="textbutton" disabled={!data||!!error} onClick={()=>start('free')}>Alle Karten frei üben</button>}
        {!!selected.length&&<small>Freies Üben verändert deine Wiederholungstermine nicht.</small>}
      </div>
      <details className="study-help"><summary>So funktioniert das Üben</summary><div><p>„Nochmal“ bringt eine Karte nach einer Minute zurück. „Schwer“ hält die Abstände kurz. Mit „Gut“ und „Leicht“ wachsen sie über mehrere Tage. Du kannst eine Runde jederzeit beenden – jede Bewertung wird sofort gespeichert.</p><p>Geänderte Fragen beginnen wieder als neue Karte. Dein Lernstand bleibt auf diesem Gerät und ist in deinen Sicherungen enthalten.</p></div></details>
    </>:<>
      <div className="study-session-head"><button className="textbutton" onClick={finish} disabled={busy}><ArrowLeft/> Runde beenden</button><span>{session.mode==='free'?'Freies Üben':deckNames[deck]}</span></div>
      <div className="study-session-progress"><span>{session.initial-session.remaining.length} von {session.initial} Karten abgeschlossen</span><span>{session.answered} {session.answered===1?'Antwort':'Antworten'}</span></div>
      <progress className="study-progress-bar" aria-label="Abgeschlossene Karten" value={session.initial-session.remaining.length} max={session.initial}/>
      {current?<article className="study-card" data-revealed={revealed} key={current.id}>
        <div className="study-card-body">
        <span className="study-card-kind">{deckNames[current.kind]} · {currentProgress?'Wiederholung':'Neue Karte'}</span>
        <p className="study-question">{current.kind==='collection'?'Welche Zahl gehört zu dieser Bezeichnung?':'Welche Zahl gehört dazu?'}</p>
        <div className="study-prompt"><CardPrompt card={current}/></div>
        {revealed&&current.kind==='collection'&&current.entry.note&&<details className="study-note"><summary>Merkszene anzeigen</summary><p>{current.entry.note}</p></details>}
        </div>
        <div className="study-card-response">
        {!revealed?<button ref={revealButton} className="primary study-reveal" onClick={()=>setRevealed(true)}>Antwort zeigen</button>:<>
          <div className="study-answer" aria-live="polite"><span>Die Zahl</span><strong data-long={current.answer.length>12}>{current.answer}</strong></div>
          {session.mode==='free'?<button ref={gradeButton} className="primary study-reveal" onClick={nextFree}>Nächste Karte <ArrowRight/></button>:<>
            <p className="study-rating-label">Wie gut wusstest du die Antwort?</p>
            <div className="study-ratings">{ratings.map((item,index)=><button key={item.value} ref={index===0?gradeButton:undefined} disabled={busy} className={'study-rating study-rating-'+item.value} onClick={()=>grade(item.value)}><b>{item.label}</b><span>{intervalLabel(scheduleReview(current,currentProgress,item.value,now))}</span></button>)}</div>
          </>}
        </>}
        </div>
      </article>:session.remaining.length?<div className="study-finished"><Clock3 size={42}/><h3>Eine kurze Pause fürs Gedächtnis.</h3><p>{session.remaining.length} {session.remaining.length===1?'Karte kommt':'Karten kommen'} noch einmal dran.</p>{waitingAt&&<><strong className="study-countdown">{countdown(waitingAt,now)}</strong><p>Die nächste Karte erscheint automatisch. Du kannst auch später weiterüben.</p></>}<button className="secondary" onClick={finish}>Zur Übersicht</button></div>:<div className="study-finished" role="status"><Check size={46}/><h3>Runde geschafft.</h3><p>{session.mode==='free'?'Du hast alle Karten in dieser Runde angesehen. Dein Lernplan ist unverändert.':'Deine Bewertungen sind gespeichert. Die Karten kommen zu ihren nächsten Terminen wieder.'}</p><button className="primary" onClick={finish}>Zur Übersicht</button></div>}
      <p className="study-save-status" role="status">{busy?'Lernstand wird gespeichert …':session.mode==='free'?'Freie Runde · Keine Änderung am Lernplan':lastSaved||'Jede Bewertung wird auf diesem Gerät gespeichert.'}</p>
    </>}
  </section>;
}
