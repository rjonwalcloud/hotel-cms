import { useState, useEffect } from 'react';
import { roomAPI, amenityAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, Hotel, RefreshCw, Wifi, Tv, Wind, Coffee, Refrigerator, Waves, Utensils, Cigarette, Flame, Droplets, Briefcase, Car } from 'lucide-react';

const ICON_OPTIONS = [
    { value: 'Wifi', icon: Wifi },
    { value: 'Tv', icon: Tv },
    { value: 'Wind', icon: Wind },
    { value: 'Coffee', icon: Coffee },
    { value: 'Refrigerator', icon: Refrigerator },
    { value: 'Waves', icon: Waves },
    { value: 'Utensils', icon: Utensils },
    { value: 'Cigarette', icon: Cigarette },
    { value: 'Flame', icon: Flame },
    { value: 'Droplets', icon: Droplets },
    { value: 'Briefcase', icon: Briefcase },
    { value: 'Car', icon: Car },
];

export default function RoomTypeManagement() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const hotelId = getHotelId();
    const [types, setTypes] = useState([]);
    const [availableAmenities, setAvailableAmenities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        short_code: '',
        description: '',
        base_price: '',
        max_occupancy: '2',
        max_adults: '2',
        max_children: '0',
        extra_adult_charge: '500',
        extra_child_charge: '200',
        amenities: [],
    });

    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [refreshing, setRefreshing] = useState(false);

    const confirmAction = (title, message, onConfirm) => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm });
    };

    useEffect(() => {
        if (hotelId) loadTypes();
    }, [hotelId]);

    const loadTypes = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);
        try {
            const [typesData, amenitiesData] = await Promise.all([
                roomAPI.getTypes(hotelId),
                amenityAPI.getByHotel(hotelId)
            ]);
            setTypes(typesData.roomTypes || []);
            setAvailableAmenities(amenitiesData.amenities || []);
        } catch (error) {
            toast.error(t('common.error_loading') || 'Failed to load room types');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...formData,
                hotel_id: hotelId,
                base_price: parseFloat(formData.base_price),
                max_occupancy: parseInt(formData.max_occupancy),
                max_adults: parseInt(formData.max_adults),
                max_children: parseInt(formData.max_children),
                extra_adult_charge: parseFloat(formData.extra_adult_charge),
                extra_child_charge: parseFloat(formData.extra_child_charge),
                amenities: formData.amenities
            };

            if (editingType) {
                await roomAPI.updateType(editingType.id, data);
                toast.success('Room type updated!');
            } else {
                await roomAPI.createType(data);
                toast.success('Room type created!');
            }
            setShowModal(false);
            setEditingType(null);
            loadTypes();
            resetForm();
        } catch (error) {
            toast.error(error.message || 'Operation failed');
        }
    };

    const handleDelete = async (type) => {
        confirmAction(t('room_types.delete_title') || 'Delete Room Type', t('room_types.delete_confirm', { name: type.name }) || `Delete room type "${type.name}"?`, async () => {
            try {
                await roomAPI.deleteType(type.id, hotelId);
                toast.success('Room type deleted');
                loadTypes();
            } catch (error) {
                toast.error(error.message || 'Failed to delete room type');
            }
        });
    };

    const handleEdit = (type) => {
        setEditingType(type);
        setFormData({
            name: type.name || '',
            short_code: type.short_code || '',
            description: type.description || '',
            base_price: type.base_price ? type.base_price.toString() : '',
            max_occupancy: type.max_occupancy ? type.max_occupancy.toString() : '2',
            max_adults: type.max_adults !== undefined ? type.max_adults.toString() : '2',
            max_children: type.max_children !== undefined ? type.max_children.toString() : '0',
            extra_adult_charge: type.extra_adult_charge !== undefined ? type.extra_adult_charge.toString() : '500',
            extra_child_charge: type.extra_child_charge !== undefined ? type.extra_child_charge.toString() : '200',
            amenities: Array.isArray(type.amenities) ? type.amenities : (typeof type.amenities === 'string' ? type.amenities.split(',').map(a => a.trim()) : []),
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({ name: '', short_code: '', description: '', base_price: '', max_occupancy: '2', max_adults: '2', max_children: '0', extra_adult_charge: '500', extra_child_charge: '200', amenities: [] });
    };

    const renderAmenityIcon = (amenityName) => {
        const fullAmenity = availableAmenities.find(a => a.name === amenityName);
        if (!fullAmenity || !fullAmenity.icon) return <Wifi className="w-3 h-3 text-gray-500 inline-block mr-1" />;

        const iconOption = ICON_OPTIONS.find(opt => opt.value === fullAmenity.icon);
        if (iconOption) {
            const IconComp = iconOption.icon;
            return <IconComp className="w-3 h-3 text-gray-500 inline-block mr-1" />;
        }

        return <span className="text-[10px] leading-none inline-block mr-1">{fullAmenity.icon}</span>;
    };

    const columns = [
        { key: 'name', label: t('room_types.name') },
        {
            key: 'short_code',
            label: t('room_types.short_code'),
            render: (val) => val ? <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md shadow-sm font-medium text-xs">{val}</span> : '-'
        },
        { key: 'description', label: t('room_types.description') },
        {
            key: 'base_price',
            label: t('room_types.base_price'),
            render: (val) => formatCurrency(val)
        },
        {
            key: 'max_occupancy',
            label: 'Occupancy',
            render: (_, row) => `${row.max_adults || 0}A, ${row.max_children || 0}C (Max: ${row.max_occupancy || 0})`
        },
        {
            key: 'amenities',
            label: t('room_types.amenities'),
            render: (val) => {
                if (!Array.isArray(val) && typeof val !== 'string') return '-';
                const list = Array.isArray(val) ? val : val.split(',').map(a => a.trim());
                return (
                    <div className="flex flex-wrap gap-1">
                        {list.map(a => (
                            <span key={a} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {renderAmenityIcon(a)} {a}
                            </span>
                        ))}
                    </div>
                );
            }
        },
    ];

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">{t('room_types.title')}</h1>
                    <p className="text-gray-600">{t('room_types.subtitle')}</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => loadTypes(true)}
                        disabled={refreshing}
                        className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center transition-all active:scale-95"
                        title={t('common.refresh')}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? t('common.refreshing') : t('common.refresh')}
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setEditingType(null);
                            setShowModal(true);
                        }}
                        className="btn btn-primary inline-flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('room_types.add_type')}
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={types}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingType(null);
                    resetForm();
                }}
                title={editingType ? t('room_types.edit_type') : t('room_types.add_type')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('room_types.name')} *
                            </label>
                            <input
                                required
                                placeholder="e.g. Deluxe Room"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('room_types.short_code')}
                            </label>
                            <input
                                placeholder="e.g. DLX, 👑, etc."
                                maxLength={10}
                                value={formData.short_code}
                                onChange={(e) => setFormData({ ...formData, short_code: e.target.value })}
                                className="input"
                            />
                            <div className="flex flex-wrap gap-1 mt-2">
                                {['⭐ Deluxe', '👨‍👩‍👧‍👦 Family', '👑 VIP', '💑 Couple', '🛋️ Suite', '🐾 Pet', '🛏️ STD'].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, short_code: tag.split(' ')[0] })}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors whitespace-nowrap"
                                        title={`Set identifier to ${tag.split(' ')[0]}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('room_types.description')}
                        </label>
                        <textarea
                            placeholder="Spacious room with king bed..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input"
                            rows="2"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('room_types.base_price')} *
                            </label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                placeholder="100.00"
                                value={formData.base_price}
                                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Capacity *
                            </label>
                            <input
                                required
                                type="number"
                                min="1"
                                value={formData.max_occupancy}
                                onChange={(e) => setFormData({ ...formData, max_occupancy: e.target.value })}
                                className="input"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 truncate" title="Base Included Adults">Base Adults</label>
                            <input type="number" min="1" value={formData.max_adults} onChange={e => setFormData({ ...formData, max_adults: e.target.value })} className="input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 truncate" title="Base Included Children">Base Kids</label>
                            <input type="number" min="0" value={formData.max_children} onChange={e => setFormData({ ...formData, max_children: e.target.value })} className="input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 truncate" title="Extra charge per adult > Base Adults">Extra Adult ₹</label>
                            <input type="number" min="0" step="0.01" value={formData.extra_adult_charge} onChange={e => setFormData({ ...formData, extra_adult_charge: e.target.value })} className="input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 truncate" title="Extra charge per child > Base Kids">Extra Kid ₹</label>
                            <input type="number" min="0" step="0.01" value={formData.extra_child_charge} onChange={e => setFormData({ ...formData, extra_child_charge: e.target.value })} className="input" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('room_types.amenities')}
                        </label>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            {availableAmenities.map(amenity => (
                                <label key={amenity.id} className="flex items-center space-x-2 text-sm text-gray-700 p-2 rounded border border-gray-100 bg-gray-50 hover:bg-gray-100 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.amenities.includes(amenity.name)}
                                        onChange={(e) => {
                                            const newAmenities = e.target.checked
                                                ? [...formData.amenities, amenity.name]
                                                : formData.amenities.filter(a => a !== amenity.name);
                                            setFormData({ ...formData, amenities: newAmenities });
                                        }}
                                        className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                                    />
                                    <div className="flex items-center gap-1.5 truncate">
                                        {renderAmenityIcon(amenity.name)}
                                        <span>{amenity.name}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {availableAmenities.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">{t('room_types.no_amenities')}</p>
                        )}
                    </div>

                    <div className="flex space-x-3 mt-6">
                        <button type="submit" className="btn btn-primary flex-1">
                            {editingType ? t('common.update') : t('common.create')}
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
