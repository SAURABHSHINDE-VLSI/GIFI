"use client";

import React, { forwardRef } from "react";

export interface CallDockProps {
  children: React.ReactNode;
  className?: string;
}

export const CallDock = forwardRef<HTMLDivElement, CallDockProps>(function CallDock(
  { children, className = "" },
  ref,
) {
  return (
    <nav
      className={`call-dock ${className}`.trim()}
      ref={ref}
      aria-label="Call and media controls"
    >
      {children}
    </nav>
  );
});

export default CallDock;
