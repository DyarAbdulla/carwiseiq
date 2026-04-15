import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { inter, vazirmatn } from '@/lib/fonts';
import { locales } from '@/i18n';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { ToastProvider } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SkipToContent } from '@/components/common/SkipToContent';
import { SetDirection } from '@/components/common/SetDirection';
import { BodyFontSwitcher } from '@/components/common/BodyFontSwitcher';
import { PageTransition } from '@/components/PageTransition';
import { PredictLoadingProvider } from '@/components/PredictLoadingProvider';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { IpBanGuard } from '@/components/security/IpBanGuard';
import React from 'react';

const ScrollToTop = dynamic(
  () => import('@/components/ScrollToTop').then((m) => ({ default: m.ScrollToTop })),
  { ssr: false, loading: () => null }
);
const BackendStatusBanner = dynamic(
  () => import('@/components/BackendStatusBanner').then((m) => ({ default: m.BackendStatusBanner })),
  { ssr: false, loading: () => null }
);
const Footer = dynamic(
  () => import('@/components/layout/Footer').then((m) => ({ default: m.Footer })),
  { loading: () => <footer className="min-h-[120px]" aria-hidden /> }
);
const CookieConsent = dynamic(
  () => import('@/components/common/CookieConsent').then((m) => ({ default: m.CookieConsent })),
  { ssr: false, loading: () => null }
);
const ChatBot = dynamic(
  () => import('@/components/chat/ChatBot').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => null }
);
const OnboardingModal = dynamic(
  () => import('@/components/onboarding/OnboardingModal').then((m) => ({ default: m.OnboardingModal })),
  { ssr: false, loading: () => null }
);
const PushClientKit = dynamic(
  () => import('@/components/push/PushClientKit').then((m) => ({ default: m.PushClientKit })),
  { ssr: false, loading: () => null }
);
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }, { locale: 'ku' }]
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  let locale: string = 'en';
  let messages: any = {};

  try {
    const resolvedParams = await params;
    locale = resolvedParams?.locale || 'en';

    // Validate locale
    if (!locale || !locales.includes(locale as any)) {
      locale = 'en';
    }

    // Enable static rendering
    try {
      unstable_setRequestLocale(locale);
    } catch (error) {
      console.error('Failed to set request locale:', error);
    }

    // Get messages with error handling
    try {
      messages = await getMessages() || {};
    } catch (error) {
      console.error('Failed to load messages:', error);
      // Fallback to empty messages object
      messages = {};
    }
  } catch (error) {
    console.error('Error in LocaleLayout:', error);
    // Don't call notFound() here, just use defaults
    locale = 'en';
    messages = {};
  }

  return (
    <ErrorBoundary>
      {/* Load Vazirmatn so it’s available when BodyFontSwitcher applies it for RTL */}
      <span className={vazirmatn.className} aria-hidden style={{ position: 'absolute', left: -9999, pointerEvents: 'none' }} />
      <NextIntlClientProvider locale={locale} messages={messages || {}}>
        <IpBanGuard>
          <AuthProvider>
            <ThemeProvider>
              <SetDirection />
              <BodyFontSwitcher interClass={inter.className} vazirmatnClass={vazirmatn.className} />
              <ToastProvider>
                <PredictLoadingProvider>
                  <ScrollToTop />
                  <SkipToContent />
                  <BackendStatusBanner />
                  <div className="flex flex-col min-h-screen">
                    <ErrorBoundary>
                      <Suspense fallback={<div className="h-16" aria-hidden />}>
                        <Header />
                      </Suspense>
                    </ErrorBoundary>
                    <main
                      id="main-content"
                      className="relative flex-1 min-h-[calc(100vh-8rem)] bg-transparent"
                      role="main"
                    >
                      {/* Single page canvas: body supplies mesh (globals.css); no extra full-page bg in route components */}
                      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-20 overflow-x-hidden overflow-y-visible bg-transparent">
                        <ErrorBoundary homeHref={`/${locale}`}>
                          <PageTransition>
                            {children}
                          </PageTransition>
                        </ErrorBoundary>
                      </div>
                    </main>
                    <ErrorBoundary>
                      <Footer />
                    </ErrorBoundary>
                    <BottomNav />
                  </div>
                  <CookieConsent />
                  <PushClientKit />
                  <ChatBot />
                  <OnboardingModal />
                </PredictLoadingProvider>
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </IpBanGuard>
      </NextIntlClientProvider>
    </ErrorBoundary>
  );
}
