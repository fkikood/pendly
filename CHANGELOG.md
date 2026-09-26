# Pendly – Änderungsprotokoll

## v0.14.75
- Anmeldemaske auf die drei klaren Wege **Anmelden**, **Konto erstellen** und **Demo ausprobieren** reduziert.
- Demo-Kalkulation ist beim Start standardmäßig ausgeblendet und wird nur bewusst geöffnet.
- Login-Ansicht wird beim Laden explizit aktiviert.
- Service-Worker-Cache für die neue Anmeldemaske erneuert.


Dieses Protokoll dokumentiert die Entwicklung von Pendly anhand der GitHub-Historie.

> **Hinweis zur Rekonstruktion:** Die Historie wurde nachträglich aus den vorhandenen GitHub-Commits rekonstruiert. Bei einigen älteren Versionssprüngen wurde die Versionsnummer erhöht, ohne dass der Commit selbst eine eindeutige Versionsnummer oder eine vollständige Änderungsbeschreibung enthielt. In diesen Fällen wird nichts erfunden; der Eintrag beschreibt nur den belegbaren Stand.

## Aktuell

### v0.14.74 – Jahresrückblick verständlicher und korrekt für das laufende Jahr
- Im laufenden Jahr werden beim Jahresrückblick nur die bereits angefallenen Ticketmonate berücksichtigt.
- „Zugfahrten“ wurde im Jahresrückblick zu „Zugtagen“ präzisiert.
- „Autofahrten“ wurde zu „Autotagen“ präzisiert.
- „geschätztes CO₂“ wurde zu „geschätzte CO₂-Einsparung“ präzisiert.
- Die laufende Jahres-Nettoersparnis wird als „geschätzte Netto-Ersparnis bisher“ bezeichnet.
- Versionshistorie und Entwicklungschronik werden erstmals als eigenes Änderungsprotokoll dokumentiert.
- In den Einstellungen gibt es eine sichtbare Pendly-Entwicklungschronik.

## 2026-09-26

### v0.14.73
- Versionsstand nach dem großen technischen und funktionalen Ausbau des Tages.
- Automatisierte Prüfungen, Accessibility, XLSX-Lazy-Loading, Onboarding, rechtliche Seiten und Account-Löschung waren bereits integriert.

### v0.14.70
- Neue Nutzerführung und Quick-Start-Übergabe verbessert.
- Rechtliche Seiten ergänzt und aus der App verlinkt.
- Mobile Authentifizierung verbessert.
- Pendly-Styles in eine eigene CSS-Datei ausgelagert.
- XLSX-Bibliothek wird erst bei Bedarf geladen.
- Accessibility verbessert.
- Automatisierte Regressionstests und CI-Prüfungen ergänzt.
- Account-Löschung technisch abgesichert.

### v0.14.63
- Nach Ausbau von Landingpage, SEO, PWA und App-Icon/Favicon.
- Marketing-Landingpage ergänzt und App damit verknüpft.
- Sitemap und robots.txt ergänzt.
- PWA-Manifest und Service Worker eingeführt bzw. weiterentwickelt.
- Pendly-App-Icons/Favicon eingebunden.

### v0.14.61
- Versionsstand nach der weiteren technischen Aufteilung der App.
- App-Logik aus der HTML-Datei in `app.js` ausgelagert.
- Smoke-Test an die neue App-Struktur angepasst.

### v0.14.58
- Historische Kraftstoffpreise und deren Quellenangaben verbessert.
- Tageswerte werden über gespeicherte Pendeltages-Snapshots historisch stabil gehalten.
- Passwortanforderungen verschärft.
- Regressionstest/Smoke-Test eingeführt.
- Anonymer Schnellrechner und weitere Einstiegshilfen ergänzt.

### v0.14.52
- Zwischenstand nach dem Ausbau der persönlichen Konto- und Berechnungslogik.

