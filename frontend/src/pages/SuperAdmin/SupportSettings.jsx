import { useState, useEffect } from 'react';
import { hotelAPI, settingsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
    Building2,
    Phone,
    Mail,
    MessageCircle,
    Save,
    Loader2,
    Search,
    Settings as SettingsIcon
} from 'lucide-react';

export default function SupportSettings() {
    const { t } = useTranslation();
    const [hotels, setHotels] = useState([]);
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        support_phone: '',
        support_email: '',
        support_whatsapp: ''
    });

    useEffect(() => {
        loadHotels();
    }, []);

    const loadHotels = async () => {
        try {
            const data = await hotelAPI.getAll();
            setHotels(data.hotels || []);
        } catch (error) {
            toast.error('Failed to load hotels');
        } finally {
            setLoading(false);
        }
    };

    const loadHotelSettings = async (hotelId) => {
        try {
            setLoading(true);
            const settings = await settingsAPI.getSettings(hotelId);
            setFormData({
                support_phone: settings.support_phone || '',
                support_email: settings.support_email || '',
                support_whatsapp: settings.support_whatsapp || ''
            });
        } catch (error) {
            toast.error('Failed to load hotel settings');
        } finally {
            setLoading(false);
        }
    };

    const handleHotelSelect = (hotel) => {
        setSelectedHotel(hotel);
        loadHotelSettings(hotel.id);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHotel) return;

        setSaving(true);
        try {
            await settingsAPI.updateSettings(formData, selectedHotel.id);
            toast.success(t('support.superadmin.save_success'));
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const filteredHotels = hotels.filter(h =>
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.city?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && hotels.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('support.superadmin.title')}</h1>
                    <p className="text-gray-600">{t('support.superadmin.subtitle')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hotel Selection List */}
                <div className="lg:col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-250px)]">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary-600" />
                        {t('support.superadmin.select_hotel')}
                    </h2>

                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 transition-all"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {filteredHotels.map(hotel => (
                            <button
                                key={hotel.id}
                                onClick={() => handleHotelSelect(hotel)}
                                className={`w-full text-left p-4 rounded-2xl transition-all ${selectedHotel?.id === hotel.id
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="font-bold truncate">{hotel.name}</div>
                                    <div className="text-[10px] font-mono font-black bg-white/20 px-2 py-0.5 rounded-lg border border-white/10">{hotel.hotel_id_code}</div>
                                </div>
                                <div className={`text-xs ${selectedHotel?.id === hotel.id ? 'text-primary-100' : 'text-slate-500'} mt-1`}>
                                    {hotel.city}, {hotel.country}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Configuration Form */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedHotel ? (
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
                                    <SettingsIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold text-slate-900">{selectedHotel.name}</h3>
                                        <span className="text-[10px] font-mono font-black border border-slate-200 px-2 py-0.5 rounded-lg text-slate-400 bg-slate-50 uppercase tracking-widest">{selectedHotel.hotel_id_code || 'NO ID'}</span>
                                    </div>
                                    <p className="text-sm text-slate-500">Configure support contact points for this hotel</p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Phone className="w-4 h-4" />
                                            {t('support.superadmin.phone_label')}
                                        </label>
                                        <input
                                            type="tel"
                                            placeholder="+1 234 567 8900"
                                            value={formData.support_phone}
                                            onChange={(e) => setFormData({ ...formData, support_phone: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Mail className="w-4 h-4" />
                                            {t('support.superadmin.email_label')}
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="support@hotel.com"
                                            value={formData.support_email}
                                            onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4" />
                                            {t('support.superadmin.whatsapp_label')}
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">wa.me/</span>
                                            <input
                                                type="text"
                                                placeholder="1234567890"
                                                value={formData.support_whatsapp}
                                                onChange={(e) => setFormData({ ...formData, support_whatsapp: e.target.value })}
                                                className="w-full pl-16 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 transition-all"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium px-2">Enter phone number with country code, no space or plus (e.g., 18001234567)</p>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        {t('common.save_changes')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                                <Building2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No Hotel Selected</h3>
                            <p className="text-slate-500 max-w-xs">Select a hotel from the sidebar to configure its support contact information.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
