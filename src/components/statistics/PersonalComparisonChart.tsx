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
  const maxValue = Math.max(
    ...data.flatMap(d => [d.studentValue, d.classAvg, d.overallAvg]),
    100
  );

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span className="text-gray-600">{studentName}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-400" />
          <span className="text-gray-600">반 평균</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-300" />
          <span className="text-gray-600">전체 평균</span>
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="space-y-4">
        {data.map((item, i) => {
          const studentWidth = (item.studentValue / maxValue) * 100;
          const classWidth = (item.classAvg / maxValue) * 100;
          const overallWidth = (item.overallAvg / maxValue) * 100;
          const isAboveAvg = item.studentValue >= item.classAvg;

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <span className={`text-sm font-bold ${
                  isAboveAvg ? 'text-green-600' : 'text-red-500'
                }`}>
                  {item.studentValue.toFixed(1)}%
                  {isAboveAvg ? (
                    <span className="text-xs ml-1 text-green-500">
                      +{(item.studentValue - item.classAvg).toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs ml-1 text-red-400">
                      {(item.studentValue - item.classAvg).toFixed(1)}
                    </span>
                  )}
                </span>
              </div>

              <div className="space-y-1">
                {/* Student bar */}
                <div className="relative h-4 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full rounded transition-all ${
                      isAboveAvg ? 'bg-indigo-500' : 'bg-indigo-400'
                    }`}
                    style={{ width: `${studentWidth}%` }}
                  />
                  {/* Class avg marker */}
                  <div
                    className="absolute top-0 w-0.5 h-full bg-emerald-500"
                    style={{ left: `${classWidth}%` }}
                  />
                  {/* Overall avg marker */}
                  <div
                    className="absolute top-0 w-0.5 h-full bg-gray-400"
                    style={{ left: `${overallWidth}%` }}
                  />
                </div>

                {/* Reference values */}
                <div className="flex justify-between text-xs text-gray-400">
                  <span>반: {item.classAvg.toFixed(1)}%</span>
                  <span>전체: {item.overallAvg.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-gray-500">반 평균 대비</div>
            <div className={`text-lg font-bold ${
              data.reduce((sum, d) => sum + (d.studentValue - d.classAvg), 0) >= 0
                ? 'text-green-600' : 'text-red-500'
            }`}>
              {data.reduce((sum, d) => sum + (d.studentValue - d.classAvg), 0) >= 0 ? '+' : ''}
              {(data.reduce((sum, d) => sum + (d.studentValue - d.classAvg), 0) / data.length).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">전체 평균 대비</div>
            <div className={`text-lg font-bold ${
              data.reduce((sum, d) => sum + (d.studentValue - d.overallAvg), 0) >= 0
                ? 'text-green-600' : 'text-red-500'
            }`}>
              {data.reduce((sum, d) => sum + (d.studentValue - d.overallAvg), 0) >= 0 ? '+' : ''}
              {(data.reduce((sum, d) => sum + (d.studentValue - d.overallAvg), 0) / data.length).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">상위</div>
            <div className="text-lg font-bold text-indigo-600">
              {/* This would be calculated based on rank */}
              Top {Math.max(5, Math.round((1 - (data[0]?.studentValue || 0) / 100) * 100))}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
