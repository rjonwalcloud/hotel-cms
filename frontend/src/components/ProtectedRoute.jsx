import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, hasRole } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && !hasRole(role)) {
    console.warn(`Access denied for role ${role}. Redirecting to safety.`);
    return <Navigate to="/dashboard" replace />;
  }

  return children || <Outlet />;
}
