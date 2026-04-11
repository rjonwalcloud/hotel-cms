import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import SRNotificationManager from './SRNotificationManager';
import { useCurrencyStore } from '../store/currencyStore';

export default function Layout() {
  const { fetchCurrencySettings } = useCurrencyStore();

  useEffect(() => {
    fetchCurrencySettings();

    // Listen to currency-updated events to reload when settings change
    const listener = () => fetchCurrencySettings();
    window.addEventListener('currency-updated', listener);
    return () => window.removeEventListener('currency-updated', listener);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <SRNotificationManager />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 lg:p-10 overflow-y-auto scroll-smooth">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
