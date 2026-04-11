import { useState, useEffect } from 'react';
import { bookingAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import DataTable from '../../components/DataTable';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Users, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CustomerManagement() {
    const { t } = useTranslation();
    const { getHotelId } = useAuthStore();
    const hotelId = getHotelId();
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        search: ''
    });

    useEffect(() => {
        if (hotelId) {
            loadGuests();
        }
    }, [hotelId, filters]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: searchTerm }));
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadGuests = async () => {
        try {
            setLoading(true);
            const data = await bookingAPI.getGuests(hotelId, filters);
            setGuests(data.guests || []);
        } catch (error) {
            toast.error(t('bulk_bookings.messages.load_error'));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            key: 'full_name',
            label: t('customers.table.name'),
            render: (value) => <span className="font-medium text-gray-900">{value}</span>
        },
        {
            key: 'age',
            label: t('customers.table.age'),
            render: (value) => value || t('common.none')
        },
        {
            key: 'id_proof_type',
            label: t('customers.table.id_proof'),
            render: (_, guest) => (
                <div className="text-sm">
                    <p className="text-gray-900">{guest.id_proof_number || t('common.none')}</p>
                    <p className="text-xs text-gray-500">{guest.id_proof_type}</p>
                </div>
            )
        },
        {
            key: 'last_visit',
            label: t('customers.table.last_visit'),
            render: (value) => value ? format(new Date(value), 'MMM dd, yyyy') : t('common.none')
        },
        {
            key: 'last_room_type',
            label: t('customers.table.preferred_room'),
            render: (value) => value || t('common.none')
        },
        {
            key: 'last_status',
            label: t('customers.table.last_status'),
            render: (value) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'CHECKED_OUT' ? 'bg-green-100 text-green-800' :
                    value === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                    }`}>
                    {value ? t(`bookings.status.${value.toLowerCase()}`) : t('common.none')}
                </span>
            )
        }
    ];

    if (!hotelId) return <div className="p-8 text-center">{t('customers.no_hotel')}</div>;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary-600" />
                        {t('customers.title')}
                    </h1>
                    <p className="text-slate-500 font-medium tracking-tight mt-1">{t('customers.subtitle')}</p>
                </div>
            </div>

            <div className="card p-6 bg-slate-50/50 border-slate-100">
                <div className="relative max-w-md group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                    <input
                        type="text"
                        placeholder={t('customers.search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-12 bg-white transition-all shadow-material-1 group-focus-within:shadow-material-2"
                    />
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <DataTable
                    columns={columns}
                    data={guests}
                    loading={loading}
                    searchable={false}
                />
            </div>
        </div>
    );
}