### v0.14.50
- Größerer Funktionsausbau rund um Konto, Berechnung und historische Tageswerte.
- Gespeicherte Pendeltages-Snapshots eingeführt bzw. weiterentwickelt.

### v0.14.38
- Versionsstand nach den umfangreichen Cloud-/Supabase-Korrekturen.
- Cloud-Daten sollten nicht mehr vor dem vollständigen Profil-Laden überschrieben werden.

### v0.14.36
- Cloud-Daten-Laden abgesichert.
- Versehentliches Überschreiben mit leeren Daten verhindert.

### v0.14.35
- Überschreiben von Cloud-Daten vor dem Profil-Laden verhindert.

### v0.14.34
- Supabase-Auth-Deadlock behoben.
- Kalenderinteraktionen korrigiert.

### v0.14.33
- Kalender wird unmittelbar beim Seitenladen initialisiert.

### v0.14.32
- Kalender wieder sichtbar gemacht.
- Berechnungen robuster gemacht.

### v0.14.31
- Doppelte Berechnungsdefinition entfernt.

### v0.14.30
- Zentrale Fahrtkostenberechnung auch für Tagesersparnis und Toast-Meldungen verwendet.

### v0.14.29
- Sparziel auf Netto-Ersparnis statt Brutto-Ersparnis ausgerichtet.

### v0.14.28
- Kilometerbasierte Wartungs-/Reparaturkosten verständlicher bezeichnet.

### v0.14.27
- CO₂- und Ersparnis-Bezeichnungen präzisiert.

### v0.14.26
- Kostenbezeichnungen und Fallback-Texte präzisiert.

### v0.14.25
- Tages-Kraftstoffpreis wird beim Wechsel des Kraftstofftyps aktualisiert.

### v0.14.24
- Abschreibungs-/Wertverlustschätzung altersabhängig gemacht.

### v0.14.23
- Zeitraum-Statistiken an die zentrale Fahrtkostenberechnung angeglichen.

### v0.14.22
- Fahrtkostenberechnung zentralisiert.

### v0.14.21
- Versionsstand nach dem vorangegangenen Berechnungs- und UI-Ausbau.

### v0.14.20
- Versionsanzeige in den Einstellungen eingeführt.

## 2026-09-24

### v0.14.13
- Versionsstand vor dem großen Ausbau vom 26.09.
- Die Kraftstoffpreisfunktion wurde auf TankPuls/Tankerkönig-bezogene Datenquellen umgestellt.

### Weitere dokumentierte Änderungen ohne eindeutig zuordenbare Versionsnummer
- Mobile Glass-Navigation und Account-Scrolling verbessert.
- Signup-Bestätigungsweiterleitung korrigiert.
- Fortschritts-/Ersparnisdarstellung angepasst.
- Historische Kraftstoffquelle korrigiert.

## 2026-09-23

### Früher Ausbau der Kraftstoffpreisfunktion
- Kraftstoffpreisfunktion auf externe Tagespreise vorbereitet und anschließend weiterentwickelt.

## Nicht separat dokumentierte Zwischenversionen

Die GitHub-Historie enthält zwischen den eindeutig nachvollziehbaren Versionsständen weitere Commits, aber nicht für jeden einzelnen Commit einen eigenen Versionssprung. Die Zwischenstände **v0.14.14–v0.14.19, v0.14.37, v0.14.39–v0.14.49, v0.14.51, v0.14.53–v0.14.57, v0.14.59–v0.14.60, v0.14.62, v0.14.64–v0.14.69, v0.14.71–v0.14.72** sind deshalb nicht mit erfundenen Einzeländerungen belegt.

## Ab jetzt

Ab **v0.14.74** wird jede funktionale Änderung nach diesem Schema dokumentiert:

1. Änderung umsetzen.
2. Versionsnummer erhöhen.
3. Änderungsprotokoll ergänzen.
4. GitHub-Commit mit verständlicher Beschreibung erstellen.

Damit bleibt die Entwicklung sowohl in Pendly als auch im GitHub-Projekt nachvollziehbar.
