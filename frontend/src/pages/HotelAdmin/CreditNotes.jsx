import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { creditNoteAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import {
    Plus, RefreshCw, FileText, Search, User, Phone, Mail, Hash, MessageSquare,
    DollarSign, CreditCard, CheckCircle, XCircle, Clock, Eye, ShieldCheck, ShieldX
} from 'lucide-react';
import { format } from 'date-fns';

const PAID_VIA_OPTIONS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'CHEQUE', label: 'Cheque' },
];

const statusColors = {
    CREATED: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
};

const statusIcons = {
    CREATED: Clock,
    APPROVED: CheckCircle,
    REJECTED: XCircle,
};

export default function CreditNotes() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const hotelId = getHotelId();

    const [creditNotes, setCreditNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedCN, setSelectedCN] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, id: null, action: '' });
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectId, setRejectId] = useState(null);

    const [form, setForm] = useState({
        guest_name: '', guest_phone: '', guest_email: '', invoice_pnr: '',
        comments: '', amount: '', paid_via: 'CASH',
    });

    useEffect(() => {
        if (hotelId) loadCreditNotes();
    }, [hotelId]);

    const loadCreditNotes = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;
            const data = await creditNoteAPI.getByHotel(hotelId, params);
            setCreditNotes(data.creditNotes || []);
        } catch (error) {
            toast.error('Failed to load credit notes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hotelId) loadCreditNotes();
    }, [statusFilter]);

    const resetForm = () => {
        setForm({ guest_name: '', guest_phone: '', guest_email: '', invoice_pnr: '', comments: '', amount: '', paid_via: 'CASH' });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await creditNoteAPI.create({ ...form, hotel_id: hotelId });
            toast.success('Credit note created');
            setShowCreateModal(false);
            resetForm();
            loadCreditNotes();
        } catch (error) {
            toast.error(error.message || 'Failed to create credit note');
        }
    };

    const handleViewDetail = async (cn) => {
        try {
            const data = await creditNoteAPI.getById(cn.id, hotelId);
            setSelectedCN(data);
            setShowDetailModal(true);
        } catch (error) {
            toast.error('Failed to load credit note details');
        }
    };

    const handleApprove = async (id) => {
        try {
            await creditNoteAPI.approve(id, hotelId);
            toast.success('Credit note approved - amount deducted from earnings');
            loadCreditNotes();
            if (selectedCN?.id === id) {
                const data = await creditNoteAPI.getById(id, hotelId);
                setSelectedCN(data);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to approve');
        }
    };

    const handleReject = async () => {
        try {
            await creditNoteAPI.reject(rejectId, hotelId, rejectReason);
            toast.success('Credit note rejected');
            setShowRejectModal(false);
            setRejectReason('');
            setRejectId(null);
            loadCreditNotes();
            if (selectedCN?.id === rejectId) {
                const data = await creditNoteAPI.getById(rejectId, hotelId);
                setSelectedCN(data);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to reject');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        loadCreditNotes();
    };

    // Stats
    const stats = {
        total: creditNotes.length,
        pending: creditNotes.filter(cn => cn.status === 'CREATED').length,
        approved: creditNotes.filter(cn => cn.status === 'APPROVED').length,
        rejected: creditNotes.filter(cn => cn.status === 'REJECTED').length,
        totalRefunded: creditNotes.filter(cn => cn.status === 'APPROVED').reduce((sum, cn) => sum + parseFloat(cn.amount || 0), 0),
    };

    const columns = [
        {
            key: 'credit_note_ref', label: 'Ref#',
            render: (v) => <span className="font-mono font-bold text-sm text-slate-900">{v}</span>,
        },
        { key: 'guest_name', label: 'Guest Name', render: (v) => <span className="font-medium">{v}</span> },
        { key: 'guest_phone', label: 'Phone', render: (v) => v || '-' },
        {
            key: 'invoice_pnr', label: 'Invoice/PNR',
            render: (v) => v ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{v}</span> : '-',
        },
        {
            key: 'amount', label: 'Amount',
            render: (v) => <span className="font-bold text-slate-900">{formatCurrency(v)}</span>,
        },
        {
            key: 'paid_via', label: 'Paid Via',
            render: (v) => <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-semibold">{v?.replace('_', ' ')}</span>,
        },
        {
            key: 'status', label: 'Status',
            render: (v) => {
                const Icon = statusIcons[v] || Clock;
                return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[v]}`}>
                        <Icon className="w-3 h-3" /> {v}
                    </span>
                );
            },
        },
        {
            key: 'created_at', label: 'Created',
            render: (v) => <span className="text-xs text-slate-500">{v ? format(new Date(v), 'MMM dd, yyyy') : '-'}</span>,
        },
        {
            key: 'actions_custom', label: '',
            render: (_, cn) => (
                <div className="flex items-center gap-1">
                    <button onClick={() => handleViewDetail(cn)}
                        className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg hover:bg-slate-200 inline-flex items-center font-medium">
                        <Eye className="w-3 h-3 mr-1" /> View
                    </button>
                    {cn.status === 'CREATED' && (
                        <>
                            <button onClick={() => handleApprove(cn.id)}
                                className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-100 inline-flex items-center font-medium">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Approve
                            </button>
                            <button onClick={() => { setRejectId(cn.id); setShowRejectModal(true); }}
                                className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-100 inline-flex items-center font-medium">
                                <ShieldX className="w-3 h-3 mr-1" /> Reject
                            </button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    const eventTypeColors = {
        CREATED: 'text-amber-500',
        APPROVED: 'text-emerald-500',
        REJECTED: 'text-red-500',
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Credit Notes</h1>
                    <p className="text-gray-500 text-sm">Manage refunds and credit notes for customers</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadCreditNotes} className="btn btn-secondary inline-flex items-center text-sm">
                        <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
                    </button>
                    <button onClick={() => { resetForm(); setShowCreateModal(true); }}
                        className="btn btn-primary inline-flex items-center text-sm">
                        <Plus className="w-4 h-4 mr-1.5" /> New Credit Note
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Total</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className="bg-white rounded-xl border border-amber-200 p-4">
                    <div className="text-xs text-amber-600 uppercase font-semibold">Pending</div>
                    <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
                </div>
                <div className="bg-white rounded-xl border border-emerald-200 p-4">
                    <div className="text-xs text-emerald-600 uppercase font-semibold">Approved</div>
                    <div className="text-2xl font-bold text-emerald-700">{stats.approved}</div>
                </div>
                <div className="bg-white rounded-xl border border-red-200 p-4">
                    <div className="text-xs text-red-500 uppercase font-semibold">Rejected</div>
                    <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
                </div>
                <div className="bg-white rounded-xl border border-purple-200 p-4">
                    <div className="text-xs text-purple-600 uppercase font-semibold">Total Refunded</div>
                    <div className="text-xl font-bold text-purple-700">{formatCurrency(stats.totalRefunded)}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <form onSubmit={handleSearch} className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                        <input placeholder="Search by name, phone, ref, PNR..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300" />
                    </div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none">
                        <option value="">All Status</option>
                        <option value="CREATED">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                    <button type="submit" className="btn btn-secondary text-sm">Search</button>
                    {(statusFilter || searchTerm) && (
                        <button type="button" onClick={() => { setStatusFilter(''); setSearchTerm(''); }}
                            className="text-xs text-slate-500 hover:text-slate-700 underline">Clear</button>
                    )}
                </form>
            </div>

            {/* Table */}
            <DataTable columns={columns} data={creditNotes} loading={loading} />

            {/* ============================================ */}
            {/* CREATE CREDIT NOTE MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm(); }}
                title="Create Credit Note">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name *</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input required placeholder="Customer name" value={form.guest_name}
                                    onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                                    className="input pl-10" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input placeholder="Phone number" value={form.guest_phone}
                                    onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
                                    className="input pl-10" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input type="email" placeholder="Email address" value={form.guest_email}
                                    onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
                                    className="input pl-10" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice / Booking PNR</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input placeholder="e.g. BK-XXXXXX or INV-XXX" value={form.invoice_pnr}
                                    onChange={(e) => setForm({ ...form, invoice_pnr: e.target.value })}
                                    className="input pl-10" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Refunded *</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input required type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    className="input pl-10" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Paid Via *</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <select required value={form.paid_via}
                                    onChange={(e) => setForm({ ...form, paid_via: e.target.value })}
                                    className="input pl-10">
                                    {PAID_VIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                        <div className="relative">
                            <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <textarea rows={3} placeholder="Reason for refund..." value={form.comments}
                                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                                className="input pl-10" />
                        </div>
                    </div>

                    <div className="flex space-x-3 pt-4 border-t border-gray-200">
                        <button type="submit" className="btn btn-primary flex-1">Create Credit Note</button>
                        <button type="button" onClick={() => { setShowCreateModal(false); resetForm(); }}
                            className="btn btn-secondary">Cancel</button>
                    </div>
                </form>
            </Modal>

            {/* ============================================ */}
            {/* DETAIL MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showDetailModal}
                onClose={() => { setShowDetailModal(false); setSelectedCN(null); }}
                title="Credit Note Details">
                {selectedCN && (
                    <div className="space-y-6">
                        {/* Header info */}
                        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="font-mono text-lg font-bold text-gray-900">{selectedCN.credit_note_ref}</span>
                                    {selectedCN.booking_ref && (
                                        <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                                            Booking: {selectedCN.booking_ref}
                                        </span>
                                    )}
                                </div>
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${statusColors[selectedCN.status]}`}>
                                    {(() => { const Icon = statusIcons[selectedCN.status]; return <Icon className="w-3.5 h-3.5" />; })()}
                                    {selectedCN.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Guest Name:</span>
                                    <span className="ml-1 font-medium text-gray-900">{selectedCN.guest_name}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Amount:</span>
                                    <span className="ml-1 font-bold text-gray-900">{formatCurrency(selectedCN.amount)}</span>
                                </div>
                                {selectedCN.guest_phone && (
                                    <div>
                                        <span className="text-gray-500">Phone:</span>
                                        <span className="ml-1 font-medium">{selectedCN.guest_phone}</span>
                                    </div>
                                )}
                                {selectedCN.guest_email && (
                                    <div>
                                        <span className="text-gray-500">Email:</span>
                                        <span className="ml-1 font-medium">{selectedCN.guest_email}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-gray-500">Invoice/PNR:</span>
                                    <span className="ml-1 font-mono text-sm">{selectedCN.invoice_pnr || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Paid Via:</span>
                                    <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                                        {selectedCN.paid_via?.replace('_', ' ')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Created By:</span>
                                    <span className="ml-1 font-medium">{selectedCN.created_by_name || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Created At:</span>
                                    <span className="ml-1 font-medium">{format(new Date(selectedCN.created_at), 'MMM dd, yyyy HH:mm')}</span>
                                </div>
                                {selectedCN.approved_by_name && (
                                    <div>
                                        <span className="text-gray-500">Approved By:</span>
                                        <span className="ml-1 font-medium text-emerald-700">{selectedCN.approved_by_name}</span>
                                    </div>
                                )}
                                {selectedCN.approved_at && (
                                    <div>
                                        <span className="text-gray-500">Approved At:</span>
                                        <span className="ml-1 font-medium text-emerald-700">{format(new Date(selectedCN.approved_at), 'MMM dd, yyyy HH:mm')}</span>
                                    </div>
                                )}
                            </div>

                            {selectedCN.comments && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Comments</span>
                                    <p className="text-sm text-gray-700 mt-1">{selectedCN.comments}</p>
                                </div>
                            )}

                            {/* Action buttons for CREATED status */}
                            {selectedCN.status === 'CREATED' && (
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => handleApprove(selectedCN.id)}
                                        className="btn btn-primary inline-flex items-center text-sm flex-1">
                                        <ShieldCheck className="w-4 h-4 mr-1.5" /> Approve & Deduct from Earnings
                                    </button>
                                    <button onClick={() => { setRejectId(selectedCN.id); setShowRejectModal(true); }}
                                        className="btn bg-red-600 hover:bg-red-700 text-white inline-flex items-center text-sm">
                                        <ShieldX className="w-4 h-4 mr-1.5" /> Reject
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Event History Timeline */}
                        <div>
                            <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-blue-500" /> History
                            </h4>
                            {(!selectedCN.events || selectedCN.events.length === 0) ? (
                                <p className="text-sm text-gray-500 italic text-center py-4">No history available</p>
                            ) : (
                                <div className="relative ml-4">
                                    <div className="absolute left-3.5 top-6 bottom-6 w-0.5 bg-gray-100" />
                                    <div className="space-y-0">
                                        {selectedCN.events.map((event) => {
                                            const dotColor = eventTypeColors[event.event_type] || 'text-gray-400';
                                            return (
                                                <div key={event.id} className="relative flex items-start pl-10 py-3">
                                                    <div className={`absolute left-0 top-3.5 ${dotColor}`}>
                                                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
                                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="white" />
                                                            <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-xl p-4 flex-1 border border-gray-100">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <p className="font-bold text-gray-900 text-sm">{event.event_type}</p>
                                                                <p className="text-sm text-blue-600 mt-0.5">{event.description}</p>
                                                            </div>
                                                            <span className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-100 whitespace-nowrap font-medium">
                                                                {format(new Date(event.created_at), 'MMM dd, yyyy, h:mm a')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                            <button onClick={() => { setShowDetailModal(false); setSelectedCN(null); }}
                                className="btn btn-secondary w-full">Close</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ============================================ */}
            {/* REJECT REASON MODAL */}
            {/* ============================================ */}
            <Modal isOpen={showRejectModal} onClose={() => { setShowRejectModal(false); setRejectReason(''); setRejectId(null); }}
                title="Reject Credit Note">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Please provide a reason for rejecting this credit note.</p>
                    <textarea rows={3} placeholder="Reason for rejection..." value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="input w-full" />
                    <div className="flex space-x-3 pt-2">
                        <button onClick={handleReject}
                            className="btn bg-red-600 hover:bg-red-700 text-white flex-1">
                            Confirm Reject
                        </button>
                        <button onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectId(null); }}
                            className="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
