export const runtime = 'edge';
import React from 'react';

/**
 * Profile segment layout: no outer box.
 * Wrapper is bg-transparent and borderless so "Profile Settings" and content
 * sit directly on the main page background. Inner cards (sidebar, form) keep their glass.
 */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="!bg-transparent !shadow-none !border-none min-h-full w-full">
      {children}
    </div>
  );
}
