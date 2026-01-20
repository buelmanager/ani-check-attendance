import { useMemo } from 'react';

interface TrendChartData {
  label: string;
  value: number;
  previousValue?: number;
}

interface TrendChartProps {
  data: TrendChartData[];
  height?: number;
  showComparison?: boolean;
  lineColor?: string;
  comparisonColor?: string;
  title?: string;
  valueLabel?: string;
  comparisonLabel?: string;
}

export default function TrendChart({
  data,
  height = 200,
  showComparison = true,
  lineColor = '#6366f1',
  comparisonColor = '#94a3b8',
  title,
  valueLabel = '현재',
  comparisonLabel = '이전'
}: TrendChartProps) {
  if (!data || data.length === 0) return null;

  const { maxValue, points, comparisonPoints } = useMemo(() => {
    const values = data.map(d => d.value);
    const prevValues = data.filter(d => d.previousValue !== undefined).map(d => d.previousValue!);
    const allValues = [...values, ...prevValues];
    const max = Math.max(...allValues, 1);

    const padding = { top: 30, right: 20, bottom: 40, left: 40 };
    const chartWidth = 400;
    const chartHeight = 180;

    const pts = data.map((item, index) => {
      const x = padding.left + (index / (data.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
      const y = chartHeight - padding.bottom - (item.value / max) * (chartHeight - padding.top - padding.bottom);
      return { x, y, value: item.value, label: item.label };
    });

    const compPts = showComparison ? data
      .filter(d => d.previousValue !== undefined)
      .map((item, index) => {
        const x = padding.left + (index / (data.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
        const y = chartHeight - padding.bottom - (item.previousValue! / max) * (chartHeight - padding.top - padding.bottom);
        return { x, y, value: item.previousValue!, label: item.label };
      }) : [];

    return { maxValue: max, points: pts, comparisonPoints: compPts };
  }, [data, showComparison]);

  const createPath = (pts: typeof points) => {
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  const createAreaPath = (pts: typeof points) => {
    if (pts.length === 0) return '';
    const linePath = createPath(pts);
    const chartHeight = 180;
    const padding = { bottom: 40, left: 40 };
    return `${linePath} L ${pts[pts.length - 1].x} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`;
  };

  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">{title}</h4>
          {showComparison && comparisonPoints.length > 0 && (
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5" style={{ backgroundColor: lineColor }} />
                <span className="text-gray-600">{valueLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 border-dashed border-t-2" style={{ borderColor: comparisonColor }} />
                <span className="text-gray-600">{comparisonLabel}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height }}>
        <svg viewBox="0 0 400 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(percent => {
            const y = 180 - 40 - (percent / 100) * (180 - 30 - 40);
            return (
              <g key={percent}>
                <line x1={40} y1={y} x2={380} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={35} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                  {Math.round(maxValue * percent / 100)}%
                </text>
              </g>
            );
          })}

          {/* Comparison area (if showing) */}
          {showComparison && comparisonPoints.length > 0 && (
            <>
              <path
                d={createAreaPath(comparisonPoints)}
                fill={`${comparisonColor}15`}
              />
              <path
                d={createPath(comparisonPoints)}
                fill="none"
                stroke={comparisonColor}
                strokeWidth="2"
                strokeDasharray="5,5"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Current area */}
          <path
            d={createAreaPath(points)}
            fill={`${lineColor}20`}
          />
          <path
            d={createPath(points)}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current dots */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={lineColor} strokeWidth="2" />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#374151">
                {Math.round(p.value)}%
              </text>
            </g>
          ))}

          {/* Labels */}
          {points.map((p, i) => (
            <text key={i} x={p.x} y={180 - 15} textAnchor="middle" fontSize="10" fill="#6b7280">
              {p.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
