import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ServiceRow = {
  name: string | null;
  slug: string | null;
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("services")
      .select("name, slug")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const services = ((data ?? []) as ServiceRow[])
      .map((service) => ({
        value: service.slug?.trim() ?? "",
        label: service.name?.trim() || service.slug?.trim() || "Service KLYX",
      }))
      .filter((service) => {
        if (!service.value || seen.has(service.value)) return false;
        seen.add(service.value);
        return true;
      });

    return NextResponse.json({
      services: [{ value: "all", label: "Tous les services" }, ...services],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger les services." },
      { status: 500 }
    );
  }
}
