'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { HOTEL_ID } from '@/config';
import { Users, Info, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

function RoomResults() {
    const searchParams = useSearchParams();
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults') || 2;

    const [isMounted, setIsMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        if (!checkIn || !checkOut) {
            setError('Please provide valid check-in and check-out dates.');
            setLoading(false);
            return;
        }

        const fetchAvailability = async () => {
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
                const res = await fetch(`${backendUrl}/api/public/availability?hotel_id=${HOTEL_ID}&check_in=${checkIn}&check_out=${checkOut}&adults=${adults}&rooms=1`);
                const json = await res.json();

                if (json.success) {
                    setData(json);
                } else {
                    setError(json.message || 'Failed to fetch availability.');
                }
            } catch (err) {
                setError('Network error contacting server.');
            } finally {
                setLoading(false);
            }
        };

        fetchAvailability();
    }, [checkIn, checkOut, adults, isMounted]);

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-500 font-medium">Checking inventory...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <div className="bg-blue-900 text-white py-8 px-6 shadow-md relative z-10">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        Modify Search
                    </Link>
                    <div className="text-right">
                        <div className="font-semibold text-lg">{checkIn} to {checkOut}</div>
                        <div className="text-sm text-blue-200">{adults} Guests</div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 mt-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Available Rooms</h2>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 min-h-[400px]">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                        <p className="text-lg">Searching best rates and availability...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg max-w-2xl text-red-700">
                        <p className="font-medium text-lg mb-1">Oops, something went wrong</p>
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && data?.available_rooms?.length === 0 && (
                    <div className="bg-white p-12 text-center rounded-2xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col justify-center">
                        <Info className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">No Rooms Available</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-6">We&apos;re fully booked for these dates or the selected room capacity is too small for {adults} guests.</p>
                        <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">Try Different Dates</Link>
                    </div>
                )}

                {!loading && !error && data?.available_rooms?.map((room) => (
                    <div key={room.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 flex flex-col md:flex-row hover:shadow-md transition-shadow">

                        {/* Image Placeholder */}
                        <div className="w-full md:w-1/3 bg-gray-200 flex flex-col items-center justify-center min-h-[250px] relative overflow-hidden">
                            <div className="absolute inset-0 bg-blue-50"></div>
                            <Info className="w-12 h-12 text-blue-200 z-10 mb-2" />
                            <span className="text-blue-300 font-medium z-10 block px-4 text-center">{room.name} Image</span>
                            {room.available_count <= 2 && (
                                <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm z-20">Only {room.available_count} left!</span>
                            )}
                        </div>

                        <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-2xl font-bold text-gray-900">{room.name}</h3>
                                </div>
                                <p className="text-gray-600 mb-6 leading-relaxed max-w-xl">{room.description}</p>

                                <div className="flex flex-wrap gap-4 mb-6">
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                                        <Users className="w-4 h-4 text-gray-500" />
                                        Sleeps up to {room?.max_occupancy || adults}
                                    </div>
                                    {Array.isArray(room?.amenities) && room.amenities.slice(0, 3).map((amenity, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <CheckCircle2 className="w-4 h-4" />
                                            {amenity}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-gray-100 mt-2">
                                <div className="text-center sm:text-left mb-6 sm:mb-0">
                                    <div className="text-3xl font-extrabold text-blue-900">${Number(room?.base_price || 0).toFixed(2)}</div>
                                    <div className="text-sm text-gray-500 font-medium mt-1">per night, excluding taxes</div>
                                    <div className="text-xs text-gray-400 mt-0.5">Total for {data?.nights || 1} nights: ${Number(room?.total_price || 0).toFixed(2)}</div>
                                </div>

                                <Link
                                    href={`/book/${room?.id}?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`}
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-center transition-transform transform hover:scale-105 shadow-md flex items-center justify-center gap-2"
                                >
                                    Select Room
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function RoomsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>}>
            <RoomResults />
        </Suspense>
    );
}
