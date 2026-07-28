import { Link, useLocation } from "wouter";
import { Shield, History, Activity, Zap } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-5xl">
          <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">JobScan</span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors hover:text-primary ${location === '/' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              New Scan
            </Link>
            <Link 
              href="/history" 
              className={`text-sm font-medium transition-colors hover:text-primary ${location === '/history' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              History
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center mt-auto">
        <p className="text-xs text-muted-foreground font-mono">
          JobScan Forensic Analysis Engine &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
