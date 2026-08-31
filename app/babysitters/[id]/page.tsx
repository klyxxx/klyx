import { redirect } from "next/navigation";

// KLYX_BABYSITTER_BOOKING_COMPATIBILITY_ROUTE
type SearchParams = Record<string, string | string[] | undefined>;

export default async function LegacyBabysitterBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, sourceParams] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(sourceParams)) {
    if (typeof value === "string") {
      query.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  query.set("service", "babysitting");
  redirect(`/providers/${encodeURIComponent(id)}/book?${query.toString()}`);
}
