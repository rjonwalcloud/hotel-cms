import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ShieldAlert } from 'lucide-react';
import api from '../api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/auth/login', { username, password });
            localStorage.setItem('central_token', response.data.token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-[#e1e1e3] font-inter">
            <div className="w-full max-w-md p-8 bg-[#161618] rounded-2xl border border-[#2d2d30] shadow-2xl">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-tr from-[#3b82f6] to-[#60a5fa] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                        <ShieldAlert size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Central Control</h1>
                    <p className="text-[#a1a1aa] mt-2">Identify yourself to access tracking data</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                            <ShieldAlert size={20} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#52525b] group-focus-within:text-blue-400 transition-colors">
                                <User size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-[#0a0a0b] border border-[#2d2d30] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-[#52525b]"
                                required
                            />
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#52525b] group-focus-within:text-blue-400 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-[#0a0a0b] border border-[#2d2d30] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-[#52525b]"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? 'Authenticating...' : 'Enter Dashboard'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-[#52525b]">
                    Central Security Infrastructure © 2026
                </div>
            </div>
        </div>
    );
};

export default Login;
