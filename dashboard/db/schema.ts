import { sqliteTable, text, integer,index,uniqueIndex } from "drizzle-orm/sqlite-core";

export const authAccounts = sqliteTable("auth_accounts", {
  id: integer("id").primaryKey(), username: text("username").notNull().unique(),
  salt: text("salt").notNull(), passwordHash: text("password_hash").notNull(),
});
export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(), accountId: integer("account_id").notNull(), expires: integer("expires").notNull(),
});
export const authLimits = sqliteTable("auth_limits", {
  id: text("id").primaryKey(), attempts: integer("attempts").notNull(), expires: integer("expires").notNull(),
});

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  snapshot: text("snapshot").notNull(),
  updated: integer("updated").notNull(),
  ownerId: integer("owner_id"), tokenHash: text("token_hash"),
  activeUntil: integer("active_until").notNull().default(0),
},table=>[index("devices_token_hash_idx").on(table.tokenHash)]);
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  state: text("state").notNull(),
  result: text("result"),
  created: integer("created").notNull(),
  expires: integer("expires").notNull(),
  leaseUntil: integer("lease_until"),
  deviceId: text("device_id").notNull().default("phone"), requestedBy: integer("requested_by"),
},table=>[index("jobs_device_created_idx").on(table.deviceId,table.created),index("jobs_device_queue_idx").on(table.deviceId,table.state,table.expires,table.leaseUntil),index("jobs_created_idx").on(table.created)]);
export const transfers = sqliteTable("transfers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  direction: text("direction").notNull(),
  uploaded: integer("uploaded").notNull(),
  expires: integer("expires").notNull(),
  deviceId: text("device_id").notNull().default("phone"), accountId: integer("account_id"), permission: text("permission").notNull().default("files.read"),
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(), deviceId: text("device_id").notNull(), accountId: integer("account_id").notNull(), permissions: text("permissions").notNull(), expires:integer("expires").notNull().default(0),
},table=>[index("members_device_account_idx").on(table.deviceId,table.accountId)]);
export const invitations = sqliteTable("invitations", {
  tokenHash: text("token_hash").primaryKey(), deviceId: text("device_id").notNull(), permissions: text("permissions").notNull(), expires: integer("expires").notNull(), usedBy: integer("used_by"), label:text("label").notNull().default("Einladung"),recipient:text("recipient").notNull().default(""),maxUses:integer("max_uses").notNull().default(1),uses:integer("uses").notNull().default(0),accessHours:integer("access_hours").notNull().default(0),revoked:integer("revoked").notNull().default(0),
});

export const invitationRedemptions=sqliteTable("invitation_redemptions",{id:integer("id").primaryKey(),tokenHash:text("token_hash").notNull(),accountId:integer("account_id").notNull()},table=>[uniqueIndex("redemption_lookup_idx").on(table.tokenHash,table.accountId)]);

export const deviceLinks=sqliteTable("device_links",{codeHash:text("code_hash").primaryKey(),pollHash:text("poll_hash").notNull(),model:text("model").notNull(),expires:integer("expires").notNull(),claimedBy:integer("claimed_by"),deviceId:text("device_id"),encrypted:text("encrypted")});
