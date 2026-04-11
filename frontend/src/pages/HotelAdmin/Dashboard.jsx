import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { hotelAPI, roomAPI, bookingAPI } from '../../services/api';
import StatsCard from '../../components/StatsCard';
import { DoorOpen, Calendar, TrendingUp, Users, DollarSign, CheckCircle, ArrowRight, UtensilsCrossed } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function HotelAdminDashboard() {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency } = useCurrencyStore();
  const hotelId = getHotelId();
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) {
      loadDashboardData();
    }
  }, [hotelId]);

  const loadDashboardData = async () => {
    if (!hotelId) {
      setLoading(false);
      return;
    }

    try {
      const [hotelStats, bookingsData, hotelData] = await Promise.all([
        hotelAPI.getStats(hotelId),
        bookingAPI.getByHotel(hotelId, { limit: 5 }),
        hotelAPI.getById(hotelId),
      ]);

      setStats(hotelStats.stats || {});
      setRecentBookings(bookingsData.bookings || []);
      setHotel(hotelData.hotel);
      toast.success(t('common.refresh_success') || 'Dashboard updated'); // Feedback for refresh
    } catch (error) {
      toast.error(t('common.error_loading') || 'Failed to load dashboard data');
      console.error(error);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      toast.loading('Generating report...', { id: 'download-report' });
      const response = await bookingAPI.exportBookings(hotelId);

      // Create a blob link to download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hotel-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Report downloaded', { id: 'download-report' });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download report', { id: 'download-report' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('dashboard.loading')}</div>
      </div>
    );
  }

  if (!hotelId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('dashboard.no_hotel')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {hotel?.logo && (
            <img
              src={hotel.logo}
              alt={hotel.name}
              className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-100"
            />
          )}
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {hotel?.name || t('dashboard.executive_dashboard')}
            </h1>
            <p className="text-slate-500 font-medium">{t('dashboard.monitoring')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="btn btn-secondary px-4 py-2 text-sm flex items-center gap-2"
          >
            {t('common.refresh')}
          </button>
          <button
            onClick={handleDownloadReport}
            className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            {t('common.download_report')}
          </button>
        </div>
      </div>



      {/* Subscription Status */}
      {
        stats?.subscription ? (
          <div className="card p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-20 -translate-y-20 blur-3xl" />

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">{t('dashboard.subscription.current_plan')}</p>
                  <h3 className="text-2xl font-black">{stats.subscription.plan_name}</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 backdrop-blur-sm text-xs font-bold mt-2">
                    <div className={`w-2 h-2 rounded-full ${stats.subscription.days_left < 7 ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                    {stats.subscription.days_left > 0 ? t('dashboard.subscription.days_left', { count: Math.ceil(stats.subscription.days_left) }) : t('dashboard.subscription.expired')}
                  </span>
                </div>
                <div className="hidden sm:block">
                  {/* Decorative Icon */}
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-white/90">{t('dashboard.subscription.room_limit')}</span>
                    <span className="text-white/90">{stats.total_rooms} / {stats.subscription.max_rooms}</span>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (stats.total_rooms / stats.subscription.max_rooms) * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-white/90">{t('dashboard.subscription.monthly_bookings')}</span>
                    <span className="text-white/90">{stats.active_bookings} / {stats.subscription.max_bookings}</span>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (stats.active_bookings / stats.subscription.max_bookings) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {stats.subscription.days_left < 7 && (
                <div className="mt-6 flex items-center gap-2 text-sm font-medium bg-rose-500/20 p-3 rounded-lg border border-rose-500/30">
                  <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  {t('dashboard.subscription.expiring_soon')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-6 bg-slate-900 text-white relative overflow-hidden border border-slate-800">
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30 flex-shrink-0">
                <div className="w-8 h-8 text-rose-500">⚠️</div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-1">{t('dashboard.subscription.no_active')}</h3>
                <p className="text-slate-400 max-w-xl">
                  {t('dashboard.subscription.restricted')}
                </p>
                <div className="mt-4 flex gap-3">
                  <button className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-colors">
                    {t('dashboard.subscription.contact_support')}
                  </button>
                  <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors">
                    {t('dashboard.subscription.view_plans')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatsCard
          title={t('dashboard.stats.inventory')}
          value={stats?.total_rooms || 0}
          icon={DoorOpen}
          color="primary"
          trend={{ direction: 'up', value: 12, label: t('dashboard.stats.vs_last_month') }}
        />
        <StatsCard
          title={t('dashboard.stats.availability')}
          value={stats?.available_rooms || 0}
          icon={CheckCircle}
          color="green"
        />
        <StatsCard
          title={t('dashboard.stats.reservations')}
          value={stats?.active_bookings || 0}
          icon={Calendar}
          color="blue"
          trend={{ direction: 'up', value: 8, label: t('dashboard.stats.this_week') }}
        />
        <StatsCard
          title={t('dashboard.stats.revenue')}
          value={formatCurrency(stats?.total_revenue || 0)}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* Service Requests Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4" /> {t('dashboard.service_requests.title')}
          </h2>
          <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-2 py-1 rounded-lg uppercase tracking-widest">{t('dashboard.service_requests.live_updates')}</span>
        </div>
 
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 border-amber-100 bg-amber-50/30 group hover:bg-amber-50 hover:border-amber-200 transition-all cursor-pointer">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 group-hover:translate-x-1 transition-transform">{t('dashboard.service_requests.incoming')}</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">{stats?.pending_services || 0}</span>
              <span className="text-[10px] font-bold text-amber-500 mb-1 animate-pulse italic">{t('dashboard.service_requests.new')}</span>
            </div>
          </div>
 
          <div className="card p-5 border-blue-100 bg-blue-50/30 group hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 group-hover:translate-x-1 transition-transform">{t('dashboard.service_requests.accepted')}</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">{stats?.accepted_services || 0}</span>
              <span className="text-[10px] font-bold text-blue-500 mb-1 italic">{t('dashboard.service_requests.queued')}</span>
            </div>
          </div>
 
          <div className="card p-5 border-indigo-100 bg-indigo-50/30 group hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer">
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 group-hover:translate-x-1 transition-transform">{t('dashboard.service_requests.in_progress')}</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">{stats?.in_progress_services || 0}</span>
              <span className="text-[10px] font-bold text-indigo-500 mb-1 italic">{t('dashboard.service_requests.active')}</span>
            </div>
          </div>
 
          <div className="card p-5 border-emerald-100 bg-emerald-50/30 group hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 group-hover:translate-x-1 transition-transform">{t('dashboard.service_requests.completed')}</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">{stats?.completed_services || 0}</span>
              <span className="text-[10px] font-bold text-emerald-500 mb-1 italic">{t('dashboard.service_requests.done')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Occupancy Rate */}
        <div className="lg:col-span-1 card p-8 bg-gradient-to-br from-white to-slate-50">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">{t('dashboard.analytics.capacity')}</h2>
 
          <div className="flex flex-col items-center justify-center py-10 relative">
            {/* Simple circular progress simulation using a large font and a ring */}
            <div className="w-48 h-48 rounded-full border-[12px] border-slate-100 flex flex-col items-center justify-center group">
              <span className="text-5xl font-black text-slate-900">
                {stats?.total_rooms > 0
                  ? Math.round(((Number(stats?.total_rooms) - Number(stats?.available_rooms)) / Number(stats?.total_rooms)) * 100)
                  : 0}%
              </span>
              <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest mt-1">{t('dashboard.analytics.occupancy')}</span>
            </div>
 
            <div className="grid grid-cols-2 w-full mt-10 gap-4">
              <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100/50">
                <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest">{t('dashboard.analytics.occupied')}</p>
                <p className="text-xl font-black text-slate-900">{Number(stats?.total_rooms || 0) - Number(stats?.available_rooms || 0)}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{t('dashboard.analytics.vacant')}</p>
                <p className="text-xl font-black text-slate-900">{stats?.available_rooms || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="lg:col-span-2 card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">{t('dashboard.activity.recent')}</h2>
            <button className="text-xs font-bold text-primary-600 hover:text-primary-700 uppercase tracking-widest">{t('common.view_all')}</button>
          </div>
 
          {recentBookings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium">{t('dashboard.activity.no_activity')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-5 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                      <Users className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{booking.guest_name}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        {booking.rooms?.map(r => r.room_number).join(', ') || booking.room_number || 'TBA'} • {format(new Date(booking.check_in_date), 'MMM dd')} - {format(new Date(booking.check_out_date), 'MMM dd')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{formatCurrency(booking.total_amount)}</p>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg inline-block mt-2 ${booking.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                      booking.status === 'CHECKED_IN' ? 'bg-primary-100 text-primary-700' :
                        booking.status === 'CHECKED_OUT' ? 'bg-slate-200 text-slate-700' :
                          'bg-amber-100 text-amber-700'
                      }`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
