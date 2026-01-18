import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ParentLayout } from '../../components/parent/ParentLayout';
import { studentService } from '../../services/studentService';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import { announcementService } from '../../services/announcementService';
import { usePushNotification } from '../../hooks/usePushNotification';
import type { Student, Class, Attendance, Announcement } from '../../types';

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { parentData, logout } = useAuth();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(true);

  const [children, setChildren] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [allAttendances, setAllAttendances] = useState<Attendance[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 푸시 알림 훅
  const { isSupported, isPermissionGranted, requestPermission } = usePushNotification();

  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  useEffect(() => {
    if (!parentData) return;

    // 자녀 정보 로드 (Promise.all로 병렬 처리 - async-parallel 규칙)
    const loadChildren = async () => {
      const childrenData = await Promise.all(
        parentData.studentIds.map(studentId => studentService.getById(studentId))
      );
      setChildren(childrenData.filter((student): student is Student => student !== null));
      setIsLoading(false);
    };

    loadChildren();

    // 클래스 구독
    const unsubClasses = classService.subscribe(setClasses);

    // 오늘 출석 구독
    const unsubAttendance = attendanceService.subscribeByDate(today, (attendances) => {
      // 내 자녀 출석만 필터링
      const childAttendance = attendances.filter(a =>
        parentData.studentIds.includes(a.studentId)
      );
      setTodayAttendance(childAttendance);
    });

    // 공지사항 구독
    const unsubAnnouncements = announcementService.subscribe((anns) => {
      setAnnouncements(anns.slice(0, 3));
    });

    // 전체 출석 데이터 구독 (출석률 계산용)
    const unsubAllAttendances = attendanceService.subscribeAll((attendances) => {
      // 내 자녀 출석만 필터링
      const childAttendances = attendances.filter(a =>
        parentData.studentIds.includes(a.studentId)
      );
      setAllAttendances(childAttendances);
    });

    return () => {
      unsubClasses();
      unsubAttendance();
      unsubAnnouncements();
      unsubAllAttendances();
    };
  }, [parentData, today]);

  // 자녀의 오늘 출석 상태
  const getChildTodayStatus = (studentId: string) => {
    const attendance = todayAttendance.filter(a => a.studentId === studentId);
    if (attendance.length === 0) return null;

    // 가장 최근 출석
    const latest = attendance.sort((a, b) =>
      (b.checkInTime || '').localeCompare(a.checkInTime || '')
    )[0];

    return latest;
  };

  // 자녀의 클래스 목록
  const getChildClasses = (studentId: string) => {
    return classes.filter(c => c.studentIds.includes(studentId));
  };

  // 이번 달 출석률 계산
  const monthlyRates = useMemo(() => {
    const rates: Record<string, number> = {};
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    for (const child of children) {
      // 해당 학생의 이번 달 출석 기록
      const studentAttendances = allAttendances.filter(a => {
        if (a.studentId !== child.id) return false;
        const date = new Date(a.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      if (studentAttendances.length === 0) {
        rates[child.id] = 0;
        continue;
      }

      // 출석/지각은 출석으로 간주, 결석은 미출석
      const presentCount = studentAttendances.filter(a =>
        a.status === 'present' || a.status === 'late' || a.status === 'excused'
      ).length;

      const rate = Math.round((presentCount / studentAttendances.length) * 100);
      rates[child.id] = rate;
    }

    return rates;
  }, [children, allAttendances]);

  const getMonthlyRate = (studentId: string) => {
    return monthlyRates[studentId] ?? 0;
  };

  // 전체 자녀 출석 통계
  const totalChildren = children.length;
  const checkedInToday = children.filter(c => getChildTodayStatus(c.id)).length;

  const handleLogout = async () => {
    await logout();
    navigate('/parent/login');
  };

  const iconColors = ['#2ECC71', '#1E3A5F', '#F8A035', '#E85D4C'];

  if (isLoading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ParentLayout>
    );
  }

  // 푸시 알림 권한 요청 핸들러
  const handleEnablePush = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShowPushBanner(false);
    }
  };

  return (
    <ParentLayout>
      <div className="px-1">
        {/* 푸시 알림 권한 요청 배너 */}
        {isSupported && !isPermissionGranted && showPushBanner && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 mb-4 relative">
            <button
              onClick={() => setShowPushBanner(false)}
              className="absolute top-2 right-2 p-1 text-white/70 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">출석 알림을 받으시겠어요?</p>
                <p className="text-white/70 text-xs">자녀가 출석하면 실시간으로 알려드려요</p>
              </div>
              <button
                onClick={handleEnablePush}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors"
              >
                허용
              </button>
            </div>
          </div>
        )}

        {/* Header with Settings */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">{todayFormatted}</p>
            <h1 className="text-2xl font-bold text-primary">안녕하세요, {parentData?.name}님!</h1>
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
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm mb-1">오늘의 출석 현황</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold text-white">{checkedInToday}</span>
                  <span className="text-2xl text-white/70 mb-1">/ {totalChildren}</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/20">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-green-300 rounded-full" />
                  <span className="text-white/70 text-xs">출석 완료</span>
                </div>
                <span className="text-xl font-bold text-white">{checkedInToday}명</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-amber-300 rounded-full" />
                  <span className="text-white/70 text-xs">대기 중</span>
                </div>
                <span className="text-xl font-bold text-white">{totalChildren - checkedInToday}명</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-white/50 rounded-full" />
                  <span className="text-white/70 text-xs">총 자녀</span>
                </div>
                <span className="text-xl font-bold text-white">{totalChildren}명</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Link to="/parent/notices" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">공지사항</span>
          </Link>
          <Link to="/parent/notifications" className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">알림</span>
          </Link>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">통계</span>
          </div>
        </div>

        {/* 내 자녀 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">내 자녀</h2>
          </div>

          <div className="space-y-3">
            {children.length > 0 ? (
              children.map((child, index) => {
                const todayStatus = getChildTodayStatus(child.id);
                const childClasses = getChildClasses(child.id);
                const monthlyRate = getMonthlyRate(child.id);

                return (
                  <button
                    key={child.id}
                    onClick={() => navigate(`/parent/child/${child.id}`)}
                    className="w-full card card-hover flex items-center gap-4"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${iconColors[index % iconColors.length]}20` }}
                    >
                      <span
                        className="text-xl font-bold"
                        style={{ color: iconColors[index % iconColors.length] }}
                      >
                        {child.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-primary truncate">{child.name}</p>
                      <p className="text-sm text-gray-400">{childClasses.length}개 수업 · 출석률 {monthlyRate}%</p>
                    </div>
                    <div className="text-right">
                      {todayStatus ? (
                        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                          todayStatus.status === 'present' ? 'status-present' :
                          todayStatus.status === 'late' ? 'status-late' :
                          'status-absent'
                        }`}>
                          {todayStatus.status === 'present' ? '출석' :
                           todayStatus.status === 'late' ? '지각' : '결석'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 px-3 py-1 bg-gray-100 rounded-full">대기중</span>
                      )}
                      {todayStatus?.checkInTime && (
                        <p className="text-xs text-gray-400 mt-1">{todayStatus.checkInTime}</p>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="card text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">등록된 자녀가 없습니다</p>
                <p className="text-sm text-gray-400">초대 링크를 통해 자녀를 등록하세요</p>
              </div>
            )}
          </div>
        </div>

        {/* 공지사항 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">공지사항</h2>
            <Link to="/parent/notices" className="text-sm text-green-500 font-medium">전체보기</Link>
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
    </ParentLayout>
  );
}
