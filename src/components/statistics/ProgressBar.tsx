interface ProgressBarProps {
  value: number;
  maxValue?: number;
  label?: string;
  showValue?: boolean;
  color?: 'accent' | 'green' | 'yellow' | 'red' | 'blue';
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  accent: 'bg-accent',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500'
};

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3'
};

export default function ProgressBar({
  value,
  maxValue = 100,
  label,
  showValue = true,
  color = 'accent',
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm text-gray-600">{label}</span>}
          {showValue && <span className="text-sm font-medium text-gray-900">{value}%</span>}
        </div>
      )}
      <div className={`${sizeClasses[size]} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
