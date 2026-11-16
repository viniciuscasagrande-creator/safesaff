import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div
        className={`relative w-full ${maxWidth} bg-white dark:bg-[#151C27] text-[#111827] dark:text-[#F7F9FC] rounded-card shadow-2xl border border-[#DCE2EA] dark:border-[#344154] overflow-hidden z-10 animate-in zoom-in-95 duration-200`}
      >
        <div className="flex items-start justify-between p-5 border-b border-[#DCE2EA] dark:border-[#344154]">
          <div>
            <h3 className="text-[17px] font-bold text-[#111827] dark:text-[#F7F9FC] leading-tight">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#526074] dark:text-[#B5C0D0] mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-btn text-[#526074] dark:text-[#B5C0D0] hover:bg-[#EEF2F6] dark:hover:bg-[#1D2735] hover:text-[#111827] dark:hover:text-[#F7F9FC] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
