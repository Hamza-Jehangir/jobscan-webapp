import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evidenceItemSchema = z.object({
  label: z.string(),
  status: z.enum(["pass", "warn", "fail"]),
  detail: z.string(),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const scansTable = pgTable("scans", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  status: text("status").notNull().default("pending"),
  trustScore: integer("trust_score"),
  verdict: text("verdict"),
  companyName: text("company_name"),
  jobTitle: text("job_title"),
  salary: text("salary"),
  applicationChannel: text("application_channel"),
  summary: text("summary"),
  evidence: jsonb("evidence").$type<EvidenceItem[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScanSchema = createInsertSchema(scansTable).omit({ id: true, createdAt: true });
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;
