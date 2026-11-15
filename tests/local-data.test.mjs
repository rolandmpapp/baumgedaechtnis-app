import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, mutateState, parseBackup, serializeBackup, MAX_BACKUP_BYTES} from '../lib/local-data.ts';
import {encode} from '../lib/memory.ts';
const now = '2026-11-15T12:00:00.000Z';
const input = {number:'00123', title:'Testzahl', note:'Eine Szene', encoding:{mode:'custom', useColors:true, pattern:[2,3]}};
const create = () => mutateState(emptyState(), 'POST', input, 'test-entry', now).state;
test('leading zeros, notes and custom grouping survive backup', () => {
  const data = create();
  assert.deepEqual(parseBackup(serializeBackup(data)), data);
  assert.equal(data.entries[0].number, '00123');
  assert.deepEqual(encode(data.entries[0].number, undefined, undefined, data.entries[0].encoding).map(p=>p.digits), ['00','123']);
});
test('edit preserves identity and original state', () => {
  const before = create();
  const after = mutateState(before,'PUT',{...before.entries[0],title:'Geändert',number:'12345'},'unused',now).state;
  assert.equal(before.entries[0].title,'Testzahl');
  assert.equal(after.entries[0].id,'test-entry');
  assert.equal(after.entries[0].created_at,now);
  assert.equal(after.entries[0].title,'Geändert');
});
test('all personal mappings and default rule survive backup', () => {
  let state=create();
  for (const m of [{kind:'symbol',n:1,name:'Eiche'},{kind:'color',n:3,name:'Orange',hex:'#ff8800'},{kind:'default',n:0,name:'Standardfarbe',hex:'#111111'}]) state=mutateState(state,'PUT',m,'',now).state;
  state=mutateState(state,'PUT',{kind:'rules',encoding:{mode:'pairs',useColors:false}},'',now).state;
  assert.deepEqual(parseBackup(serializeBackup(state)),state);
  assert.equal(state.mappings.length,3);
  assert.equal(state.defaultRule.useColors,false);
});
test('legacy API export accepts nullable encoding and hex', () => {
  const data=create();
  const legacy={entries:[{...data.entries[0],encoding:null}],mappings:[{kind:'symbol',n:1,name:'Baum',hex:null}],defaultRule:{mode:'auto',useColors:true}};
  const parsed=parseBackup(JSON.stringify(legacy));
  assert.equal(parsed.entries[0].encoding,null);
  assert.equal(parsed.mappings[0].hex,undefined);
});
test('bad imports reject entirely before any data is written', () => {
  const state=create();
  for (const text of ['{','{}',JSON.stringify({format:'baumgedaechtnis',version:2,data:state}),JSON.stringify({...state,entries:[{...state.entries[0],number:'abc'}]}),JSON.stringify({...state,entries:[{...state.entries[0],number:'348',encoding:{mode:'triples',useColors:false}}]}),JSON.stringify({...state,entries:[state.entries[0],state.entries[0]]}),JSON.stringify({...state,mappings:[{kind:'color',n:10,name:'Bad',hex:'#ffffff'}]}),JSON.stringify({...state,mappings:[{kind:'color',n:3,name:'Bad',hex:'red'}]}),JSON.stringify({...state,defaultRule:{mode:'custom',useColors:true,pattern:[]}}),JSON.stringify({...state,entries:[{...state.entries[0],created_at:'yesterday'}]}),' '.repeat(MAX_BACKUP_BYTES+1)]) assert.throws(()=>parseBackup(text));
  assert.deepEqual(state,create());
});
test('invalid writes do not alter the original state', () => {
  const state=create();
  assert.throws(()=>mutateState(state,'POST',{...input,number:'123',encoding:{mode:'triples',useColors:false}},'x',now));
  assert.throws(()=>mutateState(state,'PUT',{kind:'symbol',n:101,name:'Bad'},'',now));
  assert.throws(()=>mutateState(state,'PUT',{...input,id:'missing'},'',now));
  assert.throws(()=>mutateState(state,'DELETE',{id:'missing'},'',now));
  assert.equal(mutateState(state,'DELETE',{id:'test-entry'},'',now).state.entries.length,0);
  assert.equal(state.entries.length,1);
});
test('special symbols and number splitting remain compatible', () => {
  assert.equal(encode('348')[0].symbol.name,'Teller');
  assert.equal(encode('348')[0].color.name,'Orange');
  assert.equal(encode('100',undefined,undefined,{mode:'auto',useColors:false})[0].symbol.name,'Haare');
  assert.equal(encode('0')[0].symbol.name,'Null');
  assert.deepEqual(encode('348',undefined,undefined,{mode:'auto',useColors:false}).map(p=>p.digits),['34','8']);
});

test('imported unknown fields and prototype keys are discarded', () => {
  const data=create();
  const payload=JSON.parse(JSON.stringify(data));
  payload.entries[0].html='<img src=x onerror=alert(1)>';
  Object.defineProperty(payload.entries[0],'__proto__',{value:{polluted:true},enumerable:true});
  payload.secret='ignored';
  const restored=parseBackup(JSON.stringify(payload));
  assert.equal('html' in restored.entries[0],false);
  assert.equal('secret' in restored,false);
  assert.equal(Object.hasOwn(restored.entries[0],'__proto__'),false);
  assert.equal({}.polluted,undefined);
});
test('oversized collections reject without mutating the active collection', () => {
  const data=create();
  const huge={...data,entries:Array.from({length:10001},(_,i)=>({...data.entries[0],id:String(i)}))};
  assert.throws(()=>parseBackup(JSON.stringify(huge)));
  assert.equal(data.entries.length,1);
});
