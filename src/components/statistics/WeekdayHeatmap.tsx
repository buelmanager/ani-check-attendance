interface WeekdayHeatmapProps {
  data: {
    dayOfWeek: number; // 0-6 (일-토)
    hour: number;      // 0-23
    value: number;     // 출석 수 또는 비율
  }[];
  maxValue?: number;
  onCellClick?: (dayOfWeek: number, hour: number) => void;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const getColor = (value: number, max: number): string => {
  if (value === 0) return '#f3f4f6';
  const intensity = value / max;
  if (intensity < 0.2) return '#c7d2fe';
  if (intensity < 0.4) return '#a5b4fc';
  if (intensity < 0.6) return '#818cf8';
  if (intensity < 0.8) return '#6366f1';
  return '#4f46e5';
};

export default function WeekdayHeatmap({
  data,
  maxValue,
  onCellClick
}: WeekdayHeatmapProps) {
  // 데이터 맵 생성
  const dataMap = new Map<string, number>();
  data.forEach(d => {
    dataMap.set(`${d.dayOfWeek}-${d.hour}`, d.value);
  });

  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  // 영업 시간대만 표시 (6시-22시)
  const displayHours = HOURS.filter(h => h >= 6 && h <= 22);

  return (
    <div className="w-full overflow-x-auto">
      {/* 범례 */}
      <div className="flex items-center justify-end gap-2 mb-3 text-xs text-gray-500">
        <span>적음</span>
        <div className="flex gap-0.5">
          {['#f3f4f6', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5'].map((color, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span>많음</span>
      </div>

      <div className="inline-block">
        {/* 시간 헤더 */}
        <div className="flex ml-8">
          {displayHours.map(hour => (
            <div
              key={hour}
              className="w-7 h-6 text-[10px] text-gray-500 text-center"
            >
              {hour}시
            </div>
          ))}
        </div>

        {/* 요일별 행 */}
        {WEEKDAY_LABELS.map((day, dayIdx) => (
          <div key={dayIdx} className="flex items-center">
            <div className={`w-8 text-xs font-medium ${
              dayIdx === 0 || dayIdx === 6 ? 'text-red-400' : 'text-gray-600'
            }`}>
              {day}
            </div>

            {displayHours.map(hour => {
              const value = dataMap.get(`${dayIdx}-${hour}`) || 0;
              return (
                <div
                  key={hour}
                  className="w-7 h-6 m-px rounded cursor-pointer transition-all hover:ring-2 hover:ring-indigo-300"
                  style={{ backgroundColor: getColor(value, max) }}
                  title={`${day}요일 ${hour}시: ${value}건`}
                  onClick={() => onCellClick?.(dayIdx, hour)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 통계 요약 */}
      <div className="mt-4 flex gap-4 text-xs text-gray-600">
        <div>
          <span className="font-medium">피크 시간: </span>
          {(() => {
            if (!data || data.length === 0) return '데이터 없음';
            const validData = data.filter(d => d.value > 0 && typeof d.hour === 'number' && !isNaN(d.hour));
            if (validData.length === 0) return '데이터 없음';
            const peak = validData.reduce((max, d) => d.value > max.value ? d : max, validData[0]);
            return `${WEEKDAY_LABELS[peak.dayOfWeek]} ${peak.hour}시 (${peak.value}건)`;
          })()}
        </div>
        <div>
          <span className="font-medium">총 건수: </span>
          {data.reduce((sum, d) => sum + (d.value || 0), 0)}건
        </div>
      </div>
    </div>
  );
}
