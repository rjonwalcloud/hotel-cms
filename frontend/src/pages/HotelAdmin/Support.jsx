import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import {
    Phone,
    Mail,
    MessageCircle,
    Loader2,
    ChevronRight,
    HeadphonesIcon,
    ExternalLink
} from 'lucide-react';

export default function Support() {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, [user.hotel_id]);

    const loadSettings = async () => {
        try {
            const data = await settingsAPI.getSettings(user.hotel_id);
            setSettings(data);
        } catch (error) {
            console.error('Failed to load support settings', error);
        } finally {
            setLoading(false);
        }
    };

    const openWhatsApp = (number) => {
        const cleanNumber = number.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanNumber}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    const hasAnyContact = settings?.support_phone || settings?.support_email || settings?.support_whatsapp;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            {/* Header Section */}
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-50 rounded-[2rem] text-primary-600 mb-6 shadow-xl shadow-primary-100/50">
                    <HeadphonesIcon className="w-10 h-10" />
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
                    {t('support.title')}
                </h1>
                <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">
                    {t('support.subtitle')}
                </p>
            </div>

            {!hasAnyContact ? (
                <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                        <Mail className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 font-bold">{t('support.no_config')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Support Cards */}
                    {settings.support_phone && (
                        <a
                            href={`tel:${settings.support_phone}`}
                            className="group bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-primary-100/50 transition-all duration-300 flex flex-col items-center text-center"
                        >
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                                <Phone className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('support.phone')}</h3>
                            <p className="text-slate-500 font-bold mb-6">{settings.support_phone}</p>
                            <div className="mt-auto w-full py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {t('support.call_now')}
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </a>
                    )}

                    {settings.support_whatsapp && (
                        <button
                            onClick={() => openWhatsApp(settings.support_whatsapp)}
                            className="group bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-300 flex flex-col items-center text-center"
                        >
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                                <MessageCircle className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('support.whatsapp')}</h3>
                            <p className="text-slate-500 font-bold mb-6">WhatsApp Business</p>
                            <div className="mt-auto w-full py-3 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                {t('support.chat_whatsapp')}
                                <ExternalLink className="w-4 h-4" />
                            </div>
                        </button>
                    )}

                    {settings.support_email && (
                        <a
                            href={`mailto:${settings.support_email}`}
                            className="group bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-300 flex flex-col items-center text-center md:col-span-2"
                        >
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                                <Mail className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('support.email')}</h3>
                            <p className="text-slate-500 font-bold mb-6">{settings.support_email}</p>
                            <div className="mt-auto w-48 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors mx-auto">
                                {t('support.send_email')}
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </a>
                    )}
                </div>
            )}

            {/* Footer Info */}
            <div className="mt-12 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500 rounded-full blur-[60px] opacity-20 -translate-y-16 translate-x-16" />
                <div className="relative z-10">
                    <p className="text-primary-400 font-black uppercase tracking-[0.2em] text-[10px] mb-2 text-center md:text-left">System Information</p>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1 text-center md:text-left">
                            <h4 className="text-xl font-black">{user?.full_name}</h4>
                            <p className="text-slate-400 text-sm font-medium">Internal Support Context for your account</p>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-end gap-3">
                            <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">{t('support.hotel_id')}</p>
                                <p className="text-xs font-mono font-bold text-primary-200">{settings?.hotel_id_code || user.hotel_id?.substring(0, 8)}</p>
                            </div>
                            <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Role</p>
                                <p className="text-xs font-bold text-primary-200">{user.roles?.[0]?.role}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
