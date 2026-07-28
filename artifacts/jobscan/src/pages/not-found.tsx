import { useLocation } from 'wouter';
import { ShieldOff } from 'lucide-react';

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <main className="max-w-xl mx-auto px-4 flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-5">
        <ShieldOff size={24} className="text-gray-400" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Page not found</h1>
      <p className="text-sm text-gray-500 mb-6">This page doesn't exist.</p>
      <button
        onClick={() => setLocation('/')}
        className="px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 transition-colors"
      >
        Go home
      </button>
    </main>
  );
}
