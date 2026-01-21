import { useMemo } from 'react';

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
  const chartData = useMemo(() => {
    if (data.length === 0) return { points: '', areaPoints: '', maxValue: 100, months: [] };

    const maxRate = Math.max(...data.map(d => d.attendanceRate), 100);
    const minRate = Math.min(...data.map(d => d.attendanceRate), 0);
    const range = maxRate - minRate;
    const padding = range * 0.1;
    const normalizedMax = Math.min(100, maxRate + padding);
    const normalizedMin = Math.max(0, minRate - padding);
    const normalizedRange = normalizedMax - normalizedMin;

    const width = 100 / (data.length - 1 || 1);
    const points = data.map((d, i) => {
      const x = i * width;
      const y = normalizedRange > 0
        ? 100 - ((d.attendanceRate - normalizedMin) / normalizedRange) * 100
        : 50;
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = `0,100 ${points} 100,100`;

    return {
      points,
      areaPoints,
      maxValue: normalizedMax,
      minValue: normalizedMin,
      months: data.map(d => d.month)
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        데이터가 없습니다
      </div>
    );
  }

  // 평균 계산
  const avgRate = data.reduce((sum, d) => sum + d.attendanceRate, 0) / data.length;
  const trend = data.length >= 2
    ? data[data.length - 1].attendanceRate - data[0].attendanceRate
    : 0;

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">평균: <span className="font-medium text-gray-700">{avgRate.toFixed(1)}%</span></span>
            <span className={`font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          <defs>
            <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="0.3"
            />
          ))}

          {/* Area fill */}
          <polygon
            points={chartData.areaPoints}
            fill="url(#monthlyGradient)"
          />

          {/* Line */}
          <polyline
            points={chartData.points}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points */}
          {data.map((d, i) => {
            const x = i * (100 / (data.length - 1 || 1));
            const normalizedRange = (chartData.maxValue as number) - (chartData.minValue as number);
            const y = normalizedRange > 0
              ? 100 - ((d.attendanceRate - (chartData.minValue as number)) / normalizedRange) * 100
              : 50;
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r="2"
                  fill="white"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 -translate-x-6">
          <span>{chartData.maxValue}%</span>
          <span>{((chartData.maxValue as number) + (chartData.minValue as number)) / 2}%</span>
          <span>{chartData.minValue}%</span>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        {chartData.months.map((month, i) => (
          <span key={i} className="text-center" style={{ width: `${100 / data.length}%` }}>
            {month}
          </span>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {data.slice(-4).map((d, i) => (
          <div key={i} className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">{d.month}</div>
            <div className={`text-sm font-bold ${
              d.attendanceRate >= 90 ? 'text-green-600' :
              d.attendanceRate >= 80 ? 'text-indigo-600' :
              'text-red-600'
            }`}>
              {d.attendanceRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">{d.present}/{d.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
