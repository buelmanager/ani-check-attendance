import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import AdminLayout from '../../components/admin/AdminLayout';

interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: Timestamp;
  appVersion: string;
  userId?: string;
  userRole?: 'admin' | 'student' | 'parent';
  additionalInfo?: Record<string, unknown>;
  errorType: 'javascript' | 'react' | 'network' | 'promise' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export default function AdminErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
  const [filter, setFilter] = useState<{
    severity: string;
    errorType: string;
    dateRange: string;
  }>({
    severity: 'all',
    errorType: 'all',
    dateRange: '7d',
  });

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const errorsRef = collection(db, 'errorLogs');
      let q = query(errorsRef, orderBy('timestamp', 'desc'), limit(100));

      // 날짜 필터
      if (filter.dateRange !== 'all') {
        const days = filter.dateRange === '1d' ? 1 : filter.dateRange === '7d' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        q = query(errorsRef, where('timestamp', '>=', Timestamp.fromDate(startDate)), orderBy('timestamp', 'desc'), limit(100));
      }

      const snapshot = await getDocs(q);
      let fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ErrorLog[];

      // 클라이언트 사이드 필터링
      if (filter.severity !== 'all') {
        fetchedLogs = fetchedLogs.filter(log => log.severity === filter.severity);
      }
      if (filter.errorType !== 'all') {
        fetchedLogs = fetchedLogs.filter(log => log.errorType === filter.errorType);
      }

      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('이 로그를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'errorLogs', logId));
      setLogs(prev => prev.filter(log => log.id !== logId));
      if (selectedLog?.id === logId) {
        setSelectedLog(null);
      }
    } catch (error) {
      console.error('Failed to delete log:', error);
    }
  };

  const handleClearOldLogs = async () => {
    if (!confirm('30일 이상 된 로그를 모두 삭제하시겠습니까?')) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldLogsQuery = query(
        collection(db, 'errorLogs'),
        where('timestamp', '<', Timestamp.fromDate(thirtyDaysAgo))
      );

      const snapshot = await getDocs(oldLogsQuery);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      alert(`${snapshot.size}개의 오래된 로그가 삭제되었습니다.`);
      fetchLogs();
    } catch (error) {
      console.error('Failed to clear old logs:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'javascript': return 'bg-purple-100 text-purple-700';
      case 'react': return 'bg-blue-100 text-blue-700';
      case 'network': return 'bg-cyan-100 text-cyan-700';
      case 'promise': return 'bg-indigo-100 text-indigo-700';
      case 'custom': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 통계
  const stats = {
    total: logs.length,
    critical: logs.filter(l => l.severity === 'critical').length,
    high: logs.filter(l => l.severity === 'high').length,
    medium: logs.filter(l => l.severity === 'medium').length,
    low: logs.filter(l => l.severity === 'low').length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">오류 로그</h1>
            <p className="text-gray-500 mt-1">앱에서 발생한 오류를 확인합니다</p>
          </div>
          <button
            onClick={handleClearOldLogs}
            className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            오래된 로그 정리
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">전체</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-sm text-red-600">Critical</p>
            <p className="text-2xl font-bold text-red-700">{stats.critical}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <p className="text-sm text-orange-600">High</p>
            <p className="text-2xl font-bold text-orange-700">{stats.high}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4">
            <p className="text-sm text-yellow-600">Medium</p>
            <p className="text-2xl font-bold text-yellow-700">{stats.medium}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-sm text-green-600">Low</p>
            <p className="text-2xl font-bold text-green-700">{stats.low}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-xl p-4 shadow-sm flex gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">심각도</label>
            <select
              value={filter.severity}
              onChange={(e) => setFilter(prev => ({ ...prev, severity: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">전체</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">에러 유형</label>
            <select
              value={filter.errorType}
              onChange={(e) => setFilter(prev => ({ ...prev, errorType: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">전체</option>
              <option value="javascript">JavaScript</option>
              <option value="react">React</option>
              <option value="network">Network</option>
              <option value="promise">Promise</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">기간</label>
            <select
              value={filter.dateRange}
              onChange={(e) => setFilter(prev => ({ ...prev, dateRange: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="1d">최근 1일</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="all">전체</option>
            </select>
          </div>
          <div className="flex-1" />
          <div className="flex items-end">
            <button
              onClick={fetchLogs}
              className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 로그 목록 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              오류 로그가 없습니다
            </div>
          ) : (
            <div className="divide-y">
              {logs.map(log => (
                <div
                  key={log.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedLog?.id === log.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(log.severity)}`}>
                          {log.severity}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getErrorTypeColor(log.errorType)}`}>
                          {log.errorType}
                        </span>
                        {log.userRole && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {log.userRole}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          v{log.appVersion}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {log.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(log.timestamp)} · {log.url}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLog(log.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* 상세 정보 (선택 시) */}
                  {selectedLog?.id === log.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      {log.stack && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Stack Trace</p>
                          <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                            {log.stack}
                          </pre>
                        </div>
                      )}
                      {log.componentStack && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Component Stack</p>
                          <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                            {log.componentStack}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">User Agent</p>
                          <p className="text-xs text-gray-600 break-all">{log.userAgent}</p>
                        </div>
                        {log.userId && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">User ID</p>
                            <p className="text-xs text-gray-600 font-mono">{log.userId}</p>
                          </div>
                        )}
                      </div>
                      {log.additionalInfo && Object.keys(log.additionalInfo).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Additional Info</p>
                          <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                            {JSON.stringify(log.additionalInfo, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
