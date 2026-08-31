import { redirect } from "next/navigation";

// KLYX_BABYSITTER_BOOKING_COMPATIBILITY_ROUTE
type SearchParams = Record<string, string | string[] | undefined>;

export default async function BabysitterBookingCompatibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sourceParams = await searchParams;
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(sourceParams)) {
    if (typeof value === "string") {
      nextParams.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        nextParams.append(key, item);
      }
    }
  }

  nextParams.set("service", "babysitting");
  redirect(`/providers/${encodeURIComponent(id)}/book?${nextParams.toString()}`);
}
