import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`rounded-card border border-dashed border-[#DCE2EA] dark:border-[#344154] bg-white dark:bg-[#151C27] p-10 text-center flex flex-col items-center justify-center ${className}`}>
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F6] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0] mb-3.5 shadow-2xs">
          {icon}
        </div>
      )}
      <h3 className="text-[16px] font-bold text-[#111827] dark:text-[#F7F9FC]">{title}</h3>
      {description && (
        <p className="text-[13px] text-[#526074] dark:text-[#B5C0D0] max-w-md mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
