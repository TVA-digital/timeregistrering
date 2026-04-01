import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const pageTitles: Record<string, string> = {
  '/': 'Hjem',
  '/timeliste': 'Mine timer',
  '/send-inn': 'Send inn timer',
  '/fravar': 'Mitt fravær',
  '/fravar/nytt': 'Søk om fravær',
  '/varsler': 'Varsler',
  '/leder': 'Team-oversikt',
  '/leder/godkjenn-timer': 'Godkjenn timer',
  '/leder/godkjenn-fravar': 'Godkjenn fravær',
  '/admin/brukere': 'Brukere',
  '/admin/avdelinger': 'Avdelinger',
  '/admin/grupper': 'Grupper',
  '/admin/arbeidsplaner': 'Arbeidsplaner',
  '/admin/overtidsregler': 'Overtidsregler',
  '/admin/fravaerskoder': 'Fraværskoder',
  '/lonning/eksport': 'Lønnseksport',
};

export function AppLayout() {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] ?? 'Timeregistrering';
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Backdrop for mobil-drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={title} onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
