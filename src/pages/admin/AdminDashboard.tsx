import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';

export default function AdminDashboard() {
  const { classes, students, attendances } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const todayAttendances = attendances.filter((a) => a.date === today);

  const presentCount = todayAttendances.filter((a) => a.status === 'present').length;
  const lateCount = todayAttendances.filter((a) => a.status === 'late').length;
  void todayAttendances.filter((a) => a.status === 'absent').length; // absentCount - unused

  const totalExpected = classes.reduce((sum, cls) => sum + cls.studentIds.length, 0);
  const attendanceRate = totalExpected > 0
    ? Math.round(((presentCount + lateCount) / totalExpected) * 100)
    : 0;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const todayFormatted = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const stats = [
    {
      label: '총 클래스',
      value: classes.length,
      color: '#c9a962',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      label: '총 학생',
      value: students.length,
      color: '#2ECC71',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      label: '오늘 출석',
      value: presentCount + lateCount,
      color: '#3B82F6',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      label: '출석률',
      value: `${attendanceRate}%`,
      color: '#F8A035',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  const recentAttendances = [...todayAttendances]
    .sort((a, b) => (b.checkInTime || '').localeCompare(a.checkInTime || ''))
    .slice(0, 10);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">대시보드</h1>
        <p className="text-gray-500">{todayFormatted}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}20`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <span className="text-gray-500 text-sm">{stat.label}</span>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 작업</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/admin/classes" className="card card-hover text-center py-6">
            <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-gray-900 font-medium">클래스 추가</span>
          </Link>

          <Link to="/admin/students" className="card card-hover text-center py-6">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <span className="text-gray-900 font-medium">학생 추가</span>
          </Link>

          <Link to="/admin/attendance" className="card card-hover text-center py-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-gray-900 font-medium">출석 체크</span>
          </Link>

          <Link to="/admin/reports" className="card card-hover text-center py-6">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-gray-900 font-medium">리포트 보기</span>
          </Link>
        </div>
      </div>

      {/* Today's Attendance & Classes */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">오늘의 클래스</h2>
            <Link to="/admin/classes" className="text-accent text-sm hover:underline">
              전체보기
            </Link>
          </div>

          {classes.length > 0 ? (
            <div className="space-y-3">
              {classes.slice(0, 5).map((cls) => {
                const classAttendances = todayAttendances.filter((a) => a.classId === cls.id);
                const classPresent = classAttendances.filter((a) => a.status === 'present' || a.status === 'late').length;
                const classRate = cls.studentIds.length > 0
                  ? Math.round((classPresent / cls.studentIds.length) * 100)
                  : 0;

                return (
                  <div key={cls.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{cls.name}</p>
                      <p className="text-sm text-gray-500">{cls.schedule} {cls.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-accent">{classRate}%</p>
                      <p className="text-xs text-gray-500">{classPresent}/{cls.studentIds.length}명</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">등록된 클래스가 없습니다.</p>
          )}
        </div>

        {/* Recent Attendance */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">최근 출석</h2>
            <Link to="/admin/attendance" className="text-accent text-sm hover:underline">
              전체보기
            </Link>
          </div>

          {recentAttendances.length > 0 ? (
            <div className="space-y-3">
              {recentAttendances.map((att) => {
                const student = students.find((s) => s.id === att.studentId);
                const cls = classes.find((c) => c.id === att.classId);

                return (
                  <div key={att.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      att.status === 'present' ? 'bg-green-100 text-green-600' :
                      att.status === 'late' ? 'bg-amber-100 text-amber-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {student?.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{student?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{cls?.name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        att.status === 'present' ? 'bg-green-100 text-green-600' :
                        att.status === 'late' ? 'bg-amber-100 text-amber-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {att.status === 'present' ? '출석' : att.status === 'late' ? '지각' : '결석'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{att.checkInTime}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">오늘 출석 기록이 없습니다.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
