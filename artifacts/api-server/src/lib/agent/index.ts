import { ChatGroq } from "@langchain/groq";
import { ChatXAI } from "@langchain/xai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { forensicTools } from "./tools";
import { logger } from "../logger";
import type { ScanResult } from "../scanner-types";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROK_MODEL = process.env.GROK_MODEL || "grok-4-fast-non-reasoning";

const AGENT_SYSTEM_PROMPT = `You are JobScan's forensic job-fraud analyst agent. A user describes a suspicious job offer in plain English; your job is to determine whether it is legitimate or a scam.

You have three forensic tools. USE THEM — do not rely only on your own judgment:
1. check_scam_patterns — always call this first with the full text.
2. check_salary_realism — call whenever any pay figure or job title is mentioned.
3. analyze_contact_channel — call whenever a contact method, platform, or email appears.

Also apply your own knowledge for checks the tools can't cover:
- Company verification: is the claimed company real and does this role fit it?
- Recruiter legitimacy and process realism (real interviews? too fast?).
- Early requests for personal/financial information.

Scoring guide for the final trust score (0-100):
75-100 = safe, 50-74 = caution, 25-49 = risky, 0-24 = scam.
Weigh hard evidence from the tools more heavily than vibes. A single severe red flag (upfront fee, fake-check task, crypto payment) should cap the score below 25.`;

const ScanResultSchema = z.object({
  trustScore: z.number().int().min(0).max(100).describe("Overall trust score 0-100"),
  verdict: z.enum(["safe", "caution", "risky", "scam"]),
  companyName: z.string().nullable().describe("Extracted company name, or null"),
  jobTitle: z.string().nullable().describe("Extracted job title, or null"),
  salary: z.string().nullable().describe("Extracted salary as stated, or null"),
  applicationChannel: z
    .string()
    .nullable()
    .describe("How the user was contacted / asked to apply, e.g. WhatsApp, LinkedIn, company website"),
  summary: z
    .string()
    .describe("2-3 sentence plain-English summary of the findings and a clear recommendation"),
  evidence: z
    .array(
      z.object({
        label: z.string().describe("Name of the trust check, e.g. 'Salary Realism'"),
        status: z.enum(["pass", "warn", "fail"]),
        detail: z.string().describe("One-sentence explanation grounded in tool output where possible"),
      })
    )
    .min(5)
    .describe("One entry per trust check performed (aim for 5-7)"),
});

export function isGrokConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY || process.env.XAI_API_KEY);
}

export async function analyseWithGrokAgent(query: string): Promise<ScanResult> {
  // Prefer Groq (fast inference) when its key is available; otherwise use xAI Grok.
  const useGroq = Boolean(process.env.GROQ_API_KEY);
  const llm = useGroq
    ? new ChatGroq({ model: GROQ_MODEL, temperature: 0 })
    : new ChatXAI({ model: GROK_MODEL, temperature: 0 });
  const modelName = useGroq ? GROQ_MODEL : GROK_MODEL;

  const agent = createReactAgent({
    llm,
    tools: forensicTools,
    prompt: AGENT_SYSTEM_PROMPT,
    responseFormat: ScanResultSchema,
  });

  logger.info({ model: modelName, queryLength: query.length }, "Agent: starting analysis");

  const state = await agent.invoke(
    {
      messages: [
        {
          role: "user",
          content: `Analyse this job offer description and produce your structured assessment:\n\n${query}`,
        },
      ],
    },
    { recursionLimit: 12 }
  );

  const result = state.structuredResponse as ScanResult;
  if (!result || typeof result.trustScore !== "number") {
    throw new Error("Grok agent did not return a structured result");
  }

  // Clamp + make verdict consistent with the score
  result.trustScore = Math.max(0, Math.min(100, Math.round(result.trustScore)));
  if (result.trustScore >= 75) result.verdict = "safe";
  else if (result.trustScore >= 50) result.verdict = "caution";
  else if (result.trustScore >= 25) result.verdict = "risky";
  else result.verdict = "scam";

  const toolCalls = state.messages.filter((m: { getType?: () => string }) => m.getType?.() === "tool").length;
  logger.info(
    { trustScore: result.trustScore, verdict: result.verdict, toolCallsUsed: toolCalls },
    "Grok agent: analysis complete"
  );
  return result;
}
