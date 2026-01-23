import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { StudentRoute } from './components/StudentRoute';
import { ParentRoute } from './components/ParentRoute';
import { useStore } from './store/useStore';
import PwaInstallGuide from './components/PwaInstallGuide';
import UpdateNotification from './components/UpdateNotification';
import ErrorBoundary from './components/ErrorBoundary';
import { getWebviewInfo } from './utils/webviewDetect';
import { setupGlobalErrorHandlers } from './services/errorTrackingService';
import { APP_VERSION } from './config/version';

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
import StudentSettings from './pages/student/StudentSettings';
import StudentAttendance from './pages/student/StudentAttendance';

// Parent Pages
import ParentLogin from './pages/parent/ParentLogin';
import ParentDashboard from './pages/parent/ParentDashboard';
import ParentChildDetail from './pages/parent/ParentChildDetail';
import ParentNotices from './pages/parent/ParentNotices';
import ParentNotifications from './pages/parent/ParentNotifications';
import ParentSettings from './pages/parent/ParentSettings';
import ParentMessages from './pages/parent/ParentMessages';
import ParentStats from './pages/parent/ParentStats';
import ParentPayments from './pages/parent/ParentPayments';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClasses from './pages/admin/AdminClasses';
import AdminStudents from './pages/admin/AdminStudents';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminReports from './pages/admin/AdminReports';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminSettings from './pages/admin/AdminSettings';
import AdminNotices from './pages/admin/AdminNotices';
import AdminGuardians from './pages/admin/AdminGuardians';
import StudentDetail from './pages/admin/StudentDetail';
import AdminErrorLogs from './pages/admin/AdminErrorLogs';
import AdminPayments from './pages/admin/AdminPayments';

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
      <Route path="/student/settings" element={
        <StudentRoute>
          <StudentSettings />
        </StudentRoute>
      } />
      <Route path="/student/attendance" element={
        <StudentRoute>
          <StudentAttendance />
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
      <Route path="/parent/settings" element={
        <ParentRoute>
          <ParentSettings />
        </ParentRoute>
      } />
      <Route path="/parent/messages" element={
        <ParentRoute>
          <ParentMessages />
        </ParentRoute>
      } />
      <Route path="/parent/stats" element={
        <ParentRoute>
          <ParentStats />
        </ParentRoute>
      } />
      <Route path="/parent/payments" element={
        <ParentRoute>
          <ParentPayments />
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
      <Route path="/admin/students/:id" element={
        <ProtectedRoute>
          <StudentDetail />
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
      <Route path="/admin/notices" element={
        <ProtectedRoute>
          <AdminNotices />
        </ProtectedRoute>
      } />
      <Route path="/admin/guardians" element={
        <ProtectedRoute>
          <AdminGuardians />
        </ProtectedRoute>
      } />
      <Route path="/admin/errors" element={
        <ProtectedRoute>
          <AdminErrorLogs />
        </ProtectedRoute>
      } />
      <Route path="/admin/payments" element={
        <ProtectedRoute>
          <AdminPayments />
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

// 전역 에러 핸들러를 위한 래퍼 컴포넌트
function AppWithErrorBoundary() {
  const { user, studentData, parentData } = useAuth();

  useEffect(() => {
    // 전역 에러 핸들러 설정
    setupGlobalErrorHandlers(() => {
      let userRole: 'admin' | 'student' | 'parent' | undefined;
      if (studentData) userRole = 'student';
      else if (parentData) userRole = 'parent';
      else if (user) userRole = 'admin';

      return {
        userId: user?.uid || studentData?.id || parentData?.id,
        userRole,
      };
    });
  }, [user, studentData, parentData]);

  return (
    <ErrorBoundary
      userId={user?.uid || studentData?.id || parentData?.id}
      userRole={studentData ? 'student' : parentData ? 'parent' : user ? 'admin' : undefined}
    >
      <AppContent />
    </ErrorBoundary>
  );
}

function App() {
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [isVersionChecking, setIsVersionChecking] = useState(true);

  // 앱 시작 시 버전 체크
  useEffect(() => {
    const STORED_VERSION_KEY = 'app-version';
    const storedVersion = localStorage.getItem(STORED_VERSION_KEY);

    console.log('[App] Version check - Stored:', storedVersion, 'Current:', APP_VERSION);

    const performVersionCheck = async () => {
      // 버전이 다르고, 아직 리로드하지 않았으면 캐시 클리어 후 리로드
      if (storedVersion && storedVersion !== APP_VERSION) {
        const reloadAttempted = sessionStorage.getItem('version-reload-attempted');

        if (!reloadAttempted) {
          console.log('[App] Version mismatch detected. Clearing cache and reloading...');
          sessionStorage.setItem('version-reload-attempted', 'true');

          try {
            // 모든 캐시 삭제
            if ('caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            // 서비스 워커 재등록 강제
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                await registration.unregister();
              }
            }

            // 새 버전 저장
            localStorage.setItem(STORED_VERSION_KEY, APP_VERSION);

            // 강제 새로고침
            window.location.href = window.location.pathname + '?v=' + Date.now();
            return;
          } catch (error) {
            console.error('[App] Version check error:', error);
          }
        } else {
          // 이미 리로드 시도했으면 플래그 클리어하고 진행
          sessionStorage.removeItem('version-reload-attempted');
        }
      }

      // 버전 저장
      localStorage.setItem(STORED_VERSION_KEY, APP_VERSION);
      setIsVersionChecking(false);
    };

    performVersionCheck();
  }, []);

  useEffect(() => {
    if (isVersionChecking) return;

    // 웹뷰에서 접속한 경우 PWA 설치 안내 표시
    const webviewInfo = getWebviewInfo();
    const dismissedKey = 'pwa-guide-dismissed';
    const dismissedTime = localStorage.getItem(dismissedKey);

    // 디버깅용 로그
    console.log('[PWA Guide] WebView Info:', webviewInfo);
    console.log('[PWA Guide] User Agent:', navigator.userAgent);
    console.log('[PWA Guide] Dismissed Time:', dismissedTime);

    // 24시간 내에 닫은 경우 다시 표시하지 않음
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      console.log('[PWA Guide] Hours since dismissed:', hoursSinceDismissed);
      if (hoursSinceDismissed < 24) {
        console.log('[PWA Guide] Skipping - dismissed within 24 hours');
        return;
      }
    }

    if (webviewInfo.needsPwaGuide) {
      console.log('[PWA Guide] Showing guide...');
      // 약간의 딜레이 후 팝업 표시 (페이지 로딩 후)
      const timer = setTimeout(() => {
        setShowPwaGuide(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      console.log('[PWA Guide] Not showing - needsPwaGuide is false');
    }
  }, [isVersionChecking]);

  const handleClosePwaGuide = () => {
    setShowPwaGuide(false);
    localStorage.setItem('pwa-guide-dismissed', Date.now().toString());
  };

  // 버전 체크 중이면 로딩 표시
  if (isVersionChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">앱을 시작하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppWithErrorBoundary />
        {showPwaGuide && <PwaInstallGuide onClose={handleClosePwaGuide} />}
        <UpdateNotification />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
