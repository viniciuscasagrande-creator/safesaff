import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error,
  children,
  fullWidth = true,
  className = '',
  id,
  ...props
}) => {
  const generatedId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label htmlFor={generatedId} className="text-[12px] font-bold text-[#111827] dark:text-[#F7F9FC] select-none">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          id={generatedId}
          className={`h-[42px] rounded-input border bg-white dark:bg-[#101620] pl-3.5 pr-9 text-[14px] text-[#111827] dark:text-[#F7F9FC] transition-all duration-150 outline-none appearance-none cursor-pointer ${
            error
              ? 'border-[#C1273C] dark:border-[#FF5A78] focus:border-[#C1273C] focus:shadow-[0_0_0_3px_rgba(193,39,60,0.15)]'
              : 'border-[#DCE2EA] dark:border-[#344154] focus:border-[#155EEF] dark:focus:border-[#388BFF] focus:shadow-[0_0_0_3px_rgba(21,94,239,0.12)]'
          } ${fullWidth ? 'w-full' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>

        <span className="absolute right-3 text-[#64748B] dark:text-[#8E9BAE] pointer-events-none">
          <ChevronDown size={16} />
        </span>
      </div>

      {error && <span className="text-[11px] font-semibold text-[#C1273C] dark:text-[#FF5A78]">{error}</span>}
      {!error && helperText && <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">{helperText}</span>}
    </div>
  );
};
