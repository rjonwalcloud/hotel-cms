import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { analyticsAPI } from '../../services/analytics.service';
import { 
  BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, 
  Filter, FileText, ChevronDown, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';
import Papa from 'papaparse';

// Explicitly register the plugin for ESM/Vite environments
try {
  applyPlugin(jsPDF);
  console.log('Analytics Module: jsPDF-AutoTable plugin registered');
} catch (e) {
  console.error('Analytics Module: Failed to register jsPDF-AutoTable plugin', e);
}

const MetricCard = ({ title, value, icon: Icon, trend, color, subtitle }) => (
  <div className="card p-6 border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
    <div className={`absolute top-0 right-0 w-32 h-32 ${color.bg} opacity-10 rounded-full translate-x-16 -translate-y-16 group-hover:scale-110 transition-transform`} />
    
    <div className="flex items-center justify-between mb-4 relative z-10">
      <div className={`p-3 rounded-2xl ${color.bg} ${color.text} shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    
    <div className="relative z-10">
      <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</h3>
      <p className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{value}</p>
      {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{subtitle}</p>}
    </div>
  </div>
);

const Analytics = () => {
  const { t } = useTranslation();
  const { getHotelId } = useAuthStore();
  const { formatCurrency, fetchCurrencySettings, isLoaded: currencyLoaded } = useCurrencyStore();
  const hotelId = getHotelId();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  
  const [filters, setFilters] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
  });

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, []);

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
    { value: 'all', label: 'Full Year (Annual)' }
  ];

  useEffect(() => {
    if (!currencyLoaded) {
      fetchCurrencySettings();
    }
  }, [currencyLoaded, fetchCurrencySettings]);

  const loadData = async () => {
    if (!hotelId) return;
    try {
      setLoading(true);
      const activeFilters = {
        year: filters.year,
        month: filters.month === 'all' ? null : filters.month,
        period: filters.month === 'all' ? 'monthly' : 'daily'
      };

      const [summaryData, chartResults] = await Promise.all([
        analyticsAPI.getSummary(hotelId, activeFilters),
        analyticsAPI.getChartData(hotelId, activeFilters)
      ]);

      setSummary(summaryData || {});
      setChartData(Array.isArray(chartResults) ? chartResults : []);
    } catch (error) {
      console.error('Analytics Error:', error);
      toast.error('Failed to load analytics data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hotelId, filters.year, filters.month]);

  const stats = useMemo(() => {
    if (!summary) return [];

    const occRate = summary.totalRooms > 0 
      ? (summary.roomNightsSold / (summary.totalRooms * (summary.daysInPeriod || 1))) * 100 
      : 0;

    return [
      {
        title: "Total Revenue",
        value: formatCurrency(summary.totalRevenue || 0),
        icon: DollarSign,
        color: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
        subtitle: "Net Earnings"
      },
      {
        title: "Bookings Done",
        value: summary.totalBookings || 0,
        icon: Calendar,
        color: { bg: 'bg-primary-50', text: 'text-primary-600' },
        subtitle: "Total Volume"
      },
      {
        title: "Occupancy Rate",
        value: `${occRate.toFixed(1)}%`,
        icon: Activity,
        color: { bg: 'bg-amber-50', text: 'text-amber-600' },
        subtitle: `${summary.roomNightsSold || 0} Room Nights`
      },
      {
        title: "Avg. Booking Value",
        value: formatCurrency(summary.avgBookingValue || 0),
        icon: TrendingUp,
        color: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
        subtitle: "Per Reservation"
      }
    ];
  }, [summary, formatCurrency]);

  const exportToCSV = () => {
    if (!chartData.length) return;
    const data = chartData.map(d => ({
      Period: d.label,
      Revenue: d.revenue,
      Bookings: d.bookings,
      Cancellations: d.cancellations
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_report_${filters.year}_${filters.month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    console.log('Starting PDF Export...', { summary: !!summary, chartData: chartData?.length });
    try {
      if (!summary) {
        toast.error('No summary data available to export');
        return;
      }
      
      const doc = new jsPDF();
      console.log('jsPDF instance created');

      // Helper to call autoTable safely across different bundler environments
      const safeAutoTable = (document, options) => {
        try {
          // 1. Try the method attached to the instance by applyPlugin
          if (typeof document.autoTable === 'function') {
            return document.autoTable(options);
          }
          // 2. Try the imported function itself
          if (typeof autoTable === 'function') {
            return autoTable(document, options);
          }
          // 3. Last resort fallback
          if (typeof jsPDF.autoTable === 'function') {
             return jsPDF.autoTable(document, options);
          }
        } catch (e) {
          console.warn('PDF Table generation error:', e);
        }
        throw new Error('PDF Table plugin could not be initialized.');
      };

      // Title
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text('Hotel Analytics Report', 14, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      const periodLabel = filters.month === 'all' ? 'Annual' : (months.find(m => m.value === filters.month)?.label || 'Selected Period');
      doc.text(`Generated on: ${new Date().toLocaleDateString()} | Period: ${periodLabel} ${filters.year}`, 14, 32);
      
      console.log('Adding Summary Table...');
      safeAutoTable(doc, {
        startY: 40,
        head: [['Metric', 'Value']],
        body: [
          ['Total Bookings', summary.totalBookings || 0],
          ['Total Revenue', formatCurrency(summary.totalRevenue || 0)],
          ['Avg Booking Value', formatCurrency(summary.avgBookingValue || 0)],
          ['Room Nights Sold', summary.roomNightsSold || 0],
          ['Occupancy Rate', stats[2]?.value || '0.0%']
        ],
        theme: 'striped',
        headStyles: { fillStyle: '#4f46e5', fontWeight: 'bold' }
      });

      const finalYAfterSummary = doc.lastAutoTable?.finalY || 100;
      console.log('Summary table done. FinalY:', finalYAfterSummary);

      if (Array.isArray(chartData) && chartData.length > 0) {
        console.log('Adding Chart Data Table...');
        safeAutoTable(doc, {
          startY: finalYAfterSummary + 15,
          head: [['Period', 'Revenue', 'Bookings', 'Cancellations']],
          body: chartData.map(d => [
            d.label || '-', 
            formatCurrency(d.revenue || 0), 
            d.bookings || 0, 
            d.cancellations || 0
          ]),
          theme: 'grid',
          headStyles: { fillStyle: '#6366f1' }
        });
      }

      console.log('Saving PDF...');
      const fileName = `analytics_${filters.year}_${filters.month}.pdf`;
      doc.save(fileName);
      toast.success('PDF report generated successfully');
    } catch (error) {
      console.error('CRITICAL PDF EXPORT ERROR:', error);
      toast.error(`Export failed: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary-100 rounded-full" />
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
        </div>
        <div className="text-center">
          <p className="text-slate-900 font-black text-xl tracking-tight">Gathering Insights</p>
          <p className="text-slate-400 font-medium text-sm mt-1">Analyzing your hotel's performance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-16 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Analytics <span className="text-primary-600">Overview</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Real-time performance metrics and growth trends</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative">
              <select
                value={filters.year}
                onChange={(e) => setFilters(f => ({ ...f, year: e.target.value }))}
                className="pl-4 pr-10 py-2 bg-transparent text-sm font-bold text-slate-700 cursor-pointer outline-none appearance-none"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            
            <div className="w-px h-6 bg-slate-200 mx-1" />

            <div className="relative">
              <select
                value={filters.month}
                onChange={(e) => setFilters(f => ({ ...f, month: e.target.value }))}
                className="pl-4 pr-10 py-2 bg-transparent text-sm font-bold text-slate-700 cursor-pointer outline-none appearance-none min-w-[140px]"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          
          <button 
            onClick={loadData}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-primary-600 hover:border-primary-100 transition-all shadow-sm"
          >
            <Activity className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <MetricCard key={idx} {...stat} />
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="card p-8 bg-white border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Revenue Performance
            </h3>
            <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-widest">
              Live
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickMargin={12} 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis 
                  tickFormatter={(val) => formatCurrency(val)} 
                  fontSize={10} 
                  fontWeight="bold"
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip 
                  formatter={(value) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-8 bg-white border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-500" />
              Booking & Cancellations
            </h3>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  fontSize={10} 
                  fontWeight="bold"
                  tickMargin={12} 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis 
                  fontSize={10} 
                  fontWeight="bold"
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '0', paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }} 
                />
                <Bar dataKey="bookings" name="Bookings" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="cancellations" name="Cancellations" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Export Footer */}
      <div className="card p-8 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/10 rounded-full translate-x-32 -translate-y-32 blur-3xl group-hover:scale-125 transition-transform duration-1000" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Financial Intelligence</h3>
              <p className="text-slate-400 font-medium mt-1">Export your data to professional PDF or CSV reports.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={exportToCSV}
              className="flex-1 md:flex-none px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10 transition-all"
            >
              Export CSV
            </button>
            <button 
              onClick={exportToPDF}
              className="flex-1 md:flex-none px-8 py-4 bg-primary-600 hover:bg-primary-500 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-900/50 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
