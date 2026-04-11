'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, use, Suspense } from 'react';
import { HOTEL_ID } from '@/config';
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';

function BookingForm({ params }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // React 19 unwraps params via use()
    const resolvedParams = use(params);
    const roomId = resolvedParams.id;

    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults') || 2;

    const [form, setForm] = useState({
        guest_name: '',
        guest_email: '',
        guest_phone: ''
    });

    const [isMounted, setIsMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
            const res = await fetch(`${backendUrl}/api/public/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hotel_id: HOTEL_ID,
                    room_type_id: roomId,
                    check_in_date: checkIn,
                    check_out_date: checkOut,
                    adults: parseInt(adults),
                    children: 0,
                    room_count: 1,
                    ...form
                })
            });

            const json = await res.json();

            if (json.success) {
                router.push(`/confirmation/${json.booking.booking_ref}`);
            } else {
                setError(json.message || 'Failed to complete booking. Please try again.');
            }
        } catch (err) {
            setError('A network error occurred while booking. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                <Link href={`/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`} className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium">
                    <ArrowLeft className="w-5 h-5 mr-1" />
                    Back to Rooms
                </Link>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
                    {/* Booking Summary Panel */}
                    <div className="bg-blue-900 text-white p-8 md:w-1/3 flex flex-col justify-between">
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Booking Details</h2>
                            <div className="space-y-4 text-blue-100">
                                <div>
                                    <div className="text-xs uppercase tracking-wider text-blue-300 font-semibold mb-1">Check In</div>
                                    <div className="text-lg font-medium text-white">{checkIn}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wider text-blue-300 font-semibold mb-1">Check Out</div>
                                    <div className="text-lg font-medium text-white">{checkOut}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wider text-blue-300 font-semibold mb-1">Guests</div>
                                    <div className="text-lg font-medium text-white">{adults} Adults</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 bg-blue-800/50 p-4 rounded-xl border border-blue-700">
                            <div className="flex items-center gap-2 text-sm text-blue-200 mb-2">
                                <ShieldCheck className="w-4 h-4" /> Secure SSL Booking
                            </div>
                            <p className="text-xs text-blue-300">Your payment and personal details are encrypted and securely transacted.</p>
                        </div>
                    </div>

                    {/* Guest Form Panel */}
                    <div className="p-8 md:w-2/3">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Guest Information</h2>
                        <p className="text-gray-500 mb-8">Please enter your details to lock in your reservation.</p>

                        {error && (
                            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                                    placeholder="John Doe"
                                    value={form.guest_name}
                                    onChange={e => setForm({ ...form, guest_name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="email"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                                        placeholder="john@example.com"
                                        value={form.guest_email}
                                        onChange={e => setForm({ ...form, guest_email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="tel"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                                        placeholder="+1 (555) 000-0000"
                                        value={form.guest_phone}
                                        onChange={e => setForm({ ...form, guest_phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Fake Payment Disclaimer for MVP */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-start gap-4 mt-8">
                                <div className="bg-white p-2 rounded shadow-sm">
                                    <CreditCard className="w-6 h-6 text-gray-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">Pay at Hotel</h4>
                                    <p className="text-sm text-gray-600 mt-1">No credit card required right now. You will be asked to pay upon arrival.</p>
                                </div>
                            </div>

                            <button
                                disabled={loading}
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-8"
                            >
                                {loading ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        Confirm Booking <CheckCircle2 className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BookPage({ params }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>}>
            <BookingForm params={params} />
        </Suspense>
    );
}
