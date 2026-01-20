interface BarChartData {
  label: string;
  value: number;
  subLabel?: string;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
  barColor?: string;
}

export default function BarChart({
  data,
  maxValue,
  height = 160,
  showValues = true,
  barColor = 'bg-accent'
}: BarChartProps) {
  // 데이터가 없거나 유효하지 않으면 null 반환
  if (!data || data.length === 0) return null;

  // 유효한 값들만 계산에 사용
  const validValues = data.map(d => d?.value ?? 0).filter(v => !isNaN(v));
  const max = maxValue || Math.max(...validValues, 1);

  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full">
          {showValues && (
            <span className="text-xs font-medium text-gray-600">
              {item.value}%
            </span>
          )}
          <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden flex-1 flex flex-col justify-end">
            <div
              className={`${item.color || barColor} transition-all duration-500 rounded-t-lg`}
              style={{ height: `${(item.value / max) * 100}%` }}
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-gray-700">{item.label}</p>
            {item.subLabel && (
              <p className="text-xs text-gray-400">{item.subLabel}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
