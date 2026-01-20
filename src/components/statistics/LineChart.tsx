interface LineChartData {
  label: string;
  value: number;
  subLabel?: string;
}

interface LineChartProps {
  data: LineChartData[];
  height?: number;
  lineColor?: string;
  fillColor?: string;
  showDots?: boolean;
  showValues?: boolean;
  showGrid?: boolean;
  formatLabel?: (label: string, index: number) => string;
}

export default function LineChart({
  data,
  height = 200,
  lineColor = '#6366f1',
  fillColor = 'rgba(99, 102, 241, 0.1)',
  showDots = true,
  showValues = true,
  showGrid = true,
  formatLabel
}: LineChartProps) {
  if (!data || data.length === 0) return null;

  const validData = data.filter(d => d && typeof d.value === 'number' && !isNaN(d.value));
  if (validData.length === 0) return null;

  const maxValue = Math.max(...validData.map(d => d.value), 1);
  const minValue = Math.min(...validData.map(d => d.value), 0);
  const range = maxValue - minValue || 1;

  const padding = { top: 30, right: 20, bottom: 50, left: 20 };
  const chartWidth = 400;
  const chartHeight = 200;

  const points = validData.map((item, index) => {
    const x = padding.left + (index / (validData.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
    const y = chartHeight - padding.bottom - ((item.value - minValue) / range) * (chartHeight - padding.top - padding.bottom);
    return { x, y, value: item.value, label: item.label, subLabel: item.subLabel };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`;

  const getDisplayLabel = (label: string, index: number) => {
    if (formatLabel) return formatLabel(label, index);
    return label;
  };

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {showGrid && [0, 25, 50, 75, 100].map(percent => {
          const y = chartHeight - padding.bottom - (percent / 100) * (chartHeight - padding.top - padding.bottom);
          return (
            <line
              key={percent}
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          );
        })}

        {/* Fill area */}
        <path d={areaPath} fill={fillColor} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="5" fill="white" stroke={lineColor} strokeWidth="2" />
        ))}

        {/* Values */}
        {showValues && points.map((p, i) => (
          <text key={i} x={p.x} y={p.y - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="#374151">
            {Math.round(p.value)}%
          </text>
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <text x={p.x} y={chartHeight - padding.bottom + 18} textAnchor="middle" fontSize="11" fill="#6b7280">
              {getDisplayLabel(p.label, i)}
            </text>
            {p.subLabel && (
              <text x={p.x} y={chartHeight - padding.bottom + 32} textAnchor="middle" fontSize="10" fill="#9ca3af">
                {p.subLabel}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
