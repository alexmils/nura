import { dbQuery } from "@/lib/rls";
import type { SqlClient } from "@/lib/auth/db-auth";

type QueryFn = SqlClient["query"];

export async function ensureRlsPolicies(client?: SqlClient) {
  const query: QueryFn = client
    ? (text, params) => client.query(text, params)
    : (text, params) => dbQuery(text, params);

  await query(`
    CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS TEXT AS $$
      SELECT NULLIF(current_setting('app.current_user_id', true), '');
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS TEXT AS $$
      SELECT NULLIF(current_setting('app.current_user_role', true), '');
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION app_is_platform_admin() RETURNS BOOLEAN AS $$
      SELECT app_current_user_role() = 'platform_admin';
    $$ LANGUAGE sql STABLE;
  `);

  const tables = [
    "threads",
    "messages",
    "memories",
    "user_settings",
    "client_profiles",
    "consents",
  ];

  for (const table of tables) {
    await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  }

  await query(`
    DROP POLICY IF EXISTS threads_all ON threads;
    CREATE POLICY threads_all ON threads FOR ALL USING (
      user_id = app_current_user_id()
    ) WITH CHECK (
      user_id = app_current_user_id()
    );

    DROP POLICY IF EXISTS messages_all ON messages;
    CREATE POLICY messages_all ON messages FOR ALL USING (
      EXISTS (
        SELECT 1 FROM threads t
        WHERE t.id = messages.thread_id AND t.user_id = app_current_user_id()
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM threads t
        WHERE t.id = messages.thread_id AND t.user_id = app_current_user_id()
      )
    );

    DROP POLICY IF EXISTS memories_all ON memories;
    CREATE POLICY memories_all ON memories FOR ALL USING (
      user_id = app_current_user_id()
    ) WITH CHECK (
      user_id = app_current_user_id()
    );

    DROP POLICY IF EXISTS user_settings_all ON user_settings;
    CREATE POLICY user_settings_all ON user_settings FOR ALL USING (
      user_id = app_current_user_id()
    ) WITH CHECK (
      user_id = app_current_user_id()
    );

    DROP POLICY IF EXISTS client_profiles_all ON client_profiles;
    CREATE POLICY client_profiles_all ON client_profiles FOR ALL USING (
      user_id = app_current_user_id()
    ) WITH CHECK (
      user_id = app_current_user_id()
    );

    DROP POLICY IF EXISTS consents_all ON consents;
    CREATE POLICY consents_all ON consents FOR ALL USING (
      user_id = app_current_user_id()
    ) WITH CHECK (
      user_id = app_current_user_id()
    );
  `);
}

export async function migrateOrphanDataToUser(userId: string) {
  await dbQuery(
    "UPDATE threads SET user_id = $1 WHERE user_id IS NULL",
    [userId]
  );
  await dbQuery(
    "UPDATE memories SET user_id = $1 WHERE user_id IS NULL",
    [userId]
  );
}

export async function migrateLegacySettings(userId: string) {
  const { rows } = await dbQuery<{ json: unknown }>(
    "SELECT json FROM app_settings WHERE id = 1"
  );
  if (rows[0]) {
    await dbQuery(
      `INSERT INTO user_settings (user_id, json) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, rows[0].json]
    );
  }
}
