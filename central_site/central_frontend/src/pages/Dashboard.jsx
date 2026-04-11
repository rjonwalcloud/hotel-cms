import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    Globe,
    Shield,
    ShieldAlert,
    RefreshCcw,
    ExternalLink,
    Lock,
    LogOut,
    Eye
} from 'lucide-react';
import api from '../api';

const Dashboard = () => {
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, unauthorized: 0, activeToday: 0 });
    const navigate = useNavigate();

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/deployments');
            setDeployments(response.data);

            // Calculate stats
            const unauthorized = response.data.filter(d => d.status === 'UNAUTHORIZED').length;
            const today = new Date().toISOString().split('T')[0];
            const activeToday = response.data.filter(d => d.last_seen.startsWith(today)).length;

            setStats({
                total: response.data.length,
                unauthorized,
                activeToday
            });
        } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // 30s auto-refresh
        return () => clearInterval(interval);
    }, []);

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'AUTHORIZED' ? 'UNAUTHORIZED' : 'AUTHORIZED';
        try {
            await api.patch(`/deployments/${id}/status`, { status: newStatus });
            fetchData();
        } catch (err) {
            console.error('Failed to update status');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('central_token');
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-[#e1e1e3] font-inter">
            {/* Nav */}
            <nav className="border-b border-[#2d2d30] bg-[#161618]/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Shield size={20} className="text-white" />
                        </div>
                        <span className="font-bold text-xl tracking-tight">Central Control</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="p-2 text-[#a1a1aa] hover:text-white transition-colors"
                        >
                            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2d2d30] border border-[#3f3f46] rounded-lg hover:bg-[#3f3f46] transition-all"
                        >
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-10">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <StatCard
                        title="Total Deployments"
                        value={stats.total}
                        icon={<Globe size={24} className="text-blue-400" />}
                        subtitle="Across all regions"
                    />
                    <StatCard
                        title="Active Today"
                        value={stats.activeToday}
                        icon={<Activity size={24} className="text-emerald-400" />}
                        subtitle="Last 24 hours"
                    />
                    <StatCard
                        title="Unauthorized"
                        value={stats.unauthorized}
                        icon={<ShieldAlert size={24} className="text-red-400" />}
                        subtitle="Pending investigation"
                        highlight={stats.unauthorized > 0}
                    />
                </div>

                {/* Table */}
                <div className="bg-[#161618] border border-[#2d2d30] rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-[#2d2d30] flex justify-between items-center bg-[#1c1c1f]">
                        <h2 className="text-lg font-semibold">Deployment Logs</h2>
                        <span className="text-sm text-[#52525b]">Live Tracking Enabled</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[#52525b] text-sm border-b border-[#2d2d30]">
                                    <th className="px-6 py-4 font-medium">Hotel / ID</th>
                                    <th className="px-6 py-4 font-medium">Contact / Tax</th>
                                    <th className="px-6 py-4 font-medium">Location</th>
                                    <th className="px-6 py-4 font-medium">Network Details</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2d2d30]">
                                {deployments.map((d) => (
                                    <tr key={d.id} className="hover:bg-[#1c1c1f] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{d.hotel_name || 'Generic Deploy'}</div>
                                            <div className="text-xs text-[#52525b] mt-1 font-mono uppercase">{d.hotel_id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm space-y-1">
                                                {d.email && <div className="flex items-center gap-2 text-[#a1a1aa] hover:text-blue-400 transition-colors cursor-default">
                                                    <span className="text-xs">{d.email}</span>
                                                </div>}
                                                {d.phone && <div className="text-xs text-[#52525b]">{d.phone}</div>}
                                                {d.gst_number && <div className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded inline-block border border-blue-500/20">GST: {d.gst_number}</div>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-[#a1a1aa] line-clamp-1 max-w-[200px]" title={d.address}>
                                                {d.address || 'No Address Provided'}
                                            </div>
                                            <div className="text-xs text-[#52525b] mt-1">
                                                {[d.city, d.state, d.country].filter(Boolean).join(', ') || 'Global'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-blue-400 font-mono">{d.ip}</span>
                                            </div>
                                            {d.public_url && (
                                                <a
                                                    href={d.public_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-[#52525b] hover:text-blue-400 mt-1 flex items-center gap-1 transition-colors"
                                                >
                                                    Dashboard Link
                                                    <ExternalLink size={10} />
                                                </a>
                                            )}
                                            <div className="text-[10px] text-[#3f3f46] mt-1">
                                                Seen: {new Date(d.last_seen).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${d.status === 'AUTHORIZED'
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                                                }`}>
                                                {d.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => toggleStatus(d.id, d.status)}
                                                className={`p-2 rounded-lg transition-all ${d.status === 'AUTHORIZED'
                                                    ? 'text-[#52525b] hover:text-red-400 hover:bg-red-500/10'
                                                    : 'text-red-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                    }`}
                                                title={d.status === 'AUTHORIZED' ? 'Mark Unauthorized' : 'Authorize'}
                                            >
                                                {d.status === 'AUTHORIZED' ? <Lock size={18} /> : <Shield size={18} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {deployments.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-20 text-center text-[#52525b]">
                                            <div className="flex flex-col items-center gap-3">
                                                <Eye size={48} className="opacity-20" />
                                                <p>No deployments reported yet</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

const StatCard = ({ title, value, icon, subtitle, highlight }) => (
    <div className={`p-6 bg-[#161618] border rounded-2xl shadow-lg transition-all ${highlight ? 'border-red-500/20 shadow-red-500/5' : 'border-[#2d2d30]'
        }`}>
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#0a0a0b] border border-[#2d2d30] rounded-xl">
                {icon}
            </div>
            {highlight && <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20 uppercase">Alert</span>}
        </div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        <div className="text-sm font-medium text-[#e1e1e3]">{title}</div>
        <div className="text-xs text-[#52525b] mt-2">{subtitle}</div>
    </div>
);

export default Dashboard;
