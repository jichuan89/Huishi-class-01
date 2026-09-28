import React, { lazy, Suspense, useEffect, useState } from 'react';
import AdminUsers from './AdminUsers';
import Dashboard from './Dashboard';
import Landing, { MarketingPage } from './Landing';
import Login, { AuthUser } from './Login';
import ModelGenerationStudio from './components/ModelGenerationStudio';
import { useTheme } from './components/ThemeProvider';
import { isThemeId } from './services/theme';

type AppView = 'landing' | 'login' | 'dashboard' | 'admin' | 'model-generation' | 'prep-studio';

const PrepStudioPage = lazy(() => import('./prep/PrepStudioPage'));

const MARKETING_ROUTES: Record<MarketingPage, string> = {
  home: '/',
  solutions: '/solutions',
  cases: '/cases',
  pricing: '/pricing',
  docs: '/docs',
  join: '/join',
};

function marketingPageFromPath(pathname: string): MarketingPage {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.entries(MARKETING_ROUTES) as [MarketingPage, string][])
    .find(([, path]) => path === normalizedPath);
  return match?.[0] || 'home';
}

async function readError(response: Response) {
  try {
    const data = await response.json();
    return data.message || '请求失败';
  } catch {
    return '请求失败';
  }
}

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [marketingPage, setMarketingPage] = useState<MarketingPage>(() => marketingPageFromPath(window.location.pathname));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [localModelId, setLocalModelId] = useState<string | null>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    if (user?.theme && isThemeId(user.theme)) {
      setTheme(user.theme, { remote: true });
    }
  }, [user?.theme, setTheme]);

  useEffect(() => {
    let isMounted = true;
    const initialMarketingPage = marketingPageFromPath(window.location.pathname);

    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) throw new Error(await readError(response));
        const data = await response.json();

        if (isMounted) {
          setUser(data.user);
          if (initialMarketingPage === 'home') {
            setView(data.user.role === 'admin' ? 'admin' : 'dashboard');
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setView('landing');
        }
      } finally {
        if (isMounted) setIsCheckingAuth(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setMarketingPage(marketingPageFromPath(window.location.pathname));
      setView('landing');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleMarketingNavigate = (page: MarketingPage) => {
    const path = MARKETING_ROUTES[page];
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setMarketingPage(page);
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleEnter = () => {
    if (user) {
      setView(user.role === 'admin' ? 'admin' : 'dashboard');
      return;
    }
    setView('login');
  };

  const handleAuthenticated = (nextUser: AuthUser) => {
    setUser(nextUser);
    setView(nextUser.role === 'admin' ? 'admin' : 'dashboard');
  };

  const handleUserUpdated = (nextUser: AuthUser) => {
    setUser(nextUser);
  };

  const handleBackToLanding = () => {
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
    setMarketingPage('home');
    setView('landing');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      setLocalModelId(null);
      setView('login');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] text-ink flex items-center justify-center">
        <div className="rounded-lg border border-line/10 bg-white/[0.04] px-6 py-4 text-sm text-ink/60">
          正在恢复登录状态...
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <Login onAuthenticated={handleAuthenticated} onBack={handleBackToLanding} />
    );
  }

  if (view === 'admin' && user?.role === 'admin') {
    return (
      <AdminUsers
        currentUser={user}
        onEnterDashboard={() => setView('dashboard')}
        onLogout={handleLogout}
      />
    );
  }

  if (view === 'model-generation' && user) {
    return (
      <ModelGenerationStudio
        ownerId={user.id}
        onBack={() => setView('dashboard')}
        onImportModel={(modelId) => {
          setLocalModelId(modelId);
          setView('dashboard');
        }}
      />
    );
  }

  if (view === 'prep-studio' && user) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#f5f7fb] grid place-items-center text-sm text-slate-600">正在打开备课工作台...</div>}>
        <PrepStudioPage onBack={() => setView('dashboard')} />
      </Suspense>
    );
  }

  if (view === 'dashboard' && user) {
    return (
      <Dashboard
        playIntro={!localModelId}
        initialLocalModelId={localModelId || undefined}
        currentUser={user}
        onBack={() => setView('landing')}
        onLogout={handleLogout}
        onUserUpdated={handleUserUpdated}
        onOpenModelGeneration={() => setView('model-generation')}
        onOpenPrepStudio={() => setView('prep-studio')}
        onOpenAdmin={user.role === 'admin' ? () => setView('admin') : undefined}
      />
    );
  }

  return (
    <Landing
      page={marketingPage}
      onNavigate={handleMarketingNavigate}
      onEnter={handleEnter}
    />
  );
}
