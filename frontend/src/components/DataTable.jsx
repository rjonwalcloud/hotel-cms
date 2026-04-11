import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  searchable = true,
  pagination = true,
  loading = false,
  emptyMessage
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Normalize columns: support both { key, label } and { accessor, header } formats
  const normalizedColumns = columns.map(col => ({
    ...col,
    key: col.key || col.accessor || col.id || col.header,
    label: col.label || col.header
  }));

  // Filter data based on search
  const filteredData = searchable
    ? data.filter(item =>
      normalizedColumns.some(col =>
        String(item[col.key] ?? '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
    )
    : data;

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = pagination
    ? filteredData.slice(startIndex, startIndex + itemsPerPage)
    : filteredData;

  return (
    <div className="space-y-4">
      {/* Search */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="input pl-10"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-3xl shadow-material-1 border border-slate-100">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/50">
            <tr>
              {normalizedColumns.map((col) => (
                <th
                  key={col.key}
                  className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest"
                >
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete || onView) && (
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={normalizedColumns.length + 1}
                  className="px-8 py-16 text-center"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3"></div>
                    <p className="text-slate-400 font-medium text-sm">Loading...</p>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={normalizedColumns.length + 1}
                  className="px-8 py-16 text-center"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <Search className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-medium text-sm">{emptyMessage || 'No records found matching your criteria'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors group">
                  {normalizedColumns.map((col) => (
                    <td key={col.key} className="px-8 py-5 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </td>
                  ))}
                  {(onEdit || onDelete || onView) && (
                    <td className="px-8 py-5 whitespace-nowrap text-right text-xs font-bold space-x-3">
                      {onView && (
                        <button
                          onClick={() => onView(item)}
                          className="text-primary-600 hover:text-primary-700 uppercase tracking-widest"
                        >
                          View
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item)}
                          className="text-rose-600 hover:text-rose-700 uppercase tracking-widest"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Showing <span className="text-slate-900">{startIndex + 1}</span> to <span className="text-slate-900">{Math.min(startIndex + itemsPerPage, filteredData.length)}</span> of{' '}
            <span className="text-slate-900">{filteredData.length}</span> entries
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Page {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
