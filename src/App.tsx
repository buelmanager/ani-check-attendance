import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { StudentRoute } from './components/StudentRoute';
import { ParentRoute } from './components/ParentRoute';
import { useStore } from './store/useStore';

// Public Pages
import Home from './pages/Home';
import Invite from './pages/Invite';
import QRCheckin from './pages/QRCheckin';

// Legacy Public (Mobile) Pages - 관리자용 모바일 UI
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Students from './pages/Students';
import Checkin from './pages/Checkin';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

// Student Pages
import StudentLogin from './pages/student/StudentLogin';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentSchedule from './pages/student/StudentSchedule';
import StudentNotices from './pages/student/StudentNotices';
import StudentCheckin from './pages/student/StudentCheckin';

// Parent Pages
import ParentLogin from './pages/parent/ParentLogin';
import ParentDashboard from './pages/parent/ParentDashboard';
import ParentChildDetail from './pages/parent/ParentChildDetail';
import ParentNotices from './pages/parent/ParentNotices';
import ParentNotifications from './pages/parent/ParentNotifications';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClasses from './pages/admin/AdminClasses';
import AdminStudents from './pages/admin/AdminStudents';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminReports from './pages/admin/AdminReports';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminSettings from './pages/admin/AdminSettings';

function AppContent() {
  const initializeSubscriptions = useStore((state) => state.initializeSubscriptions);

  useEffect(() => {
    const unsubscribe = initializeSubscriptions();
    return () => unsubscribe();
  }, [initializeSubscriptions]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/invite/:code" element={<Invite />} />
      <Route path="/qr/:token" element={<QRCheckin />} />

      {/* Student Routes */}
      <Route path="/student/login" element={<StudentLogin />} />
      <Route path="/student" element={
        <StudentRoute>
          <StudentDashboard />
        </StudentRoute>
      } />
      <Route path="/student/schedule" element={
        <StudentRoute>
          <StudentSchedule />
        </StudentRoute>
      } />
      <Route path="/student/notices" element={
        <StudentRoute>
          <StudentNotices />
        </StudentRoute>
      } />
      <Route path="/student/checkin" element={
        <StudentRoute>
          <StudentCheckin />
        </StudentRoute>
      } />

      {/* Parent Routes */}
      <Route path="/parent/login" element={<ParentLogin />} />
      <Route path="/parent" element={
        <ParentRoute>
          <ParentDashboard />
        </ParentRoute>
      } />
      <Route path="/parent/child/:id" element={
        <ParentRoute>
          <ParentChildDetail />
        </ParentRoute>
      } />
      <Route path="/parent/notices" element={
        <ParentRoute>
          <ParentNotices />
        </ParentRoute>
      } />
      <Route path="/parent/notifications" element={
        <ParentRoute>
          <ParentNotifications />
        </ParentRoute>
      } />

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
      <Route path="/admin/announcements" element={
        <ProtectedRoute>
          <AdminAnnouncements />
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

      {/* Legacy Mobile Routes (관리자용 모바일 UI) */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/classes" element={
        <ProtectedRoute>
          <Classes />
        </ProtectedRoute>
      } />
      <Route path="/classes/:id" element={
        <ProtectedRoute>
          <Classes />
        </ProtectedRoute>
      } />
      <Route path="/students" element={
        <ProtectedRoute>
          <Students />
        </ProtectedRoute>
      } />
      <Route path="/checkin" element={
        <ProtectedRoute>
          <Checkin />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
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
