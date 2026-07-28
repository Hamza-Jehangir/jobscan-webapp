import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import Home from '@/pages/home';
import ScanResult from '@/pages/scan-result';
import History from '@/pages/history';
import NotFound from '@/pages/not-found';
import Navbar from '@/components/navbar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

function Router() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/scan/:id" component={ScanResult} />
        <Route path="/history" component={History} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

export default App;
