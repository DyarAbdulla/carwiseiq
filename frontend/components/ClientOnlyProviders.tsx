'use client';

import { useEffect, useState } from 'react';
import PWARegister from './PWARegister';
import InstallPrompt from './InstallPrompt';

export default function ClientOnlyProviders() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;
  
  return (
    <>
      <PWARegister />
      <InstallPrompt />
    </>
  );
}
