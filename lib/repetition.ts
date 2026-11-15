import type { Entry, SymbolItem, ColorItem } from './memory.ts';
import { LEGACY_RULE } from './number-rules.ts';

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type Deck = 'all' | 'symbols' | 'colors' | 'collection';
export type Review = {
  cardId: string;
  fingerprint: string;
  dueAt: string;
  reviewedAt: string;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
  reviews: number;
  rating: Rating;
};
type CardBase = {id:string; fingerprint:string; answer:string};
export type StudyCard = CardBase & (
  {kind:'symbols'; symbol:SymbolItem} |
  {kind:'colors'; color:ColorItem} |
  {kind:'collection'; entry:Entry}
);
export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
const MAX_INTERVAL = 3650;

// The exact question/answer content identifies a card revision. Notes are only hints.
export function buildStudyCards(entries:Entry[], symbols:SymbolItem[], colors:ColorItem[]):StudyCard[] {
  return [
    ...symbols.map(symbol => ({kind:'symbols' as const, id:'s:'+symbol.n, answer:String(symbol.n), symbol, fingerprint:JSON.stringify([symbol.n,symbol.name,symbol.icon])})),
    ...colors.map(color => ({kind:'colors' as const, id:'c:'+color.n, answer:String(color.n), color, fingerprint:JSON.stringify([color.n,color.name,color.hex])})),
    ...entries.map(entry => ({kind:'collection' as const, id:'e:'+entry.id, answer:entry.number, entry, fingerprint:JSON.stringify([entry.title,entry.number,entry.encoding??LEGACY_RULE])})),
  ];
}
export function matchingReview(card:StudyCard, reviews:Map<string,Review>):Review | undefined {
  const review=reviews.get(card.id);
  return review?.fingerprint===card.fingerprint ? review : undefined;
}
export function cardsInDeck(cards:StudyCard[], deck:Deck) {
  return deck==='all' ? cards : cards.filter(card=>card.kind===deck);
}
export function availableCards(cards:StudyCard[], reviews:Map<string,Review>, now:number) {
  return cards.filter(card=>{
    const progress=matchingReview(card,reviews);
    return !progress || Date.parse(progress.dueAt)<=now;
  }).sort((a,b)=>{
    const aProgress=matchingReview(a,reviews), bProgress=matchingReview(b,reviews);
    if (aProgress && bProgress) return Date.parse(aProgress.dueAt)-Date.parse(bProgress.dueAt);
    return aProgress ? -1 : bProgress ? 1 : 0;
  });
}

export function sessionCards(cards:StudyCard[], reviews:Map<string,Review>, now:number, free=false, random= Math.random) {
  const available=free?[...cards]:availableCards(cards,reviews,now);
  const due=free?[]:available.filter(card=>matchingReview(card,reviews));
  const fresh=free?available:available.filter(card=>!matchingReview(card,reviews));
  // Avoid revealing the answer through a predictable 1, 2, 3 ... card order.
  for(let i=fresh.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[fresh[i],fresh[j]]=[fresh[j],fresh[i]];}
  return [...due,...fresh];
}

// SM-2-inspired intervals, with explicit 1/10-minute relearning steps.
// This is a simple deterministic scheduler, not FSRS or a fitted retention model.
export function scheduleReview(card:StudyCard, previous:Review | undefined, rating:Rating, now:number):Review {
  if (!Number.isFinite(now)) throw new Error('Die Gerätezeit ist ungültig.');
  const old=previous?.fingerprint===card.fingerprint ? previous : undefined;
  const oldEase=old?.ease??2.5;
  let ease=oldEase, days=0, minutes=0, repetitions=old?.repetitions??0;
  const inLearning=!old || old.intervalDays===0;
  if (rating==='again') {
    minutes=1; ease=Math.max(1.3,oldEase-0.2); repetitions=0;
  } else if (rating==='hard') {
    ease=Math.max(1.3,oldEase-0.15);
    if (inLearning) {minutes=10; repetitions=0;}
    else {days=Math.ceil(old.intervalDays*1.2); repetitions++;}
  } else {
    const goodDays=inLearning ? 1 : repetitions===1 ? Math.max(6,Math.round(old.intervalDays*oldEase)) : Math.max(old.intervalDays+1,Math.round(old.intervalDays*oldEase));
    if (rating==='easy') {
      days=inLearning ? 4 : Math.max(goodDays+1,Math.ceil(goodDays*1.3));
      ease=Math.min(3,oldEase+0.15);
    } else days=goodDays;
    repetitions++;
  }
  days=Math.min(MAX_INTERVAL,days);
  return {
    cardId:card.id, fingerprint:card.fingerprint,
    dueAt:new Date(now+(minutes?minutes*MINUTE:days*DAY)).toISOString(),
    reviewedAt:new Date(now).toISOString(), intervalDays:days,
    ease:Math.round(ease*100)/100, repetitions,
    lapses:(old?.lapses??0)+(rating==='again'?1:0),
    reviews:(old?.reviews??0)+1, rating,
  };
}
export function intervalLabel(review:Review) {
  if (review.intervalDays>0) return review.intervalDays===1?'1 Tag':review.intervalDays+' Tage';
  return Math.round((Date.parse(review.dueAt)-Date.parse(review.reviewedAt))/MINUTE)+' Min.';
}
export function nextReadyId(ids:string[], cards:Map<string,StudyCard>, reviews:Map<string,Review>, now:number, free=false) {
  return ids.find(id=>{
    const card=cards.get(id);
    if (!card) return false;
    const progress=matchingReview(card,reviews);
    return free || !progress || Date.parse(progress.dueAt)<=now;
  })??null;
}
