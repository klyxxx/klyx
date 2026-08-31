import { redirect } from "next/navigation";

// KLYX_BABYSITTERS_COMPATIBILITY_ROUTE
type SearchParams = Record<string, string | string[] | undefined>;

export default async function BabysittersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sourceParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(sourceParams)) {
    if (typeof value === "string") {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  params.set("service", "babysitting");
  redirect(`/recommendations?${params.toString()}`);
}
