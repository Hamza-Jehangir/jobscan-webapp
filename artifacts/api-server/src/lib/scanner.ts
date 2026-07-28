import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";
import { analyseWithGrokAgent, isGrokConfigured } from "./agent";
import type { ScanResult } from "./scanner-types";
import { scanDuration, engineFallbacks, trustScoreGauge } from "./metrics";

export type { ScanResult } from "./scanner-types";

const SYSTEM_PROMPT = `You are a forensic job fraud analyst. Your job is to analyse a job posting description provided by a user and determine whether it is legitimate or a scam.

You will reason through a structured set of trust checks and return a JSON result.

Trust checks to perform (analyse each carefully from the user's description):
1. Company Verification — Is the company name real, well-known, and verifiable? Does it match the role type?
2. Salary Realism — Is the salary plausible for this role, seniority level, and location? Is it suspiciously high or vague?
3. Application Channel — Was the user asked to apply via a legitimate platform (LinkedIn, Indeed, company website) or a suspicious one (WhatsApp, Telegram, Gmail, Google Form)?
4. Recruiter Legitimacy — Does the recruiter/contact appear legitimate? Does their email domain match the company?
5. Red Flag Language — Does the description contain urgency pressure, upfront fees, vague duties, or too-good-to-be-true claims?
6. Known Scam Patterns — Does it match common scam job patterns (reshipping, data entry with huge salary, "be your own boss", pay-to-train)?
7. Information Requests — Is personal/financial information requested too early in the process?

Scoring guide:
- Each passing check adds to the score. Each failing check reduces it.
- Trust score 75–100 = safe, 50–74 = caution, 25–49 = risky, 0–24 = scam

Return ONLY valid JSON with this exact structure:
{
  "trustScore": <integer 0-100>,
  "verdict": "<safe|caution|risky|scam>",
  "companyName": "<extracted company name or null>",
  "jobTitle": "<extracted job title or null>",
  "salary": "<extracted salary or null>",
  "applicationChannel": "<extracted channel e.g. WhatsApp, LinkedIn, company website, or null>",
  "summary": "<2-3 sentence plain-English summary of your findings and recommendation>",
  "evidence": [
    { "label": "<check name>", "status": "<pass|warn|fail>", "detail": "<one sentence explanation>" }
  ]
}`;

/** Rejects with ScanTimeoutError after `ms` milliseconds. */
export class ScanTimeoutError extends Error {
  constructor(ms: number) {
    super(`Analysis timed out after ${Math.round(ms / 1000)}s`);
    this.name = "ScanTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ScanTimeoutError(ms)), ms);
    }),
  ]);
}

const AGENT_TIMEOUT_MS = Number(process.env.SCAN_AGENT_TIMEOUT_MS || 45_000);
const FALLBACK_TIMEOUT_MS = Number(process.env.SCAN_FALLBACK_TIMEOUT_MS || 60_000);
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function isAnthropicConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL &&
      process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  );
}

function normalizeScanResult(result: ScanResult): ScanResult {
  result.trustScore = Math.max(0, Math.min(100, Math.round(result.trustScore)));
  if (result.trustScore >= 75) result.verdict = "safe";
  else if (result.trustScore >= 50) result.verdict = "caution";
  else if (result.trustScore >= 25) result.verdict = "risky";
  else result.verdict = "scam";
  return result;
}

function parseScanResultFromText(rawText: string): ScanResult {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error({ rawText }, "No JSON found in AI response");
    throw new Error("AI did not return valid JSON");
  }
  return normalizeScanResult(JSON.parse(jsonMatch[0]) as ScanResult);
}

export async function analyseJobPosting(query: string): Promise<ScanResult> {
  logger.info({ queryLength: query.length }, "Starting job posting analysis");

  let primaryError: unknown;

  // Primary engine: LangChain agent powered by Groq/Grok with forensic tools.
  if (isGrokConfigured()) {
    const engine = process.env.GROQ_API_KEY ? "groq" : "xai";
    const stopTimer = scanDuration.startTimer({ engine });
    try {
      const result = await withTimeout(analyseWithGrokAgent(query), AGENT_TIMEOUT_MS);
      stopTimer();
      trustScoreGauge.observe(result.trustScore);
      return result;
    } catch (err) {
      stopTimer();
      primaryError = err;
      const reason = err instanceof ScanTimeoutError ? "timeout" : "error";
      engineFallbacks.inc({ reason });
      logger.error({ err, reason }, "Primary agent failed — trying simpler fallback");
    }
  } else {
    engineFallbacks.inc({ reason: "not_configured" });
    logger.warn("No GROQ/XAI key set — skipping agent engine");
  }

  // Secondary: direct Groq chat (no tools) — reliable for local dev.
  if (process.env.GROQ_API_KEY) {
    const stopTimer = scanDuration.startTimer({ engine: "groq-direct" });
    try {
      const result = await withTimeout(analyseWithGroqDirect(query), FALLBACK_TIMEOUT_MS);
      stopTimer();
      trustScoreGauge.observe(result.trustScore);
      logger.info({ trustScore: result.trustScore, verdict: result.verdict }, "Groq direct: analysis complete");
      return result;
    } catch (err) {
      stopTimer();
      primaryError = err;
      logger.error({ err }, "Groq direct fallback failed");
    }
  }

  // Tertiary: Replit Anthropic integration (production fallback).
  if (isAnthropicConfigured()) {
    const stopTimer = scanDuration.startTimer({ engine: "anthropic" });
    try {
      const result = await withTimeout(analyseWithAnthropic(query), FALLBACK_TIMEOUT_MS);
      stopTimer();
      trustScoreGauge.observe(result.trustScore);
      return result;
    } catch (err) {
      stopTimer();
      throw err;
    }
  }

  throw primaryError ?? new Error("No AI engine configured. Set GROQ_API_KEY in .env");
}

async function analyseWithGroqDirect(query: string): Promise<ScanResult> {
  const { ChatGroq } = await import("@langchain/groq");
  const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");

  const llm = new ChatGroq({ model: GROQ_MODEL, temperature: 0 });
  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(
      `Please analyse this job posting description and return your assessment as JSON:\n\n${query}`,
    ),
  ]);

  const rawText =
    typeof response.content === "string"
      ? response.content
      : response.content
          .map((block) => (typeof block === "string" ? block : "text" in block ? block.text : ""))
          .join("");

  return parseScanResultFromText(rawText);
}

async function analyseWithAnthropic(query: string): Promise<ScanResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Please analyse this job posting description and return your assessment as JSON:\n\n${query}`,
      },
    ],
  });

  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  const result = parseScanResultFromText(rawText);
  logger.info({ trustScore: result.trustScore, verdict: result.verdict }, "Analysis complete");
  return result;
}
