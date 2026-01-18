import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useStore } from './store/useStore';

// Public (Mobile) Pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Students from './pages/Students';
import Checkin from './pages/Checkin';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import QRCheckin from './pages/QRCheckin';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClasses from './pages/admin/AdminClasses';
import AdminStudents from './pages/admin/AdminStudents';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';

function AppContent() {
  const initializeSubscriptions = useStore((state) => state.initializeSubscriptions);

  useEffect(() => {
    const unsubscribe = initializeSubscriptions();
    return () => unsubscribe();
  }, [initializeSubscriptions]);

  return (
    <Routes>
      {/* Public Routes (Mobile UI) */}
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/classes" element={<Classes />} />
      <Route path="/classes/:id" element={<Classes />} />
      <Route path="/students" element={<Students />} />
      <Route path="/checkin" element={<Checkin />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/qr/:token" element={<QRCheckin />} />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/classes" element={
        <ProtectedRoute>
          <AdminClasses />
        </ProtectedRoute>
      } />
      <Route path="/admin/students" element={
        <ProtectedRoute>
          <AdminStudents />
        </ProtectedRoute>
      } />
      <Route path="/admin/attendance" element={
        <ProtectedRoute>
          <AdminAttendance />
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute>
          <AdminReports />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute>
          <AdminSettings />
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
