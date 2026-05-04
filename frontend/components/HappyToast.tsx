'use client';

import { useEffect, useState } from 'react';
import { type MessageContext, getRandomMessage } from '@/lib/happyMessages';

interface HappyToastProps {
  context: MessageContext;
  /** Increment (e.g. `setSeq(s => s + 1)`) each time you want a new toast. Values ≤ 0 are ignored. */
  trigger: number;
  duration?: number;
}

export default function HappyToast({ context, trigger, duration = 4000 }: HappyToastProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (trigger <= 0) return;
    setMessage(getRandomMessage(context));
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [trigger, context, duration]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
        color: '#fff',
        padding: '14px 24px',
        borderRadius: '16px',
        fontSize: '15px',
        fontFamily: 'inherit',
        boxShadow: '0 8px 32px rgba(109,40,217,0.4)',
        textAlign: 'center',
        maxWidth: '90vw',
        animation: 'happySlideUp 0.4s ease',
        direction: 'rtl',
        lineHeight: 1.6,
      }}
    >
      {message}
      <style>{`
        @keyframes happySlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
