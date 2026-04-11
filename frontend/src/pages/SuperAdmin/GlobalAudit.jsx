import { useState, useEffect } from 'react';
import { auditAPI } from '../../services/api';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Download, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function GlobalAudit() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    from_date: '',
    to_date: '',
  });

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const params = {};
      if (filters.action) params.action = filters.action;
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.from_date) params.from_date = filters.from_date;
      if (filters.to_date) params.to_date = filters.to_date;

      const data = await auditAPI.getAll(params);
      setAuditLogs(data.logs || []);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      toast.loading('Exporting audit logs...', { id: 'export-audit' });

      const params = {};
      if (filters.action) params.action = filters.action;
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.from_date) params.from_date = filters.from_date;
      if (filters.to_date) params.to_date = filters.to_date;

      const response = await auditAPI.exportGlobalCSV(params);

      // Create a blob link to download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `global-audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Export completed successfully', { id: 'export-audit' });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', { id: 'export-audit' });
    }
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (value) => value ? format(new Date(value), 'MMM dd, yyyy HH:mm') : 'N/A'
    },
    {
      key: 'action',
      label: 'Action',
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'CREATE' ? 'bg-green-100 text-green-800' :
            value === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
              value === 'DELETE' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
          }`}>
          {value}
        </span>
      )
    },
    { key: 'entity_type', label: 'Entity Type' },
    { key: 'user_email', label: 'User' },
    { key: 'hotel_name', label: 'Hotel' },
    {
      key: 'changes',
      label: 'Changes',
      render: (value) => (
        <span className="text-sm text-gray-600">
          {value ? Object.keys(value).length : 0} fields
        </span>
      )
    },
  ];

  const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'CHECK_IN', 'CHECK_OUT', 'CANCEL', 'STATUS_CHANGE'];
  const entityTypes = ['HOTEL', 'ROOM', 'ROOM_TYPE', 'AMENITY', 'BOOKING', 'BULK_BOOKING', 'USER', 'SERVICE', 'TASK', 'PROMOTION', 'COUPON', 'RATE_PLAN', 'RATE_RULE', 'TAX', 'SETTING', 'POLICY', 'CHANNEL', 'SUBSCRIPTION', 'QR_CODE', 'ADDON'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Global Audit Logs</h1>
          <p className="text-gray-600">System-wide activity tracking</p>
        </div>
        <button onClick={handleExport} className="btn btn-secondary inline-flex items-center">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="input"
            >
              <option value="">All Actions</option>
              {actions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entity Type
            </label>
            <select
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              className="input"
            >
              <option value="">All Types</option>
              {entityTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-4">
          <button onClick={loadAuditLogs} className="btn btn-primary">
            Apply Filters
          </button>
          <button
            onClick={() => {
              setFilters({ action: '', entity_type: '', from_date: '', to_date: '' });
              loadAuditLogs();
            }}
            className="btn btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading audit logs...</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={auditLogs}
          searchable={true}
          pagination={true}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total Logs</p>
          <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Creates</p>
          <p className="text-2xl font-bold text-green-600">
            {auditLogs.filter(log => log.action === 'CREATE').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Updates</p>
          <p className="text-2xl font-bold text-blue-600">
            {auditLogs.filter(log => log.action === 'UPDATE').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Deletes</p>
          <p className="text-2xl font-bold text-red-600">
            {auditLogs.filter(log => log.action === 'DELETE').length}
          </p>
        </div>
      </div>
    </div>
  );
}
