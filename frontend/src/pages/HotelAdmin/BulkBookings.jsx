import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bulkBookingAPI, roomAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Users, Calendar, Info, RefreshCw, Trash2, Eye, Building2, Phone, Mail, MapPin, FileText, Printer, Tag, CheckCircle, ChevronLeft, ChevronRight, XCircle, DollarSign, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BulkBookings() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const { formatCurrency } = useCurrencyStore();
    const navigate = useNavigate();
    const hotelId = getHotelId();

    const [bookings, setBookings] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    // Form State
    const initialFormState = {
        company_name: '',
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        event_details: '',
        additional_requirements: '',
        check_in_date: '',
        check_out_date: '',
        adults: 1,
        children: 0,
        rooms: [] // array of { room_type_id, quantity }
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (hotelId) loadData();
    }, [hotelId]);

    const loadData = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            try {
                const typesRes = await roomAPI.getTypes(hotelId);
                setRoomTypes(typesRes.roomTypes || typesRes.data || typesRes || []);
            } catch (error) {
                console.error("Failed to load room types:", error);
                setRoomTypes([]);
            }

            try {
                const bookingsRes = await bulkBookingAPI.getByHotel(hotelId);
                setBookings(bookingsRes.data || bookingsRes || []);
            } catch (error) {
                console.error("Failed to load bulk bookings:", error);
                toast.error(t('bulk_bookings.messages.load_error'));
                setBookings([]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.rooms.length) {
            return toast.error(t('bulk_bookings.messages.room_required'));
        }

        try {
            await bulkBookingAPI.create(hotelId, formData);
            toast.success(t('bulk_bookings.messages.create_success'));
            setShowModal(false);
            setFormData(initialFormState);
            loadData();
        } catch (error) {
            console.error("Bulk Booking Error:", error);
            toast.error(error.message || error.toString() || t('bulk_bookings.messages.load_error'));
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            // Fix: Pass null for roomAssignments when updating status from the list
            await bulkBookingAPI.updateStatus(id, newStatus, null, hotelId);
            toast.success(t('bulk_bookings.messages.update_success'));
            loadData();
        } catch (error) {
            console.error("Update Status Error:", error);
            toast.error(error.message || error.toString() || t('bulk_bookings.messages.update_success'));
        }
    };

    const handleViewInvoice = async (booking) => {
        try {
            const data = await bulkBookingAPI.getInvoice(booking.id, hotelId);
            setInvoiceData(data.invoice);
            setShowInvoiceModal(true);
        } catch (error) {
            console.error('Invoice Error:', error);
            toast.error(error.message || 'Failed to load invoice');
        }
    };

    const addRoomRow = () => {
        if (!roomTypes.length) return toast.error('No room types available.');

        // Suggest quantity based on adults/children if possible
        const defaultType = roomTypes[0];
        const maxOcc = (defaultType.max_adults || 2);
        const suggestedQty = Math.ceil(formData.adults / maxOcc) || 1;

        setFormData({
            ...formData,
            rooms: [...formData.rooms, { room_type_id: defaultType.id, quantity: suggestedQty }]
        });
    };

    const updateRoomRow = (index, field, value) => {
        const updated = [...formData.rooms];
        updated[index][field] = value;
        setFormData({ ...formData, rooms: updated });
    };

    const removeRoomRow = (index) => {
        const updated = [...formData.rooms];
        updated.splice(index, 1);
        setFormData({ ...formData, rooms: updated });
    };

    const getStatusBadgeClass = (status) => {
        const map = {
            CREATED: 'bg-blue-100 text-blue-800',
            CONFIRMED: 'bg-yellow-100 text-yellow-800',
            CHECKED_IN: 'bg-green-100 text-green-800',
            CHECKED_OUT: 'bg-gray-200 text-gray-700',
            CANCELLED: 'bg-red-100 text-red-800',
            NO_SHOW: 'bg-orange-100 text-orange-800',
            REFUNDED: 'bg-purple-100 text-purple-800'
        };
        return map[status] || 'bg-gray-100 text-gray-800';
    };

    const columns = [
        {
            key: 'company_name',
            label: t('bulk_bookings.table.corporate_group'),
            render: (val, row) => (
                <div>
                    <div className="font-semibold text-gray-900">{val || t('common.none')}</div>
                    <div className="text-xs text-gray-500">{row.guest_name}</div>
                </div>
            )
        },
        {
            key: 'dates',
            label: t('bulk_bookings.table.dates'),
            render: (_, row) => (
                <span className="text-sm">
                    {new Date(row.check_in_date).toLocaleDateString()} - {new Date(row.check_out_date).toLocaleDateString()}
                </span>
            )
        },
        {
            key: 'child_bookings',
            label: t('bulk_bookings.table.rooms_reserved'),
            render: (val) => {
                if (!val || val.length === 0) return <span className="text-gray-400">0</span>;
                const total = val.reduce((acc, curr) => acc + parseInt(curr.quantity), 0);
                const allRoomNumbers = val.flatMap(b => (b.rooms || []).map(r => r.room_number)).filter(Boolean);

                return (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-bold">{total} Rooms</span>
                            <div className="flex -space-x-1 overflow-hidden" title={val.map(v => `${v.quantity}x ${v.room_type_name}`).join(', ')}>
                                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                            </div>
                        </div>
                        {allRoomNumbers.length > 0 && (
                            <div className="text-[10px] text-gray-600 font-bold tracking-wider mt-1 flex flex-wrap gap-1 max-w-[180px]">
                                {allRoomNumbers.map((rm, idx) => (
                                    <span key={idx} className="bg-gray-100 border px-1 rounded">{rm}</span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'booking_references',
            label: 'PNR',
            render: (_, row) => {
                if (!row.child_bookings) return <span className="text-gray-400">-</span>;
                return (
                    <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {row.child_bookings.map(b => b.booking_ref).filter(Boolean).map((ref, idx) => (
                            <span key={idx} className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded shadow-sm border border-indigo-100 uppercase">{ref}</span>
                        ))}
                    </div>
                );
            }
        },
        {
            key: 'total_amount',
            label: t('bulk_bookings.table.bill'),
            render: (val) => formatCurrency(val)
        },
        {
            key: 'status',
            label: t('bulk_bookings.table.status'),
            render: (val) => (
                <span
                    className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-1 shadow-sm border ${val === 'CREATED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        val === 'CONFIRMED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            val === 'CHECKED_IN' ? 'bg-green-50 text-green-700 border-green-200' :
                                val === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                                    val === 'CHECKED_OUT' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                        'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                >
                    {t(`bulk_bookings.status.${val.toLowerCase()}`)}
                </span>
            )
        },
        {
            key: 'actions',
            label: t('bulk_bookings.table.actions'),
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setSelectedBooking(row); setShowDetailModal(true); }}
                        className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="View Details"
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                    {(row.status === 'CONFIRMED' || row.status === 'CREATED') && (
                        <>
                            <button
                                onClick={() => handleCheckInClick(row)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Group Check-in"
                            >
                                <Calendar className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleCancel(row)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Cancel Booking"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </>
                    )}
                    {(row.status === 'CHECKED_IN') && (
                        <button
                            onClick={() => { setSelectedBooking(row); setShowBillingModal(true); }}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                            title="Manage Billing"
                        >
                            <FileText className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )
        }
    ];

    // Room Assignment State for Check-in
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [roomAssignments, setRoomAssignments] = useState([]); // Array of room IDs
    const [availableRooms, setAvailableRooms] = useState([]);

    useEffect(() => {
        if (showCheckInModal && selectedBooking) {
            loadAvailableRooms();
        }
    }, [showCheckInModal, selectedBooking]);

    const handleCheckInClick = (booking) => {
        setSelectedBooking(booking);
        setCheckInStep(0);
        setShowCheckInModal(true);

        // Initialization of guests is handled here
        const totalGuests = (parseInt(booking.adults) || 0) + (parseInt(booking.children) || 0);
        const initialGuests = Array.from({ length: totalGuests }, (_, idx) => ({
            full_name: '',
            age: '',
            id_proof_type: 'Aadhar',
            id_proof_number: '',
            room_idx: 0,
            is_child: idx >= (parseInt(booking.adults) || 0)
        }));
        setGroupGuestDetails(initialGuests);
    };

    const handleCancel = async (booking) => {
        if (!window.confirm("Are you sure you want to cancel this bulk booking? This action cannot be undone.")) return;
        try {
            await bulkBookingAPI.updateStatus(booking.id, 'CANCELLED', [], hotelId, []);
            toast.success("Booking cancelled successfully");
            loadData();
        } catch (error) {
            toast.error(error.message || "Failed to cancel booking");
        }
    };

    const loadAvailableRooms = async () => {
        try {
            const res = await roomAPI.getByHotel(hotelId, { status: 'AVAILABLE' });
            setAvailableRooms(res.rooms || []);
            // Initialize assignments with nulls for each child booking
            const totalRequired = selectedBooking.child_bookings.reduce((acc, b) => acc + parseInt(b.quantity), 0);
            setRoomAssignments(new Array(totalRequired).fill(''));
        } catch (error) {
            toast.error("Failed to load available rooms");
        }
    };

    const [checkInStep, setCheckInStep] = useState(0);
    const [groupGuestDetails, setGroupGuestDetails] = useState([]);

    const handleGroupCheckIn = async () => {
        if (roomAssignments.some(id => !id)) {
            return toast.error("Please assign a room to all bookings");
        }

        if (groupGuestDetails.some(g => !g.full_name)) {
            return toast.error("Please fill all guest names");
        }

        try {
            await bulkBookingAPI.updateStatus(selectedBooking.id, 'CHECKED_IN', roomAssignments, hotelId, groupGuestDetails);
            toast.success("Group checked in successfully");
            setShowCheckInModal(false);
            loadData();
        } catch (error) {
            toast.error(error.message || "Failed to check in");
        }
    };

    // Billing Management State
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [billingData, setBillingData] = useState({
        promo_discount: 0,
        applied_promotion: '',
        corporate_gst: '',
        extra_charges: []
    });

    useEffect(() => {
        if (showBillingModal && selectedBooking) {
            setBillingData({
                promo_discount: selectedBooking.promo_discount || 0,
                applied_promotion: selectedBooking.applied_promotion || '',
                corporate_gst: selectedBooking.corporate_gst || '',
                extra_charges: selectedBooking.extra_charges || []
            });
        }
    }, [showBillingModal, selectedBooking]);

    const handleApplyCoupon = async () => {
        if (!billingData.applied_promotion) return;
        try {
            const res = await bulkBookingAPI.updateBilling(selectedBooking.id, hotelId, {
                applied_promotion: billingData.applied_promotion
            });
            toast.success("Coupon applied!");
            const updatedRes = await bulkBookingAPI.getById(selectedBooking.id, hotelId);
            const updated = updatedRes.data;
            setSelectedBooking(updated);
            setBillingData({
                ...billingData,
                promo_discount: updated.promo_discount || 0,
                applied_promotion: updated.applied_promotion || ''
            });
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.error || "Invalid coupon code");
        }
    };

    const handlePreviewBill = async () => {
        try {
            await bulkBookingAPI.updateBilling(selectedBooking.id, hotelId, billingData);
            const invRes = await bulkBookingAPI.getInvoice(selectedBooking.id, hotelId);
            setInvoiceData(invRes.invoice);
            setShowBillingModal(false);
            setShowInvoiceModal(true);
        } catch (error) {
            toast.error("Failed to generate preview bill");
        }
    };

    const handleCheckOutSubmit = async () => {
        if (!window.confirm("Are you sure you want to finalize checkout? You cannot add more charges after this.")) return;
        try {
            await bulkBookingAPI.updateStatus(selectedBooking.id, 'CHECKED_OUT', [], hotelId, []);
            toast.success("Booking checked out successfully");

            const updatedRes = await bulkBookingAPI.getById(selectedBooking.id, hotelId);
            setSelectedBooking(updatedRes.data);

            // Refresh invoice
            const invRes = await bulkBookingAPI.getInvoice(selectedBooking.id, hotelId);
            setInvoiceData(invRes.invoice);

            loadData();
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to checkout");
        }
    };

    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [isSettling, setIsSettling] = useState(false);

    const handleSettlePayment = async () => {
        if (!selectedBooking || !paymentMethod) return;
        setIsSettling(true);
        try {
            await bulkBookingAPI.settlePayment(selectedBooking.id, hotelId, paymentMethod);
            toast.success("Payment settled successfully!");

            // Refresh invoice to show Paid status
            const invRes = await bulkBookingAPI.getInvoice(selectedBooking.id, hotelId);
            setInvoiceData(invRes.invoice);
            const updatedRes = await bulkBookingAPI.getById(selectedBooking.id, hotelId);
            setSelectedBooking(updatedRes.data);

            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Failed to settle payment");
        } finally {
            setIsSettling(false);
        }
    };

    if (loading) return <div>{t('bulk_bookings.loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary-600" />
                        {t('bulk_bookings.title')}
                    </h1>
                    <p className="text-gray-600">{t('bulk_bookings.subtitle')}</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('bulk_bookings.refresh')}
                    </button>
                    <button
                        onClick={() => { setFormData(initialFormState); setShowModal(true); }}
                        className="btn btn-primary inline-flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('bulk_bookings.new_booking')}
                    </button>
                </div>
            </div>

            <DataTable columns={columns} data={bookings} />

            {/* Create Bulk Booking Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={t('bulk_bookings.modals.create.title')}
                size="4xl"
            >
                <form onSubmit={handleCreate} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Left Column: Client Details */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary-600" />
                                {t('bulk_bookings.modals.create.client_details')}
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.company_name')}</label>
                                    <input
                                        type="text"
                                        required
                                        className="input w-full"
                                        value={formData.company_name}
                                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                        placeholder="Company OR Family Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.contact_name')}</label>
                                    <input
                                        type="text"
                                        required
                                        className="input w-full"
                                        value={formData.guest_name}
                                        onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.email')}</label>
                                        <input
                                            type="email"
                                            className="input w-full"
                                            value={formData.guest_email}
                                            onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.phone')}</label>
                                        <input
                                            type="text"
                                            required
                                            className="input w-full"
                                            value={formData.guest_phone}
                                            onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Stay Details */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary-600" />
                                {t('bulk_bookings.modals.create.stay_details')}
                            </h3>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.check_in')}</label>
                                        <input
                                            type="date"
                                            required
                                            min={new Date().toISOString().split('T')[0]}
                                            className="input w-full"
                                            value={formData.check_in_date}
                                            onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.check_out')}</label>
                                        <input
                                            type="date"
                                            required
                                            min={formData.check_in_date || new Date().toISOString().split('T')[0]}
                                            className="input w-full"
                                            value={formData.check_out_date}
                                            onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.adults')}</label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            className="input w-full"
                                            value={formData.adults}
                                            onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.children')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="input w-full"
                                            value={formData.children}
                                            onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Room Requirements Section */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-primary-600" />
                                {t('bulk_bookings.modals.create.room_requirements')}
                            </h3>
                            <button
                                type="button"
                                onClick={addRoomRow}
                                className="btn btn-secondary btn-sm flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> {t('bulk_bookings.modals.create.add_room')}
                            </button>
                        </div>

                        {formData.rooms.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-500 text-sm">{t('bulk_bookings.modals.create.no_requirements_help')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {formData.rooms.map((room, index) => (
                                    <div key={index} className="flex gap-4 items-end bg-white p-3 rounded-lg border shadow-sm">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('bulk_bookings.modals.create.room_type')}</label>
                                            <select
                                                required
                                                className="input w-full"
                                                value={room.room_type_id}
                                                onChange={(e) => updateRoomRow(index, 'room_type_id', e.target.value)}
                                            >
                                                {roomTypes.map(type => (
                                                    <option key={type.id} value={type.id}>{type.name} (Max {type.max_adults} Pax)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-32">
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('bulk_bookings.modals.create.quantity')}</label>
                                            <input
                                                type="number"
                                                min="1"
                                                required
                                                className="input w-full"
                                                value={room.quantity}
                                                onChange={(e) => updateRoomRow(index, 'quantity', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeRoomRow(index)}
                                            className="btn btn-secondary text-red-600 hover:bg-red-50 border-red-100 p-2 h-[42px]"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Additional Details */}
                    <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.event_details')}</label>
                            <textarea
                                className="input w-full h-20"
                                value={formData.event_details}
                                onChange={(e) => setFormData({ ...formData, event_details: e.target.value })}
                                placeholder="Any event info or specific room numbers request..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('bulk_bookings.modals.create.requirements_optional')}</label>
                            <textarea
                                className="input w-full h-20"
                                value={formData.additional_requirements}
                                onChange={(e) => setFormData({ ...formData, additional_requirements: e.target.value })}
                                placeholder="Extra beds, early check-in notes, etc."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="btn btn-secondary px-8"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary px-12 shadow-lg shadow-primary-200"
                        >
                            {t('bulk_bookings.modals.create.submit')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Group Check-in & Room Assignment Modal */}
            <Modal
                isOpen={showCheckInModal}
                onClose={() => setShowCheckInModal(false)}
                title="Group Check-in & Room Assignment"
                size="4xl"
            >
                {selectedBooking && (
                    <div className="space-y-6">
                        {/* Step Indicators */}
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${checkInStep === 0 ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-green-100 text-green-600'}`}>
                                    {checkInStep > 0 ? <CheckCircle className="w-5 h-5" /> : '1'}
                                </div>
                                <span className={`text-sm font-bold ${checkInStep === 0 ? 'text-primary-700' : 'text-green-700'}`}>Guest Details</span>
                            </div>
                            <div className="w-16 h-px bg-gray-200" />
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${checkInStep === 1 ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-gray-100 text-gray-400'}`}>
                                    2
                                </div>
                                <span className={`text-sm font-bold ${checkInStep === 1 ? 'text-primary-700' : 'text-gray-400'}`}>Assign Rooms</span>
                            </div>
                        </div>

                        {checkInStep === 0 ? (
                            <div className="space-y-6">
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm text-emerald-800 font-medium">
                                            Enter details for <span className="font-bold">{groupGuestDetails.length} guests</span> ({groupGuestDetails.filter(g => !g.is_child).length} Adults, {groupGuestDetails.filter(g => g.is_child).length} Children).
                                        </p>
                                        <p className="text-xs text-emerald-600">Guests will be automatically distributed into rooms upon clicking Next based on room occupancy rules.</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <button onClick={() => setGroupGuestDetails([...groupGuestDetails, { full_name: '', age: '', id_proof_type: 'Aadhar', id_proof_number: '', is_child: false, room_idx: '' }])} className="btn py-1.5 px-3 shadow-sm text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold">+ Add Adult</button>
                                        <button onClick={() => setGroupGuestDetails([...groupGuestDetails, { full_name: '', age: '', id_proof_type: 'Aadhar', id_proof_number: '', is_child: true, room_idx: '' }])} className="btn py-1.5 px-3 shadow-sm text-xs bg-white text-orange-600 border-orange-200 hover:bg-orange-100 font-bold">+ Add Child</button>
                                    </div>
                                </div>

                                <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                                    {groupGuestDetails.map((guest, idx) => (
                                        <div key={idx} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${guest.is_child ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {guest.is_child ? 'Child' : 'Adult'} {idx + 1}
                                                    </span>
                                                    <button onClick={() => { const newD = [...groupGuestDetails]; newD.splice(idx, 1); setGroupGuestDetails(newD); }} className="text-red-500 hover:bg-red-50 rounded p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>

                                                {/* Hidden room assign UI since we auto-assign them */}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Full Name *</label>
                                                    <input
                                                        placeholder="Name"
                                                        className="input text-sm py-1.5 w-full"
                                                        value={guest.full_name}
                                                        onChange={(e) => {
                                                            const d = [...groupGuestDetails];
                                                            d[idx].full_name = e.target.value;
                                                            setGroupGuestDetails(d);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Age</label>
                                                    <input
                                                        placeholder="Age"
                                                        type="number"
                                                        className="input text-sm py-1.5 w-full"
                                                        value={guest.age}
                                                        onChange={(e) => {
                                                            const d = [...groupGuestDetails];
                                                            d[idx].age = e.target.value;
                                                            setGroupGuestDetails(d);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">ID Type *</label>
                                                    <select
                                                        className="input text-sm py-1.5 w-full"
                                                        value={guest.id_proof_type}
                                                        onChange={(e) => {
                                                            const d = [...groupGuestDetails];
                                                            d[idx].id_proof_type = e.target.value;
                                                            setGroupGuestDetails(d);
                                                        }}
                                                    >
                                                        <option>Aadhar</option><option>Passport</option><option>DL</option><option>Voter ID</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">ID Number *</label>
                                                    <input
                                                        placeholder="ID Num"
                                                        className="input text-sm py-1.5 w-full"
                                                        value={guest.id_proof_number}
                                                        onChange={(e) => {
                                                            const d = [...groupGuestDetails];
                                                            d[idx].id_proof_number = e.target.value;
                                                            setGroupGuestDetails(d);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {groupGuestDetails.length === 0 && (
                                        <div className="text-center py-6 bg-gray-50 rounded-xl text-gray-400 italic">No guests added. Click Add Adult/Child above.</div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <button onClick={() => setShowCheckInModal(false)} className="btn btn-secondary px-6">Cancel</button>
                                    <button
                                        onClick={() => {
                                            // Auto-Assign Logic
                                            let totalRoomsRequested = 0;
                                            let roomCapacityList = [];
                                            selectedBooking.child_bookings.forEach(child => {
                                                const rt = roomTypes.find(r => r.id === child.room_type_id);
                                                const maxA = rt ? rt.max_adults : 2;
                                                const maxC = rt ? rt.max_children : 1;
                                                for (let j = 0; j < child.quantity; j++) {
                                                    roomCapacityList.push({ idx: totalRoomsRequested++, maxA, maxC, currA: 0, currC: 0 });
                                                }
                                            });

                                            const newGuests = [...groupGuestDetails];
                                            newGuests.forEach(guest => {
                                                if (guest.is_child) {
                                                    let assigned = roomCapacityList.find(r => r.currC < r.maxC);
                                                    if (!assigned) assigned = roomCapacityList.find(r => r.currA < r.maxA);
                                                    if (assigned) { assigned.currC++; guest.room_idx = assigned.idx; }
                                                    else { guest.room_idx = roomCapacityList[0]?.idx || 0; }
                                                } else {
                                                    let assigned = roomCapacityList.find(r => r.currA < r.maxA);
                                                    if (assigned) { assigned.currA++; guest.room_idx = assigned.idx; }
                                                    else { guest.room_idx = roomCapacityList[0]?.idx || 0; }
                                                }
                                            });
                                            setGroupGuestDetails(newGuests);
                                            setCheckInStep(1);
                                        }}
                                        className="btn btn-primary px-10 flex items-center gap-2 font-bold"
                                    >
                                        Next: Assign Rooms <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-primary-50 p-4 rounded-xl border border-primary-100">
                                    <p className="text-sm text-primary-800 font-medium">
                                        <span className="font-bold">{selectedBooking.company_name || selectedBooking.guest_name}</span> requires <span className="font-bold">{selectedBooking.child_bookings.reduce((acc, b) => acc + parseInt(b.quantity), 0)} rooms</span>. Guests have been auto-distributed.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-6 max-h-[500px] overflow-y-auto pr-2">
                                    {selectedBooking.child_bookings.map((child, i) => {
                                        const startIdx = selectedBooking.child_bookings.slice(0, i).reduce((acc, b) => acc + parseInt(b.quantity), 0);
                                        const endIdx = startIdx + parseInt(child.quantity);

                                        return (
                                            <div key={i} className="bg-white border rounded-lg p-4 shadow-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-semibold text-gray-700">{child.room_type_name}</span>
                                                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded border">{child.booking_ref}</span>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-gray-500 font-bold uppercase tracking-wider">Select {child.quantity} Rooms</span>
                                                        <span className="text-primary-600 font-bold">
                                                            {roomAssignments.slice(startIdx, endIdx).filter(id => id).length} / {child.quantity} Assigned
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                                                        {availableRooms
                                                            .filter(r => r.room_type_id === child.room_type_id)
                                                            .map(room => {
                                                                const isSelectedInThisGroup = roomAssignments.slice(startIdx, endIdx).includes(room.id);
                                                                const isSelectedInOtherGroup = roomAssignments.some((id, idx) => id === room.id && (idx < startIdx || idx >= endIdx));

                                                                return (
                                                                    <button
                                                                        key={room.id}
                                                                        type="button"
                                                                        disabled={isSelectedInOtherGroup}
                                                                        onClick={() => {
                                                                            const newAssign = [...roomAssignments];
                                                                            if (isSelectedInThisGroup) {
                                                                                const idx = newAssign.indexOf(room.id);
                                                                                if (idx >= startIdx && idx < endIdx) newAssign[idx] = '';
                                                                            } else {
                                                                                for (let j = startIdx; j < endIdx; j++) {
                                                                                    if (!newAssign[j]) {
                                                                                        newAssign[j] = room.id;
                                                                                        break;
                                                                                    }
                                                                                }
                                                                            }
                                                                            setRoomAssignments(newAssign);
                                                                        }}
                                                                        className={`p-2 rounded-lg border-2 text-center text-sm transition-all flex flex-col items-center justify-center ${isSelectedInThisGroup
                                                                            ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold shadow-sm scale-105'
                                                                            : isSelectedInOtherGroup
                                                                                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed hidden'
                                                                                : 'border-gray-200 hover:border-primary-300 text-gray-600'
                                                                            }`}
                                                                    >
                                                                        <span className="text-xs font-black">{room.room_number}</span>
                                                                        <span className="text-[10px] font-medium opacity-60">{room.floor}F</span>
                                                                    </button>
                                                                );
                                                            })}
                                                    </div>

                                                    {/* Show Auto-assigned Guests for this group of rooms */}
                                                    <div className="mt-4 pt-3 border-t bg-gray-50 p-2 rounded">
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Auto-Assigned Guests Details</p>
                                                        <div className="flex justify-between items-start gap-4">
                                                            {Array.from({ length: child.quantity }).map((_, roomOffset) => {
                                                                const globalRoomIdx = startIdx + roomOffset;
                                                                const guestsInRoom = groupGuestDetails.filter(g => g.room_idx === globalRoomIdx);
                                                                const assignedRoomId = roomAssignments[globalRoomIdx];
                                                                const realRoom = availableRooms.find(r => r.id === assignedRoomId);

                                                                return (
                                                                    <div key={roomOffset} className="flex-1 bg-white border border-gray-200 rounded p-2">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className="text-xs font-bold text-gray-700">Room {realRoom ? realRoom.room_number : `?`}</span>
                                                                        </div>
                                                                        {guestsInRoom.length > 0 ? (
                                                                            <ul className="text-[10px] space-y-1">
                                                                                {guestsInRoom.map((g, gIdx) => (
                                                                                    <li key={gIdx} className="flex justify-between text-gray-600">
                                                                                        <span className="font-semibold truncate w-24">{g.full_name || 'Unnamed'}</span>
                                                                                        <span>{g.is_child ? 'C' : 'A'}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        ) : (
                                                                            <span className="text-[10px] text-gray-400 italic">Empty</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {availableRooms.filter(r => r.room_type_id === child.room_type_id).length === 0 && (
                                                        <div className="text-center py-4 bg-orange-50 border border-orange-100 rounded-lg">
                                                            <p className="text-xs text-orange-700 font-medium">No available rooms found for this type.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex justify-between gap-3 pt-6 border-t font-bold">
                                    <button onClick={() => setCheckInStep(0)} className="btn btn-secondary flex items-center gap-2 px-6">
                                        <ChevronLeft className="w-4 h-4" /> Back to Guests
                                    </button>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowCheckInModal(false)} className="btn btn-secondary px-6">Cancel</button>
                                        <button
                                            onClick={handleGroupCheckIn}
                                            disabled={roomAssignments.some(id => !id)}
                                            className="btn bg-emerald-600 hover:bg-emerald-700 text-white px-10 shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <CheckCircle className="w-5 h-5" /> Complete Group Check-in
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Billing Management Modal */}
            <Modal
                isOpen={showBillingModal}
                onClose={() => setShowBillingModal(false)}
                title="Manage Group Billing & Checkout"
                size="3xl"
            >
                {selectedBooking && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Corporate GST Number</label>
                                    <input
                                        type="text"
                                        className="input w-full"
                                        value={billingData.corporate_gst}
                                        onChange={(e) => setBillingData({ ...billingData, corporate_gst: e.target.value })}
                                        placeholder="e.g. 27AAACR1234A1Z1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Apply Promotion / Discount Code</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input flex-1"
                                            value={billingData.applied_promotion}
                                            onChange={(e) => setBillingData({ ...billingData, applied_promotion: e.target.value })}
                                            placeholder="Code"
                                        />
                                        <button onClick={handleApplyCoupon} type="button" className="btn btn-secondary py-1.5 px-3 flex items-center gap-1">
                                            <Tag className="w-4 h-4" /> Apply
                                        </button>
                                        <input
                                            type="number"
                                            className="input w-24"
                                            value={billingData.promo_discount}
                                            onChange={(e) => setBillingData({ ...billingData, promo_discount: parseFloat(e.target.value) || 0 })}
                                            placeholder="Amt"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <h4 className="font-semibold text-gray-800 text-sm mb-3 border-b pb-2">Extra Charges</h4>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto mb-3">
                                    {(billingData.extra_charges || []).map((charge, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                                            <span>{charge.description}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">{formatCurrency(charge.amount)}</span>
                                                <button
                                                    onClick={() => {
                                                        const newExtras = [...billingData.extra_charges];
                                                        newExtras.splice(idx, 1);
                                                        setBillingData({ ...billingData, extra_charges: newExtras });
                                                    }}
                                                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                >
                                                    <Plus className="w-4 h-4 rotate-45" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input id="extra-desc" type="text" className="input flex-1 py-1 text-sm" placeholder="Description" />
                                    <input id="extra-amt" type="number" className="input w-20 py-1 text-sm" placeholder="Amt" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const desc = document.getElementById('extra-desc').value;
                                            const amt = parseFloat(document.getElementById('extra-amt').value);
                                            if (desc && amt) {
                                                setBillingData({
                                                    ...billingData,
                                                    extra_charges: [...(billingData.extra_charges || []), { description: desc, amount: amt }]
                                                });
                                                document.getElementById('extra-desc').value = '';
                                                document.getElementById('extra-amt').value = '';
                                            }
                                        }}
                                        className="btn btn-primary py-1 px-3 text-sm"
                                    > Add </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                            <button onClick={handlePreviewBill} className="btn bg-indigo-600 text-white hover:bg-indigo-700 px-8 flex items-center gap-2 font-bold shadow-lg shadow-indigo-100">
                                <FileText className="w-4 h-4" /> Preview Bill & Checkout
                            </button>
                            <button onClick={() => setShowBillingModal(false)} className="btn btn-secondary px-6">Cancel</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Combined Invoice Modal */}
            <Modal
                isOpen={showInvoiceModal}
                onClose={() => setShowInvoiceModal(false)}
                title={t('bulk_bookings.modals.invoice.title')}
                size="4xl"
            >
                {invoiceData && (
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2" id="bulk-invoice-content" style={{ textAlign: 'left' }}>
                        {/* Invoice Status Ribbon / Shadow Icon */}
                        <div className={`border-2 p-8 bg-white rounded-2xl shadow-sm relative overflow-hidden ${invoiceData.payment_status === 'PAID' ? 'border-green-500 bg-green-50/10' : 'border-gray-100'}`}>

                            {invoiceData.payment_status === 'PAID' && (
                                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                    <CheckCircle className="w-32 h-32 text-green-600 rotate-12" />
                                </div>
                            )}

                            {/* Header: Hotel Info & Invoice Details */}
                            <div className="flex flex-col md:flex-row justify-between border-b border-dashed pb-8 mb-8 gap-6">
                                <div className="space-y-3">
                                    {invoiceData.hotel_settings?.logo_url ? (
                                        <img src={invoiceData.hotel_settings.logo_url} alt="Hotel Logo" className="h-16 object-contain" />
                                    ) : (
                                        <div className="h-16 w-16 bg-primary-50 rounded-xl flex items-center justify-center">
                                            <Building2 className="w-8 h-8 text-primary-600" />
                                        </div>
                                    )}
                                    <div>
                                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{invoiceData.hotel_name}</h1>
                                        <div className="text-sm text-gray-500 space-y-1">
                                            {invoiceData.hotel_settings?.address && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {invoiceData.hotel_settings.address}</p>}
                                            <div className="flex gap-4">
                                                {invoiceData.hotel_settings?.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {invoiceData.hotel_settings.phone}</p>}
                                                {invoiceData.hotel_settings?.email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {invoiceData.hotel_settings.email}</p>}
                                            </div>
                                            {invoiceData.hotel_gst && <p className="inline-block bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">GST: {invoiceData.hotel_gst}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-left md:text-right space-y-2">
                                    <h2 className="text-3xl font-black text-primary-600 uppercase tracking-tighter">{t('bulk_bookings.modals.invoice.header')}</h2>
                                    <div className="inline-block bg-primary-50 px-3 py-1 rounded-lg border border-primary-100">
                                        <p className="text-xs text-primary-600 font-bold uppercase tracking-widest">{invoiceData.invoice_number ? t('bookings.billing.invoice') : t('bookings.table.pnr')}</p>
                                        <p className="text-lg font-mono font-black text-primary-900 uppercase">
                                            {invoiceData.invoice_number || `#BB-${selectedBooking?.id?.substring(0, 8).toUpperCase()}`}
                                        </p>
                                    </div>
                                    <div className="text-sm text-gray-500 pt-2 font-medium">
                                        {t('bookings.billing.date')}: {new Date().toLocaleDateString()}
                                    </div>

                                    <div className="mt-2 text-right">
                                        {invoiceData.payment_status === 'PAID' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 text-xs font-black rounded-full uppercase tracking-wider">
                                                <CheckCircle className="w-3.5 h-3.5" /> {t('bookings.modals.check_out.paid')} {invoiceData.payment_method && `${t('bookings.modals.check_out.via')} ${invoiceData.payment_method}`}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full uppercase tracking-wider">
                                                <XCircle className="w-3.5 h-3.5" /> {t('bookings.modals.check_out.not_paid')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Client & Stay Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 text-left">
                                <div className="space-y-4 border-r border-gray-200/50 pr-8">
                                    <div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">{t('bulk_bookings.modals.invoice.bill_to')}</h3>
                                        <div className="space-y-1">
                                            {invoiceData.company_name && <p className="font-black text-lg text-gray-900 leading-none">{invoiceData.company_name}</p>}
                                            <p className="text-gray-700 font-bold flex items-center gap-2">{invoiceData.guest_name}</p>
                                            <p className="text-gray-500 text-sm flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {invoiceData.guest_phone}</p>
                                            {invoiceData.guest_email && <p className="text-gray-500 text-sm flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {invoiceData.guest_email}</p>}
                                            {invoiceData.corporateGst && <p className="text-[10px] text-gray-400 font-bold uppercase pt-1">Client GST: {invoiceData.corporateGst}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pl-4 md:pl-0">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{t('bulk_bookings.modals.invoice.stay_period')}</h3>
                                            <p className="text-sm font-black text-gray-900">{new Date(invoiceData.check_in_date).toLocaleDateString()} — {new Date(invoiceData.check_out_date).toLocaleDateString()}</p>
                                            <p className="text-xs text-gray-500 font-bold">({t('bulk_bookings.modals.invoice.nights', { count: invoiceData.nights })})</p>
                                        </div>
                                        <div>
                                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{t('bookings.billing.occupancy')}</h3>
                                            <p className="text-sm font-black text-gray-900">{invoiceData.adults} {t('bookings.modals.timeline.adult_plural')}</p>
                                            <p className="text-xs text-gray-500 font-bold">{invoiceData.children} {t('bookings.modals.timeline.child_plural')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items Table */}
                            <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 text-left">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-900 text-white">
                                            <th className="py-4 px-4 text-left font-black uppercase tracking-widest text-[10px]">{t('bulk_bookings.modals.invoice.table.ref')}</th>
                                            <th className="py-4 px-4 text-left font-black uppercase tracking-widest text-[10px]">{t('bulk_bookings.modals.invoice.table.room_type')}</th>
                                            <th className="py-4 px-4 text-center font-black uppercase tracking-widest text-[10px]">{t('bulk_bookings.modals.invoice.table.rooms')}</th>
                                            <th className="py-4 px-4 text-right font-black uppercase tracking-widest text-[10px]">{t('bulk_bookings.modals.invoice.table.rate')}</th>
                                            <th className="py-4 px-4 text-right font-black uppercase tracking-widest text-[10px]">{t('bulk_bookings.modals.invoice.table.amount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {invoiceData.lineItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-4 px-4 font-mono font-bold text-primary-600">{item.booking_ref}</td>
                                                <td className="py-4 px-4 text-gray-800 font-bold">{item.room_type_name}</td>
                                                <td className="py-4 px-4 text-center text-gray-700 font-bold">{item.quantity}</td>
                                                <td className="py-4 px-4 text-right text-gray-500 font-medium">{formatCurrency(item.base_price)}</td>
                                                <td className="py-4 px-4 text-right text-gray-900 font-black">{formatCurrency(item.line_total)}</td>
                                            </tr>
                                        ))}

                                        {/* Extra Charges Section */}
                                        {invoiceData.extraCharges && invoiceData.extraCharges.length > 0 && (
                                            <>
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan="5" className="py-2 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('bulk_bookings.modals.invoice.extra_charges')}</td>
                                                </tr>
                                                {invoiceData.extraCharges.map((charge, idx) => (
                                                    <tr key={`extra-${idx}`} className="text-gray-700 border-t border-gray-100 italic font-medium">
                                                        <td colSpan="4" className="py-3 px-8 text-sm">{charge.description}</td>
                                                        <td className="py-3 px-4 text-right font-black">{formatCurrency(charge.amount)}</td>
                                                    </tr>
                                                ))}
                                            </>
                                        )}

                                        {/* Discounts Section */}
                                        {invoiceData.promoDiscount > 0 && (
                                            <tr className="bg-green-50/30 text-green-700 font-bold border-t border-green-100">
                                                <td colSpan="4" className="py-3 px-4 text-right text-xs uppercase tracking-wider">{t('bulk_bookings.modals.invoice.promo_discount')} {invoiceData.appliedPromotion && `(${invoiceData.appliedPromotion})`}</td>
                                                <td className="py-3 px-4 text-right">-{formatCurrency(invoiceData.promoDiscount)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals Section */}
                            <div className="flex justify-end mb-8">
                                <div className="w-full md:w-80 space-y-3">
                                    <div className="flex justify-between text-sm text-gray-500 font-bold">
                                        <span>{t('bulk_bookings.modals.invoice.subtotal')}</span>
                                        <span>{formatCurrency(invoiceData.totalRoomCharge + invoiceData.extraTotal)}</span>
                                    </div>

                                    {invoiceData.taxBreakdown.map((tax, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-gray-400 italic">
                                            <span>↳ {tax.name} ({tax.rate}%) {tax.is_inclusive ? '(Incl.)' : ''}</span>
                                            <span>{tax.is_inclusive ? '' : '+'}{formatCurrency(tax.amount)}</span>
                                        </div>
                                    ))}

                                    <div className="border-t-2 border-gray-900 pt-4 mt-4 flex justify-between items-baseline">
                                        <span className="text-sm font-black text-gray-900 uppercase tracking-widest">{t('bulk_bookings.modals.invoice.total')}</span>
                                        <span className="text-3xl font-black text-primary-600 tracking-tighter">{formatCurrency(invoiceData.finalTotal)}</span>
                                    </div>

                                    <div className="pt-2">
                                        <div className="flex justify-between text-xs text-green-600 font-bold py-1 bg-green-50/50 px-2 rounded">
                                            <span>{t('bulk_bookings.modals.invoice.advance_paid')}</span>
                                            <span>{formatCurrency(invoiceData.paid_amount)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-black text-gray-900 border-t border-gray-100 pt-2 mt-1 px-2">
                                            <span>{t('bulk_bookings.modals.invoice.balance')}</span>
                                            <span className={invoiceData.finalTotal - invoiceData.paid_amount > 0 ? "text-red-700" : "text-green-700 font-black"}>
                                                {formatCurrency(Math.max(0, invoiceData.finalTotal - invoiceData.paid_amount))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center pt-8 border-t border-dashed border-gray-200">
                                <p className="text-sm text-gray-400 italic font-medium">{t('bulk_bookings.modals.invoice.footer')}</p>
                            </div>
                        </div>

                        {/* Payment Settlement for Bulk (Mirroring Booking Flow) */}
                        {invoiceData.payment_status !== 'PAID' && selectedBooking?.status === 'CHECKED_OUT' && (
                            <div className="bg-primary-50 p-8 rounded-3xl border border-primary-100 shadow-inner mt-8 no-print text-left">
                                <h4 className="text-primary-900 font-black text-xl mb-4 flex items-center gap-3">
                                    <DollarSign className="w-6 h-6 p-1 bg-primary-600 text-white rounded-lg" /> {t('bookings.modals.check_out.settle_title')}
                                </h4>
                                <p className="text-sm text-primary-700/80 font-bold mb-6">{t('bookings.modals.check_out.settle_description')}</p>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    {['CASH', 'UPI', 'CC', 'DC'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`px-4 py-4 rounded-2xl border-4 text-xs font-black transition-all transform active:scale-95 ${paymentMethod === method
                                                ? 'bg-primary-600 border-primary-600 text-white shadow-xl translate-y-[-2px]'
                                                : 'bg-white border-primary-100 text-primary-600 hover:border-primary-300 hover:bg-primary-50 hover:shadow-md'
                                                }`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>

                                {/* QR / Bank Context */}
                                {(paymentMethod === 'UPI' || paymentMethod === 'CC' || paymentMethod === 'DC') && (
                                    <div className="bg-white p-6 rounded-2xl border border-primary-100 mb-8 flex flex-col md:flex-row gap-8 items-center animate-in fade-in slide-in-from-bottom-2">
                                        {paymentMethod === 'UPI' && (invoiceData.hotel_settings?.upi_id) && (
                                            <div className="flex-shrink-0 bg-gray-50 p-3 rounded-2xl border-2 border-dashed border-primary-200">
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${invoiceData.hotel_settings.upi_id}&pn=${invoiceData.hotel_name}&am=${invoiceData.finalTotal - invoiceData.paid_amount}&cu=INR`)}`}
                                                    alt="Payment QR"
                                                    className="w-32 h-32"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-left">
                                            {paymentMethod === 'UPI' && (
                                                <div>
                                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Payable UPI ID</p>
                                                    <p className="text-lg font-mono font-black text-primary-900">{invoiceData.hotel_settings?.upi_id || 'Not Configured'}</p>
                                                </div>
                                            )}
                                            {invoiceData.hotel_settings?.bank_name && (
                                                <>
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Bank Name</p>
                                                        <p className="text-sm font-black text-gray-800">{invoiceData.hotel_settings.bank_name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Account Number</p>
                                                        <p className="text-sm font-mono font-black text-gray-800 tracking-tighter">{invoiceData.hotel_settings.account_number}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">IFSC Code</p>
                                                        <p className="text-sm font-mono font-black text-gray-800">{invoiceData.hotel_settings.ifsc_code}</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleSettlePayment}
                                    disabled={isSettling}
                                    className="w-full btn bg-primary-600 text-white hover:bg-primary-700 hover:shadow-2xl flex items-center justify-center gap-3 py-4 text-lg font-black rounded-2xl transition-all disabled:opacity-50"
                                >
                                    {isSettling ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle className="w-6 h-6" />}
                                    {t('bookings.modals.check_out.settle_button', { amount: formatCurrency(invoiceData.finalTotal - invoiceData.paid_amount) })}
                                </button>
                            </div>
                        )}

                        {/* Print/Close Actions */}
                        <div className="flex justify-center pt-8 border-t print:hidden space-x-4 sticky bottom-0 bg-white/80 backdrop-blur-md pb-4">
                            {selectedBooking?.status === 'CHECKED_IN' && (
                                <button
                                    onClick={handleCheckOutSubmit}
                                    className="btn bg-purple-600 text-white hover:bg-purple-700 px-10 flex items-center gap-2 py-3 rounded-xl font-black shadow-lg"
                                >
                                    <CheckCircle className="w-5 h-5" /> {t('bookings.modals.check_out.finalize')}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    const printContent = document.getElementById('bulk-invoice-content').innerHTML;
                                    const originalContent = document.body.innerHTML;
                                    document.body.innerHTML = printContent;
                                    window.print();
                                    document.body.innerHTML = originalContent;
                                    window.location.reload();
                                }}
                                className="btn bg-gray-900 text-white hover:bg-black px-10 flex items-center gap-2 py-3 rounded-xl font-black shadow-lg"
                            >
                                <Printer className="w-5 h-5" /> {t('bulk_bookings.modals.invoice.print')}
                            </button>
                            <button
                                onClick={() => setShowInvoiceModal(false)}
                                className="btn bg-gray-100 text-gray-600 hover:bg-gray-200 px-10 py-3 rounded-xl font-black"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* View Detail Modal */}
            <Modal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title={t('bulk_bookings.modals.details.title')}
                size="3xl"
            >
                {selectedBooking && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-8 text-left">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('bulk_bookings.modals.details.contact_info')}</h3>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                                        <Building2 className="w-5 h-5 text-primary-600 mt-1" />
                                        <div>
                                            <p className="font-bold text-gray-900">{selectedBooking.company_name || 'Individual Group'}</p>
                                            <p className="text-sm text-gray-600">{selectedBooking.guest_name}</p>
                                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1 font-medium"><Phone className="w-3.5 h-3.5" />{selectedBooking.guest_phone}</p>
                                            <p className="text-sm text-gray-600 flex items-center gap-1 font-medium"><Mail className="w-3.5 h-3.5" />{selectedBooking.guest_email}</p>
                                            {selectedBooking.corporate_gst && (
                                                <p className="text-primary-600 font-semibold mt-2 text-sm border-t pt-2">GST: {selectedBooking.corporate_gst}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {selectedBooking.event_details && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Event Details</h3>
                                        <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 text-sm text-gray-700">
                                            {selectedBooking.event_details}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('bulk_bookings.modals.details.stay_info')}</h3>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{t('bulk_bookings.modals.details.stay_info')}</p>
                                                <div className="flex items-center gap-2 text-gray-900 font-bold">
                                                    <Calendar className="w-4 h-4 text-primary-500" />
                                                    {new Date(selectedBooking.check_in_date).toLocaleDateString()} - {new Date(selectedBooking.check_out_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-6 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-gray-400" />
                                                <span className="font-semibold">{selectedBooking.adults}</span> Adults
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-gray-400" />
                                                <span className="font-semibold">{selectedBooking.children}</span> Children
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {selectedBooking.additional_requirements && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Requirements</h3>
                                        <p className="text-sm text-gray-600 italic">"{selectedBooking.additional_requirements}"</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('bulk_bookings.modals.details.room_breakdown')}</h3>
                            <div className="border rounded-xl overflow-hidden mt-6 text-left">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="text-left py-3 px-4 text-gray-600 font-bold">{t('bulk_bookings.modals.details.table.room_type')} & Ref</th>
                                            <th className="text-left py-3 px-4 text-gray-600 font-bold">Assigned Rooms</th>
                                            <th className="text-left py-3 px-4 text-gray-600 font-bold">Guests Info</th>
                                            <th className="text-right py-3 px-4 text-gray-600 font-bold">{t('bulk_bookings.modals.details.table.status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {(selectedBooking.child_bookings || []).map((child, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 align-top">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-gray-900">{child.room_type_name}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">{child.quantity} Rooms Requested</div>
                                                    <div className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded inline-block mt-1 uppercase border border-indigo-100">{child.booking_ref}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {child.rooms && child.rooms.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {child.rooms.map((rm, i) => (
                                                                <span key={i} className="bg-gray-100 border text-xs font-bold px-1.5 py-0.5 rounded">{rm.room_number}</span>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-gray-400 text-xs italic">Unassigned</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {child.guests && child.guests.length > 0 ? (
                                                        <ul className="text-[11px] space-y-1">
                                                            {child.guests.map((g, i) => (
                                                                <li key={i} className="flex flex-col border-b border-gray-100 pb-1 last:border-0">
                                                                    <span className="font-bold text-gray-800">{g.full_name} <span className="text-gray-400 font-normal">({g.age} yrs {g.is_child ? 'Child' : 'Adult'})</span></span>
                                                                    <span className="text-gray-500">{g.id_proof_type}: {g.id_proof_number}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : <span className="text-gray-400 text-xs italic">No guests added</span>}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${child.status === 'CREATED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        child.status === 'CONFIRMED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                            child.status === 'CHECKED_IN' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                child.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                    child.status === 'CHECKED_OUT' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                                        'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                        {child.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleViewInvoice(selectedBooking)}
                                    className="btn btn-secondary flex items-center"
                                >
                                    <Printer className="w-4 h-4 mr-2" />
                                    {t('bulk_bookings.modals.details.view_invoice')}
                                </button>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="btn btn-primary px-8">
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
