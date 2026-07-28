import { Link, useLocation } from 'wouter';
import { BadgeCheck, History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGetStats } from '@workspace/api-client-react';

const LIVE_MESSAGES = [
  'Scanning active — ready for your next job',
  'Watching for new scam patterns',
  '7 fraud signals checked per scan',
  'Free · Private · No account needed',
];

function PulsingDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 shrink-0 ${className}`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    </span>
  );
}

export default function Navbar() {
  const [location] = useLocation();
  const [msgIdx, setMsgIdx] = useState(0);
  const { data: stats } = useGetStats();

  // Build live messages — inject real scan count if available
  const messages = stats?.totalScans
    ? [`${stats.totalScans.toLocaleString()} jobs checked so far`, ...LIVE_MESSAGES]
    : LIVE_MESSAGES;

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 3200);
    return () => clearInterval(t);
  }, [messages.length]);

  const isHistory = location.startsWith('/history');

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="nav-logo">
          <BadgeCheck size={20} className="text-blue-700" />
          <span className="font-bold text-gray-900 text-[15px] tracking-tight">JobScan</span>
        </Link>

        {/* Live ticker — hidden on small screens */}
        <div className="hidden sm:flex items-center gap-2 min-w-0 flex-1">
          <PulsingDot />
          <span
            key={msgIdx}
            className="text-xs text-gray-500 truncate animate-fade-in"
          >
            {messages[msgIdx]}
          </span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/"
            data-testid="nav-scan"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !isHistory ? 'text-blue-700 bg-blue-50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Check a job
          </Link>
          <Link
            href="/history"
            data-testid="nav-history"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isHistory ? 'text-blue-700 bg-blue-50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <History size={14} />
            History
          </Link>
        </div>
      </div>
    </nav>
  );
}
