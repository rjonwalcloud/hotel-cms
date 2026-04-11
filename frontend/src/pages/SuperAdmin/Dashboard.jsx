import { useEffect, useState } from 'react';
import { hotelAPI, policyAPI } from '../../services/api';
import StatsCard from '../../components/StatsCard';
import { Building2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalHotels: 0,
    activeHotels: 0,
    quotaStatus: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [hotelsData, quotaData] = await Promise.all([
        hotelAPI.getAll(),
        policyAPI.getQuotaSummary(),
      ]);

      const activeHotels = hotelsData.hotels.filter(h => h.is_active).length;

      setStats({
        totalHotels: hotelsData.hotels.length,
        activeHotels,
        quotaStatus: quotaData.hotels || [],
      });
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-600">Welcome! Here's an overview of the system.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Hotels"
          value={stats.totalHotels}
          icon={Building2}
          color="primary"
        />
        <StatsCard
          title="Active Hotels"
          value={stats.activeHotels}
          icon={CheckCircle}
          color="green"
        />
        <StatsCard
          title="Inactive Hotels"
          value={stats.totalHotels - stats.activeHotels}
          icon={AlertCircle}
          color="yellow"
        />
        <StatsCard
          title="System Health"
          value="Healthy"
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Quota Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quota Usage by Hotel</h2>
        <div className="space-y-4">
          {stats.quotaStatus.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No quota data available</p>
          ) : (
            stats.quotaStatus.slice(0, 5).map((hotel) => (
              <div key={hotel.hotel_id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{hotel.hotel_name}</h3>
                </div>
                <div className="space-y-2">
                  {hotel.limits.map((limit) => (
                    <div key={limit.key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">{limit.description || limit.key}</span>
                        <span className="text-gray-900 font-medium">
                          {limit.current_value} / {limit.max_value}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            limit.usage_percentage >= 90
                              ? 'bg-red-600'
                              : limit.usage_percentage >= 75
                              ? 'bg-yellow-600'
                              : 'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(limit.usage_percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card hover:shadow-md transition-shadow cursor-pointer">
          <h3 className="font-semibold text-gray-900 mb-2">Manage Hotels</h3>
          <p className="text-sm text-gray-600">View and manage all hotels in the system</p>
        </div>
        <div className="card hover:shadow-md transition-shadow cursor-pointer">
          <h3 className="font-semibold text-gray-900 mb-2">Quota Management</h3>
          <p className="text-sm text-gray-600">Configure and monitor quota limits</p>
        </div>
        <div className="card hover:shadow-md transition-shadow cursor-pointer">
          <h3 className="font-semibold text-gray-900 mb-2">Audit Logs</h3>
          <p className="text-sm text-gray-600">Review system-wide audit trail</p>
        </div>
      </div>
    </div>
  );
}
