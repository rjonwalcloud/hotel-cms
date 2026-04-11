'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, XCircle, ArrowLeft, Loader2, Clock, CheckCircle2 } from 'lucide-react';

export default function ManageBookingPage() {
    const [form, setForm] = useState({ ref: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [booking, setBooking] = useState(null);
    const [error, setError] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setBooking(null);

        try {
            // 1. Fetch booking by ref
            const res = await fetch(`/api/public/bookings/${form.ref.toUpperCase()}`);
            const json = await res.json();

            if (json.success) {
                // 2. Validate email on frontend for MVP (Backend also validates on cancel)
                if (json.booking.guest_email.toLowerCase() !== form.email.toLowerCase()) {
                    setError('We found the booking, but the email address does not match our records.');
                    return;
                }
                setBooking(json.booking);
            } else {
                setError('Booking not found. Please verify your reference number.');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;

        setCancelLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/public/bookings/${booking.booking_ref}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guest_email: form.email })
            });
            const json = await res.json();

            if (json.success) {
                setBooking({ ...booking, status: 'CANCELLED' });
            } else {
                setError(json.message || 'Failed to cancel booking.');
            }
        } catch (err) {
            setError('Network error during cancellation.');
        } finally {
            setCancelLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-3xl mx-auto pt-16">
                <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-8 font-medium">
                    <ArrowLeft className="w-5 h-5 mr-1" /> Return Home
                </Link>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">

                    <div className="bg-blue-900 px-8 py-10 text-white text-center">
                        <h1 className="text-3xl font-extrabold mb-2">Manage Your Booking</h1>
                        <p className="text-blue-200">View details, print receipt, or cancel your reservation.</p>
                    </div>

                    <div className="p-8">
                        {!booking && (
                            <form onSubmit={handleSearch} className="max-w-md mx-auto space-y-6">
                                {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-4 border border-red-100">{error}</div>}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Booking Reference</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. HTL-X8K9M2"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                        value={form.ref}
                                        onChange={e => setForm({ ...form, ref: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <input
                                        required
                                        type="email"
                                        placeholder="The email used during booking"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>

                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-bold transition-all shadow-md flex justify-center items-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5" /> Find Booking</>}
                                </button>
                            </form>
                        )}

                        {booking && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-1">{booking.room_type_name || 'Hotel Room'}</h2>
                                        <p className="text-gray-500 font-medium">{new Date(booking.check_in_date).toLocaleDateString()} — {new Date(booking.check_out_date).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                        booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {booking.status}
                                    </span>
                                </div>

                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 grid grid-cols-2 gap-6 relative overflow-hidden">
                                    <div className="col-span-2 md:col-span-1">
                                        <p className="text-sm text-gray-500 uppercase font-semibold tracking-wider mb-1">Guest</p>
                                        <p className="font-medium text-gray-900">{booking.guest_name}</p>
                                        <p className="text-gray-500 text-sm mt-0.5">{booking.guest_email}</p>
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <p className="text-sm text-gray-500 uppercase font-semibold tracking-wider mb-1">Total</p>
                                        <p className="font-bold text-2xl text-blue-900">${parseFloat(booking.total_amount).toFixed(2)}</p>
                                    </div>
                                </div>

                                {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium border border-red-100">{error}</div>}

                                {booking.events && booking.events.length > 0 && (
                                    <div className="my-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
                                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-blue-600" /> Booking History Log
                                        </h3>
                                        <div className="space-y-0">
                                            {booking.events.map((event, idx) => (
                                                <div key={idx} className="flex gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${event.event_type === 'CREATED' ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'}`}>
                                                            {event.event_type === 'CREATED' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                        </div>
                                                        {idx !== booking.events.length - 1 && <div className="w-0.5 h-full bg-gray-200 my-1"></div>}
                                                    </div>
                                                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex-1 mb-4 shadow-sm transition-all hover:shadow-md">
                                                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                                                            <span className="font-bold text-gray-900 text-sm">{event.event_type.replace(/_/g, ' ')}</span>
                                                            <span className="text-xs text-gray-500 bg-white border border-gray-100 px-2 py-1 rounded shadow-sm font-medium">
                                                                {new Date(event.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-600 text-sm mt-1">{event.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {booking.status === 'CONFIRMED' && (
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-red-900 flex items-center gap-2">
                                                <XCircle className="w-5 h-5" /> Need to cancel?
                                            </h4>
                                            <p className="text-sm text-red-700 mt-1">If your plans have changed, you can cancel this reservation safely online. Cancellation policies apply.</p>
                                        </div>
                                        <button
                                            onClick={handleCancel}
                                            disabled={cancelLoading}
                                            className="shrink-0 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-3 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2"
                                        >
                                            {cancelLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cancel Booking'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
