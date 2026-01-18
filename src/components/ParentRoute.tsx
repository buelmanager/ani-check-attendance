import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ParentRouteProps {
  children: React.ReactNode;
}

export function ParentRoute({ children }: ParentRouteProps) {
  const { isParent, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isParent) {
    return <Navigate to="/parent/login" replace />;
  }

  return <>{children}</>;
}
