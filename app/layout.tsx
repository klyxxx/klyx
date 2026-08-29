import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import ActiveProfileSync from "@/app/components/ActiveProfileSync";
import FounderAccessBar from "@/app/components/FounderAccessBar";
import KlyxLocaleProvider from "@/app/components/KlyxLocaleProvider";
import KlyxSkipLink from "@/app/components/KlyxSkipLink";
import PwaRegistrar from "@/app/components/PwaRegistrar";
import ThemeProvider from "@/app/components/ThemeProvider";
import AppSidebar from "@/app/ui/AppSidebar";
import AppVisualBackground from "@/app/ui/AppVisualBackground";
import { TooltipProvider } from "@/app/ui/tooltip";
import {
  getKlyxLocaleMetadata,
  type KlyxLocale,
} from "@/lib/klyx-i18n";
import { getServerKlyxLocale } from "@/lib/klyx-server-i18n";
import { cn } from "@/lib/utils";

import "./globals.css";
import "./klyx-visual-system.css";
import "./klyx-accessibility.css";
import "./klyx-quality-system.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000";

type SeoCopy = {
  title: string;
  description: string;
  socialDescription: string;
  keywords: string[];
};

const SEO_COPY: Partial<Record<KlyxLocale, SeoCopy>> = {
  fr: {
    title: "KLYX — Tous vos services, simplement",
    description:
      "Trouvez, réservez et payez des prestataires de confiance pour tous les services du quotidien.",
    socialDescription:
      "Trouvez, réservez et payez des prestataires de confiance depuis une seule plateforme.",
    keywords: [
      "services",
      "prestataires",
      "réservation",
      "KLYX",
    ],
  },
  en: {
    title: "KLYX — Everyday services, simply",
    description:
      "Find, book and pay trusted providers for everyday services from one place.",
    socialDescription:
      "Find, book and pay trusted providers from one simple platform.",
    keywords: [
      "services",
      "providers",
      "booking",
      "KLYX",
    ],
  },
  nl: {
    title: "KLYX — Dagelijkse diensten, eenvoudig",
    description:
      "Vind, boek en betaal betrouwbare dienstverleners voor dagelijkse diensten op één plek.",
    socialDescription:
      "Vind, boek en betaal betrouwbare dienstverleners vanaf één eenvoudig platform.",
    keywords: [
      "diensten",
      "dienstverleners",
      "boeken",
      "KLYX",
    ],
  },
  de: {
    title: "KLYX — Alltagsservices, einfach",
    description:
      "Finde, buche und bezahle vertrauenswürdige Anbieter für Alltagsservices an einem Ort.",
    socialDescription:
      "Finde, buche und bezahle vertrauenswürdige Anbieter über eine einfache Plattform.",
    keywords: [
      "Dienstleistungen",
      "Anbieter",
      "Buchung",
      "KLYX",
    ],
  },
};

function getSeoCopy(locale: KlyxLocale): SeoCopy {
  return SEO_COPY[locale] ?? SEO_COPY.en!;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerKlyxLocale();
  const localeMetadata = getKlyxLocaleMetadata(locale);
  const copy = getSeoCopy(locale);
  const openGraphLocale = localeMetadata.htmlLang.replace("-", "_");

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: copy.title,
      template: "%s | KLYX",
    },
    description: copy.description,
    applicationName: "KLYX",
    keywords: copy.keywords,
    authors: [{ name: "KLYX" }],
    creator: "KLYX",
    publisher: "KLYX",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "KLYX",
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
        {
          url: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      shortcut: "/icon.svg",
      apple: [
        {
          url: "/icons/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    openGraph: {
      type: "website",
      locale: openGraphLocale,
      url: appUrl,
      siteName: "KLYX",
      title: copy.title,
      description: copy.socialDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.socialDescription,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#ffffff",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#09090b",
    },
  ],
};

const themeScript = `
  try {
    const savedTheme =
      localStorage.getItem("klyx_theme") || "system";

    const systemDark =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

    const dark =
      savedTheme === "dark" ||
      (
        savedTheme === "system" &&
        systemDark
      );

    document.documentElement.classList.toggle(
      "dark",
      dark
    );

    document.documentElement.style.colorScheme =
      dark ? "dark" : "light";
  } catch {}
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerKlyxLocale();
  const localeMetadata = getKlyxLocaleMetadata(locale);

  return (
    <html
      lang={localeMetadata.htmlLang}
      dir={localeMetadata.dir}
      data-klyx-locale={locale}
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        geistSans.variable,
        geistMono.variable,
        inter.variable,
        "font-sans"
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeScript,
          }}
        />
      </head>

      <body className="min-h-full bg-background text-foreground">
        <KlyxLocaleProvider initialLocale={locale}>
          <KlyxSkipLink />

          <PwaRegistrar />
          <ActiveProfileSync />
          <AppVisualBackground />

          <ThemeProvider>
            <TooltipProvider>
              <div className="klyx-app-shell min-h-screen lg:flex">
                <AppSidebar />

                <div className="klyx-app-content min-w-0 flex-1">
                  <FounderAccessBar />
                  <div
                    id="klyx-main-content"
                    tabIndex={-1}
                  >
                    {children}
                  </div>
                </div>
              </div>
            </TooltipProvider>
          </ThemeProvider>
        </KlyxLocaleProvider>
      </body>
    </html>
  );
}
