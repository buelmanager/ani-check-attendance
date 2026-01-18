import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { isLoading, userRole, isAdmin, isStudent, isParent } = useAuth();
  const [progress, setProgress] = useState(0);

  // 역할에 따른 리다이렉트 경로 결정
  const getRedirectPath = () => {
    if (isAdmin) return '/admin';
    if (isStudent) return '/student';
    if (isParent) return '/parent';
    // 로그인 안 된 경우 역할 선택 페이지로
    return null;
  };

  useEffect(() => {
    // Progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // 로그인 로딩이 끝나면 적절한 페이지로 이동
    if (!isLoading) {
      const redirectPath = getRedirectPath();
      const timer = setTimeout(() => {
        if (redirectPath) {
          navigate(redirectPath);
        }
        // 로그인 안 된 경우 스플래시 화면 유지 (역할 선택 버튼 표시)
      }, redirectPath ? 1500 : 2500);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }

    return () => {
      clearInterval(interval);
    };
  }, [navigate, isLoading, userRole]);

  const showRoleSelection = !isLoading && !userRole && progress >= 100;

  return (
    <div
      className="app-container min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: '#1a1f2e' }}
    >
      {/* Logo */}
      <div className="mb-8">
        <h1
          className="text-5xl font-bold tracking-widest"
          style={{ color: '#c9a962' }}
        >
          ANI WID
        </h1>
      </div>

      {/* Subtitle */}
      <div className="text-center mb-12">
        <p className="text-gray-400 text-sm">예술가의 꿈을 현실로 만드는</p>
        <p className="text-gray-400 text-sm">최고의 미술 전문 교육기관</p>
      </div>

      {showRoleSelection ? (
        // 역할 선택 버튼
        <div className="w-72 space-y-3">
          <button
            onClick={() => navigate('/student/login')}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            학생 로그인
          </button>
          <button
            onClick={() => navigate('/parent/login')}
            className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            부모 로그인
          </button>
          <button
            onClick={() => navigate('/admin/login')}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors text-sm"
          >
            관리자 로그인
          </button>
        </div>
      ) : (
        // 프로그레스 바
        <div className="w-64">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: '#c9a962'
              }}
            />
          </div>
          <p
            className="text-center mt-3 text-sm font-medium"
            style={{ color: '#c9a962' }}
          >
            {isLoading ? '로딩중...' : `${progress}%`}
          </p>
        </div>
      )}
    </div>
  );
}
