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

    const maxRate = Math.max(...fullData.map(d => d.attendanceRate), 100);
    const avgRate = fullData.filter(d => d.total > 0).reduce((sum, d) => sum + d.attendanceRate, 0) /
                   (fullData.filter(d => d.total > 0).length || 1);

    return {
      days: fullData,
      maxRate,
      avgRate
    };
  }, [data]);

  // Find best and worst days
  const bestDay = useMemo(() => {
    const daysWithData = chartData.days.filter(d => d.total > 0);
    if (daysWithData.length === 0) return null;
    return daysWithData.reduce((best, d) => d.attendanceRate > best.attendanceRate ? d : best);
  }, [chartData.days]);

  const worstDay = useMemo(() => {
    const daysWithData = chartData.days.filter(d => d.total > 0);
    if (daysWithData.length === 0) return null;
    return daysWithData.reduce((worst, d) => d.attendanceRate < worst.attendanceRate ? d : worst);
  }, [chartData.days]);

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          <span className="text-xs text-gray-500">평균: {chartData.avgRate.toFixed(1)}%</span>
        </div>
      )}

      {/* Radar-style visualization */}
      <div className="flex items-center gap-6">
        {/* Bar chart */}
        <div className="flex-1">
          <div className="flex items-end justify-between gap-2 h-32">
            {chartData.days.map((day, i) => {
              const heightPercent = chartData.maxRate > 0
                ? (day.attendanceRate / chartData.maxRate) * 100
                : 0;
              const isBest = bestDay && day.day === bestDay.day && day.total > 0;
              const isWorst = worstDay && day.day === worstDay.day && day.total > 0 && !isBest;

              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className="relative w-full flex justify-center mb-1">
                    {day.total > 0 && (
                      <span className={`text-xs font-medium ${
                        day.attendanceRate >= 90 ? 'text-green-600' :
                        day.attendanceRate >= 80 ? 'text-indigo-600' :
                        'text-red-600'
                      }`}>
                        {day.attendanceRate.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div
                    className={`w-full max-w-8 rounded-t-md transition-all ${
                      isBest ? 'bg-green-500' :
                      isWorst ? 'bg-red-400' :
                      day.total === 0 ? 'bg-gray-200' :
                      'bg-indigo-500'
                    }`}
                    style={{
                      height: `${Math.max(heightPercent, 4)}%`,
                      opacity: day.total === 0 ? 0.3 : 1
                    }}
                  />
                  <span className={`text-xs mt-2 ${
                    i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {day.dayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="w-32 space-y-2">
          {bestDay && (
            <div className="p-2 bg-green-50 rounded-lg">
              <div className="text-xs text-green-600 font-medium">최고</div>
              <div className="text-lg font-bold text-green-700">{bestDay.dayName}요일</div>
              <div className="text-xs text-green-600">{bestDay.attendanceRate.toFixed(1)}%</div>
            </div>
          )}
          {worstDay && bestDay !== worstDay && (
            <div className="p-2 bg-red-50 rounded-lg">
              <div className="text-xs text-red-600 font-medium">최저</div>
              <div className="text-lg font-bold text-red-700">{worstDay.dayName}요일</div>
              <div className="text-xs text-red-600">{worstDay.attendanceRate.toFixed(1)}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {chartData.days.map((day, i) => (
          <div
            key={i}
            className={`text-center p-2 rounded-lg ${
              day.total === 0 ? 'bg-gray-50' :
              day.attendanceRate >= 90 ? 'bg-green-50' :
              day.attendanceRate >= 80 ? 'bg-indigo-50' :
              'bg-red-50'
            }`}
          >
            <div className={`text-xs ${i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500'}`}>
              {day.dayName}
            </div>
            {day.total > 0 ? (
              <>
                <div className="text-xs font-medium text-gray-700">{day.present}/{day.total}</div>
                <div className="text-xs text-gray-400">지각 {day.late}</div>
              </>
            ) : (
              <div className="text-xs text-gray-300">-</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
