import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KLYX — Services du quotidien",
    short_name: "KLYX",
    description:
      "Trouve, réserve et organise les services du quotidien avec KLYX.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#09090b",
    lang: "fr-BE",
    categories: [
      "lifestyle",
      "productivity",
      "business",
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Accueil KLYX",
        short_name: "Accueil",
        description: "Ouvrir KLYX",
        url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Trouver un service",
        short_name: "Rechercher",
        description:
          "Rechercher un prestataire sur KLYX",
        url: "/search",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Mes réservations",
        short_name: "Réservations",
        description:
          "Consulter mes réservations KLYX",
        url: "/bookings",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
  };
}
