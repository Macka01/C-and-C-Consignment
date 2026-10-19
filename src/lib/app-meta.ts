import { getDb } from "@/lib/db";

export function getAppMeta(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM app_meta WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setAppMeta(key: string, value: string) {
  getDb()
    .prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, value);
}
