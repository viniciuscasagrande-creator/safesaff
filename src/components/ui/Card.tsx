import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = false,
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  }[padding];

  const hoverClasses = hoverEffect
    ? 'hover:shadow-cardHover hover:-translate-y-[1px] cursor-pointer'
    : '';

  return (
    <div
      className={`bg-white dark:bg-[#151C27] text-[#111827] dark:text-[#F7F9FC] border border-[#DCE2EA] dark:border-[#344154] rounded-xl shadow-xs transition-all duration-200 ${paddingClasses} ${hoverClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
