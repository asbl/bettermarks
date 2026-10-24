# Bettermarks-Klassenübersicht

Unabhängiges Hilfswerkzeug zum Auswerten von Bettermarks-Klassenaktivitäten.
XLSX-Exporte werden lokal im Browser als Schülerübersicht mit Symbolen,
optionalen Noten und einem Durchschnitt über ausgewählte Aktivitäten angezeigt.
Dieses Projekt ist keine offizielle Anwendung von Bettermarks.

**Online ausprobieren:** https://bettermarks.it-teaching.de

## Lokal starten

Voraussetzung: Python 3 für den lokalen Webserver. Kein Backend, keine Datenbank
und kein npm-Build nötig; die benötigte JavaScript-Bibliothek ist enthalten.

```sh
git clone https://github.com/asbl/bettermarks.git
cd bettermarks
python3 -m http.server 8000 --directory public
```

Danach http://localhost:8000 im Browser öffnen. Zum Beenden des Servers Strg+C
drücken. Die Datei `index.html` nicht direkt per Doppelklick öffnen, da die
Dateiverarbeitung einen Web Worker verwendet.

1. Den Bettermarks-XLSX-Export „Klassenaktivität“ auswählen.
2. Optional unter „Klarnamen zuordnen“ die Vorlage herunterladen, bearbeiten
   und die ausgefüllte Datei zusätzlich auswählen.
3. Symbole oder Noten wählen und die Aktivitäten für „Gesamt“ festlegen.
4. Bei Bedarf die Auswertung als CSV exportieren.

Für andere Webserver ausschließlich den Inhalt von `public/` ausliefern.
`nginx.conf` ist eine Beispielkonfiguration für diesen Webordner mit
Sicherheitsheadern. Die spezifische Docker-/Traefik-Konfiguration der Demo ist
nicht Teil dieses Repositorys. Moderne Browser mit Web-Worker- und Dialog-
Unterstützung verwenden; mit Chromium automatisiert geprüft.

## Beispiel ohne Schülerdaten

Mit Node.js lässt sich eine rein erfundene Testklasse erzeugen:

```sh
node tests/fixture.cjs beispiel.xlsx
```

Die Datei anschließend wie einen Bettermarks-Export auswählen. Eigene Klassen-,
Namens- und Ergebnisdateien gehören nicht in GitHub-Issues oder Pull Requests;
Fehler bitte mit synthetischen Beispielen beschreiben. `.gitignore` schließt
lokale XLSX-/CSV-Dateien aus; die öffentliche Namensvorlage ist ausdrücklich
freigegeben.

## Verarbeitung und Datenschutz

XLSX wird ausschließlich auf dem Gerät in einem Web Worker mit lokal
mitgeliefertem SheetJS CE 0.20.3 verarbeitet. Keine externen Skripte,
Upload-Endpunkte, Cookies oder Browser-Persistenz. Reset und Folgeimport
leeren auch den Detaildialog. Ein fehlgeschlagener Import lässt die vorherige
Auswertung stehen und nennt dies ausdrücklich.

Grenzen: 20 MB komprimiert, 50 MB laut ZIP-Verzeichnis entpackt, 2.000 ZIP-Einträge,
20 Blätter, 500.000 Tabellenbereichszellen, maximal 20.000 Bewertungen in der
Übersicht. Pro Blatt maximal 20.001 Zeilen und 1.001 Spalten.
Nach 15 Sekunden wird ein laufender Worker beendet; manueller Abbruch möglich.
Die ZIP-Größenprüfung ist keine Garantie gegen alle absichtlich manipulierten
Archive. Worker und Zeitlimit begrenzen insbesondere blockierende Verarbeitung.

## Import

Bettermarks-Export „Klassenaktivität“ mit Themenüberschrift, Schülerkürzeln,
Kopf „Übung“/„Übungen“ und „Übungscode“, darunter Übungen und Prozentwerte.
Leerzeilen innerhalb eines Themas werden übersprungen. Unvollständige Köpfe,
doppelte Kürzel, Ergebnisse ohne Schülerkürzel und nicht zuordenbare Zeilen
werden abgewiesen. Leere Themen werden mit Hinweis nicht gewertet.
Namen kommen aus dem Schülerblatt; alle dort aufgeführten Schüler erscheinen,
auch ohne Ergebnis-/Aktivitätsspalte. Themen bleiben in Export-Reihenfolge.

## Symbole und 0-Prozent-Regel

- Einzelne ausgefüllte Ergebniszellen mit 0 % zählen als bearbeitet, sofern
  im selben Thema mindestens eine Übung ein Ergebnis über 0 % hat.
- Besteht ein Thema ausschließlich aus 0 % und/oder leeren Zellen,
  zählt es insgesamt als nicht bearbeitet (`--`, Note 6).
- `++`: jede Übung hat 100 %.
- `+`: jede Übung hat ein Ergebnis über 0 %. Gemischte Ergebnisse mit
  einzelnen 0 % erreichen höchstens `~`; sie zählen weiterhin zum Bearbeitungsanteil.
- `~`: mehr als die Hälfte bearbeitet.
- `-`: mindestens eine, höchstens die Hälfte bearbeitet.

## Noten und Durchschnitt

