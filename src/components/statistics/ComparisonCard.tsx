interface ComparisonCardProps {
  title: string;
  current: {
    label: string;
    value: number;
    subValue?: string;
  };
  previous: {
    label: string;
    value: number;
    subValue?: string;
  };
  unit?: string;
  higherIsBetter?: boolean;
}

export default function ComparisonCard({
  title,
  current,
  previous,
  unit = '%',
  higherIsBetter = true
}: ComparisonCardProps) {
  const diff = current.value - previous.value;
  const diffPercent = previous.value !== 0
    ? ((diff / previous.value) * 100).toFixed(1)
    : diff > 0 ? '+∞' : '0';

  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  const isNeutral = diff === 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="text-sm font-medium text-gray-600 mb-3">{title}</div>

      <div className="flex items-stretch gap-4">
        {/* 현재 값 */}
        <div className="flex-1 text-center p-3 bg-indigo-50 rounded-lg">
          <div className="text-xs text-indigo-600 mb-1">{current.label}</div>
          <div className="text-2xl font-bold text-indigo-700">
            {current.value.toFixed(1)}{unit}
          </div>
          {current.subValue && (
            <div className="text-xs text-indigo-500 mt-1">{current.subValue}</div>
          )}
        </div>

        {/* 비교 화살표 */}
        <div className="flex flex-col items-center justify-center">
          <div className={`text-lg ${
            isNeutral ? 'text-gray-400' : isPositive ? 'text-green-500' : 'text-red-500'
          }`}>
            {isNeutral ? '→' : isPositive ? '↑' : '↓'}
          </div>
          <div className={`text-xs font-medium ${
            isNeutral ? 'text-gray-400' : isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}{unit}
          </div>
          <div className="text-[10px] text-gray-400">
            ({diffPercent}%)
          </div>
        </div>

        {/* 이전 값 */}
        <div className="flex-1 text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">{previous.label}</div>
          <div className="text-2xl font-bold text-gray-600">
            {previous.value.toFixed(1)}{unit}
          </div>
          {previous.subValue && (
            <div className="text-xs text-gray-400 mt-1">{previous.subValue}</div>
          )}
        </div>
      </div>

      {/* 상태 표시 */}
      <div className={`mt-3 text-center text-xs font-medium py-1.5 rounded-md ${
        isNeutral
          ? 'bg-gray-100 text-gray-600'
          : isPositive
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
      }`}>
        {isNeutral
          ? '변화 없음'
          : isPositive
            ? `📈 ${Math.abs(diff).toFixed(1)}${unit} 향상`
            : `📉 ${Math.abs(diff).toFixed(1)}${unit} 하락`
        }
      </div>
    </div>
  );
}
