import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Deterministic forensic tools the Grok agent can call while analysing
 * a job posting. Each returns a JSON string with findings the agent
 * folds into its final verdict.
 */

// ---------------------------------------------------------------------------
// Tool 1: Known scam pattern detector (keyword/heuristic scan)
// ---------------------------------------------------------------------------
const SCAM_PATTERNS: Array<{ pattern: RegExp; flag: string; weight: number }> = [
  { pattern: /\b(registration|training|starter|activation|processing)\s+fee\b/i, flag: "Requests an upfront fee — legitimate employers never charge to hire you", weight: 40 },
  { pattern: /\b(re-?ship|reship(ping)?|package (forward|inspect))/i, flag: "Reshipping/package-forwarding job — a classic parcel-mule scam", weight: 45 },
  { pattern: /\b(whatsapp|telegram|signal)\b/i, flag: "Recruitment via WhatsApp/Telegram — legitimate employers use email or job platforms", weight: 25 },
  { pattern: /\b(urgent(ly)?|immediate(ly)? start|only \d+ (spots|positions)|act (now|fast)|limited time)\b/i, flag: "Urgency pressure — scammers rush you so you don't think", weight: 15 },
  { pattern: /\b(no (experience|interview) (needed|required|necessary))\b/i, flag: "No experience or interview required — real jobs screen candidates", weight: 20 },
  { pattern: /\b(be your own boss|financial freedom|unlimited (income|earnings))\b/i, flag: "Get-rich-quick language typical of MLM/pyramid recruitment", weight: 25 },
  { pattern: /\b(gift ?cards?|crypto(currency)?|bitcoin|wire transfer|western union|moneygram)\b/i, flag: "Mentions gift cards/crypto/wire transfers — common scam payment rails", weight: 35 },
  { pattern: /\b(bank (details|account)|routing number|ssn|social security|passport|driver'?s licen[cs]e)\b/i, flag: "Requests sensitive personal/financial data early in the process", weight: 30 },
  { pattern: /\b(check|cheque) (deposit|cashing)|deposit (a|the) check\b/i, flag: "Check-deposit task — fake-check scams leave the victim owing the bank", weight: 45 },
  { pattern: /\bgoogle forms?|docs\.google\.com\/forms\b/i, flag: "Application via Google Form — legitimate companies use ATS or careers pages", weight: 20 },
  { pattern: /\b(data entry|typing job).{0,80}(\$|£|€)\s?\d{2,}/i, flag: "High-paid data-entry/typing job — a well-known scam template", weight: 25 },
  { pattern: /\b(pay|salary) (daily|per day|every day)\b/i, flag: "Daily payment promises — common lure in task/click scams", weight: 15 },
];

export const scamPatternTool = tool(
  async ({ text }: { text: string }) => {
    const hits = SCAM_PATTERNS.filter((p) => p.pattern.test(text));
    const riskPoints = hits.reduce((s, h) => s + h.weight, 0);
    return JSON.stringify({
      matchedPatterns: hits.map((h) => h.flag),
      patternCount: hits.length,
      riskPoints: Math.min(100, riskPoints),
      assessment:
        hits.length === 0
          ? "No known scam-template patterns detected."
          : hits.length <= 1
            ? "One suspicious pattern found — warrants caution."
            : "Multiple known scam patterns found — high risk.",
    });
  },
  {
    name: "check_scam_patterns",
    description:
      "Scan the raw job posting text against a database of known job-scam patterns (upfront fees, reshipping, WhatsApp recruiting, fake-check tasks, etc). Returns matched red flags and a risk point total (0-100).",
    schema: z.object({
      text: z.string().describe("The full job posting / user description text to scan"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Tool 2: Salary realism checker
// ---------------------------------------------------------------------------
const SALARY_BANDS: Array<{ match: RegExp; role: string; low: number; high: number }> = [
  { match: /data entry|typist|typing/i, role: "Data entry", low: 25000, high: 45000 },
  { match: /virtual assistant|admin(istrative)? assistant|receptionist/i, role: "Admin/VA", low: 28000, high: 50000 },
  { match: /customer (service|support)/i, role: "Customer support", low: 30000, high: 55000 },
  { match: /junior|entry.?level|graduate|intern/i, role: "Junior/entry-level", low: 35000, high: 75000 },
  { match: /senior|staff|principal|lead/i, role: "Senior engineering/professional", low: 120000, high: 250000 },
  { match: /(software|web|full.?stack|backend|frontend|ml|machine learning|ai) (engineer|developer)/i, role: "Software engineer (mid)", low: 70000, high: 160000 },
  { match: /designer|marketing|content|copywrit/i, role: "Design/marketing", low: 40000, high: 95000 },
  { match: /driver|delivery|warehouse|picker|packer/i, role: "Driver/warehouse", low: 28000, high: 48000 },
  { match: /nurse|teacher|accountant/i, role: "Licensed professional", low: 45000, high: 95000 },
];

export const salaryRealismTool = tool(
  async ({ jobTitle, salaryText }: { jobTitle: string; salaryText: string }) => {
    // Extract annualised numbers from the salary text
    const nums = Array.from(salaryText.matchAll(/(\$|£|€)?\s?(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k|K)?\s*(\/|per\s*)?(hr|hour|day|week|month|yr|year|annum)?/g))
      .map((m) => {
        let n = parseFloat(m[2].replace(/,/g, ""));
        if (m[3]) n *= 1000;
        const unit = (m[5] || "year").toLowerCase();
        if (unit.startsWith("hr") || unit.startsWith("hour")) n *= 2080;
        else if (unit === "day") n *= 260;
        else if (unit === "week") n *= 52;
        else if (unit === "month") n *= 12;
        return n;
      })
      .filter((n) => n > 1000 && n < 5_000_000);

    const band = SALARY_BANDS.find((b) => b.match.test(jobTitle));
    if (nums.length === 0) {
      return JSON.stringify({
        verdict: "unknown",
        note: "No parseable salary figure found. Vague or hidden pay is itself a mild warning sign for high-pressure offers.",
      });
    }
    const annual = Math.max(...nums);
    if (!band) {
      return JSON.stringify({
        annualisedSalary: annual,
        verdict: annual > 300000 ? "suspiciously_high" : "no_reference_band",
        note: `No market band on file for "${jobTitle}". Annualised figure: ~${Math.round(annual).toLocaleString()}.`,
      });
    }
    const ratio = annual / band.high;
    const verdict =
      annual < band.low * 0.5 ? "suspiciously_low" : ratio <= 1.15 ? "realistic" : ratio <= 1.6 ? "above_market" : "suspiciously_high";
    return JSON.stringify({
      roleBand: band.role,
      marketRange: `${band.low.toLocaleString()}–${band.high.toLocaleString()}/yr`,
      annualisedSalary: Math.round(annual),
      verdict,
      note:
        verdict === "suspiciously_high"
          ? `Pay is ~${ratio.toFixed(1)}x the top of the market band — a classic too-good-to-be-true lure.`
          : verdict === "above_market"
            ? "Pay is above typical market range — plausible for top firms, but verify."
            : verdict === "suspiciously_low"
              ? "Pay is far below market — could indicate exploitation or a fake listing."
              : "Pay is within a realistic market range.",
    });
  },
  {
    name: "check_salary_realism",
    description:
      "Compare the offered salary against real market bands for the role. Handles hourly/daily/weekly/monthly/annual figures. Returns a verdict: realistic, above_market, suspiciously_high, suspiciously_low, or unknown.",
    schema: z.object({
      jobTitle: z.string().describe("The job title/role, e.g. 'junior ML engineer'"),
      salaryText: z.string().describe("The salary as mentioned, e.g. '£95k', '$45/hr', '5000 per week'"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Tool 3: Contact channel & email domain analyzer
// ---------------------------------------------------------------------------
const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|aol|proton(mail)?|icloud|mail|gmx|yandex|zoho)\./i;
const RISKY_CHANNELS = /\b(whatsapp|telegram|signal|wechat|sms|text message|instagram dm|facebook messenger)\b/i;
const OK_CHANNELS = /\b(linkedin|indeed|glassdoor|greenhouse|lever|workday|company (website|careers page)|careers? (page|site|portal))\b/i;

export const contactChannelTool = tool(
  async ({ text, companyName }: { text: string; companyName?: string }) => {
    const emails = Array.from(text.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)).map((m) => m[0]);
    const findings: string[] = [];
    let risk: "low" | "medium" | "high" = "low";

    if (RISKY_CHANNELS.test(text)) {
      findings.push("Contact/recruitment happens over a chat app or DM — a top indicator of job fraud.");
      risk = "high";
    }
    for (const e of emails) {
      if (FREE_MAIL.test(e)) {
        findings.push(`Recruiter uses a free email address (${e}) instead of a corporate domain.`);
        risk = risk === "high" ? "high" : "medium";
      } else if (companyName) {
        const domain = e.split("@")[1].toLowerCase();
        const compact = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (compact && !domain.replace(/[^a-z0-9]/g, "").includes(compact.slice(0, Math.min(compact.length, 6)))) {
          findings.push(`Email domain "${domain}" does not obviously match the claimed company "${companyName}" — possible lookalike/impersonation.`);
          risk = risk === "high" ? "high" : "medium";
        } else {
          findings.push(`Email domain "${domain}" plausibly matches the claimed company.`);
        }
      }
    }
    if (OK_CHANNELS.test(text) && risk === "low") {
      findings.push("Application goes through a legitimate platform or the company's own careers page.");
    }
    if (findings.length === 0) {
      findings.push("No explicit contact channel or email mentioned — unable to verify how they reached out.");
    }
    return JSON.stringify({ channelRisk: risk, emailsFound: emails, findings });
  },
  {
    name: "analyze_contact_channel",
    description:
      "Analyse how the 'recruiter' contacted the user and any email addresses in the text: chat-app recruiting, free-mail addresses, and domain/company mismatches (impersonation). Returns channelRisk low/medium/high with findings.",
    schema: z.object({
      text: z.string().describe("Full job posting / description text"),
      companyName: z.string().optional().describe("Claimed company name, if identified"),
    }),
  }
);

export const forensicTools = [scamPatternTool, salaryRealismTool, contactChannelTool];
