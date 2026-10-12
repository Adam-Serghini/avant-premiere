import type { SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const ChevronUp = () => <Icon><path d="M6 15l6-6 6 6" /></Icon>;
export const ChevronDown = () => <Icon><path d="M6 9l6 6 6-6" /></Icon>;
export const ChevronLeft = () => <Icon><path d="M15 6l-6 6 6 6" /></Icon>;
export const ChevronRight = () => <Icon><path d="M9 6l6 6-6 6" /></Icon>;
export const CloseIcon = () => <Icon><path d="M6 6l12 12M18 6L6 18" /></Icon>;
