interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  streakHistory: Array<{
    startDate: string;
    endDate: string;
    length: number;
  }>;
}

interface AttendanceStreakChartProps {
  data: StreakData;
  title?: string;
}

export default function AttendanceStreakChart({
  data,
  title = '연속 출석 기록'
}: AttendanceStreakChartProps) {
  const streakPercentage = data.longestStreak > 0
    ? (data.currentStreak / data.longestStreak) * 100
    : 0;

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>
      )}

      {/* Main streak display */}
      <div className="flex items-center gap-6 mb-6">
        {/* Current streak */}
        <div className="flex-1 text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-28 h-28 transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke={data.currentStreak > 0 ? '#22c55e' : '#e5e7eb'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${streakPercentage * 3.02} 302`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-800">{data.currentStreak}</span>
              <span className="text-xs text-gray-500">연속 출석</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 rounded-xl">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <div>
                <div className="text-xs text-yellow-600">최장 연속 기록</div>
                <div className="text-xl font-bold text-yellow-700">{data.longestStreak}일</div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 rounded-xl">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <path d="M3 10h18" />
              </svg>
              <div>
                <div className="text-xs text-indigo-600">총 출석 일수</div>
                <div className="text-xl font-bold text-indigo-700">{data.totalDays}일</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Streak comparison bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
          <span>현재 연속 기록</span>
          <span>{data.currentStreak} / {data.longestStreak}일</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
            style={{ width: `${Math.min(streakPercentage, 100)}%` }}
          />
        </div>
        {data.currentStreak > 0 && data.currentStreak === data.longestStreak && (
          <div className="text-xs text-green-600 mt-1 text-center font-medium">
            현재 최장 기록 경신 중!
          </div>
        )}
      </div>

      {/* Recent streaks */}
      {data.streakHistory && data.streakHistory.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-gray-500 mb-2">최근 연속 기록</h5>
          <div className="space-y-1">
            {data.streakHistory.slice(0, 3).map((streak, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <div className="text-xs text-gray-600">
                  {streak.startDate} ~ {streak.endDate}
                </div>
                <div className={`text-sm font-semibold ${
                  streak.length === data.longestStreak ? 'text-yellow-600' : 'text-gray-700'
                }`}>
                  {streak.length}일
                  {streak.length === data.longestStreak && (
                    <span className="ml-1 text-yellow-500">*</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivational message */}
      {data.currentStreak > 0 && (
        <div className="mt-4 p-3 bg-green-50 rounded-xl text-center">
          <p className="text-sm text-green-700">
            {data.currentStreak >= 30 ? (
              <>한 달 이상 연속 출석 중! 대단해요!</>
            ) : data.currentStreak >= 14 ? (
              <>2주 연속 출석! 꾸준함이 빛나고 있어요!</>
            ) : data.currentStreak >= 7 ? (
              <>일주일 연속 출석 달성! 좋은 습관이에요!</>
            ) : data.currentStreak >= 3 ? (
              <>{data.longestStreak - data.currentStreak}일 더 출석하면 최장 기록 달성!</>
            ) : (
              <>연속 출석 중! 계속 이어가 보세요!</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
