import Link from "next/link";
import Stripe from "stripe";
import { markBookingPaidFromSession } from "@/lib/stripe-payments";

type ConfirmationResult = {
  confirmed: boolean;
  message: string;
};

async function confirmPayment(
  bookingId: string | undefined,
  sessionId: string | undefined
): Promise<ConfirmationResult> {
  if (!bookingId || !sessionId) {
    return {
      confirmed: false,
      message: "La confirmation Stripe est incomplète. Aucun débit n’est confirmé.",
    };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!stripeSecretKey) {
    return {
      confirmed: false,
      message: "KLYX ne peut pas encore confirmer ce paiement.",
    };
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.booking_id !== bookingId) {
      return {
        confirmed: false,
        message: "Cette confirmation ne correspond pas à la réservation.",
      };
    }

    if (session.payment_status !== "paid") {
      return {
        confirmed: false,
        message: "Stripe n’a confirmé aucun débit pour cette réservation.",
      };
    }

    await markBookingPaidFromSession(session);

    return {
      confirmed: true,
      message:
        "Ton paiement est confirmé. La réservation ne peut plus être payée une seconde fois.",
    };
  } catch (error) {
    console.error("Payment success confirmation error:", error);

    return {
      confirmed: false,
      message: "KLYX n’a pas pu confirmer ce paiement. Aucun nouveau paiement ne sera créé.",
    };
  }
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string; session_id?: string }>;
}) {
  const {
    booking_id: bookingId,
    session_id: sessionId,
  } = await searchParams;
  const confirmation = await confirmPayment(bookingId, sessionId);
  const destination = bookingId
    ? `/bookings/${bookingId}${confirmation.confirmed ? "?payment=success" : ""}`
    : "/bookings";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
            confirmation.confirmed
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-300"
          }`}
        >
          {confirmation.confirmed ? "✓" : "!"}
        </div>

        <h1 className="mt-6 text-3xl font-bold">
          {confirmation.confirmed
            ? "Paiement effectué avec succès"
            : "Paiement non confirmé"}
        </h1>

        <p className="mt-3 text-zinc-400">{confirmation.message}</p>

        <Link
          href={destination}
          className="mt-8 inline-flex rounded-xl bg-violet-600 px-6 py-4 font-semibold hover:bg-violet-700"
        >
          Voir la réservation
        </Link>
      </section>
    </main>
  );
}
