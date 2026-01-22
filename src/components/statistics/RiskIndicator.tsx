interface RiskIndicatorProps {
  score: number; // 0-100 (0: 매우 좋음, 100: 관리 필요)
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  factors?: {
    name: string;
    impact: number; // 0-100
  }[];
}

const getRiskLevel = (score: number): {
  level: string;
  color: string;
  bgColor: string;
  iconColor: string;
} => {
  if (score < 20) return { level: '매우 좋음', color: 'text-green-600', bgColor: 'bg-green-100', iconColor: 'text-green-500' };
  if (score < 40) return { level: '좋음', color: 'text-blue-600', bgColor: 'bg-blue-100', iconColor: 'text-blue-500' };
  if (score < 60) return { level: '보통', color: 'text-yellow-600', bgColor: 'bg-yellow-100', iconColor: 'text-yellow-500' };
  if (score < 80) return { level: '관심 필요', color: 'text-orange-600', bgColor: 'bg-orange-100', iconColor: 'text-orange-500' };
  return { level: '집중 관리', color: 'text-red-600', bgColor: 'bg-red-100', iconColor: 'text-red-500' };
};

export default function RiskIndicator({
  score,
  label = '출석 관리 필요도',
  size = 'md',
  showDetails = false,
  factors = []
}: RiskIndicatorProps) {
  const riskInfo = getRiskLevel(score);

  const sizeClasses = {
    sm: { container: 'p-2', title: 'text-xs', score: 'text-lg', bar: 'h-1.5' },
    md: { container: 'p-3', title: 'text-sm', score: 'text-2xl', bar: 'h-2' },
    lg: { container: 'p-4', title: 'text-base', score: 'text-3xl', bar: 'h-3' }
  };

  const s = sizeClasses[size];

  return (
    <div className={`rounded-lg ${riskInfo.bgColor} ${s.container}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${s.title} font-medium text-gray-700`}>{label}</span>
        <span className={`${s.title} font-semibold ${riskInfo.color}`}>
          {riskInfo.level}
        </span>
      </div>

      {/* 위험도 바 */}
      <div className={`w-full ${s.bar} bg-white rounded-full overflow-hidden mb-2`}>
        <div
          className={`h-full rounded-full transition-all duration-500`}
          style={{
            width: `${score}%`,
            backgroundColor: score < 20 ? '#22c55e' :
                           score < 40 ? '#3b82f6' :
                           score < 60 ? '#eab308' :
                           score < 80 ? '#f97316' : '#ef4444'
          }}
        />
      </div>

      {/* 점수 표시 */}
      <div className="flex items-end justify-between">
        <span className={`${s.score} font-bold ${riskInfo.color}`}>{Math.round(score)}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>

      {/* 상세 요인 (옵션) */}
      {showDetails && factors.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/50">
          <div className="text-xs font-medium text-gray-600 mb-2">관리 포인트</div>
          <div className="space-y-1.5">
            {factors.map((factor, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 text-xs text-gray-600">{factor.name}</div>
                <div className="w-20 h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${factor.impact}%`,
                      backgroundColor: factor.impact < 30 ? '#22c55e' :
                                     factor.impact < 60 ? '#eab308' : '#ef4444'
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(factor.impact)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
