import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { publicAPI } from '../services/api';
import { Hotel, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [legalLinks, setLegalLinks] = useState({
    terms_of_service_url: 'https://example.com/terms',
    privacy_policy_url: 'https://example.com/privacy'
  });

  useEffect(() => {
    const fetchLegalLinks = async () => {
      try {
        const res = await publicAPI.getSystemConfigs();
        if (res.success && res.configs) {
          setLegalLinks(res.configs);
        }
      } catch (error) {
        console.error('Failed to fetch legal links:', error);
      }
    };
    fetchLegalLinks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login({ email, password });
    if (success) {
      navigate('/');
    }
  };


  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 relative overflow-hidden items-center justify-center p-12">
        {/* Abstract Background Patterns */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500 rounded-full blur-3xl opacity-50 animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary-700 rounded-full blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-secondary-500 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative z-10 max-w-lg text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-xl rounded-3xl mb-8 border border-white/20 shadow-2xl">
            <Hotel className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-6 tracking-tight">
            Elevate Your <span className="text-secondary-200">Hospitality</span> Experience
          </h1>
          <p className="text-xl text-primary-100 mb-8 leading-relaxed">
            Manage your hotel operations with a state-of-the-art platform designed for precision and modern efficiency.
          </p>
          <div className="flex justify-center gap-4">
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-white text-sm font-medium">
              Real-time Analytics
            </div>
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-white text-sm font-medium">
              Guest Management
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="max-w-md w-full">
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
              <Hotel className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Hotel CMS</h1>
          </div>

          <div className="bg-white rounded-3xl shadow-material-3 p-10 border border-slate-100">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h2>
              <p className="text-slate-500">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-12"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-12 pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn btn-primary py-4 text-lg group"
              >
                {isLoading ? 'Authenticating...' : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                By signing in, you agree to our{' '}
                <a
                  href={legalLinks.terms_of_service_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 font-bold hover:underline"
                >
                  Terms of Service
                </a>
                {' '}and{' '}
                <a
                  href={legalLinks.privacy_policy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 font-bold hover:underline"
                >
                  Privacy Policy
                </a>.
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400 font-medium">
            © 2024 Hotel CMS Platform. Professional Grade Operation Software.
          </p>
        </div>
      </div>
    </div>
  );
}
