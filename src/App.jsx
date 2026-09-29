import { useEffect, useState } from 'react';
import { supabase, configOk } from './supabase';
import { useParkData } from './useParkData';
import Login from './Login.jsx';
import Home from './Home.jsx';
import MapPage from './MapPage.jsx';
import Events from './Events.jsx';
import Dogs from './Dogs.jsx';

export const APP_NAME = 'Field Guide'; // working name — change anytime

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'map', label: 'Map' },
  { key: 'events', label: 'Events' },
  { key: 'dogs', label: 'My Dogs' },
];

export default function App() {
  if (!configOk) {
    return (
      <div className="page">
        <h1>Almost there</h1>
        <p>
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your
          environment variables, then redeploy.
        </p>
      </div>
    );
  }
  return <Root />;
}

function Root() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="page muted">Loading…</div>;
  if (!session) return <Login appName={APP_NAME} />;
  return <Shell session={session} />;
}

function useHashTab() {
  const read = () => {
    const key = window.location.hash.slice(1);
    return TABS.some((t) => t.key === key) ? key : 'home';
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onChange = () => { setTab(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return tab;
}

function Shell({ session }) {
  const tab = useHashTab();
  const data = useParkData(session);
  const [selectedId, setSelectedId] = useState(null);

  const viewPark = (id) => {
    setSelectedId(id);
    window.location.hash = 'map';
  };

  return (
    <div className="app">
      <header className="topbar">
        <a href="#home" className="brand">{APP_NAME}</a>
        <nav className="nav" aria-label="Main">
          {TABS.map((t) => (
            <a key={t.key} href={`#${t.key}`} aria-current={tab === t.key ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="main">
        {tab === 'home' && <Home data={data} session={session} onViewPark={viewPark} />}
        {tab === 'map' && <MapPage data={data} selectedId={selectedId} setSelectedId={setSelectedId} />}
        {tab === 'events' && <Events data={data} session={session} />}
        {tab === 'dogs' && <Dogs data={data} session={session} />}
      </main>
    </div>
  );
}
