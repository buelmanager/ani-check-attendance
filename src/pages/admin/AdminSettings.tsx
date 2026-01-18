import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminSettings() {
  const { adminData, user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { classes, students, attendances } = await import('../../store/useStore').then(m => m.useStore.getState());

      const exportData = {
        exportedAt: new Date().toISOString(),
        classes,
        students,
        attendances
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anicheck-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('데이터 내보내기 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500">시스템 설정을 관리합니다</p>
      </div>

      {/* Profile Section */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">관리자 정보</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
            <span className="text-primary font-bold text-2xl">
              {adminData?.name?.charAt(0) || 'A'}
            </span>
          </div>
          <div>
            <p className="text-gray-900 font-medium text-lg">{adminData?.name || '관리자'}</p>
            <p className="text-gray-500">{adminData?.email || user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-accent/20 text-accent text-xs rounded">
              {adminData?.role === 'superadmin' ? '최고 관리자' : '관리자'}
            </span>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">데이터 관리</h2>
        <div className="space-y-4">
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-50/80 transition-all disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-gray-900 font-medium">데이터 백업</p>
              <p className="text-sm text-gray-500">모든 데이터를 JSON 파일로 내보냅니다</p>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">앱 정보</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-500">버전</span>
            <span className="text-gray-900">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-500">앱 이름</span>
            <span className="text-gray-900">ANI CHECK</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-500">Firebase 프로젝트</span>
            <span className="text-gray-900">art-academy-80ae5</span>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">바로가기</h2>
        <div className="space-y-2">
          <a
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-50/80 transition-all"
          >
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-gray-900 font-medium">모바일 앱</p>
              <p className="text-sm text-gray-500">학생용 모바일 페이지 열기</p>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
