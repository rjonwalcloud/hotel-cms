'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { CheckCircle, Calendar, Hash, User, Loader2 } from 'lucide-react';

export default function ConfirmationPage({ params }) {
    const resolvedParams = use(params);
    const bookingRef = resolvedParams.id;

    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchBooking = async () => {
            try {
                const res = await fetch(`/api/public/bookings/${bookingRef}`);
                const json = await res.json();

                if (json.success) {
                    setBooking(json.booking);
                } else {
                    setError('Could not find booking details.');
                }
            } catch (err) {
                setError('Network error.');
            } finally {
                setLoading(false);
            }
        };

        if (bookingRef) fetchBooking();
    }, [bookingRef]);

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
    );

    if (error || !booking) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="bg-red-50 text-red-700 p-8 rounded-xl max-w-md text-center">
                <h2 className="text-xl font-bold mb-2">Booking Not Found</h2>
                <p>We couldn&apos;t verify this booking reference. Please check your email.</p>
                <Link href="/" className="mt-6 inline-block bg-white text-red-700 border border-red-200 px-6 py-2 rounded-lg font-medium">Return Home</Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-24 px-4">
            <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

                {/* Header */}
                <div className="bg-green-500 p-10 text-center text-white relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <CheckCircle className="w-20 h-20 mx-auto mb-4 relative z-10" />
                    <h1 className="text-3xl font-extrabold relative z-10 mb-2">Booking Confirmed!</h1>
                    <p className="text-green-100 relative z-10 font-medium">Your perfect stay is securely locked in.</p>
                </div>

                {/* Receipt */}
                <div className="p-8">
                    <div className="flex justify-between items-center bg-gray-50 p-4 border border-gray-200 rounded-xl mb-8 border-dashed">
                        <div className="text-gray-500 font-medium flex items-center gap-2">
                            <Hash className="w-4 h-4" /> Reference
                        </div>
                        <div className="font-mono text-xl font-bold text-gray-900 tracking-wider bg-white px-3 py-1 rounded shadow-sm">
                            {booking.booking_ref}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Stay Dates</h3>
                                <p className="text-gray-900 font-medium">{new Date(booking.check_in_date).toLocaleDateString()} — {new Date(booking.check_out_date).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Guest details</h3>
                                <p className="text-gray-900 font-medium">{booking.guest_name}</p>
                                <p className="text-gray-500 text-sm mt-0.5">{booking.guest_email}</p>
                            </div>
                        </div>
                    </div>

                    <hr className="my-8 border-gray-100" />

                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Amount</h3>
                            <p className="text-gray-500 text-sm">To be paid at property</p>
                        </div>
                        <div className="text-3xl font-extrabold text-gray-900">
                            ${parseFloat(booking.total_amount).toFixed(2)}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => window.print()} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 rounded-xl transition-colors">
                            Print
                        </button>
                        <Link href="/manage-booking" className="w-2/3 flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-center transition-all shadow-md">
                            Manage Booking
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
