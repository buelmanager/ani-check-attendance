import type { AlertStudent } from '../../types/statistics';

interface AlertStudentCardProps {
  student: AlertStudent;
  onClick?: () => void;
}

const alertTypeConfig = {
  consecutive_absent: {
    icon: '🚨',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  low_attendance: {
    icon: '⚠️',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  frequent_late: {
    icon: '⏰',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  pattern_change: {
    icon: '📉',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  }
};

export default function AlertStudentCard({ student, onClick }: AlertStudentCardProps) {
  const config = alertTypeConfig[student.alertType];

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border ${config.bgColor} ${config.borderColor} ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{student.studentName}</span>
            <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
              {student.className}
            </span>
          </div>
          <p className={`text-sm ${config.color}`}>{student.alertMessage}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>현재: {student.value}{student.alertType === 'consecutive_absent' ? '일' : '%'}</span>
            <span>기준: {student.threshold}{student.alertType === 'consecutive_absent' ? '일' : '%'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
