# E-Mail-Zustellstatus für Pendly-Feedback

Die Funktion `resend-feedback-webhook` prüft Resend/Svix-Signaturen, verwirft Zeitstempel außerhalb von fünf Minuten und speichert unterstützte Ereignisse idempotent über `provider_event_id`. Sie speichert nur begrenzte Ereignismetadaten, keine vollständigen Webhook-Payloads.

## Aktivierung

1. Migration `20261002100000_feedback_email_delivery_events.sql` anwenden.
2. Supabase Edge Function `resend-feedback-webhook` mit `verify_jwt=false` bereitstellen. Die Funktion authentifiziert Webhooks selbst über `RESEND_WEBHOOK_SECRET`.
3. Secret `RESEND_WEBHOOK_SECRET` als Resend Signing Secret (`whsec_...`) in Supabase Function Secrets setzen. Nie im Client oder Git speichern.
4. In Resend einen Webhook auf `https://prtdkebrtgwbbwvhdfea.supabase.co/functions/v1/resend-feedback-webhook` für email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained und email.failed einrichten.
5. Mit einem echten Testevent prüfen. Die Ereignistabelle ist nur für Admins lesbar.

Die Ereignisse werden zunächst als Auditdaten gespeichert. Die bestehende Feedback-Mail-Logik wird nicht als zugestellt markiert, nur weil ein Versand angestoßen wurde. Eine spätere Verknüpfung mit Feedbackmeldungen benötigt eine gespeicherte Resend-E-Mail-ID beim Versand.

## Grenzen

Dieser Webhook sendet selbst keine E-Mails, verändert keine Feedbackstatus und führt keine Codeänderungen aus. Für produktive Aktivierung muss die Migration und Funktion geprüft und das Resend Secret hinterlegt werden.