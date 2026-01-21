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
    // 데이터가 없으면 기본값 반환
    if (!data || data.length === 0) {
      const defaultHours: TimeData[] = [];
      for (let h = 8; h <= 20; h++) {
        defaultHours.push({ hour: h, count: 0, presentCount: 0, lateCount: 0 });
      }
      return {
        hours: defaultHours,
        maxCount: 1,
        totalCount: 0,
        peakHour: { hour: 0, count: 0, presentCount: 0, lateCount: 0 },
        avgTime: '--:--'
      };
    }

    // Filter to only hours with data, but ensure at least 6-22 range
    const hoursWithData = data.filter(d => d.count > 0).map(d => d.hour);
    const minHour = hoursWithData.length > 0 ? Math.min(...hoursWithData, 6) : 8;
    const maxHour = hoursWithData.length > 0 ? Math.max(...hoursWithData, 22) : 20;

    const filteredData: TimeData[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      const existing = data.find(d => d.hour === h);
      filteredData.push(existing || { hour: h, count: 0, presentCount: 0, lateCount: 0 });
    }

    const maxCount = Math.max(...filteredData.map(d => d.count), 1);
    const totalCount = filteredData.reduce((sum, d) => sum + d.count, 0);
    const defaultPeak = { hour: 0, count: 0, presentCount: 0, lateCount: 0 };
    const peakHour = filteredData.length > 0
      ? filteredData.reduce((peak, d) => d.count > peak.count ? d : peak, filteredData[0])
      : defaultPeak;

    // Calculate average check-in time
    let totalMinutes = 0;
    let totalCheckIns = 0;
    filteredData.forEach(d => {
      totalMinutes += d.hour * 60 * d.count;
      totalCheckIns += d.count;
    });
    const avgMinutes = totalCheckIns > 0 ? totalMinutes / totalCheckIns : 0;
    const avgHour = Math.floor(avgMinutes / 60);
    const avgMin = Math.round(avgMinutes % 60);

    return {
      hours: filteredData,
      maxCount,
      totalCount,
      peakHour,
      avgTime: totalCheckIns > 0 ? `${avgHour.toString().padStart(2, '0')}:${avgMin.toString().padStart(2, '0')}` : '--:--'
    };
  }, [data]);

  const scheduledHour = scheduledTime ? parseInt(scheduledTime.split(':')[0], 10) : null;

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              피크: <span className="font-medium text-indigo-600">
                {chartData.peakHour && chartData.peakHour.count > 0 ? `${chartData.peakHour.hour}시` : '-'}
              </span>
            </span>
            <span className="text-gray-500">
              평균: <span className="font-medium text-gray-700">{chartData.avgTime}</span>
            </span>
          </div>
        </div>
      )}

      {/* Timeline visualization */}
      <div className="relative">
        {/* Hour bars */}
        <div className="flex items-end gap-0.5 h-24 mb-2">
          {chartData.hours.map((hourData, i) => {
            const heightPercent = chartData.maxCount > 0
              ? (hourData.count / chartData.maxCount) * 100
              : 0;
            const isScheduled = scheduledHour !== null && hourData.hour === scheduledHour;
            const isPeak = chartData.peakHour && hourData.hour === chartData.peakHour.hour && hourData.count > 0;
            const presentPercent = hourData.count > 0 ? (hourData.presentCount / hourData.count) * 100 : 0;

            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                {/* Tooltip */}
                {hourData.count > 0 && (
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      <div className="font-medium">{hourData.hour}:00</div>
                      <div>출석: {hourData.presentCount}</div>
                      <div>지각: {hourData.lateCount}</div>
                    </div>
                  </div>
                )}

                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all relative overflow-hidden ${
                    isScheduled ? 'ring-2 ring-indigo-400 ring-offset-1' :
                    isPeak ? 'ring-1 ring-green-400' : ''
                  }`}
                  style={{
                    height: `${Math.max(heightPercent, hourData.count > 0 ? 8 : 2)}%`,
                    backgroundColor: hourData.count === 0 ? '#e5e7eb' : '#6366f1'
                  }}
                >
                  {/* Present portion */}
                  {hourData.count > 0 && (
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-green-500"
                      style={{ height: `${presentPercent}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hour labels */}
        <div className="flex gap-0.5">
          {chartData.hours.map((hourData, i) => {
            const isScheduled = scheduledHour !== null && hourData.hour === scheduledHour;
            return (
              <div
                key={i}
                className={`flex-1 text-center text-xs ${
                  isScheduled ? 'font-bold text-indigo-600' :
                  hourData.count > 0 ? 'text-gray-600' : 'text-gray-300'
                }`}
              >
                {hourData.hour}
              </div>
            );
          })}
        </div>

        {/* Scheduled time indicator */}
        {scheduledTime && (
          <div className="mt-2 text-xs text-center text-gray-500">
            수업 시작: <span className="font-medium text-indigo-600">{scheduledTime}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-gray-500">정시 출석</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span className="text-gray-500">지각</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-lg font-bold text-gray-700">{chartData.totalCount}</div>
          <div className="text-xs text-gray-500">총 체크인</div>
        </div>
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <div className="text-lg font-bold text-green-600">
            {chartData.peakHour && chartData.peakHour.count > 0 ? `${chartData.peakHour.hour}시` : '-'}
          </div>
          <div className="text-xs text-green-700">피크 시간</div>
        </div>
        <div className="text-center p-2 bg-indigo-50 rounded-lg">
          <div className="text-lg font-bold text-indigo-600">{chartData.avgTime}</div>
          <div className="text-xs text-indigo-700">평균 체크인</div>
        </div>
      </div>
    </div>
  );
}
