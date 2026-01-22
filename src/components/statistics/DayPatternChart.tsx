import { useMemo } from 'react';

interface DayData {
  day: number; // 0 = Sunday, 1 = Monday, ...
  dayName: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
}

interface DayPatternChartProps {
  data: DayData[];
  title?: string;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function DayPatternChart({
  data,
  title = '요일별 출석 패턴'
}: DayPatternChartProps) {
  const chartData = useMemo(() => {
    // Fill missing days with zero values
    const fullData: DayData[] = DAY_NAMES.map((name, i) => {
      const existing = data.find(d => d.day === i);
      return existing || {
        day: i,
        dayName: name,
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        attendanceRate: 0
      };
    });

    const daysWithData = fullData.filter(d => d.total > 0);
    const avgRate = daysWithData.length > 0
      ? daysWithData.reduce((sum, d) => sum + d.attendanceRate, 0) / daysWithData.length
      : 0;

    return {
      days: fullData,
      avgRate
    };
  }, [data]);

  // Find best and worst days
  const { bestDay, worstDay } = useMemo(() => {
    const daysWithData = chartData.days.filter(d => d.total > 0);
    if (daysWithData.length === 0) return { bestDay: null, worstDay: null };

    const best = daysWithData.reduce((b, d) => d.attendanceRate > b.attendanceRate ? d : b);
    const worst = daysWithData.reduce((w, d) => d.attendanceRate < w.attendanceRate ? d : w);

    return { bestDay: best, worstDay: worst };
  }, [chartData.days]);

  // 색상 결정 함수
  const getColors = (rate: number) => {
    if (rate >= 90) return { bg: 'bg-green-100', bar: 'bg-green-500', text: 'text-green-600' };
    if (rate >= 80) return { bg: 'bg-blue-100', bar: 'bg-blue-500', text: 'text-blue-600' };
    if (rate >= 70) return { bg: 'bg-yellow-100', bar: 'bg-yellow-500', text: 'text-yellow-600' };
    return { bg: 'bg-red-100', bar: 'bg-red-500', text: 'text-red-600' };
  };

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          <span className="text-xs text-gray-500">
            평균: <span className="font-semibold text-gray-700">{chartData.avgRate.toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* 통합된 요일별 카드 */}
      <div className="grid grid-cols-7 gap-2">
        {chartData.days.map((day, i) => {
          const isWeekend = i === 0 || i === 6;
          const colors = day.total > 0 ? getColors(day.attendanceRate) : null;
          const isBest = bestDay && day.day === bestDay.day && day.total > 0;
          const isWorst = worstDay && day.day === worstDay.day && day.total > 0 && bestDay !== worstDay;

          return (
            <div
              key={i}
              className={`relative rounded-xl p-3 text-center transition-all ${
                day.total === 0 ? 'bg-gray-50' : colors?.bg
              } ${isBest ? 'ring-2 ring-green-400' : ''} ${isWorst ? 'ring-2 ring-red-400' : ''}`}
            >
              {/* 요일 */}
              <div className={`text-sm font-bold mb-2 ${
                isWeekend ? 'text-red-500' : 'text-gray-700'
              }`}>
                {day.dayName}
              </div>

              {day.total > 0 ? (
                <>
                  {/* 출석률 막대 */}
                  <div className="h-16 flex items-end justify-center mb-2">
                    <div
                      className={`w-6 ${colors?.bar} rounded-t-md transition-all`}
                      style={{ height: `${Math.max(day.attendanceRate * 0.6, 8)}%` }}
                    />
                  </div>

                  {/* 출석률 */}
                  <div className={`text-lg font-bold ${colors?.text}`}>
                    {day.attendanceRate.toFixed(0)}%
                  </div>

                  {/* 출석 수 */}
                  <div className="text-xs text-gray-500 mt-1">
                    {day.present + day.late}/{day.total}회
                  </div>

                  {/* 지각 표시 (있을 경우만) */}
                  {day.late > 0 && (
                    <div className="text-xs text-yellow-600 mt-0.5">
                      지각 {day.late}
                    </div>
                  )}

                  {/* Best/Worst 뱃지 */}
                  {isBest && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">👍</span>
                    </div>
                  )}
                  {isWorst && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">📌</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-24 flex items-center justify-center">
                  <span className="text-gray-300 text-sm">기록 없음</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 요약 정보 */}
      {(bestDay || worstDay) && (
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          {bestDay && (
            <div className="flex items-center gap-2">
              <span className="text-green-500">👍</span>
              <span className="text-gray-600">최고:</span>
              <span className="font-semibold text-green-600">{bestDay.dayName}요일 {bestDay.attendanceRate.toFixed(0)}%</span>
            </div>
          )}
          {worstDay && bestDay !== worstDay && (
            <div className="flex items-center gap-2">
              <span className="text-red-500">📌</span>
              <span className="text-gray-600">관리필요:</span>
              <span className="font-semibold text-red-600">{worstDay.dayName}요일 {worstDay.attendanceRate.toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
