interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export default function DonutChart({
  data,
  size = 160,
  strokeWidth = 24,
  centerLabel,
  centerValue
}: DonutChartProps) {
  // 데이터가 없거나 유효하지 않으면 빈 차트 렌더링
  if (!data || data.length === 0) {
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - strokeWidth) / 2}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-2xl font-bold text-gray-900">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-xs text-gray-500">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + (item?.value ?? 0), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={strokeWidth}
        />
        {/* Data segments */}
        {data.map((item, index) => {
          const percentage = total > 0 ? item.value / total : 0;
          const strokeDasharray = circumference;
          const strokeDashoffset = circumference * (1 - percentage);
          const rotation = accumulatedPercentage * 360;
          accumulatedPercentage += percentage;

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
            />
          );
        })}
      </svg>
      {/* Center label */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue !== undefined && (
            <span className="text-2xl font-bold text-gray-900">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-xs text-gray-500">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function DonutChartLegend({ data }: { data: DonutChartData[] }) {
  // 데이터가 없으면 빈 div 반환
  if (!data || data.length === 0) return <div />;

  const total = data.reduce((sum, item) => sum + (item?.value ?? 0), 0);

  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-gray-600">{item.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{item.value}</span>
            <span className="text-xs text-gray-400">
              ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
