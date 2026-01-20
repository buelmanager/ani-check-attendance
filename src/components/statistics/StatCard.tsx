import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'accent' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  accent: 'text-accent',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  red: 'text-red-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500'
};

const bgClasses = {
  accent: 'bg-accent/10',
  green: 'bg-green-500/10',
  yellow: 'bg-yellow-500/10',
  red: 'bg-red-500/10',
  blue: 'bg-blue-500/10',
  purple: 'bg-purple-500/10'
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'accent',
  size = 'md'
}: StatCardProps) {
  const valueSize = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-2xl';

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className={`${valueSize} font-bold ${colorClasses[color]} mb-1`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend.isPositive ? 'text-green-500' : 'text-red-500'
            }`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className="text-gray-400">전기간 대비</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-xl ${bgClasses[color]} flex items-center justify-center`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
