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
  // 메시지 생성
  const getMessage = () => {
    if (data.currentStreak >= 30) return { text: '한 달 이상 연속 출석! 정말 대단해요!', emoji: '🏆' };
    if (data.currentStreak >= 14) return { text: '2주 연속 출석! 꾸준함이 빛나요!', emoji: '🌟' };
    if (data.currentStreak >= 7) return { text: '일주일 연속 출석 달성!', emoji: '👏' };
    if (data.currentStreak >= 3) return { text: '연속 출석 중! 계속 이어가세요!', emoji: '💪' };
    if (data.currentStreak > 0) return { text: '출석 시작! 화이팅!', emoji: '🔥' };
    return { text: '새로운 연속 출석을 시작해보세요!', emoji: '📅' };
  };

  const message = getMessage();
  const isRecordBreaking = data.currentStreak > 0 && data.currentStreak === data.longestStreak;

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>
      )}

      {/* 메인 연속 출석 카드 */}
      <div className={`rounded-2xl p-6 text-center mb-4 ${
        isRecordBreaking ? 'bg-gradient-to-br from-yellow-50 to-orange-50' : 'bg-gradient-to-br from-green-50 to-emerald-50'
      }`}>
        <div className="text-6xl mb-2">{message.emoji}</div>
        <div className={`text-5xl font-bold mb-1 ${
          isRecordBreaking ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {data.currentStreak}일
        </div>
        <div className="text-sm text-gray-600">현재 연속 출석</div>
        {isRecordBreaking && data.currentStreak > 0 && (
          <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 rounded-full">
            <span className="text-yellow-600 text-xs font-semibold">🏅 최장 기록 경신 중!</span>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-yellow-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⭐</span>
            <span className="text-xs text-yellow-700">최장 연속 기록</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{data.longestStreak}일</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📊</span>
            <span className="text-xs text-blue-700">총 출석 일수</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{data.totalDays}일</div>
        </div>
      </div>

      {/* 진행 바 */}
      {data.longestStreak > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">최장 기록 달성률</span>
            <span className="text-sm font-bold text-gray-700">
              {data.currentStreak} / {data.longestStreak}일
            </span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isRecordBreaking ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-green-400 to-emerald-500'
              }`}
              style={{ width: `${Math.min((data.currentStreak / data.longestStreak) * 100, 100)}%` }}
            />
          </div>
          {!isRecordBreaking && data.currentStreak > 0 && (
            <div className="text-xs text-gray-500 mt-2 text-center">
              {data.longestStreak - data.currentStreak}일 더 출석하면 최장 기록 달성!
            </div>
          )}
        </div>
      )}

      {/* 최근 연속 기록 */}
      {data.streakHistory && data.streakHistory.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">📜 연속 출석 기록</h5>
          <div className="space-y-2">
            {data.streakHistory.slice(0, 3).map((streak, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  streak.length === data.longestStreak ? 'bg-yellow-100' : 'bg-white'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-gray-700">
                    {streak.length === data.longestStreak && <span className="mr-1">🥇</span>}
                    {streak.length}일 연속
                  </div>
                  <div className="text-xs text-gray-500">
                    {streak.startDate} ~ {streak.endDate}
                  </div>
                </div>
                {streak.length === data.longestStreak && (
                  <span className="text-xs text-yellow-600 font-medium">최고 기록</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 응원 메시지 */}
      <div className={`mt-4 p-4 rounded-xl text-center ${
        data.currentStreak > 0 ? 'bg-green-50' : 'bg-gray-50'
      }`}>
        <p className={`text-sm font-medium ${
          data.currentStreak > 0 ? 'text-green-700' : 'text-gray-600'
        }`}>
          {message.text}
        </p>
      </div>
    </div>
  );
}
