import { z } from 'zod';
import { buildStudyCards, scheduleReview, type Rating } from './repetition.ts';
import { encode, cleanNumber, applyMappings } from './memory.ts';
import { LEGACY_RULE } from './number-rules.ts';

export const ruleSchema = z.object({
  mode: z.enum(['auto', 'single', 'pairs', 'triples', 'custom']),
  useColors: z.boolean(),
  pattern: z.array(z.number().int().min(1).max(3)).min(1).max(60).optional(),
}).refine(r => r.mode !== 'custom' || !!r.pattern?.length, 'Eigene Gruppengrößen fehlen.');

const entryFields = {
  number: z.string().transform(cleanNumber).pipe(z.string().regex(/^\d{1,60}$/)),
  title: z.string().trim().min(1).max(100),
  note: z.string().max(2000).default(''),
  encoding: ruleSchema.nullish(),
};
const validEncoding = (e: {number: string; encoding?: z.infer<typeof ruleSchema> | null}) => {
  try { encode(e.number, undefined, undefined, e.encoding ?? LEGACY_RULE); return true; }
  catch { return false; }
};
const entryInput = z.object(entryFields).refine(validEncoding, 'Zahl und Aufteilungsregel passen nicht zusammen.');
const entrySchema = z.object({
  ...entryFields,
  id: z.string().min(1).max(200),
  created_at: z.string().datetime({offset: true}),
}).refine(validEncoding, 'Eine gespeicherte Zahl hat eine ungültige Aufteilung.');
const mappingSchema = z.object({
  kind: z.enum(['symbol', 'color', 'default']),
  n: z.number().int(),
  name: z.string().trim().min(1).max(80),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
}).superRefine((m, ctx) => {
  const validNumber = m.kind === 'symbol' ? m.n >= 1 && m.n <= 100 : m.kind === 'color' ? m.n >= 0 && m.n <= 9 : m.n === 0;
  if (!validNumber || (m.kind !== 'symbol' && !m.hex)) ctx.addIssue({code:'custom', message:'Ungültige Farb- oder Symbolzuordnung.'});
}).transform(m => ({...m, hex: m.hex ?? undefined}));

export const reviewSchema = z.object({
  cardId:z.string().min(3).max(202).regex(/^(s:|c:|e:)/),
  fingerprint:z.string().min(1).max(1000),
  dueAt:z.string().datetime({offset:true}),
  reviewedAt:z.string().datetime({offset:true}),
  intervalDays:z.number().int().min(0).max(3650),
  ease:z.number().min(1.3).max(3),
  repetitions:z.number().int().min(0).max(1000000),
  lapses:z.number().int().min(0).max(1000000),
  reviews:z.number().int().min(1).max(1000000),
  rating:z.enum(['again','hard','good','easy']),
}).refine(r=>Date.parse(r.dueAt)>Date.parse(r.reviewedAt), 'Ungültiger Wiederholungstermin.');

export const stateSchema = z.object({
  entries: z.array(entrySchema).max(10000),
  mappings: z.array(mappingSchema).max(111),
  defaultRule: ruleSchema.default(LEGACY_RULE),
  reviews:z.array(reviewSchema).max(10110).default([]),
}).superRefine((s, ctx) => {
  if (new Set(s.reviews.map(r => r.cardId)).size !== s.reviews.length) ctx.addIssue({code:'custom',message:'Doppelte Lernstände.'});
  if (new Set(s.entries.map(e => e.id)).size !== s.entries.length) ctx.addIssue({code:'custom',message:'Doppelte Eintrags-IDs.'});
  if (new Set(s.mappings.map(m => m.kind + ':' + m.n)).size !== s.mappings.length) ctx.addIssue({code:'custom',message:'Doppelte Zuordnungen.'});
});
export type MemoryState = z.infer<typeof stateSchema>;
export const emptyState = (): MemoryState => ({entries: [], mappings: [], defaultRule: {...LEGACY_RULE}, reviews:[]});
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export function parseBackup(text: string): MemoryState {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('Die Sicherung darf höchstens 5 MB groß sein.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Die Datei enthält kein gültiges JSON.'); }
  if (raw && typeof raw === 'object' && ('format' in raw || 'version' in raw)) {
    const wrapper = z.object({format: z.literal('baumgedaechtnis'), version: z.union([z.literal(1),z.literal(2)]), data: z.unknown()}).safeParse(raw);
    if (!wrapper.success) throw new Error('Dieses Sicherungsformat wird nicht unterstützt.');
    raw = wrapper.data.data;
  }
  const result = stateSchema.safeParse(raw);
  if (!result.success) throw new Error('Die Sicherung enthält ungültige Zahlen, Farben oder Regeln. Es wurde nichts verändert.');
  return pruneReviews(result.data);
}

