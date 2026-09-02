import { redirect } from "next/navigation";

// KLYX_AI_FIRST_REQUESTS_15_03
// Compatibility route: request data remains behind /api/market/requests while
// the client lifecycle now converges on the unified Activité destination.
export const metadata = {
  description: "Confirmer et publier la demande · Choisir ce prestataire",
};

export default function RequestsPage() {
  redirect("/bookings");
}
