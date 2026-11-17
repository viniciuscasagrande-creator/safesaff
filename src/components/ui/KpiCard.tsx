import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export type KpiAccent = 'green' | 'blue' | 'cyan' | 'orange' | 'purple' | 'red' | 'slate';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  note?: string;
  accent?: KpiAccent;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendDirection = 'up',
  note,
  accent = 'blue',
  className = '',
}) => {
  const accentStyles = {
    green: { bg: 'bg-[#ECFDF5] text-[#16734A] dark:bg-[#43D9A3]/15 dark:text-[#43D9A3]', border: 'bg-[#16734A]' },
    blue: { bg: 'bg-[#EFF6FF] text-[#155EEF] dark:bg-[#388BFF]/15 dark:text-[#388BFF]', border: 'bg-[#155EEF]' },
    cyan: { bg: 'bg-[#ECFEFF] text-[#009AC2] dark:bg-[#24DEFF]/15 dark:text-[#24DEFF]', border: 'bg-[#009AC2]' },
    orange: { bg: 'bg-[#FFF7ED] text-[#BD5D00] dark:bg-[#FF9A35]/15 dark:text-[#FF9A35]', border: 'bg-[#EA580C]' },
    purple: { bg: 'bg-[#F3E8FF] text-[#7942D8] dark:bg-[#B66CFF]/15 dark:text-[#B66CFF]', border: 'bg-[#7942D8]' },
    red: { bg: 'bg-[#FFF1F2] text-[#C1273C] dark:bg-[#FF5A78]/15 dark:text-[#FF5A78]', border: 'bg-[#C1273C]' },
    slate: { bg: 'bg-[#EEF2F6] text-[#526074] dark:bg-[#1D2735] dark:text-[#B5C0D0]', border: 'bg-[#526074]' },
  }[accent];

  return (
    <div className={`rounded-xl border border-[#DCE2EA] dark:border-[#344154] bg-white dark:bg-[#151C27] text-[#111827] dark:text-[#F7F9FC] p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-[1px] flex flex-col justify-between ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#526074] dark:text-[#B5C0D0] block">
          {label}
        </span>
        {icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg p-1.5 shrink-0 ${accentStyles.bg}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <strong className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#111827] dark:text-[#F7F9FC] block leading-tight font-mono tabular-nums">
          {value}
        </strong>

        {trend && (
          <div className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold">
            {trendDirection === 'up' && (
              <span className="text-success flex items-center gap-1">
                <TrendingUp size={13} />
                {trend}
              </span>
            )}
            {trendDirection === 'down' && (
              <span className="text-destructive flex items-center gap-1">
                <TrendingDown size={13} />
                {trend}
              </span>
            )}
            {trendDirection === 'neutral' && (
              <span className="text-muted-foreground">{trend}</span>
            )}
            {note && <span className="text-muted-foreground font-normal text-[11px] ml-1">{note}</span>}
          </div>
        )}

        {!trend && note && (
          <span className="mt-1 block text-[11px] text-muted-foreground font-medium">
            {note}
          </span>
        )}
      </div>
    </div>
  );
};
