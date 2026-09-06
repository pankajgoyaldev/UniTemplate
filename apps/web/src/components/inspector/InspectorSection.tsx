import React, { useState } from 'react';

export interface InspectorSectionProps {
  title: string;
  children: React.ReactNode;
  badge?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const InspectorSection: React.FC<InspectorSectionProps> = ({
  title,
  children,
  badge,
  action,
  defaultOpen = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border-b border-studio-border/60 ${className}`}>
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-studio-muted transition-transform duration-150 ${
              isOpen ? 'rotate-90' : 'rotate-0'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
            {title}
          </span>
          {badge && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {badge}
            </span>
          )}
        </div>
        {action && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center"
          >
            {action}
          </div>
        )}
      </div>

      {/* Body */}
      {isOpen && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
};

