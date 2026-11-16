import React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'context'
  | 'danger'
  | 'success'
  | 'warning'
  | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-xs gap-2',
    lg: 'h-11 px-5 text-sm gap-2.5',
  }[size];

  // SafeSaff Design System Global v1.0 — Variantes semânticas com contraste validado em Claro e Escuro (UI-002)
  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-[#155EEF] hover:bg-[#1D4ED8] dark:bg-[#388BFF] dark:hover:bg-[#1F6FEB] text-white border border-[#155EEF] dark:border-[#388BFF] shadow-xs font-bold active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#155EEF]/50',
    secondary:
      'bg-white dark:bg-[#1D2735] hover:bg-[#F1F5F9] dark:hover:bg-[#243044] text-[#111827] dark:text-[#F7F9FC] border border-[#DCE2EA] dark:border-[#344154] shadow-2xs font-semibold active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#155EEF]/40',
    outline:
      'bg-transparent hover:bg-[#EFF6FF] dark:hover:bg-[#388BFF]/15 text-[#155EEF] dark:text-[#388BFF] border border-[#155EEF]/40 dark:border-[#388BFF]/50 font-semibold active:scale-[0.98]',
    context:
      'bg-transparent hover:bg-[#EEF2F6] dark:hover:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0] hover:text-[#111827] dark:hover:text-[#F7F9FC] border border-transparent font-medium p-1.5 sm:px-2.5',
    ghost:
      'bg-transparent hover:bg-[#EEF2F6] dark:hover:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0] hover:text-[#111827] dark:hover:text-[#F7F9FC] border border-transparent font-semibold active:scale-[0.98]',
    danger:
      'bg-[#C1273C] hover:bg-[#9F1239] dark:bg-[#FF5A78] dark:hover:bg-[#E11D48] text-white border border-[#C1273C] dark:border-[#FF5A78] shadow-xs font-bold active:scale-[0.98]',
    success:
      'bg-[#16734A] hover:bg-[#15803D] dark:bg-[#43D9A3] dark:hover:bg-[#34D399] text-white dark:text-[#082218] border border-[#16734A] dark:border-[#43D9A3] shadow-xs font-bold active:scale-[0.98]',
    warning:
      'bg-[#BD5D00] hover:bg-[#9A3412] dark:bg-[#FF9A35] dark:hover:bg-[#F97316] text-white dark:text-[#231202] border border-[#BD5D00] dark:border-[#FF9A35] shadow-xs font-bold active:scale-[0.98]',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-btn transition-all duration-150 select-none outline-none ${sizeClasses} ${variantClasses[variant]} ${
        fullWidth ? 'w-full' : ''
      } ${disabled || loading ? 'opacity-55 cursor-not-allowed pointer-events-none' : 'cursor-pointer'} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {children}
        </span>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
