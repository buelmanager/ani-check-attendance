import { useMemo } from 'react';

interface TimeData {
  hour: number;
  count: number;
  presentCount: number;
  lateCount: number;
}

interface TimeDistributionChartProps {
  data: TimeData[];
  title?: string;
  scheduledTime?: string; // e.g., "14:00"
}

export default function TimeDistributionChart({
  data,
  title = '시간대별 출석 분포',
  scheduledTime
}: TimeDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        hours: [],
        totalCount: 0,
        peakHour: null,
        avgTime: '--:--',
        presentTotal: 0,
        lateTotal: 0
      };
    }

    // 데이터가 있는 시간대만 필터링
    const hoursWithData = data.filter(d => d.count > 0);

    // 총계 계산
    const totalCount = hoursWithData.reduce((sum, d) => sum + d.count, 0);
    const presentTotal = hoursWithData.reduce((sum, d) => sum + d.presentCount, 0);
    const lateTotal = hoursWithData.reduce((sum, d) => sum + d.lateCount, 0);

    // 피크 시간 찾기
    const peakHour = hoursWithData.length > 0
      ? hoursWithData.reduce((peak, d) => d.count > peak.count ? d : peak, hoursWithData[0])
      : null;

    // 평균 체크인 시간 계산
    let totalMinutes = 0;
    let totalCheckIns = 0;
    hoursWithData.forEach(d => {
      totalMinutes += d.hour * 60 * d.count;
      totalCheckIns += d.count;
    });
    const avgMinutes = totalCheckIns > 0 ? totalMinutes / totalCheckIns : 0;
    const avgHour = Math.floor(avgMinutes / 60);
    const avgMin = Math.round(avgMinutes % 60);

    return {
      hours: hoursWithData.sort((a, b) => a.hour - b.hour),
      totalCount,
      peakHour,
      avgTime: totalCheckIns > 0 ? `${avgHour.toString().padStart(2, '0')}:${avgMin.toString().padStart(2, '0')}` : '--:--',
      presentTotal,
      lateTotal
    };
  }, [data]);

  if (chartData.totalCount === 0) {
    return (
      <div>
        {title && <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>}
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          출석 데이터가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>
      )}

      {/* 메인 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-indigo-600">{chartData.peakHour?.hour || '-'}시</div>
          <div className="text-xs text-indigo-700 mt-1">가장 많이 출석한 시간</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{chartData.avgTime}</div>
          <div className="text-xs text-green-700 mt-1">평균 체크인 시간</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-700">{chartData.totalCount}회</div>
          <div className="text-xs text-gray-500 mt-1">총 체크인</div>
        </div>
      </div>

      {/* 시간대별 출석 현황 리스트 */}
      <div className="space-y-2">
        {chartData.hours.map((hourData, i) => {
          const percentage = chartData.totalCount > 0
            ? Math.round((hourData.count / chartData.totalCount) * 100)
            : 0;
          const isPeak = chartData.peakHour && hourData.hour === chartData.peakHour.hour;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                isPeak ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-gray-50'
              }`}
            >
              {/* 시간 */}
              <div className={`w-12 text-center font-bold ${isPeak ? 'text-indigo-600' : 'text-gray-700'}`}>
                {hourData.hour}시
              </div>

              {/* 막대 그래프 */}
              <div className="flex-1">
                <div className="h-6 bg-white rounded-full overflow-hidden flex">
                  {/* 정시 출석 */}
                  {hourData.presentCount > 0 && (
                    <div
                      className="h-full bg-green-500 flex items-center justify-center"
                      style={{ width: `${(hourData.presentCount / hourData.count) * percentage}%`, minWidth: hourData.presentCount > 0 ? '20px' : 0 }}
                    >
                      {hourData.presentCount >= 2 && (
                        <span className="text-xs text-white font-medium">{hourData.presentCount}</span>
                      )}
                    </div>
                  )}
                  {/* 지각 */}
                  {hourData.lateCount > 0 && (
                    <div
                      className="h-full bg-yellow-500 flex items-center justify-center"
                      style={{ width: `${(hourData.lateCount / hourData.count) * percentage}%`, minWidth: hourData.lateCount > 0 ? '20px' : 0 }}
                    >
                      {hourData.lateCount >= 2 && (
                        <span className="text-xs text-white font-medium">{hourData.lateCount}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 횟수 */}
              <div className="w-16 text-right">
                <span className={`font-bold ${isPeak ? 'text-indigo-600' : 'text-gray-700'}`}>
                  {hourData.count}회
                </span>
                <span className="text-xs text-gray-400 ml-1">({percentage}%)</span>
              </div>

              {/* 피크 표시 */}
              {isPeak && (
                <div className="text-indigo-500 text-xs font-medium">PEAK</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-sm text-gray-600">정시 출석 ({chartData.presentTotal}회)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span className="text-sm text-gray-600">지각 ({chartData.lateTotal}회)</span>
        </div>
      </div>

      {/* 수업 시간 표시 */}
      {scheduledTime && (
        <div className="mt-3 text-center text-sm text-gray-500">
          수업 시작 시간: <span className="font-semibold text-indigo-600">{scheduledTime}</span>
        </div>
      )}
    </div>
  );
}
