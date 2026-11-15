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

Eine Sicherung verwendet `format: baumgedaechtnis`, `version: 2` und unter `data` die Felder `entries`, `mappings`, `defaultRule` und `reviews`. Sicherungen der Version 1 bleiben importierbar und starten ohne bisherigen Lernstand. Auch die JSON-Antwort der bisherigen App unter `/api/memory` lässt sich importieren. Alte Daten werden nicht automatisch von der anderen Webadresse übernommen. Persönliche Sicherungen niemals in dieses Repository hochladen.

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

## Üben mit Spaced Repetition

Unter **Üben** (Direktlink: `#ueben`) stehen alle 100 Symbolkarten, zehn Farbkarten und die eigene Sammlung bereit. Fällige Wiederholungen kommen vor neuen Karten. Es gibt keine Begrenzung auf zehn Karten; Runden können jederzeit beendet werden. Jede Bewertung wird sofort lokal gespeichert.

- Nochmal: nach einer Minute erneut, auch innerhalb derselben Runde.
- Schwer: in der Lernphase nach zehn Minuten, später mit einem kurzen Abstand in Tagen.
- Gut: eine neue Karte nach einem Tag, danach zunehmend größere Abstände.
- Leicht: eine neue Karte nach vier Tagen, danach längere Abstände als bei Gut.

Das vereinfachte Modell ist von [SM-2](https://super-memory.org/archive/english/ol/sm2.htm) inspiriert und ergänzt kurze Lernstufen. Es ist kein FSRS-Modell. Die Bewertungen zeigen den jeweiligen nächsten Abstand. Termine beruhen auf der Gerätezeit. Geänderte Karten beginnen erneut; reine Notizänderungen behalten ihren Lernstand. „Alle Karten frei üben“ zeigt auch noch nicht fällige Karten, ohne Termine zu ändern. Lernstände sind in Sicherungen enthalten und werden nicht an einen Server übertragen.

## Kompakte Ansicht und Merkbilder

Während einer Lernrunde bleiben Antwort und Bewertungstasten im sichtbaren Bereich. Lange Merkszenen lassen sich bei Bedarf aufklappen. Die Üben-Seite zeigt nur Kartenwahl, Lernstand und Startmöglichkeiten; Erläuterungen sind eingeklappt. Der kleine Speicherstatus steht auf den übrigen Seiten unter dem App-Namen.

Die 100 Merkbilder sind eigenständige, einfarbige SVG-Zeichnungen. Gegenstände wie Hocker mit drei Beinen, Kissen, Toaster und Rasenmäher besitzen passende Darstellungen. Bildverbesserungen allein setzen vorhandene Wiederholungstermine nicht zurück.
