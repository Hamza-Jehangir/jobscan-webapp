import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCreateScan, useListScans } from '@workspace/api-client-react';
import { toast } from 'sonner';
import {
  ArrowRight, Building2, Link2, AlertTriangle,
  Lock, Zap, ShieldCheck, ChevronRight,
  Clock, XCircle, CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Scan } from '@workspace/api-client-react';

const EXAMPLES = [
  'Junior ML Engineer at Google DeepMind, £95k salary, asked to apply via WhatsApp',
  'Remote data entry $5000/week, no experience needed, wants my bank details upfront',
  'Software Engineer at Stripe, LinkedIn listing, £70k, recruiter email @stripe.com',
];

const SCAN_STEPS = [
  'Identifying company and job details…',
  'Checking the recruitment channel for red flags…',
  'Comparing salary against market benchmarks…',
  'Running 7 fraud pattern checks…',
  'Writing up your report…',
];

// ── Shared helpers ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return null;
  const map: Record<string, string> = {
    safe:    'bg-emerald-100 text-emerald-700 border-emerald-200',
    caution: 'bg-amber-100  text-amber-700  border-amber-200',
    risky:   'bg-orange-100 text-orange-700 border-orange-200',
    scam:    'bg-red-100    text-red-700    border-red-200',
  };
  const labels: Record<string, string> = {
    safe: 'Safe', caution: 'Caution', risky: 'High Risk', scam: 'Scam',
  };
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${map[verdict] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {labels[verdict] ?? verdict}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : score >= 25 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

// ── Recent scan card ──────────────────────────────────────────────────────────

function ScanCard({ scan, index }: { scan: Scan; index: number }) {
  const [, setLocation] = useLocation();
  const isPending = scan.status === 'pending' || scan.status === 'processing';
  return (
    <button
      data-testid={`scan-card-${scan.id}`}
      onClick={() => setLocation(`/scan/${scan.id}`)}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all duration-150 group animate-fade-up"
      style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 truncate">
              {scan.companyName ?? 'Unknown company'}
            </span>
            {isPending
              ? <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1"><Clock size={10} className="animate-spin" /> Scanning…</span>
              : <VerdictBadge verdict={scan.verdict} />
            }
          </div>
          <p className="text-xs text-gray-500 truncate">{scan.jobTitle ?? scan.query}</p>
          {!isPending && <div className="mt-2"><ScoreBar score={scan.trustScore} /></div>}
        </div>
        <div className="text-right shrink-0">
          <span className="text-[11px] text-gray-400">
            {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
          </span>
          <p className="text-xs text-blue-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View →</p>
        </div>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();
  const createScan = useCreateScan();
  const { data: recentScans } = useListScans();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 10) {
      toast.error('Give us a bit more detail — try describing the company and how they contacted you.');
      return;
    }
    createScan.mutate(
      { data: { query: query.trim() } },
      {
        onSuccess: (scan) => setLocation(`/scan/${scan.id}`),
        onError: () => toast.error('Something went wrong. Please try again.'),
      },
    );
  };

  const isSubmitting = createScan.isPending;

  return (
    <>
      {/* ── Blue hero ─────────────────────────────────────────────────────── */}
      <div className="bg-blue-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-16">
          <p className="text-sm font-medium text-blue-200 mb-3">
            Seen a suspicious job offer?
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">
            We'll look into it —{' '}
            <span className="text-blue-200">right now.</span>
          </h1>
          <p className="text-blue-100 text-base max-w-lg leading-relaxed">
            Describe it in plain English. We cross-check the company, the pay, how
            they contacted you, and more — then give you a clear, honest verdict.
          </p>
        </div>
      </div>

      {/* ── Input card (overlaps hero) ─────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-8">
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 sm:p-6">
            <label htmlFor="job-query" className="block text-sm font-bold text-gray-800 mb-0.5">
              Tell us about this job
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Include the company name, role, salary, and how they contacted you — the more detail, the better.
            </p>
            <textarea
              id="job-query"
              data-testid="input-query"
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none disabled:opacity-60 transition-all"
              placeholder="e.g. Someone messaged me on WhatsApp saying they're from Google, offering a £95k junior ML role. The application link goes to a Google Form…"
            />

            <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-400 mr-1">Try:</span>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid={`example-${i}`}
                    onClick={() => setQuery(ex)}
                    disabled={isSubmitting}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 disabled:opacity-50"
                  >
                    example {i + 1}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                data-testid="button-submit"
                disabled={isSubmitting || !query.trim()}
                className="flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Zap size={14} />
                {isSubmitting ? 'Submitting…' : 'Check it now'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Recent scans */}
        {recentScans && recentScans.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Recent scans</h2>
              <a href="/history" className="text-xs text-blue-600 hover:underline font-medium">View all →</a>
            </div>
            <div className="space-y-2">
              {recentScans.slice(0, 4).map((scan, i) => (
                <ScanCard key={scan.id} scan={scan} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* What we look for */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">What we look for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                icon: Building2,
                title: 'Is the company who they say they are?',
                desc: 'We verify the company is real, registered, and that this role actually exists on their site.',
              },
              {
                icon: Link2,
                title: 'How did they contact you?',
                desc: 'Legitimate employers never recruit through WhatsApp, Telegram, or random texts.',
              },
              {
                icon: ArrowRight,
                title: 'Does the salary make sense?',
                desc: "We compare it to real market data. Way above average? That's a classic warning sign.",
              },
              {
                icon: AlertTriangle,
                title: 'Does it match known scam patterns?',
                desc: '7 fraud signals are checked against every submission, every time.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-0.5">{title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <div className="flex items-center justify-center gap-6 flex-wrap text-xs text-gray-400 border-t border-gray-200 pt-6">
          {[
            { icon: Lock,        text: 'We never store your description' },
            { icon: Zap,         text: 'Results in under 10 seconds' },
            { icon: ShieldCheck, text: 'Free — no account needed' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5">
              <Icon size={13} className="text-gray-400" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
