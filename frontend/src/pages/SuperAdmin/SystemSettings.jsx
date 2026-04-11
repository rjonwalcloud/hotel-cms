import { useState, useEffect } from 'react';
import { systemAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import { Save, Link as LinkIcon, Shield, FileText } from 'lucide-react';

export default function SystemSettings() {
    const [configs, setConfigs] = useState([]);
    const [formData, setFormData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            setIsLoading(true);
            const res = await systemAPI.getConfigs();
            if (res.success) {
                setConfigs(res.data);
                const initialForm = {};
                res.data.forEach(c => {
                    initialForm[c.config_key] = c.config_value;
                });
                setFormData(initialForm);
            }
        } catch (error) {
            toast.error('Failed to load system configurations');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const res = await systemAPI.updateConfigs(formData);
            if (res.success) {
                toast.success('System settings updated successfully');
                fetchConfigs();
            }
        } catch (error) {
            toast.error('Failed to update system settings');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Settings</h1>
                <p className="text-slate-500 mt-2">Manage global platform configurations and legal links.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Legal & Compliance</h2>
                            <p className="text-sm text-slate-500">Configure public URLs for agreement links shown on login and registration.</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1 flex items-center">
                                <FileText className="w-4 h-4 mr-2 text-slate-400" />
                                Terms of Service URL
                            </label>
                            <input
                                type="url"
                                value={formData['terms_of_service_url'] || ''}
                                onChange={(e) => handleInputChange('terms_of_service_url', e.target.value)}
                                className="input"
                                placeholder="https://example.com/terms"
                                required
                            />
                            <p className="text-[10px] text-slate-400 font-medium ml-1">
                                Link shown as "Terms of Service" on the sign-in page.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1 flex items-center">
                                <Shield className="w-4 h-4 mr-2 text-slate-400" />
                                Privacy Policy URL
                            </label>
                            <input
                                type="url"
                                value={formData['privacy_policy_url'] || ''}
                                onChange={(e) => handleInputChange('privacy_policy_url', e.target.value)}
                                className="input"
                                placeholder="https://example.com/privacy"
                                required
                            />
                            <p className="text-[10px] text-slate-400 font-medium ml-1">
                                Link shown as "Privacy Policy" on the sign-in page.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="btn btn-primary px-8 py-3 flex items-center space-x-2"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
                        </button>
                    </div>
                </form>
            </div>

            <div className="mt-8 bg-amber-50 rounded-2xl p-6 border border-amber-100">
                <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                        <LinkIcon className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-amber-900">Dynamic Links Implementation</h3>
                        <p className="text-sm text-amber-700 mt-1">
                            The login page will automatically fetch these URLs and display them in the agreement message.
                            Always ensure the URLs are prefix with <code className="bg-amber-100 px-1 rounded">https://</code>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
