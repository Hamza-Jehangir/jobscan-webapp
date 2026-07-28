import client from "prom-client";
import type { Request, Response, NextFunction } from "express";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: "jobscan_" });

export const httpRequestDuration = new client.Histogram({
  name: "jobscan_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [registry],
});

export const scansTotal = new client.Counter({
  name: "jobscan_scans_total",
  help: "Total scans processed, by verdict and outcome",
  labelNames: ["verdict", "outcome"] as const, // outcome: complete|failed|timeout
  registers: [registry],
});

export const scanDuration = new client.Histogram({
  name: "jobscan_scan_analysis_duration_seconds",
  help: "AI analysis duration in seconds, by engine",
  labelNames: ["engine"] as const, // groq|xai|anthropic
  buckets: [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 60],
  registers: [registry],
});

export const engineFallbacks = new client.Counter({
  name: "jobscan_engine_fallbacks_total",
  help: "Times the primary AI engine failed and analysis fell back to Anthropic",
  labelNames: ["reason"] as const, // error|timeout|not_configured
  registers: [registry],
});

export const trustScoreGauge = new client.Histogram({
  name: "jobscan_trust_score",
  help: "Distribution of trust scores returned",
  buckets: [10, 25, 40, 50, 60, 75, 90, 100],
  registers: [registry],
});

/**
 * Map request paths to a fixed set of route templates so metric label
 * cardinality stays bounded (unknown paths collapse to "other").
 */
const KNOWN_ROUTES: Array<{ pattern: RegExp; route: string }> = [
  { pattern: /^\/api\/scans\/\d+$/, route: "/api/scans/:id" },
  { pattern: /^\/api\/scans$/, route: "/api/scans" },
  { pattern: /^\/api\/stats$/, route: "/api/stats" },
  { pattern: /^\/api\/metrics$/, route: "/api/metrics" },
  { pattern: /^\/api\/healthz$/, route: "/api/healthz" },
  { pattern: /^\/api\/conversations(\/.*)?$/, route: "/api/conversations" },
];

function normalizeRoute(path: string): string {
  return KNOWN_ROUTES.find((r) => r.pattern.test(path))?.route ?? "other";
}

/** Express middleware: times every request. */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    // originalUrl keeps the full path even when 'finish' fires inside a mounted router
    end({ method: req.method, route: normalizeRoute(req.originalUrl.split("?")[0]), status: String(res.statusCode) });
  });
  next();
}

/** GET /metrics handler for Prometheus scraping. */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
}
