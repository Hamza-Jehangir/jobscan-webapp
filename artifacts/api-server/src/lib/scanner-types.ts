export interface ScanResult {
  trustScore: number;
  verdict: "safe" | "caution" | "risky" | "scam";
  companyName: string | null;
  jobTitle: string | null;
  salary: string | null;
  applicationChannel: string | null;
  summary: string;
  evidence: Array<{ label: string; status: "pass" | "warn" | "fail"; detail: string }>;
}
