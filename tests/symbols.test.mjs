import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {symbols,colors} from '../lib/memory.ts';
import {symbolIcons} from '../lib/symbol-icons.ts';
import {buildStudyCards,matchingReview,scheduleReview,DAY} from '../lib/repetition.ts';
import {emptyState,applyReview,pruneReviews,mutateState} from '../lib/local-data.ts';

test('every default memory image exists and renders as a self-contained SVG',()=>{
  assert.equal(symbols.length,100);
  for(const symbol of symbols){
    assert(symbolIcons[symbol.icon], 'Missing image for '+symbol.n+' '+symbol.name);
    const svg=renderToStaticMarkup(createElement(symbolIcons[symbol.icon],{size:48}));
    assert(svg.includes('viewBox="0 0 24 24"'));
    assert(!/<(?:image|text|script|foreignObject)\b/.test(svg));
  }
  assert.equal(symbols[2].icon,'ThreeLeggedStool');
  assert.equal(symbols[55].icon,'Armchair');
});
test('updated drawings preserve existing spaced-repetition progress',()=>{
  const now=Date.parse('2026-11-15T12:00:00Z');
  const card=buildStudyCards([],symbols,colors).find(c=>c.id==='s:3');
  const review={...scheduleReview(card,undefined,'good',now),fingerprint:JSON.stringify([3,'Hocker','Armchair'])};
  const state={...emptyState(),reviews:[review]};
  assert.equal(matchingReview(card,new Map([['s:3',review]])).reviews,1);
  const migrated=pruneReviews(state);
  assert.equal(migrated.reviews[0].dueAt,review.dueAt);
  assert.equal(migrated.reviews[0].fingerprint,card.fingerprint);
  const next=applyReview(state,card.id,card.fingerprint,'good',1,now+DAY);
  assert.equal(next.review.reviews,2);
  assert.equal(next.review.intervalDays,6);
  const renamed=mutateState(state,'PUT',{kind:'symbol',n:3,name:'Schemel'},'',new Date(now).toISOString()).state;
  assert.equal(renamed.reviews.length,0);
});
