import { useState, useEffect } from 'react';
import { settingsAPI, serviceAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { DollarSign, Percent, Plus, Save, Trash2, Edit2, Info } from 'lucide-react';
import Modal from '../../components/Modal';

export default function CurrencyTaxManagement() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const hotelId = getHotelId();
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settings, setSettings] = useState({
        currency_code: 'USD',
        currency_symbol: '$',
        upi_id: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        upi_qr_code: ''
    });

    const [taxes, setTaxes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTax, setEditingTax] = useState(null);

    const [taxForm, setTaxForm] = useState({
        name: '',
        category: 'ROOM',
        rate: '',
        is_inclusive: false,
        is_active: true
    });

    const [categories, setCategories] = useState(['ROOM']);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsRes, taxesRes, categoriesRes] = await Promise.all([
                settingsAPI.getSettings(hotelId),
                settingsAPI.getTaxes(hotelId),
                hotelId ? serviceAPI.getCategories(hotelId) : Promise.resolve({ categories: [] })
            ]);
            if (settingsRes) {
                setSettings({
                    currency_code: settingsRes.currency_code || 'USD',
                    currency_symbol: settingsRes.currency_symbol || '$',
                    upi_id: settingsRes.upi_id || '',
                    bank_name: settingsRes.bank_name || '',
                    account_number: settingsRes.account_number || '',
                    ifsc_code: settingsRes.ifsc_code || '',
                    upi_qr_code: settingsRes.upi_qr_code || ''
                });
            }
            setTaxes(taxesRes || []);

            if (categoriesRes && categoriesRes.categories) {
                const dynamicCategories = categoriesRes.categories.map(c => c.name.toUpperCase());
                // Remove duplicates in case ROOM is added in services
                setCategories([...new Set(['ROOM', ...dynamicCategories])]);
            }
        } catch (error) {
            toast.error(t('currency_tax.messages.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const handlePasteQR = (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    setSettings({ ...settings, upi_qr_code: event.target.result });
                    toast.success('QR Code pasted successfully!');
                };
                reader.readAsDataURL(blob);
            }
        }
    };

    const handleSaveSettings = async () => {
        try {
            setSavingSettings(true);
            await settingsAPI.updateSettings(settings, hotelId);
            toast.success(t('currency_tax.messages.save_success'));
            // Dispatch a custom event to notify the rest of the app to reload currency
            window.dispatchEvent(new Event('currency-updated'));
        } catch (error) {
            toast.error(t('currency_tax.messages.save_error'));
        } finally {
            setSavingSettings(false);
        }
    };

    const handleOpenModal = (tax = null) => {
        if (tax) {
            setEditingTax(tax);
            setTaxForm({
                name: tax.name,
                category: tax.category,
                rate: tax.rate,
                is_inclusive: tax.is_inclusive,
                is_active: tax.is_active
            });
        } else {
            setEditingTax(null);
            setTaxForm({
                name: '',
                category: 'ROOM',
                rate: '',
                is_inclusive: false,
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveTax = async (e) => {
        e.preventDefault();
        try {
            if (editingTax) {
                await settingsAPI.updateTax(editingTax.id, taxForm, hotelId);
                toast.success(t('currency_tax.messages.tax_update_success'));
            } else {
                await settingsAPI.createTax(taxForm, hotelId);
                toast.success(t('currency_tax.messages.tax_create_success'));
            }
            setIsModalOpen(false);
            loadData();
        } catch (error) {
            toast.error(error.message || 'Failed to save tax details');
        }
    };

    const handleDeleteTax = async (id) => {
        if (window.confirm(t('currency_tax.messages.tax_delete_confirm'))) {
            try {
                await settingsAPI.deleteTax(id, hotelId);
                toast.success(t('currency_tax.messages.tax_delete_success'));
                loadData();
            } catch (error) {
                toast.error(t('currency_tax.messages.tax_delete_error'));
            }
        }
    };

    const toggleTaxStatus = async (id, currentStatus) => {
        try {
            await settingsAPI.updateTax(id, { is_active: !currentStatus }, hotelId);
            toast.success(!currentStatus ? t('currency_tax.status.activated') : t('currency_tax.status.deactivated'));
            loadData();
        } catch (error) {
            toast.error(t('currency_tax.messages.tax_status_error'));
        }
    };

    if (loading) return <div className="p-8">{t('currency_tax.messages.loading')}</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-900 bg-clip-text text-transparent">{t('currency_tax.title')}</h1>
                <p className="text-gray-600">{t('currency_tax.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Currency Card */}
                <div className="col-span-1 border border-primary-100 bg-white/50 backdrop-blur-xl shrink-0 rounded-2xl shadow-xl p-6 h-fit relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110"></div>
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-3 bg-primary-100 rounded-xl text-primary-600">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold">{t('currency_tax.currency_setup')}</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.currency_code')}</label>
                            <input
                                type="text"
                                placeholder={t('currency_tax.currency_code_placeholder')}
                                value={settings.currency_code}
                                onChange={(e) => setSettings({ ...settings, currency_code: e.target.value.toUpperCase() })}
                                className="input focus:ring-primary-500 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.currency_symbol')}</label>
                            <input
                                type="text"
                                placeholder={t('currency_tax.currency_symbol_placeholder')}
                                value={settings.currency_symbol}
                                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                                className="input focus:ring-primary-500 rounded-xl text-xl font-bold"
                            />
                            <p className="text-xs text-gray-500 mt-2">{t('currency_tax.currency_symbol_help')}</p>
                        </div>

                        <button
                            className="btn btn-primary w-full mt-4 flex items-center justify-center"
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {savingSettings ? t('currency_tax.saving') : t('currency_tax.save_currency')}
                        </button>
                    </div>
                </div>

                {/* Payment Details Card */}
                <div className="col-span-1 border border-purple-100 bg-white/50 backdrop-blur-xl shrink-0 rounded-2xl shadow-xl p-6 h-fit relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110"></div>
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                            <Percent className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold">{t('currency_tax.payment_details')}</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.upi_id')}</label>
                            <input
                                type="text"
                                placeholder="example@upi"
                                value={settings.upi_id}
                                onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
                                className="input focus:ring-purple-500 rounded-xl"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.bank_name')}</label>
                                <input
                                    type="text"
                                    value={settings.bank_name}
                                    onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                                    className="input focus:ring-purple-500 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.account_number')}</label>
                                    <input
                                        type="text"
                                        value={settings.account_number}
                                        onChange={(e) => setSettings({ ...settings, account_number: e.target.value })}
                                        className="input focus:ring-purple-500 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.ifsc_code')}</label>
                                    <input
                                        type="text"
                                        value={settings.ifsc_code}
                                        onChange={(e) => setSettings({ ...settings, ifsc_code: e.target.value })}
                                        className="input focus:ring-purple-500 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* QR Paste Section */}
                        <div className="pt-4 border-t border-purple-100">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                UPI QR Code (Paste Image)
                            </label>
                            <div 
                                onPaste={handlePasteQR}
                                className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-300 flex flex-col items-center justify-center min-h-[150px] ${settings.upi_qr_code ? 'border-purple-300 bg-purple-50/30' : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'}`}
                            >
                                {settings.upi_qr_code ? (
                                    <div className="relative group/qr">
                                        <img src={settings.upi_qr_code} alt="UPI QR" className="max-h-32 rounded-lg shadow-sm" />
                                        <button 
                                            onClick={() => setSettings({ ...settings, upi_qr_code: '' })}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover/qr:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-xs text-gray-500">Paste your UPI QR image here (Ctrl+V)</p>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">Custom QR will be used instead of auto-generated one if provided.</p>
                        </div>

                        <button
                            className="btn bg-purple-600 hover:bg-purple-700 text-white w-full mt-4 flex items-center justify-center transform active:scale-95 transition-all shadow-lg shadow-purple-200"
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {savingSettings ? t('currency_tax.saving') : t('currency_tax.save_payment')}
                        </button>
                    </div>
                </div>

                {/* Taxes List */}
                <div className="col-span-1 lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-3 bg-green-100 rounded-xl text-green-600">
                                <Percent className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">{t('currency_tax.billing_taxes')}</h2>
                                <p className="text-sm text-gray-500">{t('currency_tax.billing_taxes_subtitle')}</p>
                            </div>
                        </div>
                        <button onClick={() => handleOpenModal()} className="btn bg-green-600 hover:bg-green-700 text-white inline-flex items-center">
                            <Plus className="w-4 h-4 mr-2" /> {t('currency_tax.add_tax')}
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('currency_tax.table.tax_details')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('currency_tax.table.type')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('currency_tax.table.status')}</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('currency_tax.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {taxes.map((tax) => (
                                    <tr key={tax.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{tax.name}</div>
                                            <div className="text-sm text-gray-500 mt-1 flex items-center space-x-2">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                    {tax.category}
                                                </span>
                                                <span className="font-bold text-gray-700">{tax.rate}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {tax.is_inclusive ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{t('currency_tax.tax_types.inclusive')}</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{t('currency_tax.tax_types.exclusive')}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleTaxStatus(tax.id, tax.is_active)}
                                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors ${tax.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}
                                            >
                                                {tax.is_active ? t('currency_tax.status.active') : t('currency_tax.status.inactive')}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => handleOpenModal(tax)} className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteTax(tax.id)} className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {taxes.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                            <Percent className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                            <p>{t('currency_tax.messages.no_taxes')}</p>
                                            <button onClick={() => handleOpenModal()} className="text-primary-600 font-medium mt-2 hover:underline">{t('currency_tax.messages.create_first')}</button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTax ? t('currency_tax.modals.edit_title') : t('currency_tax.modals.create_title')}
            >
                <form onSubmit={handleSaveTax} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.modals.tax_name')}</label>
                        <input
                            type="text"
                            required
                            placeholder={t('currency_tax.modals.tax_name_placeholder')}
                            value={taxForm.name}
                            onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                            className="input rounded-xl"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.modals.category')}</label>
                            <select
                                value={taxForm.category}
                                onChange={(e) => setTaxForm({ ...taxForm, category: e.target.value })}
                                className="input rounded-xl bg-white"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency_tax.modals.rate')}</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder={t('currency_tax.modals.rate_placeholder')}
                                value={taxForm.rate}
                                onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })}
                                className="input rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={taxForm.is_inclusive}
                                onChange={(e) => setTaxForm({ ...taxForm, is_inclusive: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="font-medium text-gray-900">{t('currency_tax.modals.inclusive_tax')}</span>
                        </label>
                        <p className="text-sm text-gray-500 flex items-start">
                            <Info className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                            {taxForm.is_inclusive ?
                                t('currency_tax.modals.inclusive_help') :
                                t('currency_tax.modals.exclusive_help')}
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                        <button type="submit" className="btn btn-primary">{t('currency_tax.modals.save_tax')}</button>
                    </div>
                </form>
            </Modal>

        </div>
    );
}
