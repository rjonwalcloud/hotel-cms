import { useState } from 'react';
import { systemAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Database, Download, ShieldAlert, History, CheckCircle2 } from 'lucide-react';

export default function SystemBackup() {
    const [downloading, setDownloading] = useState(false);

    const handleBackup = async () => {
        try {
            setDownloading(true);
            toast.loading('Generating system backup...', { id: 'backup-toast' });

            const response = await systemAPI.downloadBackup();

            // Create a blob link to download
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `hotel-cms-full-backup-${dateStr}.sql`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Backup downloaded successfully', { id: 'backup-toast' });
        } catch (error) {
            console.error('Backup failed:', error);
            toast.error('Failed to generate backup. Check server logs.', { id: 'backup-toast' });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Maintenance</h1>
                <p className="text-slate-500 font-medium">Manage database backups and system integrity</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Backup Card */}
                <div className="lg:col-span-2 card p-8 border-primary-100 bg-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full translate-x-20 -translate-y-20 blur-3xl opacity-50" />

                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-16 h-16 rounded-3xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-200">
                            <Database className="w-8 h-8 text-white" />
                        </div>

                        <div className="flex-1 space-y-4">
                            <h2 className="text-xl font-bold text-slate-900">Full Database Backup</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Generate a complete SQL dump of the entire platform. This includes:
                            </p>
                            <ul className="grid grid-cols-2 gap-2">
                                {['All Hotels', 'User Accounts', 'Room Inventories', 'Booking History', 'Audit Logs', 'Subscription Data'].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-sm text-slate-500 font-bold">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            <div className="pt-6">
                                <button
                                    onClick={handleBackup}
                                    disabled={downloading}
                                    className="btn btn-primary px-8 py-4 text-lg flex items-center gap-3 transition-all active:scale-95"
                                >
                                    {downloading ? (
                                        'Generating Dump...'
                                    ) : (
                                        <>
                                            <Download className="w-6 h-6" />
                                            Generate Full Backup (.sql)
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Info Card */}
                <div className="card p-8 bg-slate-900 text-white border-none shadow-2xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                            <ShieldAlert className="w-6 h-6 text-amber-500" />
                        </div>
                        <h3 className="font-black text-lg">Critical Safety</h3>
                    </div>

                    <div className="space-y-4 text-slate-400 text-sm leading-relaxed">
                        <p>
                            The generated backup contains sensitive information including user details and encrypted password hashes.
                        </p>
                        <p className="p-4 bg-white/5 rounded-xl border border-white/10 text-slate-300 font-medium italic">
                            "Keep these files in a secure, encrypted storage location. Never share them over unsecure channels."
                        </p>
                        <div className="flex items-center gap-2 pt-4">
                            <History className="w-4 h-4 text-primary-400" />
                            <span className="text-xs uppercase tracking-widest font-black text-slate-500">Restore Policy</span>
                        </div>
                        <p>
                            Restoration should be performed by a database administrator via pgAdmin or command line tools during a scheduled maintenance window.
                        </p>
                    </div>
                </div>
            </div>

            {/* Backup Logs / History (Stateless Demo) */}
            <div className="card p-8">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Recent Operations</h2>
                <div className="space-y-4 opacity-50 pointer-events-none">
                    {[
                        { date: 'Yesterday, 14:20', type: 'FULL_BACKUP', status: 'SUCCESS' },
                        { date: '3 Feb 2024, 09:12', type: 'FULL_BACKUP', status: 'SUCCESS' },
                    ].map((log, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                                <Download className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="font-bold text-slate-900">{log.type}</p>
                                    <p className="text-xs text-slate-500">{log.date}</p>
                                </div>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                {log.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
