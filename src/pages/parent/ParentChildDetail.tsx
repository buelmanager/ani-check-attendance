import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ParentLayout } from '../../components/parent/ParentLayout';
import { studentService } from '../../services/studentService';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import type { Student, Class, Attendance } from '../../types';

export default function ParentChildDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { parentData } = useAuth();

  const [child, setChild] = useState<Student | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!id || !parentData) return;

    // 권한 확인
    if (!parentData.studentIds.includes(id)) {
      navigate('/parent');
      return;
    }

    // 자녀 정보 로드
    const loadChild = async () => {
      const student = await studentService.getById(id);
      setChild(student);
      setIsLoading(false);
    };

    loadChild();

    // 클래스 구독
    const unsubClasses = classService.subscribe((allClasses) => {
      const childClasses = allClasses.filter(c => c.studentIds.includes(id));
      setClasses(childClasses);
    });

    // 출석 구독 (전체)
    const unsubAttendance = attendanceService.subscribeAll((allAttendances) => {
      const childAttendances = allAttendances.filter(a => a.studentId === id);
      setAttendances(childAttendances);
    });

    return () => {
      unsubClasses();
      unsubAttendance();
    };
  }, [id, parentData, navigate]);

  // 선택된 월의 출석 기록
  const monthlyAttendances = attendances.filter(a => {
    const date = new Date(a.date);
    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  });

  // 출석 통계
  const stats = {
    total: monthlyAttendances.length,
    present: monthlyAttendances.filter(a => a.status === 'present').length,
    late: monthlyAttendances.filter(a => a.status === 'late').length,
    absent: monthlyAttendances.filter(a => a.status === 'absent').length,
    excused: monthlyAttendances.filter(a => a.status === 'excused').length,
  };

  const attendanceRate = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  // 캘린더 데이터 생성
  const generateCalendar = () => {
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'late': return 'bg-yellow-500';
      case 'absent': return 'bg-red-500';
      case 'excused': return 'bg-blue-500';
      default: return 'bg-gray-300';
    }
  };

  if (isLoading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ParentLayout>
    );
  }

  if (!child) {
    return (
      <ParentLayout>
        <div className="p-4 text-center">
          <p className="text-gray-500">학생 정보를 찾을 수 없습니다.</p>
        </div>
      </ParentLayout>
    );
  }

  const calendar = generateCalendar();

  return (
    <ParentLayout>
      <div className="p-4 space-y-6">
        {/* 뒤로가기 */}
        <button
          onClick={() => navigate('/parent')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          뒤로
        </button>

        {/* 자녀 정보 */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold">{child.name.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold">{child.name}</h2>
              <p className="text-white/80 text-sm">{classes.length}개 수업 수강 중</p>
            </div>
          </div>
        </div>

        {/* 출석 통계 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">출석률</p>
            <p className="text-2xl font-bold text-green-600">{attendanceRate}%</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">총 출석</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}회</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">출석/지각</p>
            <p className="text-2xl font-bold">
              <span className="text-green-600">{stats.present}</span>
              <span className="text-gray-300">/</span>
              <span className="text-yellow-600">{stats.late}</span>
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">결석/사유</p>
            <p className="text-2xl font-bold">
              <span className="text-red-600">{stats.absent}</span>
              <span className="text-gray-300">/</span>
              <span className="text-blue-600">{stats.excused}</span>
            </p>
          </div>
        </div>

        {/* 월 선택 */}
        <div className="flex items-center justify-between">
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

        {/* 캘린더 */}
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
                        {day.attendances.slice(0, 2).map((a, i) => (
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
              사유
            </div>
          </div>
        </div>

        {/* 수강 중인 수업 */}
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-3">수강 중인 수업</h3>
          <div className="space-y-2">
            {classes.map((cls) => (
              <div key={cls.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{cls.name}</h4>
                    <p className="text-sm text-gray-500">{cls.schedule} {cls.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ParentLayout>
  );
}
