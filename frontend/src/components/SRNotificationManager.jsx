import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { qrcodeAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { playNotificationSound } from '../utils/audioUtils';
import { useNotificationStore } from '../store/notificationStore';

export default function SRNotificationManager() {
    const { getHotelId, user } = useAuthStore();
    const { addNotification } = useNotificationStore();
    const hotelId = getHotelId();
    const navigate = useNavigate();
    const lastRequestIds = useRef(new Set());
    const isFirstLoad = useRef(true);

    const showNotification = (req) => {
        const role = user?.roles?.[0]?.role || 'HOTEL_ADMIN';
        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-600 font-bold">SR</span>
                            </div>
                        </div>
                        <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                                New Service Request
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Room {req.room_number || 'N/A'}: {req.service_name || req.name}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex border-l border-gray-200">
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);
                            navigate(role === 'HOTEL_ADMIN' ? '/hotel/service-requests' : '/staff/service-requests');
                        }}
                        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        View
                    </button>
                </div>
            </div>
        ), {
            duration: 6000,
            position: 'top-right',
        });
    };

    const checkNewRequests = async () => {
        if (!hotelId) return;

        // Only for Hotel Admin and Staff
        const role = user?.roles?.[0]?.role;
        if (role !== 'HOTEL_ADMIN' && role !== 'STAFF') return;

        try {
            // Fetch pending requests
            const data = await qrcodeAPI.getServiceRequests(hotelId, { status: 'PENDING' });
            const currentRequests = data.requests || [];
            
            const currentIds = new Set(currentRequests.map(req => req.id));
            
            if (isFirstLoad.current) {
                lastRequestIds.current = currentIds;
                isFirstLoad.current = false;
                return;
            }

            // Find new IDs that were not in the previous set
            const newRequests = currentRequests.filter(req => !lastRequestIds.current.has(req.id));

            if (newRequests.length > 0) {
                // Play sound once for the batch
                playNotificationSound();
                newRequests.forEach(req => {
                    addNotification({
                        id: req.id,
                        title: 'New Service Request',
                        message: `Room ${req.room_number || 'N/A'}: ${req.service_name || req.name}`,
                        room_number: req.room_number,
                        service_name: req.service_name || req.name,
                        type: 'service_request'
                    });
                    showNotification(req);
                });
            }

            lastRequestIds.current = currentIds;
        } catch (error) {
            console.error('Failed to poll service requests:', error);
        }
    };

    useEffect(() => {
        if (!hotelId) return;

        // Initial check
        checkNewRequests();

        // Start polling every 20 seconds
        const interval = setInterval(checkNewRequests, 20000);

        return () => clearInterval(interval);
    }, [hotelId]);

    return null;
}
