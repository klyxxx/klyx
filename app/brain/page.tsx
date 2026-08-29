import { redirect } from "next/navigation";

// Compatibility alias only. KLYX exposes one assistant entry point.
export default function BrainCompatibilityPage() {
  redirect("/assistant");
}
