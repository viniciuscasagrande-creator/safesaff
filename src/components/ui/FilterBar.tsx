import React from 'react';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  selectFilters?: React.ReactNode;
  statusTabs?: {
    current: string;
    onChange: (status: string) => void;
    options: { id: string; label: string; count?: number }[];
  };
  actions?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  selectFilters,
  statusTabs,
  actions,
  className = '',
}) => {
  return (
    <div className={`rounded-card border border-[#DCE2EA] dark:border-[#344154] bg-white dark:bg-[#151C27] p-3.5 shadow-card space-y-3 mb-6 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute left-3.5 text-[#64748B] dark:text-[#8E9BAE] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-[38px] w-full rounded-input border border-[#DCE2EA] dark:border-[#344154] bg-[#F5F7FA] dark:bg-[#101620] pl-10 pr-8 text-[13px] text-[#111827] dark:text-[#F7F9FC] placeholder:text-[#64748B] dark:placeholder:text-[#8E9BAE] outline-none transition focus:border-[#155EEF] dark:focus:border-[#388BFF] focus:bg-white dark:focus:bg-[#151C27]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 text-[#64748B] hover:text-[#111827] dark:hover:text-[#F7F9FC]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {selectFilters}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {statusTabs && (
            <div className="inline-flex rounded-btn border border-[#DCE2EA] dark:border-[#344154] bg-[#EEF2F6] dark:bg-[#101620] p-0.5">
              {statusTabs.options.map((tab) => {
                const isActive = statusTabs.current === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => statusTabs.onChange(tab.id)}
                    className={`rounded-[6px] px-3 py-1 text-[12px] font-bold transition select-none cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-[#1D2735] text-[#155EEF] dark:text-[#388BFF] shadow-xs'
                        : 'text-[#526074] dark:text-[#B5C0D0] hover:text-[#111827] dark:hover:text-[#F7F9FC]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[10px] ${
                          isActive
                            ? 'bg-[#155EEF]/15 dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF]'
                            : 'bg-[#DCE2EA] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {actions}
        </div>
      </div>
    </div>
  );
};
