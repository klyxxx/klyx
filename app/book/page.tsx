import { redirect } from "next/navigation";

// KLYX_LEGACY_BOOK_COMPATIBILITY_ROUTE
export default function LegacyBookPage() {
  redirect("/recommendations?service=babysitting");
}
