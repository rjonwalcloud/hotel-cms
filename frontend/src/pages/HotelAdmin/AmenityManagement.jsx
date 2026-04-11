import { useState, useEffect } from 'react';
import { amenityAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Wifi, Tv, Wind, Coffee, Refrigerator, Waves, Utensils, Cigarette, Flame, Droplets, Briefcase, Car } from 'lucide-react';

const ICON_OPTIONS = [
    { value: 'Wifi', label: 'Wi-Fi', icon: Wifi },
    { value: 'Tv', label: 'TV', icon: Tv },
    { value: 'Wind', label: 'Air Conditioning', icon: Wind },
    { value: 'Coffee', label: 'Coffee Maker', icon: Coffee },
    { value: 'Refrigerator', label: 'Mini Fridge', icon: Refrigerator },
    { value: 'Waves', label: 'Ocean View', icon: Waves },
    { value: 'Utensils', label: 'Room Service', icon: Utensils },
    { value: 'Cigarette', label: 'Smoking Allowed', icon: Cigarette },
    { value: 'Flame', label: 'Heating', icon: Flame },
    { value: 'Droplets', label: 'Bathtub', icon: Droplets },
    { value: 'Briefcase', label: 'Workspace', icon: Briefcase },
    { value: 'Car', label: 'Parking', icon: Car },
];

export default function AmenityManagement() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const hotelId = getHotelId();
    const [amenities, setAmenities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingAmenity, setEditingAmenity] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', icon: 'Wifi' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        if (hotelId) loadAmenities();
    }, [hotelId]);

    const confirmAction = (title, message, onConfirm) => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm });
    };

    const loadAmenities = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);
        try {
            const data = await amenityAPI.getByHotel(hotelId);
            setAmenities(data.amenities || []);
        } catch (error) {
            toast.error(t('amenities.messages.load_error'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingAmenity) {
                await amenityAPI.update(editingAmenity.id, formData);
                toast.success(t('amenities.messages.update_success'));
            } else {
                await amenityAPI.create(formData);
                toast.success(t('amenities.messages.create_success'));
            }
            setShowModal(false);
            setEditingAmenity(null);
            loadAmenities();
            setFormData({ name: '', description: '', icon: 'Wifi' });
        } catch (error) {
            toast.error(error.message || t('common.error'));
        }
    };

    const handleDelete = async (amenity) => {
        confirmAction(t('amenities.modals.delete_title'), t('amenities.modals.delete_confirm', { name: amenity.name }), async () => {
            try {
                await amenityAPI.delete(amenity.id, hotelId);
                toast.success(t('amenities.messages.delete_success'));
                loadAmenities();
            } catch (error) {
                toast.error(error.message || t('common.error'));
            }
        });
    };

    const handleEdit = (amenity) => {
        setEditingAmenity(amenity);
        setFormData({
            name: amenity.name,
            description: amenity.description || '',
            icon: amenity.icon || 'Wifi',
        });
        setShowModal(true);
    };

    const renderIcon = (iconName) => {
        if (!iconName) return <Wifi className="w-5 h-5 text-gray-500" />;

        const iconOption = ICON_OPTIONS.find(opt => opt.value === iconName);
        if (iconOption) {
            const IconComp = iconOption.icon;
            return <IconComp className="w-5 h-5 text-gray-500" />;
        }

        // If not a predefined Lucide icon, assume it's a custom emoji/tag
        return <span className="text-lg leading-none">{iconName}</span>;
    };

    const columns = [
        {
            key: 'icon',
            label: t('amenities.table.icon'),
            render: (val) => <div className="flex justify-center">{renderIcon(val)}</div>
        },
        { key: 'name', label: t('amenities.table.name') },
        { key: 'description', label: t('amenities.table.description') },
    ];

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">{t('amenities.title')}</h1>
                    <p className="text-gray-600">{t('amenities.subtitle')}</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => loadAmenities(true)}
                        disabled={refreshing}
                        className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center transition-all active:scale-95"
                        title={t('amenities.refresh')}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? t('common.refreshing') : t('amenities.refresh')}
                    </button>
                    <button
                        onClick={() => {
                            setFormData({ name: '', description: '', icon: 'Wifi' });
                            setEditingAmenity(null);
                            setShowModal(true);
                        }}
                        className="btn btn-primary inline-flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('amenities.add_new')}
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={amenities}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingAmenity(null);
                }}
                title={editingAmenity ? t('amenities.modals.edit_title') : t('amenities.modals.create_title')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('amenities.form.name')} *
                        </label>
                        <input
                            required
                            placeholder={t('amenities.form.name_placeholder')}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('amenities.form.description')}
                        </label>
                        <textarea
                            placeholder={t('amenities.form.description_placeholder')}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input"
                            rows="2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('amenities.form.icon')}
                        </label>
                        <input
                            placeholder={t('amenities.form.icon_placeholder')}
                            value={formData.icon}
                            maxLength={20}
                            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                            className="input"
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                            {/* Standard Icons */}
                            {ICON_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, icon: opt.value })}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                                    title={opt.label}
                                >
                                    <opt.icon className="w-4 h-4" />
                                </button>
                            ))}
                            {/* Preset Emojis */}
                            {['🏊‍♂️ Pool', '🏋️ Gym', '🅿️ Parking', '🍸 Bar', '💆 Spa', '🛝 Kids'].map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, icon: tag.split(' ')[0] })}
                                    className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md transition-colors whitespace-nowrap"
                                    title={`Use ${tag.split(' ')[0]}`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex space-x-3 mt-6">
                        <button type="submit" className="btn btn-primary flex-1">
                            {editingAmenity ? t('common.update') : t('common.create')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="btn btn-secondary"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                confirmColor="bg-red-600 hover:bg-red-700"
            />
        </div>
    );
}
