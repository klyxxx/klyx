import Link from "next/link";
import Stripe from "stripe";
import { markBookingPaidFromSession } from "@/lib/stripe-payments";

type ConfirmationResult = {
  confirmed: boolean;
  message: string;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function confirmPayment(
  bookingId: string | undefined,
  sessionId: string | undefined
): Promise<ConfirmationResult> {
  if (!bookingId || !sessionId) {
    return {
      confirmed: false,
      message:
        "La confirmation Stripe est incomplète. Aucun débit supplémentaire ne sera lancé.",
    };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!stripeSecretKey) {
    return {
      confirmed: false,
      message:
        "La clé Stripe du serveur manque. Vérifie STRIPE_SECRET_KEY dans Vercel.",
    };
  }

  try {
    const stripe = new Stripe(stripeSecretKey);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.metadata?.booking_id !== bookingId) {
        return {
          confirmed: false,
          message:
            "Cette session Stripe ne correspond pas à la réservation demandée.",
        };
      }

      if (session.payment_status === "paid") {
        await markBookingPaidFromSession(session);

        return {
          confirmed: true,
          message:
            "Stripe a confirmé le paiement et KLYX a sécurisé la réservation contre un second débit.",
        };
      }

      if (attempt < 4) {
        await wait(700);
      }
    }

    return {
      confirmed: false,
      message:
        "Stripe n’a pas encore confirmé le débit. Actualise la réservation dans quelques secondes avant de réessayer.",
    };
  } catch (error) {
    console.error("Payment success confirmation error:", error);

    return {
      confirmed: false,
      message:
        "KLYX n’a pas pu vérifier la session Stripe. Aucun nouveau paiement ne doit être lancé avant vérification de la réservation.",
    };
  }
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    booking_id?: string;
    session_id?: string;
  }>;
}) {
  const { booking_id: bookingId, session_id: sessionId } =
    await searchParams;

  const confirmation = await confirmPayment(bookingId, sessionId);

  const destination = bookingId
    ? `/bookings/${bookingId}${
        confirmation.confirmed ? "?payment=success" : ""
      }`
    : "/bookings";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="klyx-card w-full max-w-lg p-8 text-center">
        <div
          className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl ${
            confirmation.confirmed
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }`}
        >
          {confirmation.confirmed ? "✓" : "!"}
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em]">
          {confirmation.confirmed
            ? "Paiement confirmé"
            : "Confirmation en attente"}
        </h1>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {confirmation.message}
        </p>

        <Link
          href={destination}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-500"
        >
          Voir la réservation
        </Link>
      </section>
    </main>
  );
}
