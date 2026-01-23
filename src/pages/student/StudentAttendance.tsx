import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/student/StudentLayout';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import { deduplicateAttendances } from '../../services/statisticsService';
import type { Class, Attendance } from '../../types';

export default function StudentAttendance() {
  const navigate = useNavigate();
  const { studentData } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!studentData) return;

    // 클래스 구독
    const unsubClasses = classService.subscribe((allClasses) => {
      const myClasses = allClasses.filter(c => c.studentIds.includes(studentData.id));
      setClasses(myClasses);
      setIsLoading(false);
    });

    // 출석 구독
    const unsubAttendance = attendanceService.subscribeAll((allAttendances) => {
      const myAttendances = allAttendances.filter(a => a.studentId === studentData.id);
      setAttendances(myAttendances);
    });

    return () => {
      unsubClasses();
      unsubAttendance();
    };
  }, [studentData]);

  // 해당 월 출석 기록 (중복 제거)
  const monthlyAttendances = useMemo(() => {
    let filtered = attendances.filter(a => {
      const date = new Date(a.date);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    // 수업 필터
    if (selectedClassId) {
      filtered = filtered.filter(a => a.classId === selectedClassId);
    }

    return deduplicateAttendances(filtered);
  }, [attendances, selectedMonth, selectedYear, selectedClassId]);

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

  // 캘린더 데이터 생성
  const calendar = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const days = [];

    // 첫 주 빈 칸
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // 날짜
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const dayAttendances = monthlyAttendances.filter(a => a.date === dateStr);
      days.push({ date: d, dateStr, attendances: dayAttendances });
    }

    return days;
  }, [selectedYear, selectedMonth, monthlyAttendances]);

  // 날짜별로 그룹화된 출석 기록
  const groupedAttendances = useMemo(() => {
    const sorted = [...monthlyAttendances].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const grouped: Record<string, Attendance[]> = {};
    sorted.forEach(att => {
      if (!grouped[att.date]) {
        grouped[att.date] = [];
      }
      grouped[att.date].push(att);
    });

    return grouped;
  }, [monthlyAttendances]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'late': return 'bg-yellow-500';
      case 'absent': return 'bg-red-500';
      case 'excused': return 'bg-blue-500';
      default: return 'bg-gray-300';
    }
  };

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
        {/* 헤더 */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/student')}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-primary">출석 기록</h1>
        </header>

        {/* 수업 필터 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedClassId(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedClassId === null
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedClassId === cls.id
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>

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

        {/* 출석 통계 카드 */}
        <div className="gradient-primary rounded-2xl p-6 mb-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <p className="text-white/80 text-sm mb-1">이번 달 출석률</p>
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

        {/* 캘린더 */}
        <section className="mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendar.map((day, index) => (
                <div
                  key={index}
                  className={`aspect-square p-1 text-center ${
                    day ? 'hover:bg-gray-50' : ''
                  }`}
                >
                  {day && (
                    <>
                      <span className="text-sm text-gray-700">{day.date}</span>
                      {day.attendances.length > 0 && (
                        <div className="flex justify-center gap-0.5 mt-1">
                          {day.attendances.slice(0, 3).map((a, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${getStatusColor(a.status)}`}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* 범례 */}
            <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                출석
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                지각
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                결석
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                공결
              </div>
            </div>
          </div>
        </section>

        {/* 출석 기록 목록 */}
        <section>
          <h2 className="text-lg font-bold text-primary mb-3">상세 기록</h2>
          <div className="space-y-3">
            {Object.entries(groupedAttendances).length > 0 ? (
              Object.entries(groupedAttendances).map(([date, dayAttendances]) => (
                <div key={date} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-600">
                      {new Date(date).toLocaleDateString('ko-KR', {
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short'
                      })}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayAttendances.map((attendance) => {
                      const cls = classes.find(c => c.id === attendance.classId);
                      return (
                        <div key={attendance.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{cls?.name || '알 수 없는 수업'}</p>
                            {attendance.checkInTime && (
                              <p className="text-sm text-gray-500">{attendance.checkInTime} 체크인</p>
                            )}
                          </div>
                          <span className={`text-xs font-medium px-3 py-1 rounded-full ${getStatusClass(attendance.status)}`}>
                            {getStatusText(attendance.status)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <p className="text-gray-500">이번 달 출석 기록이 없습니다</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </StudentLayout>
  );
}
