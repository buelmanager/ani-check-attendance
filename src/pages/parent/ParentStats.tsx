import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ParentLayout } from '../../components/parent/ParentLayout';
import { studentService } from '../../services/studentService';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import { deduplicateAttendances } from '../../services/statisticsService';
import type { Student, Class, Attendance } from '../../types';

export default function ParentStats() {
  const navigate = useNavigate();
  const { parentData } = useAuth();

  const [children, setChildren] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!parentData) return;

    // 자녀 정보 로드
    const loadChildren = async () => {
      const childrenData = await Promise.all(
        parentData.studentIds.map(studentId => studentService.getById(studentId))
      );
      const validChildren = childrenData.filter((student): student is Student => student !== null);
      setChildren(validChildren);
      if (validChildren.length > 0 && !selectedChildId) {
        setSelectedChildId(validChildren[0].id);
      }
      setIsLoading(false);
    };

    loadChildren();

    // 클래스 구독
    const unsubClasses = classService.subscribe(setClasses);

    // 출석 구독
    const unsubAttendance = attendanceService.subscribeAll((allAttendances) => {
      const childAttendances = allAttendances.filter(a =>
        parentData.studentIds.includes(a.studentId)
      );
      setAttendances(childAttendances);
    });

    return () => {
      unsubClasses();
      unsubAttendance();
    };
  }, [parentData]);

  // 선택된 자녀
  const selectedChild = children.find(c => c.id === selectedChildId);

  // 선택된 자녀의 클래스
  const childClasses = useMemo(() => {
    if (!selectedChildId) return [];
    return classes.filter(c => c.studentIds.includes(selectedChildId));
  }, [classes, selectedChildId]);

  // 선택된 자녀의 해당 월 출석 기록 (중복 제거)
  const monthlyAttendances = useMemo(() => {
    if (!selectedChildId) return [];
    const filtered = attendances.filter(a => {
      if (a.studentId !== selectedChildId) return false;
      const date = new Date(a.date);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
    return deduplicateAttendances(filtered);
  }, [attendances, selectedChildId, selectedMonth, selectedYear]);

  // 출석 통계
  const stats = useMemo(() => {
    const total = monthlyAttendances.length;
    const present = monthlyAttendances.filter(a => a.status === 'present').length;
    const late = monthlyAttendances.filter(a => a.status === 'late').length;
    const absent = monthlyAttendances.filter(a => a.status === 'absent').length;
    const excused = monthlyAttendances.filter(a => a.status === 'excused').length;
    const rate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0;

    return { total, present, late, absent, excused, rate };
  }, [monthlyAttendances]);

  // 수업별 출석률
  const classStats = useMemo(() => {
    return childClasses.map(cls => {
      const classAttendances = monthlyAttendances.filter(a => a.classId === cls.id);
      const total = classAttendances.length;
      const present = classAttendances.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'excused').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return { ...cls, total, present, rate };
    });
  }, [childClasses, monthlyAttendances]);

  // 최근 출석 기록
  const recentAttendances = useMemo(() => {
    if (!selectedChildId) return [];
    return attendances
      .filter(a => a.studentId === selectedChildId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [attendances, selectedChildId]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present': return '출석';
      case 'late': return '지각';
      case 'absent': return '결석';
      case 'excused': return '공결';
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'present': return 'status-present';
      case 'late': return 'status-late';
      case 'absent': return 'status-absent';
      case 'excused': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="px-1">
        {/* 헤더 */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/parent')}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-primary">출석 통계</h1>
        </header>

        {/* 자녀 선택 */}
        {children.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedChildId === child.id
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}

        {/* 월 선택 */}
        <div className="flex items-center justify-between bg-white rounded-xl p-3 mb-4 shadow-sm">
          <button
            onClick={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-bold text-gray-900">
            {selectedYear}년 {selectedMonth + 1}월
          </h3>
          <button
            onClick={() => {
              if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 종합 출석률 */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 mb-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <p className="text-white/80 text-sm mb-1">{selectedChild?.name}님의 출석률</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-bold text-white">{stats.rate}</span>
              <span className="text-2xl text-white/70 mb-1">%</span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/20">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{stats.present}</p>
                <p className="text-xs text-white/70">출석</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{stats.late}</p>
                <p className="text-xs text-white/70">지각</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{stats.absent}</p>
                <p className="text-xs text-white/70">결석</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{stats.excused}</p>
                <p className="text-xs text-white/70">공결</p>
              </div>
            </div>
          </div>
        </div>

        {/* 수업별 출석률 */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-primary mb-3">수업별 출석률</h2>
          <div className="space-y-2">
            {classStats.length > 0 ? (
              classStats.map((cls) => (
                <div key={cls.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{cls.name}</h3>
                    <span className="text-lg font-bold text-green-600">{cls.rate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${cls.rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {cls.present}/{cls.total}회 출석
                  </p>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <p className="text-gray-500">등록된 수업이 없습니다</p>
              </div>
            )}
          </div>
        </section>

        {/* 최근 출석 기록 */}
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">최근 출석 기록</h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {recentAttendances.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentAttendances.map((attendance) => {
                  const cls = classes.find(c => c.id === attendance.classId);
                  return (
                    <div key={attendance.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{cls?.name || '알 수 없는 수업'}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(attendance.date).toLocaleDateString('ko-KR', {
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                          {attendance.checkInTime && ` · ${attendance.checkInTime}`}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${getStatusClass(attendance.status)}`}>
                        {getStatusText(attendance.status)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">출석 기록이 없습니다</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </ParentLayout>
  );
}
