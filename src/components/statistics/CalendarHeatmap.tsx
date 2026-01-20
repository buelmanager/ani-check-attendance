import { useMemo } from 'react';

interface CalendarHeatmapProps {
  data: { date: string; value: number; status?: string }[];
  startDate?: Date;
  endDate?: Date;
  colorScale?: string[];
  onDateClick?: (date: string, value: number) => void;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

// 출석률에 따른 색상 (0-100%)
const getColorByRate = (rate: number): string => {
  if (rate === -1) return '#f3f4f6'; // 데이터 없음 (회색)
  if (rate >= 90) return '#22c55e'; // 90% 이상 (진한 초록)
  if (rate >= 80) return '#4ade80'; // 80-90% (초록)
  if (rate >= 70) return '#86efac'; // 70-80% (연한 초록)
  if (rate >= 50) return '#fde047'; // 50-70% (노란색)
  if (rate >= 30) return '#fb923c'; // 30-50% (주황)
  if (rate > 0) return '#f87171';   // 0-30% (빨강)
  return '#f3f4f6'; // 0% 또는 데이터 없음
};

export default function CalendarHeatmap({
  data,
  startDate,
  endDate,
  onDateClick
}: CalendarHeatmapProps) {
  // 기본값: 최근 3개월
  const { start, end } = useMemo(() => {
    const e = endDate || new Date();
    const s = startDate || new Date(e.getFullYear(), e.getMonth() - 2, 1);
    return { start: s, end: e };
  }, [startDate, endDate]);

  // 날짜별 데이터 맵 생성
  const dataMap = useMemo(() => {
    const map = new Map<string, { value: number; status?: string }>();
    data.forEach(d => {
      map.set(d.date, { value: d.value, status: d.status });
    });
    return map;
  }, [data]);

  // 월별 주 데이터 생성
  const months = useMemo(() => {
    const result: {
      month: number;
      year: number;
      weeks: { date: Date; dateStr: string; value: number; isCurrentMonth: boolean }[][];
    }[] = [];

    let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);

    while (currentDate <= end) {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      const weeks: { date: Date; dateStr: string; value: number; isCurrentMonth: boolean }[][] = [];

      // 월의 첫 날로 이동
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // 첫 주의 시작 (일요일부터)
      const weekStart = new Date(firstDay);
      weekStart.setDate(firstDay.getDate() - firstDay.getDay());

      let week: { date: Date; dateStr: string; value: number; isCurrentMonth: boolean }[] = [];
      const tempDate = new Date(weekStart);

      while (tempDate <= lastDay || week.length > 0) {
        const dateStr = tempDate.toISOString().split('T')[0];
        const isCurrentMonth = tempDate.getMonth() === month;
        const dayData = dataMap.get(dateStr);

        week.push({
          date: new Date(tempDate),
          dateStr,
          value: dayData?.value ?? -1,
          isCurrentMonth
        });

        if (week.length === 7) {
          weeks.push(week);
          week = [];
          if (tempDate > lastDay) break;
        }

        tempDate.setDate(tempDate.getDate() + 1);
      }

      result.push({ month, year, weeks });
      currentDate = new Date(year, month + 1, 1);
    }

    return result;
  }, [start, end, dataMap]);

  return (
    <div className="w-full">
      {/* 범례 */}
      <div className="flex items-center justify-end gap-2 mb-4 text-xs text-gray-500">
        <span>낮음</span>
        <div className="flex gap-0.5">
          {['#f87171', '#fb923c', '#fde047', '#86efac', '#4ade80', '#22c55e'].map((color, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span>높음</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100 ml-2" />
        <span>데이터 없음</span>
      </div>

      {/* 캘린더 히트맵 */}
      <div className="flex gap-6 overflow-x-auto pb-2">
        {months.map(({ month, year, weeks }) => (
          <div key={`${year}-${month}`} className="flex-shrink-0">
            <div className="text-sm font-medium text-gray-700 mb-2">
              {MONTH_LABELS[month]} {year !== new Date().getFullYear() && year}
            </div>

            <div className="flex gap-1">
              {/* 요일 라벨 */}
              <div className="flex flex-col gap-1 mr-1">
                {WEEKDAY_LABELS.map((day, i) => (
                  <div
                    key={day}
                    className={`w-3 h-5 text-[10px] flex items-center justify-center ${
                      i === 0 || i === 6 ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    {i % 2 === 1 ? day : ''}
                  </div>
                ))}
              </div>

              {/* 주별 셀 */}
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <div
                      key={day.dateStr}
                      className={`w-5 h-5 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-indigo-300 ${
                        !day.isCurrentMonth ? 'opacity-30' : ''
                      }`}
                      style={{ backgroundColor: getColorByRate(day.value) }}
                      title={`${day.dateStr}: ${day.value >= 0 ? `${day.value}%` : '데이터 없음'}`}
                      onClick={() => day.isCurrentMonth && onDateClick?.(day.dateStr, day.value)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
