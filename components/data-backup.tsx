import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup, type MemoryState } from '../lib/local-data';
import { readMemory, restoreMemory } from '../lib/local-store';

export function DataBackup({onRestored, disabled}: {onRestored:()=>Promise<void>; disabled:boolean}) {
  const picker = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<MemoryState | null>(null);
  const [busy, setBusy] = useState(false);
  async function exportData() {
    setBusy(true);
    try {
      const content = serializeBackup(await readMemory());
      const url = URL.createObjectURL(new Blob([content], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'baumgedaechtnis-sicherung-' + new Date().toISOString().slice(0,10) + '.json';
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success('Sicherung erstellt. Bewahre die Datei in „Dateien“ auf.');
    } catch (error) {toast.error((error as Error).message);}
    finally {setBusy(false);}
  }
  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Die Sicherung darf höchstens 5 MB groß sein.');
      setPending(parseBackup(await file.text()));
    } catch (error) {toast.error((error as Error).message);}
  }
  async function restore() {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreMemory(pending);
      setPending(null);
      await onRestored();
      toast.success('Deine Sammlung und Einstellungen wurden wiederhergestellt.');
    } catch (error) {toast.error((error as Error).message);}
    finally {setBusy(false);}
  }
  return <section className="backup-panel" aria-labelledby="backup-title">
    <div className="backup-heading"><HardDrive aria-hidden/><h3 id="backup-title">Auf diesem Gerät gespeichert</h3></div>
    <p>Deine Zahlen, Farben und Regeln bleiben in diesem Browser bzw. dieser installierten App. Sie werden nicht zu GitHub hochgeladen und nicht automatisch mit anderen Geräten synchronisiert.</p>
    <p>Erstelle regelmäßig eine Sicherung: Beim Löschen von Website-Daten oder beim Gerätewechsel kann die lokale Sammlung verloren gehen. Mit einer Sicherungsdatei kannst du sie auch auf ein anderes Gerät übertragen.</p>
    <p>Die lokale Sammlung und Sicherungsdateien sind nicht verschlüsselt. Bewahre Sicherungen privat auf.</p>
    <div className="backup-actions">
      <button className="secondary" disabled={disabled || busy} onClick={exportData}><Download/> Sicherung exportieren</button>
      <button className="secondary" disabled={disabled || busy} onClick={()=>picker.current?.click()}><Upload/> Sicherung importieren</button>
    </div>
    <input ref={picker} className="sr-only" type="file" accept="application/json,.json" aria-label="Sicherungsdatei auswählen" onChange={selectBackup}/>
    <AlertDialog open={!!pending} onOpenChange={open=>{if(!open && !busy)setPending(null)}}>
      <AlertDialogContent><AlertDialogHeader>
        <AlertDialogTitle>Sicherung wiederherstellen?</AlertDialogTitle>
        <AlertDialogDescription>Die Datei enthält {pending?.entries.length ?? 0} Zahlen und {pending?.mappings.length ?? 0} persönliche Zuordnungen sowie {pending?.reviews.length ?? 0} Lernstände. Sie ersetzt deine gesamte Sammlung, Farben, Regeln und Lernstände auf diesem Gerät. Exportiere vorher eine Sicherung, wenn du die aktuellen Daten behalten möchtest.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
        <AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();void restore();}}>Sammlung ersetzen</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}
