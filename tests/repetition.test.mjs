import test from 'node:test';
import assert from 'node:assert/strict';
import { symbols, colors } from '../lib/memory.ts';
import { availableCards, buildStudyCards, cardsInDeck, scheduleReview, matchingReview, nextReadyId, sessionCards, DAY, MINUTE } from '../lib/repetition.ts';
import { emptyState, applyReview, mutateState, parseBackup, serializeBackup, stateSchema } from '../lib/local-data.ts';

const now=Date.parse('2026-11-15T12:00:00Z');
const cards=buildStudyCards([],symbols,colors);
const first=cards[0];
const map=reviews=>new Map(reviews.map(r=>[r.cardId,r]));
const cardMap=new Map(cards.map(c=>[c.id,c]));
const grade=(state,card=first,rating='good',time=now,expected=0)=>applyReview(state,card.id,card.fingerprint,rating,expected,time);

test('sessions prioritize due cards and shuffle new cards without omissions',()=>{
  const review=scheduleReview(first,undefined,'again',now-2*MINUTE);
  const queue=sessionCards(cards,map([review]),now,false,()=>0);
  assert.equal(queue[0].id,first.id);
  assert.equal(queue.length,cards.length);
  assert.equal(new Set(queue.map(c=>c.id)).size,cards.length);
  assert.notDeepEqual(queue.slice(1).map(c=>c.id),cards.slice(1).map(c=>c.id));
  const free=sessionCards(cards,map([review]),now,true,()=>0);
  assert.equal(free.length,cards.length);
  assert.notEqual(free[0].id,first.id);
});

