import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { lostFoundAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import {
    Plus, RefreshCw, Search, Eye, MapPin, Calendar, Tag, User, Phone, Mail,
    Hash, DollarSign, MessageSquare, Package, Archive, CheckCircle, XCircle, RotateCcw, Trash2
} from 'lucide-react';
import { format } from 'date-fns';

const LOCATIONS = [
    { value: 'ROOM', label: 'Guest Room' },
    { value: 'LOBBY', label: 'Lobby' },
    { value: 'RESTAURANT', label: 'Restaurant' },
    { value: 'POOL', label: 'Pool Area' },
    { value: 'GYM', label: 'Gym' },
    { value: 'PARKING', label: 'Parking' },
    { value: 'CONFERENCE', label: 'Conference Room' },
    { value: 'OTHER', label: 'Other' },
];

const ITEM_CATEGORIES = [
    { value: 'ELECTRONICS', label: 'Electronics' },
    { value: 'BAG', label: 'Bag / Luggage' },
    { value: 'WALLET', label: 'Wallet / Purse' },
    { value: 'JEWELLERY', label: 'Jewellery' },
    { value: 'CLOTHING', label: 'Clothing' },
    { value: 'DOCUMENTS', label: 'Documents / ID' },
    { value: 'KEYS', label: 'Keys' },
    { value: 'OTHERS', label: 'Others' },
];

const STATUSES = [
    { value: 'OPEN', label: 'Open', color: 'bg-amber-100 text-amber-800' },
    { value: 'CLAIMED', label: 'Claimed', color: 'bg-blue-100 text-blue-800' },
    { value: 'RETURNED', label: 'Returned', color: 'bg-emerald-100 text-emerald-800' },
    { value: 'DISPOSED', label: 'Disposed', color: 'bg-gray-100 text-gray-600' },
];

const getStatusColor = (status) => STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-600';
const getLocationLabel = (val) => LOCATIONS.find(l => l.value === val)?.label || val;
const getCategoryLabel = (val) => ITEM_CATEGORIES.find(c => c.value === val)?.label || val;

export default function LostFound() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const hotelId = getHotelId();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, id: null });

    // Filters
    const [filters, setFilters] = useState({ type: '', status: '', item_category: '', search: '' });

    // Form
    const [form, setForm] = useState({
        type: 'FOUND', location: 'ROOM', location_detail: '', found_lost_date: '',
        item_category: 'ELECTRONICS', item_description: '', item_cost: '',
        contact_name: '', contact_phone: '', contact_email: '', booking_pnr: '', notes: '',
    });

    useEffect(() => {
        if (hotelId) loadItems();
    }, [hotelId]);

    const loadItems = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.type) params.type = filters.type;
            if (filters.status) params.status = filters.status;
            if (filters.item_category) params.item_category = filters.item_category;
            if (filters.search) params.search = filters.search;
            const data = await lostFoundAPI.getByHotel(hotelId, params);
            setItems(data.items || []);
        } catch (error) {
            toast.error('Failed to load items');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({
            type: 'FOUND', location: 'ROOM', location_detail: '', found_lost_date: '',
            item_category: 'ELECTRONICS', item_description: '', item_cost: '',
            contact_name: '', contact_phone: '', contact_email: '', booking_pnr: '', notes: '',
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, hotel_id: hotelId };
            if (editingItem) {
                await lostFoundAPI.update(editingItem.id, payload);
                toast.success('Item updated');
            } else {
                await lostFoundAPI.create(payload);
                toast.success('Item reported');
            }
            setShowModal(false);
            setEditingItem(null);
            resetForm();
            loadItems();
        } catch (error) {
            toast.error(error.message || 'Failed to save');
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setForm({
            type: item.type, location: item.location, location_detail: item.location_detail || '',
            found_lost_date: item.found_lost_date ? format(new Date(item.found_lost_date), "yyyy-MM-dd'T'HH:mm") : '',
            item_category: item.item_category, item_description: item.item_description || '',
            item_cost: item.item_cost || '', contact_name: item.contact_name || '',
            contact_phone: item.contact_phone || '', contact_email: item.contact_email || '',
            booking_pnr: item.booking_pnr || '', notes: item.notes || '',
        });
        setShowModal(true);
    };

    const handleViewDetail = async (item) => {
        try {
            const data = await lostFoundAPI.getById(item.id, hotelId);
            setSelectedItem(data);
            setShowDetailModal(true);
        } catch (error) {
            toast.error('Failed to load item details');
        }
    };

    const handleStatusChange = async (itemId, newStatus) => {
        try {
            await lostFoundAPI.updateStatus(itemId, newStatus, hotelId);
            toast.success(`Status updated to ${newStatus}`);
            loadItems();
            if (selectedItem?.id === itemId) {
                const data = await lostFoundAPI.getById(itemId, hotelId);
                setSelectedItem(data);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to update status');
        }
    };

    const handleDelete = (item) => {
        setConfirmConfig({ isOpen: true, id: item.id });
    };

    const confirmDelete = async () => {
        try {
            await lostFoundAPI.delete(confirmConfig.id, hotelId);
            toast.success('Item deleted');
            loadItems();
        } catch (error) {
            toast.error(error.message || 'Failed to delete');
        } finally {
            setConfirmConfig({ isOpen: false, id: null });
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        loadItems();
    };

    // Stats
    const stats = {
        total: items.length,
        lost: items.filter(i => i.type === 'LOST').length,
        found: items.filter(i => i.type === 'FOUND').length,
        open: items.filter(i => i.status === 'OPEN').length,
        returned: items.filter(i => i.status === 'RETURNED').length,
    };

    const columns = [
        {
            key: 'type', label: 'Type',
            render: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v === 'LOST' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {v}
                </span>
            ),
        },
        {
            key: 'item_description', label: 'Description',
            render: (v) => <span className="font-medium text-slate-900 text-sm truncate max-w-[200px] inline-block">{v}</span>,
        },
        {
            key: 'item_category', label: 'Category',
            render: (v) => <span className="text-xs text-slate-600">{getCategoryLabel(v)}</span>,
        },
        {
            key: 'location', label: 'Location',
            render: (v, row) => (
                <span className="text-xs text-slate-600">
                    {getLocationLabel(v)}{row.location_detail ? ` - ${row.location_detail}` : ''}
                </span>
            ),
        },
        {
            key: 'found_lost_date', label: 'Date',
            render: (v) => v ? <span className="text-xs text-slate-500">{format(new Date(v), 'MMM dd, yyyy')}</span> : '-',
        },
        {
            key: 'contact_name', label: 'Contact',
            render: (v, row) => v ? <span className="text-xs">{v}{row.contact_phone ? ` / ${row.contact_phone}` : ''}</span> : <span className="text-xs text-slate-400">-</span>,
        },
        {
            key: 'status', label: 'Status',
            render: (v) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(v)}`}>{v}</span>,
        },
        {
            key: 'actions_custom', label: '',
            render: (_, item) => (
                <button onClick={() => handleViewDetail(item)}
                    className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg hover:bg-slate-200 inline-flex items-center font-medium">
                    <Eye className="w-3 h-3 mr-1" /> View
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Lost & Found</h1>
                    <p className="text-gray-500 text-sm">Track lost and found items across your property</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadItems} className="btn btn-secondary inline-flex items-center text-sm">
                        <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
                    </button>
                    <button onClick={() => { setEditingItem(null); resetForm(); setShowModal(true); }}
                        className="btn btn-primary inline-flex items-center text-sm">
                        <Plus className="w-4 h-4 mr-1.5" /> Report Item
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Total</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className="bg-white rounded-xl border border-red-200 p-4">
                    <div className="text-xs text-red-500 uppercase font-semibold">Lost</div>
                    <div className="text-2xl font-bold text-red-600">{stats.lost}</div>
                </div>
                <div className="bg-white rounded-xl border border-blue-200 p-4">
                    <div className="text-xs text-blue-500 uppercase font-semibold">Found</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.found}</div>
                </div>
                <div className="bg-white rounded-xl border border-amber-200 p-4">
                    <div className="text-xs text-amber-600 uppercase font-semibold">Open</div>
                    <div className="text-2xl font-bold text-amber-700">{stats.open}</div>
                </div>
                <div className="bg-white rounded-xl border border-emerald-200 p-4">
                    <div className="text-xs text-emerald-600 uppercase font-semibold">Returned</div>
                    <div className="text-2xl font-bold text-emerald-700">{stats.returned}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <form onSubmit={handleSearch} className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[180px] max-w-sm">
                        <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                        <input placeholder="Search description, name, phone, PNR..." value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300" />
                    </div>
                    <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <option value="">All Types</option>
                        <option value="LOST">Lost</option>
                        <option value="FOUND">Found</option>
                    </select>
                    <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <option value="">All Status</option>
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select value={filters.item_category} onChange={(e) => setFilters({ ...filters, item_category: e.target.value })}
                        className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <option value="">All Categories</option>
                        {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <button type="submit" className="btn btn-secondary text-sm">Search</button>
                    {(filters.type || filters.status || filters.item_category || filters.search) && (
                        <button type="button"
                            onClick={() => { setFilters({ type: '', status: '', item_category: '', search: '' }); setTimeout(loadItems, 0); }}
                            className="text-xs text-slate-500 hover:text-slate-700 underline">Clear</button>
                    )}
                </form>
            </div>

            {/* Table */}
            <DataTable columns={columns} data={items} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />

            {/* ============================================ */}
            {/* CREATE/EDIT MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); resetForm(); }}
                title={editingItem ? 'Edit Item' : 'Report Lost / Found Item'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                            <select required value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value })}
                                className="input">
                                <option value="FOUND">Found</option>
                                <option value="LOST">Lost</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Item Category *</label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <select required value={form.item_category}
                                    onChange={(e) => setForm({ ...form, item_category: e.target.value })}
                                    className="input pl-10">
                                    {ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Description *</label>
                        <div className="relative">
                            <Package className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input required placeholder="Describe the item..." value={form.item_description}
                                onChange={(e) => setForm({ ...form, item_description: e.target.value })}
                                className="input pl-10" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <select required value={form.location}
                                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                                    className="input pl-10">
                                    {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Location Detail</label>
                            <input placeholder="e.g. Room 204, Table 5" value={form.location_detail}
                                onChange={(e) => setForm({ ...form, location_detail: e.target.value })}
                                className="input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date / Time</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input type="datetime-local" value={form.found_lost_date}
                                    onChange={(e) => setForm({ ...form, found_lost_date: e.target.value })}
                                    className="input pl-10" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Approx. Item Cost</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input type="number" step="0.01" min="0" placeholder="If known / approximate"
                                value={form.item_cost}
                                onChange={(e) => setForm({ ...form, item_cost: e.target.value })}
                                className="input pl-10" />
                        </div>
                    </div>

                    {/* Contact info section */}
                    <div className="border-t border-gray-200 pt-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contact Information (Optional)</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input placeholder="Contact name" value={form.contact_name}
                                        onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                                        className="input pl-10" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input placeholder="Phone number" value={form.contact_phone}
                                        onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                                        className="input pl-10" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input type="email" placeholder="Email address" value={form.contact_email}
                                        onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                                        className="input pl-10" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Booking PNR</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input placeholder="e.g. BK-XXXXXX" value={form.booking_pnr}
                                        onChange={(e) => setForm({ ...form, booking_pnr: e.target.value })}
                                        className="input pl-10" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea rows={2} placeholder="Additional notes..." value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            className="input" />
                    </div>

                    <div className="flex space-x-3 pt-4 border-t border-gray-200">
                        <button type="submit" className="btn btn-primary flex-1">
                            {editingItem ? 'Update Item' : 'Report Item'}
                        </button>
                        <button type="button" onClick={() => { setShowModal(false); setEditingItem(null); resetForm(); }}
                            className="btn btn-secondary">Cancel</button>
                    </div>
                </form>
            </Modal>

            {/* ============================================ */}
            {/* DETAIL MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showDetailModal}
                onClose={() => { setShowDetailModal(false); setSelectedItem(null); }}
                title="Item Details">
                {selectedItem && (
                    <div className="space-y-5">
                        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${selectedItem.type === 'LOST' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {selectedItem.type}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedItem.status)}`}>
                                        {selectedItem.status}
                                    </span>
                                </div>
                                {/* Status actions */}
                                {selectedItem.status === 'OPEN' && (
                                    <div className="flex gap-1">
                                        <button onClick={() => handleStatusChange(selectedItem.id, 'CLAIMED')}
                                            className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-100 font-medium">
                                            Claimed
                                        </button>
                                        <button onClick={() => handleStatusChange(selectedItem.id, 'RETURNED')}
                                            className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-100 font-medium">
                                            Returned
                                        </button>
                                        <button onClick={() => handleStatusChange(selectedItem.id, 'DISPOSED')}
                                            className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-200 font-medium">
                                            Disposed
                                        </button>
                                    </div>
                                )}
                                {selectedItem.status === 'CLAIMED' && (
                                    <button onClick={() => handleStatusChange(selectedItem.id, 'RETURNED')}
                                        className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-100 font-medium">
                                        Mark Returned
                                    </button>
                                )}
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{selectedItem.item_description}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                        <Tag className="w-3 h-3" /> {getCategoryLabel(selectedItem.item_category)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                        <MapPin className="w-3 h-3" /> {getLocationLabel(selectedItem.location)}
                                        {selectedItem.location_detail && ` - ${selectedItem.location_detail}`}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Date:</span>
                                    <span className="ml-1 font-medium">
                                        {selectedItem.found_lost_date ? format(new Date(selectedItem.found_lost_date), 'MMM dd, yyyy HH:mm') : '-'}
                                    </span>
                                </div>
                                {selectedItem.item_cost && (
                                    <div>
                                        <span className="text-gray-500">Approx. Cost:</span>
                                        <span className="ml-1 font-bold text-gray-900">{formatCurrency(selectedItem.item_cost)}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-gray-500">Reported By:</span>
                                    <span className="ml-1 font-medium">{selectedItem.reported_by_name || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Created:</span>
                                    <span className="ml-1 font-medium">{format(new Date(selectedItem.created_at), 'MMM dd, yyyy HH:mm')}</span>
                                </div>
                                {selectedItem.updated_by_name && (
                                    <div>
                                        <span className="text-gray-500">Last Updated By:</span>
                                        <span className="ml-1 font-medium">{selectedItem.updated_by_name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Contact Info */}
                            {(selectedItem.contact_name || selectedItem.contact_phone || selectedItem.contact_email || selectedItem.booking_pnr) && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Contact Information</span>
                                    <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                                        {selectedItem.contact_name && (
                                            <div className="flex items-center gap-1 text-gray-700">
                                                <User className="w-3.5 h-3.5 text-gray-400" /> {selectedItem.contact_name}
                                            </div>
                                        )}
                                        {selectedItem.contact_phone && (
                                            <div className="flex items-center gap-1 text-gray-700">
                                                <Phone className="w-3.5 h-3.5 text-gray-400" /> {selectedItem.contact_phone}
                                            </div>
                                        )}
                                        {selectedItem.contact_email && (
                                            <div className="flex items-center gap-1 text-gray-700">
                                                <Mail className="w-3.5 h-3.5 text-gray-400" /> {selectedItem.contact_email}
                                            </div>
                                        )}
                                        {selectedItem.booking_pnr && (
                                            <div className="flex items-center gap-1 text-gray-700">
                                                <Hash className="w-3.5 h-3.5 text-gray-400" /> {selectedItem.booking_pnr}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedItem.notes && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Notes</span>
                                    <p className="text-sm text-gray-700 mt-1">{selectedItem.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                            <button onClick={() => { setShowDetailModal(false); setSelectedItem(null); }}
                                className="btn btn-secondary w-full">Close</button>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig({ isOpen: false, id: null })}
                onConfirm={confirmDelete}
                title="Delete Item"
                message="Are you sure you want to delete this lost & found record?"
                confirmColor="bg-red-600 hover:bg-red-700" />
        </div>
    );
}
