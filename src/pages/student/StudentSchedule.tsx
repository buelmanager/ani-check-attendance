import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/student/StudentLayout';
import { classService } from '../../services/classService';
import type { Class } from '../../types';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function StudentSchedule() {
  const { studentData } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentData) return;

    const unsub = classService.subscribe((allClasses) => {
      const myClasses = allClasses.filter(c => c.studentIds.includes(studentData.id));
      setClasses(myClasses);
      setIsLoading(false);
    });

    return unsub;
  }, [studentData]);

  // 요일별 수업 그룹화
  const scheduleByDay = DAYS.map(day => ({
    day,
    classes: classes.filter(c => c.schedule.includes(day))
      .sort((a, b) => a.time.localeCompare(b.time))
  }));

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
      <div className="p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">주간 스케줄</h2>

        {classes.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500">등록된 수업이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scheduleByDay.map(({ day, classes: dayClasses }) => (
              <div key={day} className="bg-white rounded-xl overflow-hidden shadow-sm">
                <div className={`px-4 py-2 font-semibold ${
                  dayClasses.length > 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {day}요일
                </div>
                {dayClasses.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    수업 없음
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {dayClasses.map((cls) => (
                      <div key={cls.id} className="p-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{cls.name}</h4>
                          <p className="text-sm text-gray-500">{cls.schedule}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-blue-600">{cls.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 내 수업 목록 */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-3">내 수업 목록</h3>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {classes.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                등록된 수업이 없습니다
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {classes.map((cls) => (
                  <div key={cls.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{cls.name}</h4>
                      <span className="text-sm text-blue-600 font-medium">{cls.time}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cls.schedule.split(',').map((day, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                        >
                          {day.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
