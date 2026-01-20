interface RankingItem {
  id: string;
  rank: number;
  name: string;
  subtitle?: string;
  value: number;
  subValues?: { label: string; value: number; color?: string }[];
}

interface RankingTableProps {
  items: RankingItem[];
  title?: string;
  valueLabel?: string;
  valueSuffix?: string;
  maxItems?: number;
  onItemClick?: (id: string) => void;
}

export default function RankingTable({
  items,
  title,
  valueLabel = '출석률',
  valueSuffix = '%',
  maxItems = 10,
  onItemClick
}: RankingTableProps) {
  const displayItems = items.slice(0, maxItems);

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/20 text-yellow-600';
    if (rank === 2) return 'bg-gray-400/20 text-gray-600';
    if (rank === 3) return 'bg-orange-500/20 text-orange-600';
    return 'bg-gray-100 text-gray-500';
  };

  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
              <th className="pb-3 w-12">순위</th>
              <th className="pb-3">이름</th>
              {displayItems[0]?.subValues?.map((sv, i) => (
                <th key={i} className="pb-3 text-center">{sv.label}</th>
              ))}
              <th className="pb-3 text-right">{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayItems.map((item) => (
              <tr
                key={item.id}
                onClick={() => onItemClick?.(item.id)}
                className={onItemClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              >
                <td className="py-3">
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${getRankBadgeStyle(item.rank)}`}>
                    {item.rank}
                  </span>
                </td>
                <td className="py-3">
                  <div>
                    <span className="text-gray-900 font-medium">{item.name}</span>
                    {item.subtitle && (
                      <span className="text-xs text-gray-400 ml-2">{item.subtitle}</span>
                    )}
                  </div>
                </td>
                {item.subValues?.map((sv, i) => (
                  <td key={i} className={`py-3 text-center ${sv.color || 'text-gray-600'}`}>
                    {sv.value}
                  </td>
                ))}
                <td className="py-3 text-right font-bold text-accent">
                  {item.value}{valueSuffix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
