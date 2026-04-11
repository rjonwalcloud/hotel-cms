import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { qrcodeAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import { useCurrencyStore } from '../../store/currencyStore';
import {
  ShoppingBag,
  User,
  Phone,
  ChevronRight,
  Check,
  Plus,
  Minus,
  ArrowLeft,
  Building2,
  Clock,
  Info,
  ChevronUp,
  ChevronDown,
  Ticket,
  Loader2,
  Lock,
  ClipboardList
} from 'lucide-react';

export default function RoomServices() {
  const { token } = useParams();
  const { formatCurrency, setCurrency } = useCurrencyStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [guestInfo, setGuestInfo] = useState({ guest_name: '', guest_phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isCheckoutExpanded, setIsCheckoutExpanded] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [activeView, setActiveView] = useState('menu');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    loadRoomServices();
  }, [token]);

  const loadRoomServices = async () => {
    try {
      const result = await qrcodeAPI.scan(token);
      setData(result);

      // Update currency store with hotel-specific settings from the scan result
      if (result.hotel?.currency_code || result.hotel?.currency_symbol) {
        setCurrency(result.hotel.currency_code, result.hotel.currency_symbol);
      }
    } catch (err) {
      setError('This QR code is invalid or no longer active.');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const result = await qrcodeAPI.getGuestOrders(token);
      setOrders(result.orders || []);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSwitchToOrders = () => {
    setActiveView('orders');
    loadOrders();
  };

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      }
      return [...prev, { ...service, quantity: 1 }];
    });
  };

  const updateQuantity = (serviceId, delta) => {
    setSelectedServices(prev =>
      prev.map(s => {
        if (s.id === serviceId) {
          const maxLimit = s.max_quantity !== null && s.max_quantity !== undefined ? s.max_quantity : Infinity;
          const newQty = Math.max(0, Math.min(s.quantity + delta, maxLimit));
          return newQty === 0 ? null : { ...s, quantity: newQty };
        }
        return s;
      }).filter(Boolean)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }
    if (!guestInfo.guest_name || !guestInfo.guest_phone) {
      toast.error('Please provide your name and phone number');
      return;
    }

    setSubmitting(true);
    try {
      await qrcodeAPI.bulkCreateServiceRequests(token, {
        services: selectedServices.map(s => ({
          service_item_id: s.id,
          quantity: s.quantity
        })),
        guest_name: guestInfo.guest_name,
        guest_phone: guestInfo.guest_phone,
        notes: `Request from room ${data?.room?.number}`
      });
      setSubmitted(true);
      toast.success('Your order has been placed!');
    } catch (err) {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = selectedServices.reduce(
    (sum, s) => sum + (parseFloat(s.price) * s.quantity), 0
  );
  const couponDiscount = couponResult?.valid ? couponResult.discount_amount : 0;
  const finalAmount = Math.max(0, totalAmount - couponDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return toast.error('Enter a coupon code');
    if (!data?.hotel?.id) return toast.error('Hotel information not available');
    setValidatingCoupon(true);
    try {
      const res = await qrcodeAPI.validateCouponPublic({
        code: couponCode, hotel_id: data.hotel.id, amount: totalAmount, nights: 1
      });
      setCouponResult({ valid: true, ...res.data });
      toast.success(`Coupon applied! ${res.data.discount_type === 'PERCENTAGE' ? res.data.discount_value + '% off' : formatCurrency(res.data.discount_amount) + ' off'}`);
    } catch (err) {
      setCouponResult({ valid: false, error: err.response?.data?.message || 'Invalid coupon code' });
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    } finally { setValidatingCoupon(false); }
  };

  const handleRemoveCoupon = () => { setCouponCode(''); setCouponResult(null); };

  // Group services by category
  const categories = ['All', ...new Set(data?.services?.map(s => s.category_name || 'Other') || [])];

  const filteredServices = activeCategory === 'All'
    ? data?.services
    : data?.services?.filter(s => (s.category_name || 'Other') === activeCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">Setting up your room menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border border-red-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Info className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Access Denied</h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Room not occupied — show locked screen
  if (data && data.room_occupied === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Toaster position="top-center" />
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full text-center border border-slate-100">
          <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Lock className="w-12 h-12 text-amber-500" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Room Not Occupied</h1>
          <p className="text-slate-500 font-medium mb-2 leading-relaxed">
            Service requests for <span className="font-bold text-slate-900">Room {data?.room?.number}</span> are currently unavailable.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            Services are only available during an active stay. Please check in at the front desk first.
          </p>
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Hotel</p>
            <p className="text-lg font-bold text-slate-900">{data?.hotel?.name}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-primary-600 flex items-center justify-center p-6">
        <Toaster position="top-center" />
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full text-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <Check className="w-12 h-12 text-emerald-500" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Order Placed!</h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            Your request for <span className="text-slate-900 font-bold">Room {data?.room?.number}</span> has been received. Our staff will be there shortly.
          </p>
          <div className="space-y-4">
            <button
              onClick={() => { setSubmitted(false); setSelectedServices([]); }}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all active:scale-95"
            >
              Order More Items
            </button>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <Clock className="w-3 h-3" /> Usually arrives in 15-20 mins
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      <Toaster position="top-center" />

      {/* Hero Header */}
      <div className="bg-slate-900 text-white pt-12 pb-24 px-6 rounded-b-[3rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600 rounded-full translate-x-20 -translate-y-20 blur-[100px] opacity-30" />

        <div className="max-w-xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-xs font-black uppercase tracking-widest mb-6 backdrop-blur-md">
            <Building2 className="w-3 h-3 text-primary-400" />
            {data?.hotel?.name}
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">Room Service</h1>
          <p className="text-slate-400 font-medium">Exclusive menu for Room {data?.room?.number}</p>
          {data?.booking?.booking_ref && (
            <p className="text-xs text-primary-300 font-bold mt-2 uppercase tracking-widest">Booking: {data.booking.booking_ref}</p>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="-mt-12 relative z-20 max-w-xl mx-auto px-6">
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setActiveView('menu')}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg ${activeView === 'menu'
              ? 'bg-primary-600 text-white shadow-primary-200'
              : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
          >
            Menu
          </button>
          <button
            onClick={handleSwitchToOrders}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${activeView === 'orders'
              ? 'bg-primary-600 text-white shadow-primary-200'
              : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
          >
            <ClipboardList className="w-4 h-4" />
            My Orders
          </button>
        </div>
      </div>

      {/* ORDERS VIEW */}
      {activeView === 'orders' && (
        <div className="max-w-xl mx-auto px-6 py-6 space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Your Orders This Stay</h2>
          {ordersLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-slate-400 text-sm font-bold">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
              <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">No orders yet</p>
              <p className="text-slate-300 text-sm mt-1">Place your first order from the Menu tab!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const statusStyle = {
                  PENDING: 'bg-amber-100 text-amber-700',
                  ACCEPTED: 'bg-blue-100 text-blue-700',
                  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
                  COMPLETED: 'bg-emerald-100 text-emerald-700',
                  CANCELLED: 'bg-red-100 text-red-600',
                };
                return (
                  <div key={order.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{order.service_name}</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded uppercase">x{order.quantity}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">{order.category_name}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusStyle[order.status] || 'bg-slate-100 text-slate-500'}`}>
                        {order.status === 'CANCELLED' ? 'REJECTED' : order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                      <span className="text-sm font-black text-slate-900">{formatCurrency(parseFloat(order.service_price) * order.quantity)}</span>
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MENU VIEW */}
      {activeView === 'menu' && (
        <>
          {/* Category Slider */}
          <div className="overflow-x-auto no-scrollbar py-4 px-6 flex gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg ${activeCategory === cat
                  ? 'bg-primary-600 text-white shadow-primary-200 pointer-events-none'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Services Grid */}
          <div className="max-w-xl mx-auto px-6 py-6 space-y-6">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">{activeCategory} Items</h2>

            <div className="space-y-4">
              {filteredServices?.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">No items available in this category.</p>
                </div>
              ) : (
                filteredServices?.map((service) => {
                  const selection = selectedServices.find(s => s.id === service.id);
                  const isSelected = !!selection;

                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service)}
                      className={`group bg-white rounded-3xl p-5 border-2 transition-all cursor-pointer ${isSelected ? 'border-primary-500 bg-primary-50/50 shadow-xl shadow-primary-100' : 'border-slate-100 hover:shadow-xl hover:border-slate-200'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 group-hover:text-primary-600 transition-colors">
                              {service.name}
                            </span>
                            {service.dietary_type && service.dietary_type !== 'ALL' && (
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${service.dietary_type === 'VEG' ? 'border-green-500' : 'border-red-500'}`}>
                                <div className={`w-1 h-1 rounded-full ${service.dietary_type === 'VEG' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              </div>
                            )}
                            {isSelected && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                          </div>
                          <p className="text-sm text-slate-500 font-medium leading-relaxed italic line-clamp-2">
                            {service.description || 'Deliciously prepared Fresh Service'}
                          </p>
                          <div className="pt-2 text-xl font-black text-slate-900">
                            {formatCurrency(service.price)}
                          </div>
                        </div>

                        <div className="ml-4 flex flex-col items-center gap-3">
                          {isSelected ? (
                            <div className="flex flex-col items-center bg-white rounded-2xl p-1.5 shadow-md border border-slate-100 animate-in slide-in-from-right-4 duration-300" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => updateQuantity(service.id, 1)}
                                disabled={service.max_quantity !== null && selection.quantity >= service.max_quantity}
                                className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <span className="py-2 text-lg font-black text-slate-900">{selection.quantity}</span>
                              <button
                                onClick={() => updateQuantity(service.id, -1)}
                                className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center group-hover:border-primary-200 transition-colors">
                              <Check className="w-6 h-6 text-slate-200 group-hover:text-primary-200" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Floating Checkout Sheet */}
          {
            selectedServices.length > 0 && (
              <div className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-500 ease-in-out ${isCheckoutExpanded ? 'h-auto' : 'h-24'}`}>
                <div className="bg-white rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] border-t border-slate-100 max-w-xl mx-auto overflow-hidden">
                  {/* Toggle Header / Summary Bar */}
                  <div
                    onClick={() => setIsCheckoutExpanded(!isCheckoutExpanded)}
                    className="p-6 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 leading-tight">Your Order</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                          {selectedServices.length} {selectedServices.length === 1 ? 'Item' : 'Items'} • {formatCurrency(totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isCheckoutExpanded && (
                        <span className="hidden sm:block text-xs font-black text-primary-600 uppercase tracking-widest">Complete Order</span>
                      )}
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        {isCheckoutExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Form Section */}
                  <div className={`px-8 pb-8 space-y-6 transition-all duration-500 ${isCheckoutExpanded ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0'}`}>
                    <div className="h-px bg-slate-100 w-full" />

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                          <input
                            required
                            placeholder="Ordering For (Name)"
                            value={guestInfo.guest_name}
                            onChange={(e) => setGuestInfo({ ...guestInfo, guest_name: e.target.value })}
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all placeholder:text-slate-400"
                          />
                        </div>
                        <div className="relative group">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                          <input
                            required
                            type="tel"
                            placeholder="Mobile Number"
                            value={guestInfo.guest_phone}
                            onChange={(e) => setGuestInfo({ ...guestInfo, guest_phone: e.target.value })}
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Coupon Code */}
                      <div className="bg-emerald-50/60 border-2 border-emerald-100 rounded-2xl p-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-2">
                          <Ticket className="w-3.5 h-3.5" /> Have a Coupon?
                        </h4>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter code"
                            value={couponCode}
                            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                            disabled={!!couponResult?.valid}
                            className="flex-1 pl-4 pr-4 py-3 bg-white border-2 border-emerald-100 rounded-xl text-sm font-mono font-bold uppercase tracking-wider focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-300"
                          />
                          {!couponResult?.valid ? (
                            <button type="button" onClick={handleApplyCoupon} disabled={validatingCoupon}
                              className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">
                              {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                            </button>
                          ) : (
                            <button type="button" onClick={handleRemoveCoupon}
                              className="px-5 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all active:scale-95">
                              Remove
                            </button>
                          )}
                        </div>
                        {couponResult?.valid && (
                          <p className="text-xs text-emerald-700 font-bold mt-2">
                            ✅ {couponResult.discount_type === 'PERCENTAGE' ? couponResult.discount_value + '% off' : formatCurrency(couponResult.discount_amount) + ' off'} applied!
                          </p>
                        )}
                        {couponResult && !couponResult.valid && couponResult.error && (
                          <p className="text-xs text-red-500 font-medium mt-2">❌ {couponResult.error}</p>
                        )}
                      </div>

                      {/* Order Total with discount */}
                      {couponDiscount > 0 && (
                        <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="text-slate-500">{formatCurrency(totalAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-emerald-600 font-bold">Coupon Discount</span>
                            <span className="text-emerald-600 font-bold">-{formatCurrency(couponDiscount)}</span>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-5 font-black text-lg transition-all shadow-2xl flex items-center justify-between group active:scale-[0.98] disabled:opacity-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <Check className="w-6 h-6 text-white group-hover:scale-110 transition-transform" strokeWidth={3} />
                          </div>
                          Place My Order
                        </div>
                        <div className="text-2xl tracking-tighter">{formatCurrency(finalAmount)}</div>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )
          }
        </>)}
    </div>
  );
}
