interface MonthlyData {
  month: string;
  attendanceRate: number;
  present: number;
  late: number;
  absent: number;
  total: number;
}

interface MonthlyTrendChartProps {
  data: MonthlyData[];
  title?: string;
  height?: number;
}

export default function MonthlyTrendChart({
  data,
  title = '월별 출석 추세',
  height = 200
}: MonthlyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        데이터가 없습니다
      </div>
    );
  }

  // 평균 계산
  const avgRate = data.reduce((sum, d) => sum + d.attendanceRate, 0) / data.length;

  // 색상 결정 함수
  const getBarColor = (rate: number) => {
    if (rate >= 90) return { bg: 'bg-green-500', text: 'text-green-600' };
    if (rate >= 80) return { bg: 'bg-blue-500', text: 'text-blue-600' };
    if (rate >= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-600' };
    return { bg: 'bg-red-500', text: 'text-red-600' };
  };

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          <span className="text-xs text-gray-500">
            평균: <span className="font-semibold text-gray-700">{avgRate.toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* 막대 차트 */}
      <div className="space-y-3" style={{ minHeight: height }}>
        {data.map((d, i) => {
          const colors = getBarColor(d.attendanceRate);
          return (
            <div key={i} className="flex items-center gap-3">
              {/* 월 라벨 */}
              <div className="w-14 text-sm font-medium text-gray-600 text-right">
                {d.month}
              </div>

              {/* 막대 */}
              <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                <div
                  className={`h-full ${colors.bg} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max(d.attendanceRate, 5)}%` }}
                >
                  {d.attendanceRate >= 30 && (
                    <span className="text-xs font-bold text-white">
                      {d.attendanceRate.toFixed(0)}%
                    </span>
                  )}
                </div>
                {d.attendanceRate < 30 && (
                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold ${colors.text}`}>
                    {d.attendanceRate.toFixed(0)}%
                  </span>
                )}
              </div>

              {/* 출석 수 */}
              <div className="w-16 text-xs text-gray-500 text-right">
                {d.present + d.late}/{d.total}회
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-xs text-gray-500">90% 이상</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-xs text-gray-500">80~89%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-yellow-500 rounded" />
          <span className="text-xs text-gray-500">70~79%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-xs text-gray-500">70% 미만</span>
        </div>
      </div>
    </div>
  );
}
