import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useStore } from '../store/useStore';
import { deduplicateAttendances } from '../services/statisticsService';

export default function Dashboard() {
  const { classes, students, attendances } = useStore();

  const today = new Date().toISOString().split('T')[0];
  // 중복 제거 적용: 같은 학생이 같은 날 여러번 출석 체크해도 마지막 것만 카운트
  const todayAttendances = useMemo(() => {
    const filtered = attendances.filter((a) => a.date === today);
    return deduplicateAttendances(filtered);
  }, [attendances, today]);

  const presentCount = todayAttendances.filter((a) => a.status === 'present').length;
  const lateCount = todayAttendances.filter((a) => a.status === 'late').length;
  const absentCount = todayAttendances.filter((a) => a.status === 'absent').length;

  const totalExpected = classes.reduce((sum, cls) => sum + cls.studentIds.length, 0);
  const attendanceRate = totalExpected > 0 ? Math.round(((presentCount + lateCount) / totalExpected) * 100) : 0;

  const todayFormatted = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  const recentAttendances = [...todayAttendances]
    .sort((a, b) => (b.checkInTime || '').localeCompare(a.checkInTime || ''))
    .slice(0, 4);

  const iconColors = ['#E85D4C', '#1E3A5F', '#F8A035', '#2ECC71'];

  return (
    <Layout>
      <div className="px-5 pt-6 pb-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">{todayFormatted}</p>
            <h1 className="text-2xl font-bold text-primary">안녕하세요!</h1>
          </div>
          <Link to="/settings" className="relative w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-accent rounded-full border-2 border-white" />
          </Link>
        </header>

        {/* Main Stats Card */}
        <div className="gradient-primary rounded-3xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm mb-1">오늘의 출석률</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold text-white">{attendanceRate}</span>
                  <span className="text-2xl text-white/70 mb-1">%</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/20">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-white/70 text-xs">출석</span>
                </div>
                <span className="text-xl font-bold text-white">{presentCount}명</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                  <span className="text-white/70 text-xs">지각</span>
                </div>
                <span className="text-xl font-bold text-white">{lateCount}명</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-red-400 rounded-full" />
                  <span className="text-white/70 text-xs">결석</span>
                </div>
                <span className="text-xl font-bold text-white">{absentCount}명</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Link to="/checkin" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">QR출석</span>
          </Link>
          <Link to="/classes" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">클래스</span>
          </Link>
          <Link to="/students" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">학생</span>
          </Link>
          <Link to="/reports" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">리포트</span>
          </Link>
        </div>

        {/* Classes Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">오늘의 수업</h2>
            <Link to="/classes" className="text-sm text-accent font-medium">전체보기</Link>
          </div>

          <div className="space-y-3">
            {classes.length > 0 ? (
              classes.slice(0, 3).map((cls, index) => {
                const classAttendances = todayAttendances.filter((a) => a.classId === cls.id);
                const classPresent = classAttendances.filter((a) => a.status === 'present' || a.status === 'late').length;
                const classRate = cls.studentIds.length > 0
                  ? Math.round((classPresent / cls.studentIds.length) * 100)
                  : 0;

                return (
                  <Link
                    key={cls.id}
                    to={`/classes/${cls.id}`}
                    className="card card-hover flex items-center gap-4"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${iconColors[index % iconColors.length]}15` }}
                    >
                      <svg className="w-6 h-6" style={{ color: iconColors[index % iconColors.length] }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary truncate">{cls.name}</p>
                      <p className="text-sm text-gray-400">{cls.schedule} · {cls.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{classRate}%</p>
                      <p className="text-xs text-gray-400">{classPresent}/{cls.studentIds.length}</p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="card text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">등록된 클래스가 없습니다</p>
                <Link to="/classes" className="text-accent font-medium">
                  클래스 추가하기
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-bold text-primary mb-4">최근 출석</h2>

          {recentAttendances.length > 0 ? (
            <div className="space-y-3">
              {recentAttendances.map((att) => {
                const student = students.find((s) => s.id === att.studentId);
                const cls = classes.find((c) => c.id === att.classId);

                return (
                  <div key={att.id} className="card flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      att.status === 'present' ? 'bg-green-100 text-green-600' :
                      att.status === 'late' ? 'bg-amber-100 text-amber-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      <span className="font-bold text-sm">
                        {student?.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">{student?.name}</p>
                      <p className="text-sm text-gray-400 truncate">{cls?.name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                        att.status === 'present' ? 'status-present' :
                        att.status === 'late' ? 'status-late' :
                        'status-absent'
                      }`}>
                        {att.status === 'present' ? '출석' : att.status === 'late' ? '지각' : '결석'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{att.checkInTime}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card text-center py-6">
              <p className="text-gray-400">오늘 출석 기록이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