export function serializeBackup(state: MemoryState): string {
  return JSON.stringify({format:'baumgedaechtnis', version:2, exportedAt:new Date().toISOString(), data:stateSchema.parse(state)}, null, 2);
}

export function mutateState(state: MemoryState, method: string, body: unknown, newId: string, now: string) {
  const next = structuredClone(state);
  if (method === 'POST') {
    const input = entryInput.parse(body);
    const entry = { ...input, id:newId, created_at:now, encoding:input.encoding ?? LEGACY_RULE };
    next.entries.unshift(entry);
    return {state:pruneReviews(stateSchema.parse(next)), entry};
  }
  const p = z.object({id:z.string().optional(), kind:z.string().optional()}).parse(body);
  if (method === 'DELETE') {
    if (!p.id || !next.entries.some(e => e.id === p.id)) throw new Error('Dieser Eintrag wurde nicht gefunden.');
    next.entries = next.entries.filter(e => e.id !== p.id);
  } else if (method === 'PUT' && p.kind === 'rules') {
    next.defaultRule = z.object({encoding:ruleSchema}).parse(body).encoding;
  } else if (method === 'PUT' && p.kind) {
    const mapping = mappingSchema.parse(body);
    next.mappings = [...next.mappings.filter(m => !(m.kind === mapping.kind && m.n === mapping.n)), mapping];
  } else if (method === 'PUT') {
    const old = next.entries.find(e => e.id === p.id);
    if (!old) throw new Error('Dieser Eintrag wurde nicht gefunden.');
    const input = entryInput.parse(body);
    const entry = {...old, ...input, encoding:input.encoding ?? old.encoding ?? LEGACY_RULE};
    next.entries = next.entries.map(e => e.id === entry.id ? entry : e);
    return {state:pruneReviews(stateSchema.parse(next)), entry};
  } else throw new Error('Unbekannte Speicheraktion.');
  return {state:pruneReviews(stateSchema.parse(next)), entry:undefined};
}

// Edited or deleted questions must never inherit a stale learning schedule.
export function pruneReviews(state:MemoryState):MemoryState {
  const mappings=applyMappings(state.mappings);
  const versions=new Map(buildStudyCards(state.entries,mappings.symbols,mappings.colors).map(c=>[c.id,c.fingerprint]));
  return {...state,reviews:state.reviews.filter(r=>versions.get(r.cardId)===r.fingerprint)};
}

export function applyReview(state:MemoryState, cardId:string, fingerprint:string, rating:Rating, expectedReviews:number, now:number) {
  const mappings=applyMappings(state.mappings);
  const card=buildStudyCards(state.entries,mappings.symbols,mappings.colors).find(c=>c.id===cardId);
  if (!card || card.fingerprint!==fingerprint) throw new Error('Diese Karte wurde inzwischen geändert. Öffne die Üben-Seite erneut.');
  const previous=state.reviews.find(r=>r.cardId===cardId && r.fingerprint===fingerprint);
  if ((previous?.reviews??0)!==expectedReviews) throw new Error('Der Lernstand wurde in einem anderen Fenster geändert. Bitte lade ihn neu.');
  const review=scheduleReview(card,previous,rating,now);
  const next=stateSchema.parse({...state,reviews:[...state.reviews.filter(r=>r.cardId!==cardId),review]});
  return {state:next,review};
}
