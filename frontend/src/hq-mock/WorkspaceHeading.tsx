import React from 'react';
import type { LucideIcon } from 'lucide-react';

/** Shared visual heading; the title remains an ordinary accessible h1. */
export function WorkspaceHeading({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <h1 className="dio-workspace-heading"><span className="dio-workspace-icon"><Icon size={21} aria-hidden="true" /></span><span>{children}</span></h1>;
}
