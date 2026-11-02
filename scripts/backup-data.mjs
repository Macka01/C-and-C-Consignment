import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

function expandHome(input) {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

function resolveDir(value, fallback) {
  const configured = value?.trim();
  return path.resolve(expandHome(configured || fallback));
}

const dataDir = resolveDir(process.env.CONSIGNMENT_DATA_DIR, path.join(process.cwd(), "data"));
const backupRoot = resolveDir(process.env.CONSIGNMENT_BACKUP_DIR, path.join(dataDir, "..", "backups"));
const keep = Number(process.env.CONSIGNMENT_BACKUP_KEEP || 14);
const dbPath = path.join(dataDir, "consignment.db");

if (!fs.existsSync(dbPath)) {
  console.log(`[consignment] no database at ${dbPath}; nothing to back up`);
  process.exit(0);
}

const stamp = new Date();
const pad = (value) => String(value).padStart(2, "0");
const name = [
  stamp.getFullYear(),
  pad(stamp.getMonth() + 1),
  pad(stamp.getDate()),
].join("-") + `-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`;

let dest = path.join(backupRoot, name);
let suffix = 2;
while (fs.existsSync(dest)) {
  dest = path.join(backupRoot, `${name}-${suffix}`);
  suffix += 1;
}
fs.mkdirSync(dest, { recursive: true });

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  await db.backup(path.join(dest, "consignment.db"));
} finally {
  db.close();
}

const reports = path.join(dataDir, "reports");
const reportDest = path.join(dest, "reports");
fs.mkdirSync(reportDest, { recursive: true });
if (fs.existsSync(reports)) {
  fs.cpSync(reports, reportDest, { recursive: true });
}

const reportCount = fs.readdirSync(reportDest).filter((entry) => entry !== ".gitkeep").length;
fs.writeFileSync(
  path.join(dest, "README.txt"),
  [
    "Cotton & Clay consignment backup",
    `Taken: ${stamp.toString()}`,
    `Source: ${dataDir}`,
    "Files: consignment.db and reports/",
    `Report files: ${reportCount}`,
    "",
    "To restore: stop the server, replace consignment.db and the reports folder",
    "in the data repository with these copies, then start the server again.",
    "",
  ].join("\n"),
);

const previous = fs
  .readdirSync(backupRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}-\d{6}(-\d+)?$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const extra = previous.length - (Number.isFinite(keep) && keep > 0 ? keep : 14);
for (const old of previous.slice(0, Math.max(0, extra))) {
  fs.rmSync(path.join(backupRoot, old), { recursive: true, force: true });
}

console.log(`[consignment] backup written to ${dest}`);
