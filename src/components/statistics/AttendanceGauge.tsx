interface AttendanceGaugeProps {
  value: number;
  target?: number;
  size?: number;
  label?: string;
  showTarget?: boolean;
}

export default function AttendanceGauge({
  value,
  target = 85,
  size = 160,
  label = '출석률',
  showTarget = true
}: AttendanceGaugeProps) {
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius; // 반원의 둘레
  const strokeWidth = 12;

  // 값에 따른 색상 결정
  const getColor = (val: number) => {
    if (val >= target) return '#22c55e'; // 목표 달성 (녹색)
    if (val >= target - 10) return '#eab308'; // 목표 근접 (노란색)
    return '#ef4444'; // 목표 미달 (빨간색)
  };

  const color = getColor(value);
  const progress = Math.min(value, 100) / 100;
  const dashOffset = circumference * (1 - progress);

  // 목표 위치 계산
  const targetAngle = (target / 100) * 180 - 90;
  const targetX = size / 2 + radius * Math.cos((targetAngle * Math.PI) / 180);
  const targetY = size / 2 + radius * Math.sin((targetAngle * Math.PI) / 180);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* 배경 반원 */}
        <path
          d={`M ${strokeWidth / 2 + 5} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2 - 5} ${size / 2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* 진행 반원 */}
        <path
          d={`M ${strokeWidth / 2 + 5} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2 - 5} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />

        {/* 목표선 표시 */}
        {showTarget && (
          <g>
            <line
              x1={targetX}
              y1={targetY - 8}
              x2={targetX}
              y2={targetY + 8}
              stroke="#6b7280"
              strokeWidth="2"
            />
            <text
              x={targetX}
              y={targetY - 12}
              textAnchor="middle"
              fontSize="9"
              fill="#6b7280"
            >
              목표
            </text>
          </g>
        )}

        {/* 중앙 값 표시 */}
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill={color}
        >
          {Math.round(value)}%
        </text>

        {/* 라벨 */}
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          fontSize="12"
          fill="#6b7280"
        >
          {label}
        </text>

        {/* 최소/최대 라벨 */}
        <text x={10} y={size / 2 + 20} fontSize="10" fill="#9ca3af">0%</text>
        <text x={size - 25} y={size / 2 + 20} fontSize="10" fill="#9ca3af">100%</text>
      </svg>

      {/* 목표 대비 상태 */}
      {showTarget && (
        <div className={`mt-1 text-xs font-medium ${
          value >= target ? 'text-green-600' : value >= target - 10 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {value >= target
            ? `목표 달성! (+${(value - target).toFixed(1)}%)`
            : `목표까지 ${(target - value).toFixed(1)}% 남음`
          }
        </div>
      )}
    </div>
  );
}
