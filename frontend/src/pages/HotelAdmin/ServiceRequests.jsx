import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { qrcodeAPI, settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import toast from 'react-hot-toast';
import { UtensilsCrossed, Clock, CheckCircle2, XCircle, PlayCircle, RefreshCw, FileText, Printer, Eye, CheckSquare, Square, Receipt } from 'lucide-react';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';

const statusColors = {
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    ACCEPTED: 'bg-blue-100 text-blue-700 border-blue-200',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function ServiceRequests() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const hotelId = getHotelId();
    
    const [serviceRequests, setServiceRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [hotelTaxes, setHotelTaxes] = useState([]);
    
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedInvoiceGroup, setSelectedInvoiceGroup] = useState(null);

    const handlePrint = (divId) => {
        const printContent = document.getElementById(divId);
        const windowUrl = 'about:blank';
        const uniqueName = new Date().getTime();
        const printWindow = window.open(windowUrl, uniqueName, 'left=100,top=100,width=800,height=900');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print - Hotel CMS</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .kitchen-title { font-size: 24px; font-weight: 900; background: #000; color: #fff; padding: 10px; margin-bottom: 10px; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };
    
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedReviewGroup, setSelectedReviewGroup] = useState(null);
    const [reviewDecisions, setReviewDecisions] = useState({}); // { itemId: 'ACCEPTED' | 'CANCELLED' }

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailsData, setDetailsData] = useState(null);
    const [detailsHistory, setDetailsHistory] = useState([]);

    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const confirmAction = (title, message, onConfirm) => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm });
    };

    useEffect(() => {
        if (hotelId) {
            loadServiceRequests();
        } else {
            setLoading(false);
        }
    }, [hotelId]);

    const loadServiceRequests = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const [data, taxesData] = await Promise.all([
                qrcodeAPI.getServiceRequests(hotelId),
                settingsAPI.getTaxes(hotelId).catch(() => []) // Fallback on missing permissions or empty
            ]);
            setServiceRequests(data.requests || []);
            setHotelTaxes(taxesData || []);
        } catch (error) {
            toast.error(t('service_requests.messages.load_error'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const groupedRequests = useMemo(() => {
        const groups = {};
        serviceRequests.forEach(req => {
            // Group by order_group_id, or fallback to individual id if not present
            const groupId = req.order_group_id || req.id;
            if (!groups[groupId]) {
                groups[groupId] = {
                    id: groupId,
                    is_grouped: !!req.order_group_id,
                    room_number: req.room_number,
                    guest_name: req.guest_name,
                    guest_phone: req.guest_phone,
                    created_at: req.created_at,
                    booking_ref: req.booking_ref,
                    hotel_name: req.hotel_name,
                    is_billed: req.is_billed,
                    payment_method: req.payment_method,
                    items: [],
                    status: ''
                };
            }
            groups[groupId].items.push(req);
        });

        return Object.values(groups).map(group => {
            const statuses = group.items.map(i => i.status);
            
            // Priority logic for group status:
            let groupStatus = 'PENDING';
            if (statuses.every(s => s === 'CANCELLED')) {
               groupStatus = 'CANCELLED';
            } else if (statuses.includes('PENDING')) {
               groupStatus = 'PENDING';
            } else if (statuses.includes('IN_PROGRESS')) {
               groupStatus = 'IN_PROGRESS';
            } else if (statuses.includes('ACCEPTED')) {
               groupStatus = 'ACCEPTED';
            } else {
               groupStatus = 'COMPLETED';
            }
            
            group.status = groupStatus;
            
            // Collect total billed status for group
            group.is_billed = group.items.every(i => i.is_billed);
            group.payment_method = group.items[0].payment_method;

            group.items.sort((a,b) => a.id.localeCompare(b.id)); 
            return group;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [serviceRequests]);

    const handleBulkStatusUpdate = async (group, targetStatus) => {
        let validStatusesToUpdate = [];
        if (targetStatus === 'IN_PROGRESS') validStatusesToUpdate = ['ACCEPTED'];
        if (targetStatus === 'COMPLETED') validStatusesToUpdate = ['IN_PROGRESS'];
        if (targetStatus === 'CANCELLED') validStatusesToUpdate = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];

        const updates = group.items
            .filter(i => validStatusesToUpdate.includes(i.status))
            .map(i => ({ id: i.id, status: targetStatus }));

        if (updates.length === 0) return;

        try {
            await qrcodeAPI.bulkUpdateServiceRequestStatus({ updates, hotel_id: hotelId });
            toast.success(t('service_requests.messages.update_success', { status: t(`service_requests.status.${targetStatus.toLowerCase()}`) }));
            loadServiceRequests();
        } catch (error) {
            toast.error(t('service_requests.messages.update_error'));
        }
    };

    const openReviewModal = (group) => {
        const initialDecisions = {};
        group.items.forEach(item => {
            if (item.status === 'PENDING') {
                initialDecisions[item.id] = 'ACCEPTED'; // default to accepted
            }
        });
        setReviewDecisions(initialDecisions);
        setSelectedReviewGroup(group);
        setShowReviewModal(true);
    };

    const handleConfirmReview = async () => {
        if (!selectedReviewGroup) return;

        const updates = selectedReviewGroup.items
            .filter(i => i.status === 'PENDING')
            .map(i => ({
                id: i.id,
                status: reviewDecisions[i.id] || 'ACCEPTED'
            }));
            
        if (updates.length === 0) return;

        try {
            await qrcodeAPI.bulkUpdateServiceRequestStatus({ updates, hotel_id: hotelId });
            toast.success(t('service_requests.messages.review_success'));
            setShowReviewModal(false);
            loadServiceRequests();
        } catch (error) {
            toast.error(t('service_requests.messages.review_error'));
        }
    };

    const handleViewDetails = async (group) => {
        try {
            // For details, we'll just fetch history for the first item in the group or show group overview
            // Since `getSRDetails` only takes 1 ID, we'll fetch details for the first item just to get history
            // In a complete grouped app, we might want order-level history.
            const data = await qrcodeAPI.getSRDetails(group.items[0].id);
            setDetailsData(group); // pass the whole group
            setDetailsHistory(data.history || []);
            setShowDetailsModal(true);
        } catch (error) {
            toast.error(t('service_requests.messages.details_error'));
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">{t('service_requests.messages.loading')}</p>
        </div>
    );

    if (!hotelId) return <div className="p-8 text-center text-slate-500">{t('bookings.messages.no_hotel')}</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('service_requests.title')}</h1>
                    <p className="text-slate-500 font-medium">{t('service_requests.subtitle')}</p>
                </div>
                <button
                    onClick={() => loadServiceRequests(true)}
                    disabled={refreshing}
                    className="btn bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50 flex items-center gap-2 self-start md:self-center transition-all active:scale-95"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? t('common.refreshing') : t('service_requests.refresh_list')}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {groupedRequests.length === 0 ? (
                    <div className="card p-16 text-center border-2 border-dashed border-slate-200 bg-slate-50/50">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                            <UtensilsCrossed className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{t('service_requests.messages.no_orders')}</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">
                            {t('service_requests.messages.waiting_msg')}
                        </p>
                    </div>
                ) : (
                    <div className="card overflow-hidden border-slate-100 shadow-xl shadow-slate-200/50">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">{t('service_requests.table.room_info')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">{t('service_requests.table.order_details')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">{t('service_requests.table.guest_contact')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">{t('service_requests.table.status')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">{t('service_requests.table.timeline')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">{t('service_requests.table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {groupedRequests.map((group) => (
                                        <tr key={group.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 flex items-center justify-center bg-primary-50 text-primary-700 font-black rounded-xl text-sm border border-primary-100">
                                                        {group.room_number || 'POS'}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">{t('rooms.room')}</p>
                                                        <p className="font-bold text-slate-900">{group.room_number || t('pos.walk_in')}</p>
                                                        {group.booking_ref && (
                                                            <p className="text-[10px] font-bold text-blue-600 mt-0.5">{t('bookings.modals.timeline.reference')}: {group.booking_ref}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">
                                                            {group.items.length} {group.items.length === 1 ? t('bookings.modals.create.quantity') : t('bookings.modals.create.quantity')}
                                                        </span>
                                                        {group.is_grouped && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase">Grouped Order</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium max-w-xs break-words">
                                                        {group.items.map(i => `${i.quantity}x ${i.service_name}`).join(', ')}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-slate-900 text-sm">{group.guest_name || t('service_requests.modals.details.guest')}</p>
                                                    <p className="text-xs text-slate-500 font-medium">{group.guest_phone || t('bookings.modals.timeline.no_email')}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${statusColors[group.status]}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${group.status === 'PENDING' ? 'animate-pulse bg-amber-500' : ''}`} style={{ backgroundColor: 'currentColor' }} />
                                                        {t(`service_requests.status.${group.status.toLowerCase()}`)}
                                                    </span>
                                                    {group.is_billed ? (
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 px-1 bg-emerald-50 rounded">
                                                            Paid {group.payment_method === 'POST_TO_ROOM' ? '(Booking)' : '(POS)'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 bg-slate-50 rounded">
                                                            {t('service_requests.modals.invoice.status_unpaid')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-bold whitespace-nowrap">
                                                        {new Date(group.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleViewDetails(group)}
                                                        className="h-9 px-3 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95 flex items-center gap-1.5"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" /> {t('service_requests.actions.details')}
                                                    </button>
                                                    
                                                    {group.status === 'PENDING' && (
                                                        <>
                                                            <button
                                                                onClick={() => openReviewModal(group)}
                                                                className="h-9 px-4 bg-primary-600 text-white text-xs font-bold rounded-xl hover:bg-primary-700 transition-all active:scale-95 shadow-lg shadow-primary-200 flex items-center gap-2"
                                                            >
                                                                <PlayCircle className="w-4 h-4" /> {t('service_requests.actions.review')}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    confirmAction(t('service_requests.actions.reject_all'), t('service_requests.modals.review.verify_msg'), () => {
                                                                        handleBulkStatusUpdate(group, 'CANCELLED');
                                                                    });
                                                                }}
                                                                className="h-9 px-4 bg-white border-2 border-slate-100 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 transition-all active:scale-95 flex items-center gap-2"
                                                            >
                                                                <XCircle className="w-4 h-4" /> {t('service_requests.actions.reject_all')}
                                                            </button>
                                                        </>
                                                    )}
                                                    
                                                    {group.status === 'ACCEPTED' && (
                                                        <button
                                                            onClick={() => handleBulkStatusUpdate(group, 'IN_PROGRESS')}
                                                            className="h-9 px-4 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 flex items-center gap-2"
                                                        >
                                                            <Clock className="w-4 h-4" /> {t('service_requests.actions.start_prep')}
                                                        </button>
                                                    )}
                                                    
                                                    {group.status === 'IN_PROGRESS' && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    confirmAction(t('service_requests.actions.mark_complete'), t('service_requests.actions.mark_complete') + '?', () => {
                                                                        handleBulkStatusUpdate(group, 'COMPLETED');
                                                                    });
                                                                }}
                                                                className="h-9 px-4 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200 flex items-center gap-2"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" /> {t('service_requests.actions.mark_complete')}
                                                            </button>
                                                             <button
                                                                onClick={() => {
                                                                    confirmAction(t('service_requests.actions.cancel_active'), t('service_requests.actions.cancel_active') + '?', () => {
                                                                        handleBulkStatusUpdate(group, 'CANCELLED');
                                                                    });
                                                                }}
                                                                className="h-9 px-4 bg-white border-2 border-slate-100 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 transition-all active:scale-95 flex items-center gap-2"
                                                            >
                                                                <XCircle className="w-4 h-4" /> {t('service_requests.actions.cancel_active')}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {group.status === 'COMPLETED' && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedInvoiceGroup(group);
                                                                setShowInvoiceModal(true);
                                                            }}
                                                            className="h-9 px-4 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-200 transition-all active:scale-95 flex items-center gap-2"
                                                        >
                                                            <Receipt className="w-4 h-4" /> {t('service_requests.actions.invoice')}
                                                        </button>
                                                    )}

                                                    {(group.status === 'ACCEPTED' || group.status === 'IN_PROGRESS') && (
                                                        <button 
                                                            onClick={() => handlePrint(`kitchen-print-${group.id}`)}
                                                            className="h-9 px-4 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-2"
                                                        >
                                                            <Printer className="w-4 h-4" /> Kitchen
                                                        </button>
                                                    )}

                                                    <div id={`kitchen-print-${group.id}`} className="hidden">
                                                        <div style={{ fontSize: '24px', fontWeight: '900', borderBottom: '2px solid black', marginBottom: '10px' }}>KITCHEN ORDER</div>
                                                        <div style={{ fontWeight: 'bold' }}>Room: {group.room_number}</div>
                                                        <div style={{ fontSize: '12px' }}>Date: {new Date(group.created_at).toLocaleString()}</div>
                                                        <hr/>
                                                        <table style={{ width: '100%', textAlign: 'left', marginTop: '10px' }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Item</th>
                                                                    <th>Qty</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {group.items.filter(i => i.status !== 'CANCELLED').map(item => (
                                                                    <tr key={item.id}>
                                                                        <td>{item.service_name}</td>
                                                                        <td>{item.quantity}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {group.items.some(i => i.notes) && (
                                                            <div style={{ marginTop: '10px', fontSize: '12px' }}>
                                                                <strong>Notes:</strong>
                                                                {group.items.filter(i => i.notes).map(i => <div key={i.id}>- {i.service_name}: {i.notes}</div>)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Review Order Modal (Partial Fulfillment) */}
            <Modal
                isOpen={showReviewModal}
                onClose={() => { setShowReviewModal(false); setSelectedReviewGroup(null); }}
                title={t('service_requests.modals.review.title')}
            >
                {selectedReviewGroup && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                            <h3 className="font-black text-slate-800 mb-2">{t('service_requests.modals.review.fulfillment_check')}</h3>
                            <p className="text-sm text-slate-600">
                                {t('service_requests.modals.review.verify_msg')}
                            </p>
                        </div>
                        
                        <div className="space-y-3">
                            {selectedReviewGroup.items.filter(i => i.status === 'PENDING').map(item => (
                                <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border ${reviewDecisions[item.id] === 'ACCEPTED' ? 'border-primary-200 bg-primary-50/30' : 'border-red-200 bg-red-50/50'} transition-colors`}>
                                    <div>
                                        <p className="font-bold text-slate-900">{item.service_name}</p>
                                        <p className="text-xs text-slate-500">{item.category_name} - {formatCurrency(item.service_price)}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="font-black text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
                                            x{item.quantity}
                                        </div>
                                        <button 
                                            onClick={() => setReviewDecisions(prev => ({ ...prev, [item.id]: prev[item.id] === 'ACCEPTED' ? 'CANCELLED' : 'ACCEPTED' }))}
                                            className={`p-2 rounded-xl border transition-all ${reviewDecisions[item.id] === 'ACCEPTED' ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {reviewDecisions[item.id] === 'ACCEPTED' ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => { setShowReviewModal(false); setSelectedReviewGroup(null); }}
                                className="flex-1 btn bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmReview}
                                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-black hover:bg-primary-700 transition-all shadow-lg active:scale-95"
                            >
                                {t('service_requests.modals.review.confirm')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Details Modal */}
            <Modal
                isOpen={showDetailsModal}
                onClose={() => { setShowDetailsModal(false); setDetailsData(null); setDetailsHistory([]); }}
                title={t('service_requests.modals.details.title')}
            >
                {detailsData && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-5 border border-slate-100">
                            <div className="bg-white rounded-xl p-3 border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('rooms.room')}</span>
                                <p className="font-black text-slate-900 text-lg mt-0.5">{detailsData.room_number}</p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('service_requests.modals.details.guest')}</span>
                                <p className="font-bold text-slate-900 mt-0.5">{detailsData.guest_name || t('service_requests.modals.details.guest')}</p>
                                <p className="text-xs text-slate-500">{detailsData.guest_phone || t('bookings.modals.timeline.no_email')}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-base font-bold text-slate-900 mb-4 flex items-center">
                                <UtensilsCrossed className="w-5 h-5 mr-2 text-primary-500" />
                                {t('service_requests.modals.details.items')}
                            </h4>
                            <div className="space-y-3">
                                {detailsData.items.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                                        <div>
                                            <p className="font-bold text-slate-900">{item.service_name}</p>
                                            <p className="text-xs text-slate-500">x{item.quantity}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${statusColors[item.status]}`}>
                                            {t(`service_requests.status.${item.status.toLowerCase()}`)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-base font-bold text-slate-900 mb-4 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-blue-500" />
                                {t('service_requests.modals.details.timeline_root')}
                            </h4>
                            {detailsHistory.length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-4">{t('service_requests.modals.details.no_history')}</p>
                            ) : (
                                <div className="space-y-3">
                                    {detailsHistory.map((entry) => (
                                        <div key={entry.id} className="bg-slate-50 rounded-xl p-4 flex-1 border border-slate-100">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{t(`service_requests.status.${entry.to_status.toLowerCase()}`)}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{t('bookings.modals.timeline.action_by', { actor: entry.changed_by_name || t('bookings.modals.timeline.no_email') })}</p>
                                                </div>
                                                <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-100 font-medium">
                                                    {new Date(entry.changed_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <button
                                onClick={() => { setShowDetailsModal(false); setDetailsData(null); setDetailsHistory([]); }}
                                className="btn bg-slate-100 text-slate-600 hover:bg-slate-200 w-full font-bold"
                            >
                                {t('bookings.modals.check_out.close')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Service Request Invoice Modal */}
            <Modal
                isOpen={showInvoiceModal}
                onClose={() => {
                    setShowInvoiceModal(false);
                    setSelectedInvoiceGroup(null);
                }}
                title={t('service_requests.modals.invoice.title')}
            >
                {selectedInvoiceGroup && (() => {
                    // Tax Calculation Logic
                    const taxBreakdown = [];
                    let totalExclusiveTax = 0;

                    const validItems = selectedInvoiceGroup.items.filter(i => i.status !== 'CANCELLED');
                    const subtotal = validItems.reduce((acc, curr) => acc + (curr.quantity * parseFloat(curr.service_price)), 0);

                    validItems.forEach(item => {
                        const itemTotal = item.quantity * parseFloat(item.service_price);
                        
                        hotelTaxes.filter(t => t.is_active && (
                            t.category?.toUpperCase() === item.category_name?.toUpperCase() || 
                            t.category?.toUpperCase() === 'ALL' || 
                            t.category?.toUpperCase() === 'SERVICES'
                        )).forEach(tax => {
                            const rate = parseFloat(tax.rate);
                            let taxAmount = 0;

                            if (tax.is_inclusive) {
                                taxAmount = itemTotal - (itemTotal / (1 + rate / 100));
                            } else {
                                taxAmount = itemTotal * (rate / 100);
                            }

                            const existingTax = taxBreakdown.find(tb => tb.id === tax.id);
                            if (existingTax) {
                                existingTax.amount += taxAmount;
                            } else {
                                taxBreakdown.push({
                                    id: tax.id,
                                    name: tax.name,
                                    rate,
                                    is_inclusive: tax.is_inclusive,
                                    amount: taxAmount
                                });
                            }
                            if (!tax.is_inclusive) {
                                totalExclusiveTax += taxAmount;
                            }
                        });
                    });

                    const grandTotal = subtotal + totalExclusiveTax;

                    return (
                        <div className="space-y-6">
                            <div id="service-invoice-content" className="border-2 border-slate-100 p-8 bg-white rounded-[2rem] shadow-sm">
                                <div className="text-center mb-6">
                                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{selectedInvoiceGroup.hotel_name}</h1>
                                <div className="w-12 h-1 bg-primary-600 mx-auto mt-2 rounded-full" />
                            </div>

                             <div className="flex justify-between border-b border-slate-100 pb-6 mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('service_requests.modals.invoice.receipt')}</h2>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t('service_requests.modals.invoice.order_ref')}: #{selectedInvoiceGroup.id.substring(0,8).toUpperCase()}</p>
                                </div>
                                 <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">{t('rooms.room')} {selectedInvoiceGroup.room_number || t('pos.walk_in')}</p>
                                    <p className="text-xs font-bold text-slate-500 mt-1">{new Date(selectedInvoiceGroup.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                             <div className="px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('service_requests.modals.invoice.payment_status')}</p>
                                    <p className={`text-sm font-black uppercase tracking-tight ${selectedInvoiceGroup.is_billed ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {selectedInvoiceGroup.is_billed 
                                            ? (selectedInvoiceGroup.payment_method === 'POST_TO_ROOM' 
                                                ? t('service_requests.modals.invoice.status_paid_booking') 
                                                : t('service_requests.modals.invoice.status_paid_pos'))
                                            : t('service_requests.modals.invoice.status_unpaid')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('service_requests.modals.invoice.payment_method')}</p>
                                    <p className="text-sm font-bold text-slate-700 uppercase">{selectedInvoiceGroup.payment_method || 'N/A'}</p>
                                </div>
                            </div>

                             <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('service_requests.modals.details.guest')}</p>
                                    <p className="text-sm font-bold text-slate-900">{selectedInvoiceGroup.guest_name || t('service_requests.modals.details.guest')}</p>
                                    <p className="text-xs font-medium text-slate-500">{selectedInvoiceGroup.guest_phone || t('bookings.modals.timeline.no_email')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('service_requests.modals.invoice.total_items')}</p>
                                    <p className="text-sm font-bold text-slate-900">{selectedInvoiceGroup.items.filter(i => i.status !== 'CANCELLED').length}</p>
                                </div>
                            </div>

                            <table className="w-full text-sm mb-8">
                                <thead>
                                     <tr className="border-b-2 border-slate-50 text-left">
                                        <th className="py-3 px-1 font-black text-slate-400 uppercase tracking-widest text-[10px]">{t('service_requests.modals.invoice.description')}</th>
                                        <th className="py-3 px-1 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">{t('service_requests.modals.invoice.qty')}</th>
                                        <th className="py-3 px-1 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">{t('service_requests.modals.invoice.unit_price')}</th>
                                        <th className="py-3 px-1 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">{t('service_requests.modals.invoice.total')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {selectedInvoiceGroup.items.map(item => (
                                        <tr key={item.id} className={item.status === 'CANCELLED' ? 'text-slate-300' : ''}>
                                            <td className="py-4 px-1 font-bold text-slate-900">
                                                {item.status === 'CANCELLED' ? <del>{item.service_name}</del> : item.service_name}
                                                {item.status === 'CANCELLED' && <span className="ml-2 text-[10px] text-red-500 font-bold uppercase">{t('service_requests.status.cancelled')}</span>}
                                            </td>
                                            <td className={`py-4 px-1 text-center font-bold ${item.status === 'CANCELLED' ? 'text-slate-300' : 'text-slate-600'}`}>{item.quantity}</td>
                                            <td className={`py-4 px-1 text-right font-medium ${item.status === 'CANCELLED' ? 'text-slate-300' : 'text-slate-600'}`}>{formatCurrency(item.service_price)}</td>
                                            <td className={`py-4 px-1 text-right font-black ${item.status === 'CANCELLED' ? 'text-slate-300' : 'text-slate-900'}`}>
                                                {item.status === 'CANCELLED' ? formatCurrency(0) : formatCurrency(item.quantity * parseFloat(item.service_price))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                     <tr className="border-t border-slate-200">
                                        <td colSpan="3" className="py-3 px-1 font-bold text-slate-700 uppercase tracking-widest text-right">{t('service_requests.modals.invoice.subtotal')}</td>
                                        <td className="py-3 px-1 text-right font-bold text-slate-900">
                                            {formatCurrency(subtotal)}
                                        </td>
                                    </tr>
                                    {taxBreakdown.map((tax, idx) => (
                                        <tr key={`tax-${idx}`} className="text-sm">
                                            <td colSpan="3" className="py-1 px-1 text-right text-slate-500 font-medium">
                                                {tax.name} ({tax.rate}%) {tax.is_inclusive ? '(Inclusive)' : ''}
                                            </td>
                                            <td className="py-1 px-1 text-right text-slate-600 font-medium">
                                                {formatCurrency(tax.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                     <tr className="border-t-2 border-slate-900 mt-2">
                                        <td colSpan="3" className="py-4 px-1 font-black text-slate-900 uppercase tracking-widest text-right">{t('service_requests.modals.invoice.grand_total')}</td>
                                        <td className="py-4 px-1 text-right text-xl font-black text-primary-600">
                                            {formatCurrency(grandTotal)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                             <div className="text-center pt-6 border-t border-dashed border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('service_requests.modals.invoice.thank_you')}</p>
                                <p className="text-[8px] text-slate-300 font-bold">{new Date().toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    const printContent = document.getElementById('service-invoice-content').innerHTML;
                                    const originalContent = document.body.innerHTML;
                                    document.body.innerHTML = printContent;
                                    window.print();
                                    document.body.innerHTML = originalContent;
                                    window.location.reload();
                                }}
                                className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all active:scale-[0.98]"
                            >
                                 <Printer className="w-5 h-5" />
                                {t('service_requests.modals.invoice.print')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowInvoiceModal(false);
                                    setSelectedInvoiceGroup(null);
                                }}
                                 className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                            >
                                {t('bookings.modals.check_out.close')}
                            </button>
                        </div>
                        </div>
                    );
                })()}
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
