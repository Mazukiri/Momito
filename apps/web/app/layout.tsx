import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";
import { ServiceWorkerRegister } from "./components/sw-register";
import { OfflineBanner } from "./components/offline-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Momito - Interview Prep",
  description: "Practice interview questions and track your progress",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Momito",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit:'cover' lets the page draw under the iOS home-indicator/notch
  // area, which is what makes env(safe-area-inset-bottom) (used by BottomTabs)
  // resolve to a real nonzero value instead of always being 0.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Runs before hydration so the very first paint already has the right theme —
// without this, ThemeProvider's useEffect only applies the class after mount,
// producing a light-mode flash on every reload for a user who has dark saved.
const THEME_INIT_SCRIPT = `(function() {
  try {
    var stored = window.localStorage.getItem('momito-theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <ThemeProvider>
          <OfflineBanner />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
