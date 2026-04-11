import { Routes, Route, Navigate } from 'react-router-dom';
import ItemManagement from './ItemManagement';
import StockManagement from './StockManagement';
import Suppliers from './Suppliers';
import BreakageLoss from './BreakageLoss';
import ExpenseManagement from './ExpenseManagement';

export default function InventoryApp() {
  return (
    <Routes>
      <Route index element={<Navigate to="items" replace />} />
      <Route path="items" element={<ItemManagement />} />
      <Route path="stock" element={<StockManagement />} />
      <Route path="suppliers" element={<Suppliers />} />
      <Route path="breakage" element={<BreakageLoss />} />
      <Route path="expenses" element={<ExpenseManagement />} />
    </Routes>
  );
}
