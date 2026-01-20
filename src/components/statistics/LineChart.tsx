interface LineChartData {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartData[];
  height?: number;
  lineColor?: string;
  fillColor?: string;
  showDots?: boolean;
  showValues?: boolean;
  showGrid?: boolean;
}

export default function LineChart({
  data,
  height = 160,
  lineColor = '#6366f1',
  fillColor = 'rgba(99, 102, 241, 0.1)',
  showDots = true,
  showValues = false,
  showGrid = true
}: LineChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const range = maxValue - minValue || 1;

  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  const chartWidth = 100;
  const chartHeight = 100;

  const points = data.map((item, index) => {
    const x = padding.left + (index / (data.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
    const y = chartHeight - padding.bottom - ((item.value - minValue) / range) * (chartHeight - padding.top - padding.bottom);
    return { x, y, value: item.value, label: item.label };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`;

  return (
    <div style={{ height }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="none">
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
              strokeWidth="0.5"
            />
          );
        })}

        {/* Fill area */}
        <path d={areaPath} fill={fillColor} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke={lineColor} strokeWidth="2" />
        ))}

        {/* Values */}
        {showValues && points.map((p, i) => (
          <text key={i} x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fill="#6b7280">
            {p.value}%
          </text>
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={chartHeight - 5} textAnchor="middle" fontSize="7" fill="#9ca3af">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
