// Promote a user to admin (or demote with `node scripts/make-admin.mjs <email> user`).
//
// Roles can normally only be changed by an existing admin through the dashboard.
// This script is the bootstrap: it edits the DB directly so YOU become the very
// first admin. Run it once for your own account, then manage everyone else from
// the dashboard.
//
//   node scripts/make-admin.mjs you@example.com
//   node scripts/make-admin.mjs you@example.com user   # demote back

import Database from "better-sqlite3";

const email = process.argv[2];
const role = process.argv[3] ?? "admin";

if (!email) {
  console.error("Usage: node scripts/make-admin.mjs <email> [admin|user]");
  process.exit(1);
}

const db = new Database("sqlite.db");
const info = db
  .prepare("UPDATE user SET role = ?, updatedAt = ? WHERE email = ?")
  .run(role, Math.floor(Date.now() / 1000), email);

if (info.changes === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log(`✓ ${email} is now "${role}".`);
