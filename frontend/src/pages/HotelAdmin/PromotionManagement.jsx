import { useState, useEffect } from 'react';
import { promotionAPI, roomAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Tag, Ticket, RefreshCw, Percent, DollarSign, Copy, Check } from 'lucide-react';

export default function PromotionManagement() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const hotelId = getHotelId();

    const [activeTab, setActiveTab] = useState('promotions');
    const [promotions, setPromotions] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [editingCoupon, setEditingCoupon] = useState(null);

    const emptyPromoForm = {
        name: '', description: '', discount_type: 'PERCENTAGE', discount_value: '',
        auto_apply: false, start_date: '', end_date: '', min_nights: 1,
        min_amount: 0, max_discount: '', applicable_room_types: [], is_active: true
    };
    const emptyCouponForm = {
        code: '', description: '', discount_type: 'PERCENTAGE', discount_value: '',
        max_uses: '', per_booking_limit: 1, start_date: '', end_date: '',
        min_nights: 1, min_amount: 0, max_discount: '', applicable_room_types: [], is_active: true
    };

    const [promoForm, setPromoForm] = useState(emptyPromoForm);
    const [couponForm, setCouponForm] = useState(emptyCouponForm);

    useEffect(() => { loadData(); }, [hotelId]);

    const loadData = async () => {
        if (!hotelId) return;
        setLoading(true);
        try {
            const [promoRes, couponRes, rtRes] = await Promise.all([
                promotionAPI.getPromotions(hotelId),
                promotionAPI.getCoupons(hotelId),
                roomAPI.getTypes(hotelId)
            ]);
            setPromotions(promoRes.data || []);
            setCoupons(couponRes.data || []);
            setRoomTypes(rtRes.roomTypes || []);
        } catch (err) {
            console.error('Promotion data load error:', err);
            toast.error(err.message || t('common.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    // ==================== PROMO HANDLERS ====================
    const openPromoModal = (promo = null) => {
        if (promo) {
            setEditingPromo(promo);
            setPromoForm({
                name: promo.name, description: promo.description || '',
                discount_type: promo.discount_type, discount_value: promo.discount_value,
                auto_apply: promo.auto_apply, start_date: promo.start_date?.split('T')[0] || '',
                end_date: promo.end_date?.split('T')[0] || '', min_nights: promo.min_nights || 1,
                min_amount: promo.min_amount || 0, max_discount: promo.max_discount || '',
                applicable_room_types: promo.applicable_room_types || [], is_active: promo.is_active
            });
        } else {
            setEditingPromo(null);
            setPromoForm(emptyPromoForm);
        }
        setShowPromoModal(true);
    };

    const handleSavePromo = async () => {
        if (!promoForm.name.trim() || !promoForm.discount_value) return toast.error(t('promotions.promo.save_error') || 'Name and discount value required');
        try {
            const payload = { ...promoForm, applicable_room_types: promoForm.applicable_room_types.length > 0 ? promoForm.applicable_room_types : null };
            if (editingPromo) {
                await promotionAPI.updatePromotion(editingPromo.id, hotelId, payload);
                toast.success('Promotion updated');
            } else {
                await promotionAPI.createPromotion(hotelId, payload);
                toast.success('Promotion created');
            }
            setShowPromoModal(false);
            loadData();
        } catch (err) { toast.error(err.message || 'Failed to save promotion'); }
    };

    const handleDeletePromo = async (id) => {
        if (!confirm(t('promotions.promo.delete_confirm') || 'Delete this promotion?')) return;
        try { await promotionAPI.deletePromotion(id, hotelId); toast.success(t('common.deleted') || 'Deleted'); loadData(); }
        catch (err) { toast.error(err.message || t('common.error_delete')); }
    };

    // ==================== COUPON HANDLERS ====================
    const openCouponModal = (coupon = null) => {
        if (coupon) {
            setEditingCoupon(coupon);
            setCouponForm({
                code: coupon.code, description: coupon.description || '',
                discount_type: coupon.discount_type, discount_value: coupon.discount_value,
                max_uses: coupon.max_uses || '', per_booking_limit: coupon.per_booking_limit || 1,
                start_date: coupon.start_date?.split('T')[0] || '', end_date: coupon.end_date?.split('T')[0] || '',
                min_nights: coupon.min_nights || 1, min_amount: coupon.min_amount || 0,
                max_discount: coupon.max_discount || '', applicable_room_types: coupon.applicable_room_types || [],
                is_active: coupon.is_active
            });
        } else {
            setEditingCoupon(null);
            setCouponForm(emptyCouponForm);
        }
        setShowCouponModal(true);
    };

    const handleSaveCoupon = async () => {
        if (!couponForm.code.trim() || !couponForm.discount_value) return toast.error('Code and discount value required');
        try {
            const payload = { ...couponForm, applicable_room_types: couponForm.applicable_room_types.length > 0 ? couponForm.applicable_room_types : null };
            if (editingCoupon) {
                await promotionAPI.updateCoupon(editingCoupon.id, hotelId, payload);
                toast.success('Coupon updated');
            } else {
                await promotionAPI.createCoupon(hotelId, payload);
                toast.success('Coupon created');
            }
            setShowCouponModal(false);
            loadData();
        } catch (err) { toast.error(err.message || 'Failed to save coupon'); }
    };

    const handleDeleteCoupon = async (id) => {
        if (!confirm(t('promotions.coupon.delete_confirm') || 'Delete this coupon code?')) return;
        try { await promotionAPI.deleteCoupon(id, hotelId); toast.success(t('common.deleted') || 'Deleted'); loadData(); }
        catch (err) { toast.error(err.message || t('common.error_delete')); }
    };

    const handleRoomTypeToggle = (formSetter, form, rtId) => {
        const current = form.applicable_room_types || [];
        const updated = current.includes(rtId) ? current.filter(id => id !== rtId) : [...current, rtId];
        formSetter({ ...form, applicable_room_types: updated });
    };

    // ==================== TABLE COLUMNS ====================
    const promoColumns = [
        {
            key: 'name', label: t('promotions.promo.name'), render: (_, row) => (
                <div>
                    <span className="font-semibold">{row.name}</span>
                    {row.auto_apply && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">{t('promotions.promo.auto_apply')}</span>}
                </div>
            )
        },
        {
            key: 'discount', label: t('promotions.promo.discount'), render: (_, row) => (
                <span className="font-bold text-green-600">
                    {row.discount_type === 'PERCENTAGE' ? `${row.discount_value}%` : formatCurrency(row.discount_value)}
                </span>
            )
        },
        {
            key: 'dates', label: t('promotions.promo.valid_period'), render: (_, row) => (
                <span className="text-sm text-gray-500">
                    {row.start_date ? new Date(row.start_date).toLocaleDateString() : '∞'} — {row.end_date ? new Date(row.end_date).toLocaleDateString() : '∞'}
                </span>
            )
        },
        {
            key: 'room_types', label: t('promotions.promo.applies_to'), render: (_, row) => (
                <span className="text-xs text-gray-500">
                    {row.room_types_info ? row.room_types_info.map(rt => rt.name).join(', ') : t('promotions.promo.all_types')}
                </span>
            )
        },
        {
            key: 'is_active', label: t('common.status'), render: (_, row) => (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.is_active ? t('common.active') : t('common.inactive')}
                </span>
            )
        },
        {
            key: 'actions', label: t('common.actions'), render: (_, row) => (
                <div className="flex gap-2">
                    <button onClick={() => openPromoModal(row)} className="btn btn-sm btn-secondary"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => handleDeletePromo(row.id)} className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="w-3 h-3" /></button>
                </div>
            )
        }
    ];

    const couponColumns = [
        {
            key: 'code', label: t('promotions.coupon.code'), render: (_, row) => (
                <div className="flex items-center gap-2">
                    <code className="px-3 py-1 bg-slate-100 rounded-lg font-mono font-bold text-sm tracking-wider">{row.code}</code>
                    <button onClick={() => { navigator.clipboard.writeText(row.code); toast.success(t('common.copied')); }}
                        className="text-gray-400 hover:text-gray-600"><Copy className="w-3 h-3" /></button>
                </div>
            )
        },
        {
            key: 'discount', label: t('promotions.promo.discount'), render: (_, row) => (
                <span className="font-bold text-green-600">
                    {row.discount_type === 'PERCENTAGE' ? `${row.discount_value}%` : formatCurrency(row.discount_value)}
                </span>
            )
        },
        {
            key: 'usage', label: t('promotions.coupon.usage'), render: (_, row) => (
                <span className="text-sm font-mono">
                    {row.used_count}/{row.max_uses || '∞'}
                </span>
            )
        },
        {
            key: 'dates', label: t('promotions.promo.valid_period'), render: (_, row) => (
                <span className="text-sm text-gray-500">
                    {row.start_date ? new Date(row.start_date).toLocaleDateString() : '∞'} — {row.end_date ? new Date(row.end_date).toLocaleDateString() : '∞'}
                </span>
            )
        },
        {
            key: 'is_active', label: t('common.status'), render: (_, row) => (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.is_active ? t('common.active') : t('common.inactive')}
                </span>
            )
        },
        {
            key: 'actions', label: t('common.actions'), render: (_, row) => (
                <div className="flex gap-2">
                    <button onClick={() => openCouponModal(row)} className="btn btn-sm btn-secondary"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteCoupon(row.id)} className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="w-3 h-3" /></button>
                </div>
            )
        }
    ];

    // ==================== RENDER ====================
    const renderRoomTypeCheckboxes = (form, formSetter) => (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('promotions.form.applicable_room_types')}</label>
            <div className="flex flex-wrap gap-2">
                {roomTypes.map(rt => (
                    <label key={rt.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${(form.applicable_room_types || []).includes(rt.id) ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <input type="checkbox" className="sr-only"
                            checked={(form.applicable_room_types || []).includes(rt.id)}
                            onChange={() => handleRoomTypeToggle(formSetter, form, rt.id)} />
                        {(form.applicable_room_types || []).includes(rt.id) && <Check className="w-3 h-3" />}
                        <span className="text-sm font-medium">{rt.name}</span>
                    </label>
                ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('promotions.form.leave_empty_all')}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('promotions.title')}</h1>
                    <p className="text-slate-500 mt-1">{t('promotions.subtitle')}</p>
                </div>
                <button onClick={loadData} className="btn btn-secondary flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button onClick={() => setActiveTab('promotions')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'promotions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Tag className="w-4 h-4 inline mr-1" /> {t('promotions.tabs.promotions')}
                </button>
                <button onClick={() => setActiveTab('coupons')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'coupons' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Ticket className="w-4 h-4 inline mr-1" /> {t('promotions.tabs.coupons')}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'promotions' && (
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">{t('promotions.promo.title')}</h2>
                        <button onClick={() => openPromoModal()} className="btn btn-primary flex items-center gap-2">
                            <Plus className="w-4 h-4" /> {t('promotions.promo.new')}
                        </button>
                    </div>
                    <DataTable columns={promoColumns} data={promotions} loading={loading} emptyMessage={t('promotions.promo.empty')} />
                </div>
            )}

            {activeTab === 'coupons' && (
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">{t('promotions.coupon.title')}</h2>
                        <button onClick={() => openCouponModal()} className="btn btn-primary flex items-center gap-2">
                            <Plus className="w-4 h-4" /> {t('promotions.coupon.new')}
                        </button>
                    </div>
                    <DataTable columns={couponColumns} data={coupons} loading={loading} emptyMessage={t('promotions.coupon.empty')} />
                </div>
            )}

            {/* Promotion Modal */}
            <Modal isOpen={showPromoModal} onClose={() => setShowPromoModal(false)} title={editingPromo ? t('promotions.promo.edit') : t('promotions.promo.new')} size="lg">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.promo.name')} *</label>
                        <input type="text" value={promoForm.name} onChange={e => setPromoForm({ ...promoForm, name: e.target.value })}
                            className="input" placeholder="e.g. Early Bird 10% Off, Summer Special" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('room_types.description')}</label>
                        <textarea value={promoForm.description} onChange={e => setPromoForm({ ...promoForm, description: e.target.value })}
                            className="input" rows="2" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.discount_type')}</label>
                            <select value={promoForm.discount_type} onChange={e => setPromoForm({ ...promoForm, discount_type: e.target.value })} className="input">
                                <option value="PERCENTAGE">{t('promotions.form.discount_percentage')}</option>
                                <option value="FLAT">{t('promotions.form.discount_flat')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.discount_value')} *</label>
                            <input type="number" value={promoForm.discount_value} onChange={e => setPromoForm({ ...promoForm, discount_value: e.target.value })}
                                className="input" step="0.01" min="0" placeholder={promoForm.discount_type === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 500'} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.max_discount')}</label>
                            <input type="number" value={promoForm.max_discount} onChange={e => setPromoForm({ ...promoForm, max_discount: e.target.value })}
                                className="input" step="0.01" min="0" placeholder={t('promotions.form.cap_amount')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.start_date')}</label>
                            <input type="date" value={promoForm.start_date} onChange={e => setPromoForm({ ...promoForm, start_date: e.target.value })} className="input" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.end_date')}</label>
                            <input type="date" value={promoForm.end_date} onChange={e => setPromoForm({ ...promoForm, end_date: e.target.value })} className="input" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.min_nights')}</label>
                            <input type="number" value={promoForm.min_nights} onChange={e => setPromoForm({ ...promoForm, min_nights: parseInt(e.target.value) || 1 })}
                                className="input" min="1" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.min_booking_amount')}</label>
                            <input type="number" value={promoForm.min_amount} onChange={e => setPromoForm({ ...promoForm, min_amount: parseFloat(e.target.value) || 0 })}
                                className="input" step="0.01" min="0" />
                        </div>
                    </div>
                    {renderRoomTypeCheckboxes(promoForm, setPromoForm)}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={promoForm.auto_apply} onChange={e => setPromoForm({ ...promoForm, auto_apply: e.target.checked })}
                            className="w-4 h-4 rounded" />
                        <span className="text-sm font-medium">{t('promotions.promo.eligible_bookings')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={promoForm.is_active} onChange={e => setPromoForm({ ...promoForm, is_active: e.target.checked })}
                            className="w-4 h-4 rounded" />
                        <span className="text-sm font-medium">{t('common.active')}</span>
                    </label>
                    <div className="flex justify-end gap-3 pt-3 border-t">
                        <button onClick={() => setShowPromoModal(false)} className="btn btn-secondary">{t('common.cancel')}</button>
                        <button onClick={handleSavePromo} className="btn btn-primary">{editingPromo ? t('common.update') : t('common.create')} {t('promotions.tabs.promotions')}</button>
                    </div>
                </div>
            </Modal>

            {/* Coupon Modal */}
            <Modal isOpen={showCouponModal} onClose={() => setShowCouponModal(false)} title={editingCoupon ? t('promotions.coupon.edit') : t('promotions.coupon.new')} size="lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.coupon.code')} *</label>
                            <input type="text" value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                                className="input font-mono tracking-wider" placeholder="e.g. SUMMER2026" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('room_types.description')}</label>
                            <input type="text" value={couponForm.description} onChange={e => setCouponForm({ ...couponForm, description: e.target.value })}
                                className="input" placeholder={t('promotions.form.internal_note')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.discount_type')}</label>
                            <select value={couponForm.discount_type} onChange={e => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="input">
                                <option value="PERCENTAGE">{t('promotions.form.discount_percentage')}</option>
                                <option value="FLAT">{t('promotions.form.discount_flat')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.discount_value')} *</label>
                            <input type="number" value={couponForm.discount_value} onChange={e => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                                className="input" step="0.01" min="0" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.max_discount')}</label>
                            <input type="number" value={couponForm.max_discount} onChange={e => setCouponForm({ ...couponForm, max_discount: e.target.value })}
                                className="input" step="0.01" min="0" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.coupon.max_uses')}</label>
                            <input type="number" value={couponForm.max_uses} onChange={e => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                                className="input" min="1" placeholder={t('promotions.coupon.unlimited')} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.per_booking_limit')}</label>
                            <input type="number" value={couponForm.per_booking_limit} onChange={e => setCouponForm({ ...couponForm, per_booking_limit: parseInt(e.target.value) || 1 })}
                                className="input" min="1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.start_date')}</label>
                            <input type="date" value={couponForm.start_date} onChange={e => setCouponForm({ ...couponForm, start_date: e.target.value })} className="input" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.end_date')}</label>
                            <input type="date" value={couponForm.end_date} onChange={e => setCouponForm({ ...couponForm, end_date: e.target.value })} className="input" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.min_nights')}</label>
                            <input type="number" value={couponForm.min_nights} onChange={e => setCouponForm({ ...couponForm, min_nights: parseInt(e.target.value) || 1 })}
                                className="input" min="1" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.min_booking_amount')}</label>
                            <input type="number" value={couponForm.min_amount} onChange={e => setCouponForm({ ...couponForm, min_amount: parseFloat(e.target.value) || 0 })}
                                className="input" step="0.01" min="0" />
                        </div>
                    </div>
                    {renderRoomTypeCheckboxes(couponForm, setCouponForm)}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={couponForm.is_active} onChange={e => setCouponForm({ ...couponForm, is_active: e.target.checked })}
                            className="w-4 h-4 rounded" />
                        <span className="text-sm font-medium">{t('common.active')}</span>
                    </label>
                    <div className="flex justify-end gap-3 pt-3 border-t">
                        <button onClick={() => setShowCouponModal(false)} className="btn btn-secondary">{t('common.cancel')}</button>
                        <button onClick={handleSaveCoupon} className="btn btn-primary">{editingCoupon ? t('common.update') : t('common.create')} {t('promotions.tabs.coupons')}</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
