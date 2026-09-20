<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Strict Database Migration & Schema Protocol

1. ZERO Direct Database Tampering:
   - Never assume direct DB schema sync or execute blind migrations.
   - Never write non-idempotent DDL queries (e.g., bare `CREATE TABLE` or `ALTER TABLE ... ADD COLUMN` without safety checks).

2. Single Source of Truth (`save_data_migration.sql`):
   - Whenever any feature or route requires a database change (new table, new column, index, or realtime publication), DO NOT execute it silently.
   - Append or update the change inside `save_data_migration.sql` at the root of the project.
   - The user will manually copy this file and run it inside Supabase SQL Editor.

3. Strict Idempotency Rule:
   - Every single SQL statement in `save_data_migration.sql` MUST be 100% safe to run multiple times without throwing errors:
     * For tables: Use `CREATE TABLE IF NOT EXISTS ...`
     * For columns: Use `DO $$ BEGIN IF NOT EXISTS (...) THEN ALTER TABLE ... ADD COLUMN ...; END IF; END $$;`
     * For publications: Verify table existence in `pg_publication_tables` before calling `ALTER PUBLICATION supabase_realtime ADD TABLE ...`
     * For policies/indexes: Use `CREATE INDEX IF NOT EXISTS` or check `pg_policies` before `CREATE POLICY`.

## UI & Visual Design Standards

1. No Raw Emojis:
   - Do NOT use raw Unicode emojis anywhere in UI copy, buttons, badges, logs, or system notifications (e.g., avoid 🔥, 🧊, 🟩, ⚔️, 🧠, ⚡).
   - Use clean, scalable SVG icons or standard icon libraries (such as Lucide React) with descriptive `aria-label` tags.
   - If visual tier indicators are needed (e.g., temperature ranges), use semantic CSS badge components, custom SVG icons, or monochromatic glyphs instead of emoji characters.

   Typography & Dash Syntax:
   - Do NOT use em dashes (`—`) anywhere in copy, documentation, logs, or UI text.
   - Always use standard hyphens (`-`) or colons (`:`) for separators.