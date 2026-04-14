import { Suspense } from 'react';
import BannedClient from './BannedClient';

export default function BannedPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[200] min-h-screen bg-[#0a0f1c]" aria-hidden />
      }
    >
      <BannedClient />
    </Suspense>
  );
}
