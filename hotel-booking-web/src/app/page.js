import Link from 'next/link';
import { Calendar, Search, MapPin, Star } from 'lucide-react';
import { HOTEL_ID } from '@/config';

async function getHotelInfo() {
  // Using absolute URL for server-side fetches. Fallback to localhost for dev 
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const res = await fetch(`${backendUrl}/api/public/hotels/${HOTEL_ID}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function Home() {
  const data = await getHotelInfo();
  const hotel = data?.hotel;

  if (!hotel) {
    return <div className="p-8 text-center text-red-500">Failed to load hotel information. Is the backend running?</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center z-10">
        <div className="font-bold text-xl text-blue-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
          {hotel.name}
        </div>
        <div className="flex gap-4">
          <Link href="/manage-booking" className="text-gray-600 hover:text-blue-600 font-medium">Manage Booking</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative h-[60vh] bg-blue-900 flex items-center justify-center text-white text-center pb-12 overflow-hidden">
        {/* Placeholder background gradient to make it look premium */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 opacity-90"></div>

        <div className="relative z-10 max-w-3xl px-6">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight">Your perfect stay awaits.</h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
            {hotel.description || 'Experience luxury and comfort in the heart of the city. Book directly for the best rates.'}
          </p>
          <div className="flex items-center justify-center gap-2 text-blue-200 mb-12">
            <MapPin className="w-5 h-5" />
            <span>{hotel.address}, {hotel.city}</span>
          </div>
        </div>
      </div>

      {/* Floating Search Bar */}
      <div className="max-w-5xl mx-auto w-full px-4 -mt-16 relative z-20 mb-24">
        <form action="/rooms" method="GET" className="bg-white rounded-2xl shadow-xl p-6 md:p-8 flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input type="date" name="checkIn" id="checkin" required className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input type="date" name="checkOut" id="checkout" required className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>
          <div className="w-full md:w-1/6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Guests</label>
            <select name="adults" id="adults" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white">
              <option value="1">1 Adult</option>
              <option value="2">2 Adults</option>
              <option value="3">3 Adults</option>
              <option value="4">4 Adults</option>
            </select>
          </div>
          <div className="w-full md:w-auto mt-4 md:mt-0">
            <button
              type="submit"
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105"
            >
              <Search className="w-5 h-5" />
              Search Rooms
            </button>
          </div>
        </form>
      </div>

      {/* Features/Footer */}
      <footer className="mt-auto bg-white border-t border-gray-100 py-12 text-center text-gray-500">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-gray-800 mb-2">Best Rate Guarantee</h3>
            <p className="text-sm">Found it cheaper? We&apos;ll match it.</p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 mb-2">Free Cancellation</h3>
            <p className="text-sm">Flexible booking on select rates.</p>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 mb-2">24/7 Support</h3>
            <p className="text-sm">We&apos;re here when you need us.</p>
          </div>
        </div>
        <p>© 2026 {hotel.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
