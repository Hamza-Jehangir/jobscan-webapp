import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useGetScan, getGetScanQueryKey } from '@workspace/api-client-react';
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Building2, Briefcase, DollarSign, Link2, RotateCcw,
  ChevronRight, Scan,
} from 'lucide-react';
import type { EvidenceItem, Scan as ScanType } from '@workspace/api-client-react';

// ── Verdict config ────────────────────────────────────────────────────────────

const VERDICT = {
  safe: {
    label: '✓ Looks legitimate',
    sub: 'No major concerns found.',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  caution: {
    label: '⚠ Worth double-checking',
    sub: 'Some things to look into before applying.',
    bar: 'bg-amber-400',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  risky: {
    label: '⚠ Probably not legitimate',
    sub: 'Several serious warning signs detected.',
    bar: 'bg-orange-500',
    text: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  scam: {
    label: '✕ This looks like a scam',
    sub: 'Do not apply or share any personal details.',
    bar: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700 border-red-200',
  },
} as const;

// ── Scanning animation ────────────────────────────────────────────────────────

const SCAN_STEPS = [
  'Identifying company and job details…',
  'Checking recruitment channel for red flags…',
  'Comparing salary against market benchmarks…',
  'Running 7 fraud pattern checks…',
  'Writing up your report…',
];

function ScanningState() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const delays = [900, 1800, 2700, 3600, 4500];
    const timers = delays.map((d, i) =>
      setTimeout(() => setStep(i + 1), d),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Spinning ring */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-4 border-blue-100 flex items-center justify-center">
          <Scan size={26} className="text-blue-600" />
        </div>
        <div
          className="absolute inset-0 rounded-full border-4 border-blue-700 border-t-transparent"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">We're on it</h2>
      <p className="text-sm text-gray-500 mb-8 max-w-xs leading-relaxed">
        Give us a few seconds — we're checking this against everything we know about job scams.
      </p>
      <div className="w-full max-w-xs space-y-3 text-left">
        {SCAN_STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-3">
            {i < step ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : i === step ? (
              <div
                className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent shrink-0"
                style={{ animation: 'spin 0.7s linear infinite' }}
              />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
            )}
            <span className={`text-sm transition-colors ${i <= step ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Trust meter (horizontal bar) ──────────────────────────────────────────────

function TrustMeter({ score, verdict }: { score: number; verdict: keyof typeof VERDICT }) {
  const cfg = VERDICT[verdict] ?? VERDICT.caution;
  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Trust score</p>
          <p className={`text-4xl font-black ${cfg.text}`}>
            {score}
            <span className="text-base font-normal text-gray-400 ml-1">/ 100</span>
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full border ${cfg.badge}`}>
            {cfg.label}
          </span>
          <p className={`text-xs mt-1.5 ${cfg.text} opacity-70`}>{cfg.sub}</p>
        </div>
      </div>
      <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${cfg.bar} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
        <span>Higher risk</span><span>Lower risk</span>
      </div>
    </div>
  );
}

// ── Evidence row ──────────────────────────────────────────────────────────────

function EvidenceRow({ item, index }: { item: EvidenceItem; index: number }) {
  const cfg = {
    pass: { Icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    warn: { Icon: AlertTriangle, color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
    fail: { Icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100' },
  }[item.status];
  const { Icon } = cfg;
  return (
    <div
      className={`flex gap-3 p-4 rounded-xl border ${cfg.border} ${cfg.bg} animate-fade-up`}
      style={{ animationDelay: `${index * 0.06}s`, opacity: 0 }}
      data-testid={`evidence-item-${index}`}
    >
      <Icon size={16} className={`${cfg.color} shrink-0 mt-0.5`} />
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-0.5">{item.label}</p>
        <p className="text-xs text-gray-600 leading-relaxed">{item.detail}</p>
      </div>
    </div>
  );
}

// ── Detail chip ───────────────────────────────────────────────────────────────

function DetailChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-gray-400 shrink-0" />
        <p className="text-sm font-semibold text-gray-800 leading-snug">{value}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ScanResult() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id, 10);

  const { data: scan, isLoading, isError } = useGetScan(id, {
    query: {
      enabled: !!id,
      queryKey: getGetScanQueryKey(id),
      refetchInterval: (q) => {
        const d = q.state.data as ScanType | undefined;
        if (!d) return 2000;
        return d.status === 'complete' || d.status === 'failed' ? false : 2000;
      },
    },
  });

  const backBtn = (
    <button
      data-testid="button-back"
      onClick={() => setLocation('/')}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors mb-6"
    >
      <ArrowLeft size={14} /> Back
    </button>
  );

  if (isLoading || !scan) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {backBtn}
        <ScanningState />
      </main>
    );
  }

  if (isError) return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      {backBtn}
      <div className="text-center py-20">
        <XCircle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="font-semibold text-gray-800 mb-1">Scan not found</p>
        <button onClick={() => setLocation('/')} className="mt-4 text-sm text-blue-700 hover:underline">Go home</button>
      </div>
    </main>
  );

  if (scan.status === 'pending' || scan.status === 'processing') {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {backBtn}
        <ScanningState />
      </main>
    );
  }

  if (scan.status === 'failed') {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {backBtn}
        <div className="text-center py-20">
          <XCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">
            {scan.summary?.toLowerCase().includes('timed out') ? 'Analysis timed out' : 'Analysis failed'}
          </p>
          <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
            {scan.summary || 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={() => setLocation('/')}
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
          >
            <RotateCcw size={13} /> Try again
          </button>
        </div>
      </main>
    );
  }

  const score = scan.trustScore ?? 0;
  const verdict = (scan.verdict ?? 'caution') as keyof typeof VERDICT;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      {backBtn}

      {/* Job detail chips */}
      {(scan.companyName || scan.jobTitle || scan.salary || scan.applicationChannel) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 animate-fade-up" style={{ opacity: 0 }}>
          <DetailChip icon={Building2}   label="Company"  value={scan.companyName} />
          <DetailChip icon={Briefcase}   label="Role"     value={scan.jobTitle} />
          <DetailChip icon={DollarSign}  label="Salary"   value={scan.salary} />
          <DetailChip icon={Link2}       label="Via"      value={scan.applicationChannel} />
        </div>
      )}

      {/* Trust meter */}
      <div className="mb-5 animate-fade-up stagger-1" style={{ opacity: 0 }}>
        <TrustMeter score={score} verdict={verdict} />
      </div>

      {/* AI summary */}
      {scan.summary && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 animate-fade-up stagger-2" style={{ opacity: 0 }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Here's what we found</p>
          <p className="text-sm text-gray-700 leading-relaxed" data-testid="text-summary">{scan.summary}</p>
        </div>
      )}

      {/* Evidence chain */}
      {scan.evidence && scan.evidence.length > 0 && (
        <div className="mb-5 animate-fade-up stagger-3" style={{ opacity: 0 }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">The detail</p>
          <div className="space-y-2">
            {scan.evidence.map((item, i) => <EvidenceRow key={i} item={item} index={i} />)}
          </div>
        </div>
      )}

      {/* What to do next */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 animate-fade-up stagger-4" style={{ opacity: 0 }}>
        <p className="text-sm font-bold text-blue-900 mb-3">What should you do?</p>
        <ul className="space-y-2">
          {[
            "Search for the company directly on Google — don't use any link they sent you.",
            "Look for this exact role on the company's official careers page.",
            "Never pay a 'registration fee' or hand over bank details to a recruiter.",
            "Report it to Action Fraud (UK) or the FTC (US) if you believe it's fraudulent.",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <ChevronRight size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <span className="text-xs text-blue-800 leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Original query */}
      <div className="mt-5 bg-gray-50 border border-gray-100 rounded-xl p-4 animate-fade-up" style={{ opacity: 0, animationDelay: '0.35s' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Your description</p>
        <p className="text-xs text-gray-500 leading-relaxed italic">{scan.query}</p>
      </div>
    </main>
  );
}
