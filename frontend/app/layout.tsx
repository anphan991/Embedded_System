import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./Sidebar";
import { ThemeProvider } from "./ThemeProvider";
import { AlertsProvider } from "./context/AlertsContext";
import { LanguageProvider } from "./context/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FallGuard AI Monitoring",
  description: "Professional Healthcare Fall Detection System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col lg:flex-row bg-slate-50 dark:bg-[#0b0f19] overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          <LanguageProvider>
            <AlertsProvider>
              <Sidebar />
              <main className="flex-1 h-full overflow-hidden flex flex-col relative z-20">
                {children}
              </main>
            </AlertsProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
