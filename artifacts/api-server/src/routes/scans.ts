import { Router, type IRouter } from "express";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { db, scansTable } from "@workspace/db";
import { CreateScanBody, GetScanParams } from "@workspace/api-zod";
import { analyseJobPosting, ScanTimeoutError } from "../lib/scanner";
import { logger } from "../lib/logger";
import { scansTotal } from "../lib/metrics";

const router: IRouter = Router();

// GET /scans
router.get("/scans", async (_req, res): Promise<void> => {
  const scans = await db
    .select()
    .from(scansTable)
    .orderBy(desc(scansTable.createdAt));

  res.json(scans.map(formatScan));
});

// POST /scans
router.post("/scans", async (req, res): Promise<void> => {
  const parsed = CreateScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Insert a pending scan first
  const [scan] = await db
    .insert(scansTable)
    .values({ query: parsed.data.query, status: "processing" })
    .returning();

  try {
    const result = await analyseJobPosting(parsed.data.query);

    const [updated] = await db
      .update(scansTable)
      .set({
        status: "complete",
        trustScore: result.trustScore,
        verdict: result.verdict,
        companyName: result.companyName,
        jobTitle: result.jobTitle,
        salary: result.salary,
        applicationChannel: result.applicationChannel,
        summary: result.summary,
        evidence: result.evidence,
      })
      .where(eq(scansTable.id, scan.id))
      .returning();

    scansTotal.inc({ verdict: result.verdict, outcome: "complete" });
    res.status(201).json(formatScan(updated));
  } catch (err) {
    const isTimeout = err instanceof ScanTimeoutError;
    logger.error({ err, scanId: scan.id, isTimeout }, "Scan analysis failed");
    scansTotal.inc({ verdict: "none", outcome: isTimeout ? "timeout" : "failed" });

    const [failed] = await db
      .update(scansTable)
      .set({
        status: "failed",
        summary: isTimeout
          ? "The analysis took too long and timed out. This is usually temporary — please try scanning again in a moment."
          : "We couldn't complete the analysis due to a technical problem. Your description was saved — please try again shortly.",
      })
      .where(eq(scansTable.id, scan.id))
      .returning();

    res.status(201).json(formatScan(failed));
  }
});

// GET /scans/:id
router.get("/scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetScanParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid scan ID" });
    return;
  }

  const [scan] = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.id, params.data.id));

  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(formatScan(scan));
});

// GET /stats
router.get("/stats", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({ total: count(), avgScore: avg(scansTable.trustScore) })
    .from(scansTable)
    .where(eq(scansTable.status, "complete"));

  const verdictCounts = await db
    .select({ verdict: scansTable.verdict, cnt: count() })
    .from(scansTable)
    .where(eq(scansTable.status, "complete"))
    .groupBy(scansTable.verdict);

  const byVerdict = Object.fromEntries(
    verdictCounts.map((r) => [r.verdict ?? "unknown", Number(r.cnt)])
  );

  res.json({
    totalScans: Number(totals?.total ?? 0),
    averageTrustScore: totals?.avgScore ? parseFloat(totals.avgScore) : null,
    safeCount: byVerdict["safe"] ?? 0,
    cautionCount: byVerdict["caution"] ?? 0,
    riskyCount: byVerdict["risky"] ?? 0,
    scamCount: byVerdict["scam"] ?? 0,
  });
});

function formatScan(scan: typeof scansTable.$inferSelect) {
  return {
    id: scan.id,
    query: scan.query,
    status: scan.status,
    trustScore: scan.trustScore ?? null,
    verdict: scan.verdict ?? null,
    companyName: scan.companyName ?? null,
    jobTitle: scan.jobTitle ?? null,
    salary: scan.salary ?? null,
    applicationChannel: scan.applicationChannel ?? null,
    summary: scan.summary ?? null,
    evidence: scan.evidence ?? [],
    createdAt: scan.createdAt.toISOString(),
  };
}

export default router;
