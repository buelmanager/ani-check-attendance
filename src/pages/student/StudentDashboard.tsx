import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/student/StudentLayout';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import { announcementService } from '../../services/announcementService';
import type { Class, Attendance, Announcement } from '../../types';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { studentData, logout } = useAuth();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const [classes, setClasses] = useState<Class[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];

  const todayFormatted = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  useEffect(() => {
    if (!studentData) return;

    // 클래스 구독
    const unsubClasses = classService.subscribe((allClasses) => {
      // 학생이 등록된 클래스만 필터링
      const myClasses = allClasses.filter(c => c.studentIds.includes(studentData.id));
      setClasses(myClasses);
      setIsLoading(false);
    });

    // 오늘 출석 구독
    const unsubAttendance = attendanceService.subscribeByDate(today, (attendances) => {
      // 내 출석만 필터링
      const myAttendance = attendances.filter(a => a.studentId === studentData.id);
      setTodayAttendance(myAttendance);
    });

    // 공지사항 구독
    const classIds = classes.map(c => c.id);
    const unsubAnnouncements = announcementService.subscribeForStudent(
      studentData.id,
      classIds,
      (anns) => setAnnouncements(anns.slice(0, 3))
    );

    return () => {
      unsubClasses();
      unsubAttendance();
      unsubAnnouncements();
    };
  }, [studentData, today]);

  // 오늘 수업 (요일 기준)
  const todayClasses = classes.filter(c => c.schedule.includes(dayOfWeek));

  // 특정 클래스의 오늘 출석 상태 확인
  const getAttendanceStatus = (classId: string) => {
    return todayAttendance.find(a => a.classId === classId);
  };

  // 출석 통계 - present, late만 출석으로 카운트 (absent, excused는 제외)
  const checkedInCount = todayClasses.filter(cls => {
    const attendance = getAttendanceStatus(cls.id);
    return attendance && (attendance.status === 'present' || attendance.status === 'late');
  }).length;
  const attendanceRate = todayClasses.length > 0
    ? Math.round((checkedInCount / todayClasses.length) * 100)
    : 0;

  const handleCheckin = (classId: string) => {
    navigate(`/student/checkin?classId=${classId}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/student/login');
  };

  const iconColors = ['#E85D4C', '#1E3A5F', '#F8A035', '#2ECC71'];

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="px-1">
        {/* Header with Settings */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">{todayFormatted}</p>
            <h1 className="text-2xl font-bold text-primary">안녕하세요, {studentData?.name}님!</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {/* Settings Dropdown */}
            {showSettingsMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSettingsMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
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
                  <span className="text-white/70 text-xs">출석 완료</span>
                </div>
                <span className="text-xl font-bold text-white">{checkedInCount}개</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                  <span className="text-white/70 text-xs">남은 수업</span>
                </div>
                <span className="text-xl font-bold text-white">{todayClasses.length - checkedInCount}개</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-blue-300 rounded-full" />
                  <span className="text-white/70 text-xs">전체 수업</span>
                </div>
                <span className="text-xl font-bold text-white">{classes.length}개</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Link to="/student/checkin" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">QR출석</span>
          </Link>
          <Link to="/student/schedule" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">스케줄</span>
          </Link>
          <Link to="/student/notices" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">공지</span>
          </Link>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">출석기록</span>
          </div>
        </div>

        {/* 오늘 수업 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">오늘의 수업</h2>
            <Link to="/student/schedule" className="text-sm text-accent font-medium">전체보기</Link>
          </div>

          <div className="space-y-3">
            {todayClasses.length > 0 ? (
              todayClasses.map((cls, index) => {
                const attendance = getAttendanceStatus(cls.id);
                const isCheckedIn = !!attendance;

                return (
                  <div
                    key={cls.id}
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
                      <p className="text-sm text-gray-400">{cls.time}</p>
                    </div>
                    <div className="text-right">
                      {isCheckedIn ? (
                        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                          attendance.status === 'present' ? 'status-present' :
                          attendance.status === 'late' ? 'status-late' :
                          'status-absent'
                        }`}>
                          {attendance.status === 'present' ? '출석' :
                           attendance.status === 'late' ? '지각' :
                           attendance.status === 'excused' ? '사유' : '결석'}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckin(cls.id)}
                          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors"
                        >
                          체크인
                        </button>
                      )}
                      {attendance?.checkInTime && (
                        <p className="text-xs text-gray-400 mt-1">{attendance.checkInTime}</p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">오늘은 수업이 없습니다</p>
                <Link to="/student/schedule" className="text-accent font-medium">
                  스케줄 확인하기
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* 공지사항 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">공지사항</h2>
            <Link to="/student/notices" className="text-sm text-accent font-medium">전체보기</Link>
          </div>

          {announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">{ann.title}</p>
                      <p className="text-sm text-gray-400 line-clamp-1">{ann.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(ann.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-6">
              <p className="text-gray-400">새로운 공지가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
