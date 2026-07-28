import { useLocation } from 'wouter';
import { useListScans, useGetStats, getListScansQueryKey, getGetStatsQueryKey } from '@workspace/api-client-react';
import { formatDistanceToNow } from 'date-fns';
import { BarChart3, ShieldCheck, XCircle, Clock, Search } from 'lucide-react';
import type { Scan } from '@workspace/api-client-react';

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
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-gray-400 w-6 text-right">{score}</span>
    </div>
  );
}

// ── Scan row ──────────────────────────────────────────────────────────────────

function ScanRow({ scan, index }: { scan: Scan; index: number }) {
  const [, setLocation] = useLocation();
  const isPending = scan.status === 'pending' || scan.status === 'processing';
  return (
    <button
      data-testid={`history-row-${scan.id}`}
      onClick={() => setLocation(`/scan/${scan.id}`)}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all duration-150 group animate-fade-up"
      style={{ animationDelay: `${index * 0.04}s`, opacity: 0 }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-gray-800 truncate">
              {scan.companyName ?? 'Unknown company'}
            </span>
            {scan.jobTitle && <span className="text-xs text-gray-500">{scan.jobTitle}</span>}
            {isPending
              ? <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1"><Clock size={10} className="animate-spin" /> Scanning…</span>
              : <VerdictBadge verdict={scan.verdict} />
            }
          </div>
          <p className="text-xs text-gray-400 line-clamp-1">{scan.query}</p>
          {!isPending && <ScoreBar score={scan.trustScore} />}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[11px] text-gray-400">
            {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
          </span>
          <p className="text-xs text-blue-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View →</p>
        </div>
      </div>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function History() {
  const { data: scans, isLoading } = useListScans({ query: { queryKey: getListScansQueryKey() } });
  const { data: stats } = useGetStats({ query: { queryKey: getGetStatsQueryKey() } });

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-24">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Scan history</h1>
        <p className="text-sm text-gray-500">Every job you've asked us to check, most recent first.</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total scans',   value: stats.totalScans,                   icon: BarChart3,  color: 'text-blue-600',    bg: 'bg-blue-50'   },
            { label: 'Avg trust',     value: stats.averageTrustScore != null ? `${Math.round(stats.averageTrustScore)}` : '—', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Scams/risky',  value: stats.scamCount + stats.riskyCount,  icon: XCircle,    color: 'text-red-500',     bg: 'bg-red-50'    },
            { label: 'Safe/caution', value: `${stats.safeCount} / ${stats.cautionCount}`, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon size={14} className={color} />
              </div>
              <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Risk distribution */}
      {stats && stats.totalScans > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Risk breakdown</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {stats.safeCount    > 0 && <div className="bg-emerald-500" style={{ flex: stats.safeCount }}    title={`Safe: ${stats.safeCount}`} />}
            {stats.cautionCount > 0 && <div className="bg-amber-400"   style={{ flex: stats.cautionCount }} title={`Caution: ${stats.cautionCount}`} />}
            {stats.riskyCount   > 0 && <div className="bg-orange-500"  style={{ flex: stats.riskyCount }}   title={`Risky: ${stats.riskyCount}`} />}
            {stats.scamCount    > 0 && <div className="bg-red-500"     style={{ flex: stats.scamCount }}    title={`Scam: ${stats.scamCount}`} />}
          </div>
          <div className="flex items-center gap-5 mt-3 flex-wrap">
            {[
              { color: 'bg-emerald-500', label: 'Safe',    n: stats.safeCount    },
              { color: 'bg-amber-400',   label: 'Caution', n: stats.cautionCount },
              { color: 'bg-orange-500',  label: 'Risky',   n: stats.riskyCount   },
              { color: 'bg-red-500',     label: 'Scam',    n: stats.scamCount    },
            ].map(({ color, label, n }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-xs text-gray-500">{label} <span className="font-bold text-gray-700">{n}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white border border-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && scans && scans.length > 0 && (
        <div className="space-y-2">
          {scans.map((scan, i) => <ScanRow key={scan.id} scan={scan} index={i} />)}
        </div>
      )}

      {!isLoading && (!scans || scans.length === 0) && (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-600 mb-1">No scans yet</p>
          <p className="text-xs text-gray-400 mb-5">Head to the home page to check your first job.</p>
          <a href="/" className="text-sm text-blue-700 font-semibold hover:underline">Check a job now →</a>
        </div>
      )}
    </main>
  );
}
