import type { Rating } from './repetition.ts';
import { emptyState, mutateState, stateSchema, applyReview, type MemoryState } from './local-data.ts';

const DB_NAME = 'baumgedaechtnis-local-v1';
let opening: Promise<IDBDatabase> | undefined;
function database() {
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      // Retain the existing collection. Version 2 prevents older app tabs from
      // stripping the new review records when they save an entry.
      if (!request.result.objectStoreNames.contains('memory')) request.result.createObjectStore('memory');
    };
    request.onerror = () => reject(new Error('Der Gerätespeicher konnte nicht geöffnet werden. Bitte erlaube Website-Daten in deinem Browser.'));
    request.onblocked = () => reject(new Error('Bitte schließe andere Fenster dieser App und versuche es erneut.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = undefined; };
      resolve(db);
    };
  }).catch(error => {opening = undefined; throw error;});
  return opening;
}

async function transact<T>(write: boolean, operation: (state: MemoryState) => {state?: MemoryState; result:T}): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('memory', write ? 'readwrite' : 'readonly');
    const objectStore = tx.objectStore('memory');
    let result:T;
    let failure:Error | undefined;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? new Error('Speichern fehlgeschlagen. Möglicherweise ist der Gerätespeicher voll. Deine bisherigen Daten bleiben erhalten.'));
    tx.onerror = () => { /* onabort owns the error and rejects after rollback */ };
    const read = objectStore.get('state');
    read.onsuccess = () => {
      try {
        const parsed = read.result === undefined ? emptyState() : stateSchema.parse(read.result);
        const value = operation(parsed);
        result = value.result;
        if (write && value.state) objectStore.put(stateSchema.parse(value.state), 'state');
      } catch (error) {
        failure = error instanceof Error && error.name !== 'ZodError' ? error : new Error('Die Zahlen, Farben oder Regeln sind ungültig. Deine bisherigen Daten bleiben erhalten.');
        tx.abort();
      }
    };
  });
}

export const readMemory = () => transact(false, state => ({result:state}));
export const restoreMemory = (input: MemoryState) => transact(true, () => {
  const state = stateSchema.parse(input);
  return {state, result:state};
});
export async function memoryApi(method = 'GET', body?: unknown) {
  return transact(method !== 'GET', state => {
    if (method === 'GET') return {result:{...state, entry:undefined}};
    const changed = mutateState(state, method, body, crypto.randomUUID(), new Date().toISOString());
    return {state:changed.state, result:{...changed.state, entry:changed.entry}};
  });
}

export async function recordReview(cardId:string, fingerprint:string, rating:Rating, expectedReviews:number) {
  return transact(true,state=>{
    const changed=applyReview(state,cardId,fingerprint,rating,expectedReviews,Date.now());
    return {state:changed.state,result:{reviews:changed.state.reviews,review:changed.review}};
  });
}