test('all symbols, colors and personal numbers have stable, distinct card IDs',()=>{
  const own={id:'test-entry',title:'Testzahl',number:'00123',note:'',created_at:new Date(now).toISOString()};
  const all=buildStudyCards([own],symbols,colors);
  assert.equal(all.length,111);
  assert.equal(new Set(all.map(c=>c.id)).size,111);
  assert.equal(cardsInDeck(all,'symbols').length,100);
  assert.equal(cardsInDeck(all,'colors').length,10);
  assert.equal(cardsInDeck(all,'collection')[0].answer,'00123');
  assert.equal(all.find(c=>c.id==='c:0').answer,'0');
});
test('new cards use distinct, deterministic learning intervals',()=>{
  for(const [rating,delay] of [['again',MINUTE],['hard',10*MINUTE],['good',DAY],['easy',4*DAY]]){
    const r=scheduleReview(first,undefined,rating,now);
    assert.equal(Date.parse(r.dueAt)-now,delay);
    assert.equal(r.reviews,1);
  }
});
test('successful reviews expand from one to six to fifteen days',()=>{
  let review=scheduleReview(first,undefined,'good',now);
  review=scheduleReview(first,review,'good',Date.parse(review.dueAt));
  assert.equal(review.intervalDays,6);
  review=scheduleReview(first,review,'good',Date.parse(review.dueAt));
  assert.equal(review.intervalDays,15);
  assert.equal(review.reviews,3);
  assert.equal(review.repetitions,3);
});
test('a forgotten mature card relearns, preserving review history',()=>{
  const old=scheduleReview(first,undefined,'easy',now);
  const forgotten=scheduleReview(first,old,'again',now+4*DAY);
  assert.equal(forgotten.intervalDays,0);
  assert.equal(forgotten.repetitions,0);
  assert.equal(forgotten.lapses,1);
  assert.equal(forgotten.reviews,2);
  assert.equal(Date.parse(forgotten.dueAt),now+4*DAY+MINUTE);
  const relearned=scheduleReview(first,forgotten,'good',Date.parse(forgotten.dueAt));
  assert.equal(relearned.intervalDays,1);
});
test('hard, good and easy mature intervals increase in order and remain bounded',()=>{
  const old=scheduleReview(first,undefined,'good',now);
  const days=['hard','good','easy'].map(r=>scheduleReview(first,old,r,now+DAY).intervalDays);
  assert(days[0]<days[1]&&days[1]<days[2]);
  let review=old;
  for(let i=0;i<100;i++)review=scheduleReview(first,review,'easy',now);
  assert.equal(review.intervalDays,3650);
  assert.equal(review.ease,3);
  for(let i=0;i<100;i++)review=scheduleReview(first,review,'again',now);
  assert.equal(review.ease,1.3);
  assert.throws(()=>scheduleReview(first,undefined,'good',NaN));
});
test('due cards precede new cards; future cards are excluded',()=>{
  const older=scheduleReview(cards[2],undefined,'again',now-2*MINUTE);
  const future=scheduleReview(cards[0],undefined,'good',now);
  const reviews=map([older,future]);
  const available=availableCards(cards,reviews,now);
  assert.equal(available[0].id,cards[2].id);
  assert(!available.some(c=>c.id===cards[0].id));
  assert.equal(available.length,109);
});
test('relearning waits until its exact due time and free practice can include future cards',()=>{
  const review=scheduleReview(first,undefined,'again',now);
  const reviews=map([review]);
  assert.equal(nextReadyId([first.id],cardMap,reviews,now+MINUTE-1),null);
  assert.equal(nextReadyId([first.id],cardMap,reviews,now+MINUTE),first.id);
  assert.equal(nextReadyId([first.id],cardMap,reviews,now,true),first.id);
  assert.equal(review.reviews,1);
});
test('old stored data and version-one backups migrate without changing the collection',()=>{
  const old={entries:[],mappings:[{kind:'symbol',n:1,name:'Eiche'}],defaultRule:{mode:'pairs',useColors:false}};
  const migrated=stateSchema.parse(old);
  assert.deepEqual(migrated.reviews,[]);
  assert.deepEqual(migrated.mappings,old.mappings.map(m=>({...m,hex:undefined})));
  assert.deepEqual(parseBackup(JSON.stringify({format:'baumgedaechtnis',version:1,data:old})),migrated);
});
test('version-two backups preserve exact due dates and review history',()=>{
  const state=grade(emptyState()).state;
  const text=serializeBackup(state);
  assert.equal(JSON.parse(text).version,2);
  assert.deepEqual(parseBackup(text),state);
});
test('concurrent or duplicate ratings cannot silently double-count a review',()=>{
  const state=grade(emptyState()).state;
  assert.throws(()=>grade(state,first,'good',now,0),/anderen Fenster/);
  assert.equal(state.reviews[0].reviews,1);
  const next=grade(state,first,'good',now+DAY,1).state;
  assert.equal(next.reviews[0].reviews,2);
});
test('changed symbol or color cards lose only their own old learning schedule',()=>{
  let state=grade(emptyState()).state;
  const color=cards.find(c=>c.id==='c:0');
  state=grade(state,color).state;
  const renamed=mutateState(state,'PUT',{kind:'symbol',n:1,name:'Eiche'},'',new Date(now).toISOString()).state;
  assert.equal(renamed.reviews.length,1);
  assert.equal(renamed.reviews[0].cardId,'c:0');
  assert.throws(()=>grade(renamed,first),/geändert/);
  const changedCard={...first,fingerprint:'a different question'};
  assert.equal(matchingReview(changedCard,map(state.reviews)),undefined);
});
test('personal-number edits and deletion remove stale review data; note edits retain it',()=>{
  let state=mutateState(emptyState(),'POST',{title:'Test',number:'00123',note:''},'own',new Date(now).toISOString()).state;
  const own=buildStudyCards(state.entries,symbols,colors).find(c=>c.kind==='collection');
  state=grade(state,own).state;
  const noted=mutateState(state,'PUT',{...state.entries[0],note:'Neue Notiz'},'',new Date(now).toISOString()).state;
  assert.equal(noted.reviews.length,1);
  const changed=mutateState(state,'PUT',{...state.entries[0],number:'999'},'',new Date(now).toISOString()).state;
  assert.equal(changed.reviews.length,0);
  const deleted=mutateState(state,'DELETE',{id:'own'},'',new Date(now).toISOString()).state;
  assert.equal(deleted.reviews.length,0);
});
test('invalid learning data cannot be imported',()=>{
  const state=grade(emptyState()).state;
  for(const reviews of [[{...state.reviews[0],ease:0}],[{...state.reviews[0],dueAt:'invalid'}],[{...state.reviews[0],dueAt:state.reviews[0].reviewedAt}],[state.reviews[0],state.reviews[0]]]){
    assert.throws(()=>parseBackup(JSON.stringify({...state,reviews})));
  }
});
