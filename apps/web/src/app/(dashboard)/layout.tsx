'use client';

import { AuthProvider } from '@/components/providers/auth-provider';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { ThemeProvider } from '@/app/components/ThemeProvider';
import AppHeader from '@/app/components/AppHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProtectedRoute>
          <div className="min-h-screen flex flex-col transition-colors bg-slate-50 text-slate-900 dark:bg-[#05050f] dark:text-white">
            <AppHeader />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </ProtectedRoute>
      </AuthProvider>
    </ThemeProvider>
  );
}
