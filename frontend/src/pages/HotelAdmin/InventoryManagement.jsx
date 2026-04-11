import { useState, useEffect } from 'react';
import { roomInventoryAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    CalendarDays,
    DoorOpen,
    Key,
    LogOut,
    LogIn,
    RefreshCw,
    TrendingUp,
    AlertCircle
} from 'lucide-react';

export default function InventoryManagement() {
    const { t, i18n } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const hotelId = getHotelId();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState(null);
    const [calendar, setCalendar] = useState(null);

    // Date range (default 30 days)
    const today = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(today.getDate() + 30);

    const [dateRange, setDateRange] = useState({
        start: today.toISOString().split('T')[0],
        end: thirtyDays.toISOString().split('T')[0]
    });

    useEffect(() => {
        if (hotelId) loadData();
    }, [hotelId, dateRange.start, dateRange.end]);

    const loadData = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            const [statsData, calendarData] = await Promise.all([
                roomInventoryAPI.getDashboardStats(hotelId),
                roomInventoryAPI.getCalendar(hotelId, dateRange.start, dateRange.end)
            ]);

            setStats(statsData.stats);
            setCalendar(calendarData);
        } catch (error) {
            toast.error(t('inventory.messages.load_error'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const StatCard = ({ title, value, icon: Icon, color, bg }) => (
        <div className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${bg} opacity-50 group-hover:scale-150 transition-transform duration-500`}></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
                        <h3 className="text-3xl font-black text-slate-900">{value}</h3>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg} shadow-sm`}>
                        <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
    );

    if (!hotelId) return <div>{t('inventory.messages.no_hotel')}</div>;

    // Render Calendar Grid
    const dates = calendar ? Object.keys(calendar.dates).sort() : [];
    const roomTypes = calendar?.roomTypes || [];

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <TrendingUp className="w-7 h-7 text-primary-600" />
                        {t('inventory.title')}
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">{t('inventory.subtitle')}</p>
                </div>
                <div className="flex space-x-3">
                    <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <CalendarDays className="w-4 h-4 text-slate-500" />
                        <input
                            type="date"
                            className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        />
                        <span className="text-slate-400">{t('inventory.to')}</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm flex items-center"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? t('inventory.refreshing') : t('inventory.refresh')}
                    </button>
                </div>
            </div>

            {/* Dashboard Stats */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title={t('inventory.stats.available')}
                        value={stats.availableRooms}
                        icon={DoorOpen}
                        color="text-emerald-600"
                        bg="bg-emerald-100"
                    />
                    <StatCard
                        title={t('inventory.stats.occupied')}
                        value={stats.occupiedRooms}
                        icon={Key}
                        color="text-amber-600"
                        bg="bg-amber-100"
                    />
                    <StatCard
                        title={t('inventory.stats.checkins')}
                        value={`${stats.completedCheckIns} / ${stats.totalCheckIns}`}
                        icon={LogIn}
                        color="text-blue-600"
                        bg="bg-blue-100"
                    />
                    <StatCard
                        title={t('inventory.stats.checkouts')}
                        value={`${stats.completedCheckOuts} / ${stats.totalCheckOuts}`}
                        icon={LogOut}
                        color="text-rose-600"
                        bg="bg-rose-100"
                    />
                </div>
            )}

            {/* Calendar Grid View */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-indigo-600" />
                        {t('inventory.forecast.title')}
                    </h2>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> {t('inventory.forecast.available')}</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> {t('inventory.forecast.booked')}</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div> {t('inventory.forecast.sold_out')}</div>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    {dates.length > 0 ? (
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr>
                                    <th className="px-6 py-4 font-bold text-slate-900 bg-white sticky left-0 z-10 border-r border-b border-slate-100 min-w-[200px] shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                                        {t('inventory.forecast.room_type')}
                                    </th>
                                    {dates.map(date => {
                                        const d = new Date(date);
                                        const isToday = d.toISOString().split('T')[0] === today.toISOString().split('T')[0];
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                                        return (
                                            <th key={date} className={`px-4 py-3 min-w-[70px] border-b border-slate-100 text-center ${isToday ? 'bg-indigo-50 border-b-indigo-200' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}>
                                                <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {d.toLocaleDateString(i18n.language, { weekday: 'short' })}
                                                </div>
                                                <div className={`text-sm font-black ${isToday ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                    {d.getDate()}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {roomTypes.map(type => (
                                    <tr key={type.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700 bg-white sticky left-0 z-10 border-r border-b border-slate-100 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                                            {type.name}
                                        </td>
                                        {dates.map(date => {
                                            const dayData = calendar.dates[date]?.[type.id];
                                            const available = dayData ? dayData.available : 0;
                                            const total = dayData ? dayData.total : 0;

                                            let bgClass = "bg-emerald-50 text-emerald-700";
                                            if (available === 0 && total > 0) bgClass = "bg-rose-50 text-rose-700 font-bold";
                                            else if (available < total * 0.3) bgClass = "bg-amber-50 text-amber-700";

                                            const d = new Date(date);
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                                            return (
                                                <td key={`${type.id}-${date}`} className={`px-2 py-3 border-b border-slate-100 text-center ${isWeekend ? 'bg-slate-50/50' : ''}`}>
                                                    {dayData ? (
                                                        <div className={`mx-auto w-10 h-10 flex items-center justify-center rounded-xl text-base font-bold ${bgClass} transition-all cursor-pointer hover:scale-110 shadow-sm`} title={`Total: ${total} | Booked: ${dayData.booked} | Price: ${formatCurrency(dayData.price)}`}>
                                                            {available}
                                                        </div>
                                                    ) : (
                                                        <div className="mx-auto w-10 h-10 flex items-center justify-center text-slate-300">-</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-12 text-center flex flex-col items-center">
                            <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900">{t('inventory.messages.no_data')}</h3>
                            <p className="text-slate-500 mt-2 max-w-md mx-auto">
                                {t('inventory.messages.no_data_help')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
