import React from 'react';

export type BadgeStatus =
  | 'ativo'
  | 'inativo'
  | 'rascunho'
  | 'confirmado'
  | 'pendente'
  | 'cancelado'
  | 'pago'
  | 'processando'
  | 'presente'
  | 'agendado'
  | 'esgotado'
  | 'encerrado'
  | 'aprovado'
  | 'nao-cadastrado';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' | 'cyan';

interface BadgeProps {
  children?: React.ReactNode;
  status?: BadgeStatus | string;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  status,
  variant,
  dot = true,
  className = '',
}) => {
  const normalized = (status || '').toLowerCase().trim();

  const getStyles = () => {
    if (variant) {
      switch (variant) {
        case 'success':
          return {
            bg: 'bg-[#ECFDF5] text-[#166534] border border-[#A7F3D0] dark:bg-[#43D9A3]/15 dark:text-[#43D9A3] dark:border-[#43D9A3]/35',
            dot: 'bg-[#16734A] dark:bg-[#43D9A3]',
          };
        case 'warning':
          return {
            bg: 'bg-[#FFF7ED] text-[#9A3412] border border-[#FED7AA] dark:bg-[#FF9A35]/15 dark:text-[#FF9A35] dark:border-[#FF9A35]/35',
            dot: 'bg-[#BD5D00] dark:bg-[#FF9A35]',
          };
        case 'danger':
          return {
            bg: 'bg-[#FFF1F2] text-[#9F1239] border border-[#FECDD3] dark:bg-[#FF5A78]/15 dark:text-[#FF5A78] dark:border-[#FF5A78]/35',
            dot: 'bg-[#C1273C] dark:bg-[#FF5A78]',
          };
        case 'info':
          return {
            bg: 'bg-[#EFF6FF] text-[#155EEF] border border-[#BFDBFE] dark:bg-[#388BFF]/15 dark:text-[#388BFF] dark:border-[#388BFF]/35',
            dot: 'bg-[#155EEF] dark:bg-[#388BFF]',
          };
        case 'cyan':
          return {
            bg: 'bg-[#ECFEFF] text-[#0E7490] border border-[#A5F3FC] dark:bg-[#24DEFF]/15 dark:text-[#24DEFF] dark:border-[#24DEFF]/35',
            dot: 'bg-[#009AC2] dark:bg-[#24DEFF]',
          };
        case 'purple':
          return {
            bg: 'bg-[#F3E8FF] text-[#7942D8] border border-[#D8B4FE] dark:bg-[#B66CFF]/15 dark:text-[#B66CFF] dark:border-[#B66CFF]/35',
            dot: 'bg-[#7942D8] dark:bg-[#B66CFF]',
          };
        default:
          return {
            bg: 'bg-[#EEF2F6] text-[#526074] border border-[#DCE2EA] dark:bg-[#1D2735] dark:text-[#B5C0D0] dark:border-[#344154]',
            dot: 'bg-[#526074] dark:bg-[#B5C0D0]',
          };
      }
    }

    switch (normalized) {
      case 'ativo':
      case 'confirmado':
      case 'pago':
      case 'presente':
      case 'aprovado':
        return {
          bg: 'bg-[#ECFDF5] text-[#166534] border border-[#A7F3D0] dark:bg-[#43D9A3]/15 dark:text-[#43D9A3] dark:border-[#43D9A3]/35',
          dot: 'bg-[#16734A] dark:bg-[#43D9A3]',
          label: status || 'Ativo',
        };
      case 'rascunho':
      case 'pendente':
      case 'agendado':
        return {
          bg: 'bg-[#FFF7ED] text-[#9A3412] border border-[#FED7AA] dark:bg-[#FF9A35]/15 dark:text-[#FF9A35] dark:border-[#FF9A35]/35',
          dot: 'bg-[#BD5D00] dark:bg-[#FF9A35]',
          label: status || 'Pendente',
        };
      case 'cancelado':
      case 'esgotado':
        return {
          bg: 'bg-[#FFF1F2] text-[#9F1239] border border-[#FECDD3] dark:bg-[#FF5A78]/15 dark:text-[#FF5A78] dark:border-[#FF5A78]/35',
          dot: 'bg-[#C1273C] dark:bg-[#FF5A78]',
          label: status || 'Cancelado',
        };
      case 'processando':
        return {
          bg: 'bg-[#EFF6FF] text-[#155EEF] border border-[#BFDBFE] dark:bg-[#388BFF]/15 dark:text-[#388BFF] dark:border-[#388BFF]/35',
          dot: 'bg-[#155EEF] dark:bg-[#388BFF]',
          label: 'Processando',
        };
      case 'inativo':
      case 'encerrado':
      case 'nao-cadastrado':
      default:
        return {
          bg: 'bg-[#EEF2F6] text-[#526074] border border-[#DCE2EA] dark:bg-[#1D2735] dark:text-[#B5C0D0] dark:border-[#344154]',
          dot: 'bg-[#526074] dark:bg-[#B5C0D0]',
          label: normalized === 'nao-cadastrado' ? 'Não Cadastrado' : status || 'Inativo',
        };
    }
  };

  const current = getStyles();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider select-none ${current.bg} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${current.dot}`} />}
      <span>{children || current.label || status}</span>
    </span>
  );
};
