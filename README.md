# Baumgedächtnis

Zahlen als Merkbilder verstehen, speichern und lernen. Eine installierbare Web-App für GitHub Pages mit 100 Symbolen, zehn anpassbaren Farben und eigenen Regeln für Zahlengruppen.

## Auf dem iPhone

Nach der Veröffentlichung: **https://rolandmpapp.github.io/baumgedaechtnis-app/**

1. Die Adresse in Safari öffnen und auf „Offline bereit“ warten.
2. Teilen → Zu Home-Bildschirm hinzufügen.
3. „Als Web-App öffnen“ aktivieren, falls angezeigt, und hinzufügen.
4. Die installierte App einmal mit Internet öffnen. Danach sind Lernen und Speichern offline möglich.

## Daten und Sicherungen

- Die Sammlung, persönlichen Symbole, Farben und Regeln liegen in IndexedDB auf dem jeweiligen Gerät bzw. im jeweiligen Browser.
- Keine Anmeldung, keine Server-Datenbank, keine Verbindung zu ChatGPT, GPT-Sites oder Hostinger ist erforderlich.
- GitHub liefert ausschließlich die öffentlichen App-Dateien. Persönliche Einträge werden nicht zu GitHub übertragen. GitHub verarbeitet beim Abruf der Website gewöhnliche Verbindungsdaten.
- Unter **Listen → Auf diesem Gerät gespeichert** eine JSON-Sicherung exportieren oder importieren. Der Import ersetzt erst nach Bestätigung die lokale Sammlung und Einstellungen.
- Es gibt keine automatische Synchronisation zwischen Geräten. Beim Löschen von Website-Daten, bei einer Neuinstallation oder einem Gerätewechsel können lokale Daten verloren gehen. Sicherungen außerhalb der App aufbewahren.
- Der Browser und die installierte Web-App können getrennte Speicher verwenden. Sicherungen im tatsächlich verwendeten App-Fenster erstellen und importieren.

Eine Sicherung verwendet `format: baumgedaechtnis`, `version: 1` und unter `data` die Felder `entries`, `mappings` und `defaultRule`. Auch die JSON-Antwort der bisherigen App unter `/api/memory` lässt sich importieren. Alte Daten werden nicht automatisch von der anderen Webadresse übernommen. Persönliche Sicherungen niemals in dieses Repository hochladen.

## Entwicklung

Node.js 24 und npm:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Der Basispfad ist `/baumgedaechtnis-app/` und kann in `vite.config.ts` geändert werden. Die gebaute App liegt vollständig in `dist/`. Nur die Produktionsvorschau bzw. veröffentlichte App registriert den Service Worker. Ein neuer Build erhält einen eigenen Offline-Cache. Die App bietet „Neue Version laden“ an, sobald ein Update bereitsteht.

## Veröffentlichung

In GitHub **Settings → Pages → Source: GitHub Actions** wählen. Der Workflow prüft Tests und Build und veröffentlicht anschließend `dist/`. Er läuft bei einem Push auf `main` oder manuell unter Actions. Die Veröffentlichung ist während der Vorbereitung auf ein privates Repository deaktiviert. Für GitHub Pages mit GitHub Free muss das Repository öffentlich sein; die Umstellung erfolgt bewusst durch den Eigentümer.

## Technik

React, TypeScript, Vite und Tailwind CSS; Browser-IndexedDB für atomare lokale Speicherung. Diese öffentliche Ausgabe enthält ausschließlich den geprüften App-Stand ohne frühere private Projekthistorie. Der aktuelle Build enthält keinen Server und keine Plattform-Anmeldung.

## Sicherheitsgrenzen

Die App verwendet keine Analyse- oder Trackingdienste und lädt keine externen Skripte. Eine Content Security Policy beschränkt Ressourcen auf die eigene Herkunft. Texte aus Sicherungen werden als Text dargestellt und nicht als HTML ausgeführt. Sicherungen und lokale Daten sind nicht verschlüsselt; die App ist kein Passworttresor. Das Gerät und der Browser müssen vor fremdem Zugriff geschützt sein. GitHub-Nutzername und Repository-Adresse sind öffentlich sichtbar.
