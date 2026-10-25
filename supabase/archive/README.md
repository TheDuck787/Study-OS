# Archiviert – nicht anwenden

Diese beiden Dateien waren ein früher Entwurf eines relationalen Schemas (eine Tabelle pro App-Tabelle).
Sie wurden **nie** auf das Supabase-Projekt angewendet (geprüft am 25.10.2026: `public` war leer, keine Migrationen).

Für die Synchronisierung nutzt Study OS stattdessen eine einzige Tabelle `public.sync_records`
(`supabase/migrations/20261025120000_sync_records.sql`): Jeder lokale Datensatz wird als JSON-Dokument
mit Server-Zeitstempel gespeichert. So bleibt das Format identisch zur lokalen IndexedDB und zur
JSON-Sicherung, und es entstehen keine doppelten Tabellen. Die Dateien bleiben nur als Referenz erhalten.
