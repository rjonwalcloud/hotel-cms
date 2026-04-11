import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCard({ title, value, icon: Icon, trend, color = 'primary' }) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600 ring-primary-100',
    green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    yellow: 'bg-amber-50 text-amber-600 ring-amber-100',
    red: 'bg-rose-50 text-rose-600 ring-rose-100',
    purple: 'bg-violet-50 text-violet-600 ring-violet-100',
  };

  return (
    <div className="card p-6 flex items-start justify-between group">
      <div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="mt-2 text-3xl font-black text-slate-900 tracking-tight">{value}</p>

        {trend && (
          <div className="mt-3 flex items-center text-xs font-bold uppercase tracking-wider">
            <div className={`flex items-center px-1.5 py-0.5 rounded-lg ${trend.direction === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
              {trend.direction === 'up' ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {trend.value}%
            </div>
            <span className="text-slate-400 ml-2">{trend.label}</span>
          </div>
        )}
      </div>

      <div className={`p-4 rounded-2xl shadow-sm ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 ${colorClasses[color]}`}>
        <Icon className="w-7 h-7" />
      </div>
    </div>
  );
}
