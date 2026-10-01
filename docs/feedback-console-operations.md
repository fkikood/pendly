# Pendly Feedback Console – Betriebs- und Aktivierungsplan

## Sicherheitsgrenzen
- Admin-Zugriff basiert ausschließlich auf Supabase Auth `app_metadata.role=admin`; niemals `user_metadata` oder Browsercode verwenden.
- Der Browser enthält nur den öffentlichen/publishable Supabase-Schlüssel. Service-role- und OpenAI-Schlüssel bleiben ausschließlich in Edge-Function-Secrets.
- KI-Ausgaben sind unverbindliche Vorschläge. Diese Funktion ändert keinen Quellcode und veröffentlicht nichts.

## Noch notwendige vertrauliche Einrichtung
Im Supabase-Projekt müssen als Edge Function Secrets gesetzt werden:
- `OPENAI_API_KEY` – API-Schlüssel des freigegebenen KI-Anbieters
- `PENDLY_AI_MODEL` – optional, sonst Standardmodell
- `SUPABASE_SERVICE_ROLE_KEY` und `SUPABASE_URL` / `SUPABASE_ANON_KEY` – die üblichen Supabase Function Runtime-Variablen

Das Secret darf nicht in Git, HTML, SQL-Migrationen, Issues oder Chat-Nachrichten abgelegt werden.

## Aktivierung in sicherer Reihenfolge
1. Review und erfolgreiche CI für diesen PR abwarten.
2. Migrationen zuerst auf einer Supabase-Entwicklungs-/Preview-Datenbank anwenden und RLS mit Admin- und Nicht-Admin-Konten testen.
3. Die Edge Function `feedback-assistant` deployen und Secrets ausschließlich im Supabase-Dashboard/Secret-Management konfigurieren.
4. Admin-Rolle über einen vertrauenswürdigen serverseitigen Weg zuweisen.
5. Eingangs- und Abschluss-E-Mail mit realer Empfängeradresse testen; tatsächliche Resend-Zustellung und Fehlerpfad verifizieren.
6. Erst nach expliziter menschlicher Freigabe den PR mergen und Produktionsmigrationen anwenden.

## KI-Reparatur und Veröffentlichung
Die Diagnosefunktion speichert strukturierte Ursachen, Lösungsvorschlag, Risiko und Testplan. Sie ist bewusst nicht mit GitHub-Schreibrechten ausgestattet. Ein späterer Reparatur-Worker muss in einem isolierten Branch arbeiten, begrenzte Dateien ändern, Tests/CI abwarten und ausschließlich einen Draft-PR öffnen. Merge/Deployment bleiben menschlich freigegeben.

## Mail-Zustellstatus
Aktueller Datenbank-Trigger darf nicht als Zustellnachweis interpretiert werden, wenn er lediglich den Versandauftrag einreiht. Für echte Zustellbestätigung sind Resend Webhooks mit Signaturprüfung, Idempotenz und getrennten Zuständen für queued/sent/delivered/bounced/failed nötig. Bis dahin keine Zustellgarantie anzeigen.
