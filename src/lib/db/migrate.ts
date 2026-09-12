/**
 * Backfills fields added to existing row shapes after data was already
 * persisted to a device (new *tables* are backfilled in store.ts hydrate()
 * directly — this handles fields added to rows that already existed).
 * Mutates `db` in place; called once right after loading from storage.
 */
import { DB } from "./schema";

export function migrateRowShapes(db: DB): void {
  for (const p of db.permissionPolicies) if (p.slaHours === undefined) p.slaHours = null;
  for (const u of db.orgUnits) if (u.lockedAt === undefined) u.lockedAt = null;
  for (const s of db.subscriptions) {
    if (s.planId === undefined) s.planId = s.tier === "paid" ? "standard" : "free";
    if (s.trialEndsAt === undefined) s.trialEndsAt = null;
    if (s.isFoundingSub === undefined) s.isFoundingSub = false;
  }
  for (const p of db.payments) if (p.invoiceNumber === undefined) p.invoiceNumber = null;
}
