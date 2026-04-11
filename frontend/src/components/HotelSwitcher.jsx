import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Building2, ChevronDown, Check } from 'lucide-react';

export default function HotelSwitcher() {
    const { user, activeHotelId, switchHotel } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    // Extract unique hotels from user roles
    const getAvailableHotels = () => {
        if (!user?.roles) return [];

        const uniqueHotels = new Map();

        user.roles.forEach(role => {
            if (role.hotel_id && role.hotel_name) {
                if (!uniqueHotels.has(role.hotel_id)) {
                    uniqueHotels.set(role.hotel_id, {
                        id: role.hotel_id,
                        name: role.hotel_name,
                        role: role.role
                    });
                }
            }
        });

        return Array.from(uniqueHotels.values());
    };

    const hotels = getAvailableHotels();
    const currentHotel = hotels.find(h => h.id === activeHotelId) || hotels[0];

    // Don't render if user has access to 0 or 1 hotel only
    if (hotels.length < 2) return null;

    const handleSwitch = (hotelId) => {
        switchHotel(hotelId);
        setIsOpen(false);
    };

    return (
        <div className="relative px-6 py-2" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2.5 bg-slate-800 rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0 shadow-sm">
                        <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left min-w-0">
                        <p className="text-xs text-slate-400 font-medium">Current Workspace</p>
                        <p className="text-sm font-bold text-white truncate group-hover:text-primary-400 transition-colors">
                            {currentHotel?.name || 'Select Hotel'}
                        </p>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-6 right-6 top-full mt-2 bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="p-2 space-y-1">
                            <p className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Available Hotels</p>
                            {hotels.map((hotel) => (
                                <button
                                    key={hotel.id}
                                    onClick={() => handleSwitch(hotel.id)}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${activeHotelId === hotel.id
                                        ? 'bg-primary-600 text-white'
                                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                        }`}
                                >
                                    <span className="truncate mr-2 font-medium">{hotel.name}</span>
                                    {activeHotelId === hotel.id && <Check className="w-4 h-4 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
