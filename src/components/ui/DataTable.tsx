import React from 'react';

interface DataTableProps {
  headers: React.ReactNode[];
  children: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  headers,
  children,
  empty = false,
  emptyMessage = 'Nenhum registro encontrado.',
  className = '',
}) => {
  return (
    <div className={`overflow-hidden rounded-card border border-[#DCE2EA] dark:border-[#344154] bg-white dark:bg-[#151C27] shadow-card ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-[#DCE2EA] dark:border-[#344154] bg-[#EEF2F6] dark:bg-[#101620] text-[11px] font-bold text-[#526074] dark:text-[#B5C0D0] uppercase tracking-wider select-none">
              {headers.map((header, idx) => (
                <th key={idx} className="py-3.5 px-4 font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8ECF2] dark:divide-[#253041] font-medium text-[#111827] dark:text-[#F7F9FC]">
            {empty ? (
              <tr>
                <td colSpan={headers.length} className="py-12 text-center text-[#64748B] dark:text-[#8E9BAE]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