Notenbasis wählbar: Bearbeitungsanteil (Standard) oder Erfolgsquote
(Mittelwert sämtlicher Übungsergebnisse, leere Übungen als 0 %).
Note 1 verlangt stets 100 % in jeder Übung; Note 6 gilt für nicht bearbeitete
Themen einschließlich ausschließlich 0 %. Sonst greifen die Prozentgrenzen.
Voreinstellung: 2 bei >80 %, 3 bei >=50 %, darunter 5. Note 4 kann optional
aktiviert werden (Vorschlag >=25 %); alle Grenzen sind einstellbar.
Validierung: 0 <= Grenze 4 < Grenze 3 <= Grenze 2 < 100.
Ungültige Eingaben lassen die letzten gültigen Einstellungen aktiv und sperren CSV.

Gesamt ist der Durchschnitt der Themennoten mit zwei Nachkommastellen.
Wählbar: Themen gleich oder nach Übungsanzahl gewichten; unbearbeitete Themen
als 6 mitzählen oder ausschließen. Ohne verbleibende Themen erscheint „–“.
Die Symbole bleiben bei Änderung der Notenbasis unverändert.
Sortierung nach Name oder Gesamtnote möglich; fehlende Durchschnitte stehen zuletzt.

CSV exportiert ausdrücklich alle Schüler in Export-Reihenfolge, unabhängig
vom Namensfilter. Dateiname und Metadaten dokumentieren Berechnungseinstellungen.
Formelartige Namen und Titel werden beim Export entschärft.

## Tests

- `node --test parser.test.cjs`
- `python3 tests/browser.py [URL]` (Python Playwright mit Chromium erforderlich)

Tests nutzen synthetische, anonymisierte Arbeitsmappen aus `tests/fixture.cjs`.
Browserprüfungen: Worker-Import, vollständige Schülerliste, Nullergebnisse,
Noten und Einstellungen, Sortierung, CSV, Dialog, Fehler nach Folgeimport,
Reset und mobile Breite. Keine personenbezogene Fixture nötig.

## Auswahl für Gesamt

Unter „Aktivitäten für Gesamt“ können beliebige Aktivitätsspalten angehakt
werden. Standardmäßig zählen alle. Das Feld „Positionen“ erlaubt z. B. `1-4` (erste vier), `2-5` (zweite bis
fünfte) und `1, 3-5` (Kombinationen). Positionen zählen in Export-Reihenfolge
von links; Datumsauswertung findet nicht statt.
„Alle“/„Keine“ setzen die Auswahl gesammelt. Ohne Auswahl erscheint „–“.
Die Auswahl beeinflusst ausschließlich Gesamt und dessen Sortierung;
Gewichtung und Ausschluss unbearbeiteter Themen gelten innerhalb der Auswahl.
CSV dokumentiert die ausgewählten Aktivitäten mit Position und Titel.
Neuer erfolgreicher Import setzt die Auswahl auf alle Aktivitäten zurück,
ein fehlgeschlagener Import erhält die bisherige Auswahl.
Die Browserprüfung deckt manuelle Auswahl, Keine/Alle, einzelne Positionen und Bereiche,
Neuberechnung, Exportmetadaten und Rücksetzen beim erneuten Import ab.

## Zusätzliche Namenszuordnung

Unter „Klarnamen zuordnen“ die XLSX-Vorlage herunterladen, in Excel/LibreOffice
pflegen und mit demselben Bereich auswählen. Spalten „Kürzel“ und „Klarname“;
Beispielzeile vor Verwendung ersetzen. DOCX wird nicht unterstützt.
Die Namensdatei darf maximal 2 MB und 20.000 Tabellenbereichszellen enthalten.
Verarbeitung erfolgt im selben begrenzten Worker, ohne Upload oder Speicherung.

Abgleich bevorzugt das Schülerkürzel aus dem Export, ersatzweise den bisherigen
Namen (für pseudonymisierte Namensspalten). Groß-/Kleinschreibung, Punkte,
Leerzeichen, Bindestriche und Unterstriche werden ignoriert. Doppelte oder
mehrdeutige Zuordnungen werden abgewiesen, nicht gefundene Kürzel gezählt.
Fehlende Zuordnungen behalten ihren bisherigen Namen. Bewertung und Schülerzahl
werden durch eine Namenszuordnung nicht verändert.

Die Datei kann vor oder nach dem Aktivitäten-Export ausgewählt werden. Sie gilt
für weitere Aktivitäten-Importe im selben Tab, bis „Zuordnung entfernen“, Reset
oder Neuladen der Seite. Klarnamen gelten für Tabelle, Suche, Sortierung,
Detaildialog und CSV. Reset entfernt alle Zuordnungen und Dialoginhalte.

## Lizenzen

Eigener Code, Dokumentation und erstellte Vorlagen: **MIT**, Copyright (c) 2026
Andreas Siebel. Vollständiger Text: [LICENSE](LICENSE).

Die unverändert eingebundene Bibliothek SheetJS CE 0.20.3 bleibt unter
**Apache-2.0** lizenziert. Lizenztext, Attribution, Bezugsquelle und Prüfsumme:
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Auch bei einer Weitergabe nur des Webverzeichnisses müssen `public/LICENSE.txt`,
`public/vendor/LICENSE`, `public/vendor/NOTICE.txt` und die vorhandenen
Copyright-Hinweise erhalten bleiben. Die Webseite verlinkt auf diese Texte
über [Lizenzen](https://bettermarks.it-teaching.de/lizenzen.html).
