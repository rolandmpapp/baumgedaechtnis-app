import { z } from 'zod';
import { encode, cleanNumber } from './memory.ts';
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

export const stateSchema = z.object({
  entries: z.array(entrySchema).max(10000),
  mappings: z.array(mappingSchema).max(111),
  defaultRule: ruleSchema.default(LEGACY_RULE),
}).superRefine((s, ctx) => {
  if (new Set(s.entries.map(e => e.id)).size !== s.entries.length) ctx.addIssue({code:'custom',message:'Doppelte Eintrags-IDs.'});
  if (new Set(s.mappings.map(m => m.kind + ':' + m.n)).size !== s.mappings.length) ctx.addIssue({code:'custom',message:'Doppelte Zuordnungen.'});
});
export type MemoryState = z.infer<typeof stateSchema>;
export const emptyState = (): MemoryState => ({entries: [], mappings: [], defaultRule: {...LEGACY_RULE}});
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export function parseBackup(text: string): MemoryState {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('Die Sicherung darf höchstens 5 MB groß sein.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Die Datei enthält kein gültiges JSON.'); }
  if (raw && typeof raw === 'object' && ('format' in raw || 'version' in raw)) {
    const wrapper = z.object({format: z.literal('baumgedaechtnis'), version: z.literal(1), data: z.unknown()}).safeParse(raw);
    if (!wrapper.success) throw new Error('Dieses Sicherungsformat wird nicht unterstützt.');
    raw = wrapper.data.data;
  }
  const result = stateSchema.safeParse(raw);
  if (!result.success) throw new Error('Die Sicherung enthält ungültige Zahlen, Farben oder Regeln. Es wurde nichts verändert.');
  return result.data;
}

export function serializeBackup(state: MemoryState): string {
  return JSON.stringify({format:'baumgedaechtnis', version:1, exportedAt:new Date().toISOString(), data:stateSchema.parse(state)}, null, 2);
}

export function mutateState(state: MemoryState, method: string, body: unknown, newId: string, now: string) {
  const next = structuredClone(state);
  if (method === 'POST') {
    const input = entryInput.parse(body);
    const entry = { ...input, id:newId, created_at:now, encoding:input.encoding ?? LEGACY_RULE };
    next.entries.unshift(entry);
    return {state:stateSchema.parse(next), entry};
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
    return {state:stateSchema.parse(next), entry};
  } else throw new Error('Unbekannte Speicheraktion.');
  return {state:stateSchema.parse(next), entry:undefined};
}
