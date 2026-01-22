interface ComparisonData {
  label: string;
  studentValue: number;
  classAvg: number;
  overallAvg: number;
}

interface PersonalComparisonChartProps {
  data: ComparisonData[];
  studentName: string;
  title?: string;
}

export default function PersonalComparisonChart({
  data,
  studentName,
  title = '비교 분석'
}: PersonalComparisonChartProps) {
  // 평균 계산
  const avgVsClass = data.length > 0
    ? data.reduce((sum, d) => sum + (d.studentValue - d.classAvg), 0) / data.length
    : 0;
  const avgVsOverall = data.length > 0
    ? data.reduce((sum, d) => sum + (d.studentValue - d.overallAvg), 0) / data.length
    : 0;

  // 학생의 평균 출석률
  const studentAvg = data.length > 0
    ? data.reduce((sum, d) => sum + d.studentValue, 0) / data.length
    : 0;

  // 상위 퍼센트 계산 (간단한 추정)
  const topPercent = Math.max(1, Math.round((100 - studentAvg) * 0.5));

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`rounded-xl p-4 text-center ${avgVsClass >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-2xl font-bold ${avgVsClass >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {avgVsClass >= 0 ? '+' : ''}{avgVsClass.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">반 평균 대비</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${avgVsOverall >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-2xl font-bold ${avgVsOverall >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {avgVsOverall >= 0 ? '+' : ''}{avgVsOverall.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">전체 평균 대비</div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">
            Top {topPercent}%
          </div>
          <div className="text-xs text-gray-600 mt-1">전체 순위</div>
        </div>
      </div>

      {/* 상세 비교 */}
      <div className="space-y-4">
        {data.map((item, i) => {
          const diffFromClass = item.studentValue - item.classAvg;
          const isAboveClass = diffFromClass >= 0;

          return (
            <div key={i} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-700">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${isAboveClass ? 'text-green-600' : 'text-red-500'}`}>
                    {item.studentValue.toFixed(0)}%
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isAboveClass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {isAboveClass ? '↑' : '↓'} {Math.abs(diffFromClass).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 비교 바 */}
              <div className="relative h-8 bg-white rounded-lg overflow-hidden mb-2">
                {/* 학생 바 */}
                <div
                  className={`absolute top-0 left-0 h-full rounded-lg ${
                    isAboveClass ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${item.studentValue}%` }}
                />
                {/* 반 평균 마커 */}
                <div
                  className="absolute top-0 h-full w-1 bg-emerald-600 z-10"
                  style={{ left: `${item.classAvg}%` }}
                >
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-emerald-600 whitespace-nowrap">
                    반 {item.classAvg.toFixed(0)}%
                  </div>
                </div>
                {/* 전체 평균 마커 */}
                <div
                  className="absolute top-0 h-full w-1 bg-gray-400 z-10"
                  style={{ left: `${item.overallAvg}%` }}
                >
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                    전체 {item.overallAvg.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* 범례 */}
              <div className="flex items-center justify-between text-xs text-gray-500 mt-4 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className={`w-3 h-3 rounded ${isAboveClass ? 'bg-green-500' : 'bg-blue-500'}`} />
                    {studentName}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-600" />
                    반 평균
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gray-400" />
                    전체 평균
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 종합 평가 메시지 */}
      <div className={`mt-4 p-4 rounded-xl text-center ${
        avgVsClass >= 0 ? 'bg-green-50' : 'bg-yellow-50'
      }`}>
        {avgVsClass >= 5 ? (
          <p className="text-sm text-green-700">
            🌟 <strong>{studentName}</strong> 학생은 반 평균보다 <strong>{avgVsClass.toFixed(1)}%</strong> 높은 출석률을 보이고 있어요!
          </p>
        ) : avgVsClass >= 0 ? (
          <p className="text-sm text-green-700">
            👍 <strong>{studentName}</strong> 학생은 반 평균 이상의 출석률을 유지하고 있어요.
          </p>
        ) : avgVsClass >= -5 ? (
          <p className="text-sm text-yellow-700">
            💪 <strong>{studentName}</strong> 학생은 반 평균에 근접한 출석률이에요. 조금만 더 힘내요!
          </p>
        ) : (
          <p className="text-sm text-yellow-700">
            📌 <strong>{studentName}</strong> 학생의 출석률 향상이 필요해요. 함께 노력해봐요!
          </p>
        )}
      </div>
    </div>
  );
}
