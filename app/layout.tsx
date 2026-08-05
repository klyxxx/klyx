import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { TooltipProvider } from "@/app/ui/tooltip";
import AppSidebar from "@/app/ui/AppSidebar";
import ThemeProvider from "@/app/components/ThemeProvider";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "KLYX — Tous vos services, simplement", template: "%s | KLYX" },
  description: "Trouvez, réservez et payez des prestataires de confiance pour tous les services du quotidien.",
  applicationName: "KLYX",
  keywords: ["services", "prestataires", "réservation", "Belgique", "KLYX"],
  authors: [{ name: "KLYX" }],
  creator: "KLYX",
  publisher: "KLYX",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/apple-icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "fr_BE",
    url: appUrl,
    siteName: "KLYX",
    title: "KLYX — Tous vos services, simplement",
    description: "Trouvez, réservez et payez des prestataires de confiance depuis une seule plateforme.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KLYX — Tous vos services, simplement",
    description: "Une seule plateforme pour organiser tous vos services du quotidien.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const themeScript = `
  try {
    const savedTheme = localStorage.getItem("klyx_theme") || "system";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = savedTheme === "dark" || (savedTheme === "system" && systemDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning className={cn("h-full antialiased", geistSans.variable, geistMono.variable, inter.variable, "font-sans")}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            <div className="min-h-screen lg:flex">
              <AppSidebar />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
