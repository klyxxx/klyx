import { NextResponse } from "next/server";
import {
  secureApiErrorResponse,
} from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ServiceRow = {
  name: string | null;
  slug: string | null;
};

export async function GET() {
  const startedAt = Date.now();

  try {
    const { data, error } = await supabaseAdmin
      .from("services")
      .select("name, slug")
      .order("name", { ascending: true });

    if (error) throw error;

    const seen = new Set<string>();
    const services = ((data ?? []) as ServiceRow[])
      .map((service) => ({
        value: service.slug?.trim() ?? "",
        label:
          service.name?.trim() ||
          service.slug?.trim() ||
          "Service KLYX",
      }))
      .filter((service) => {
        if (!service.value || seen.has(service.value)) return false;
        seen.add(service.value);
        return true;
      });

    return NextResponse.json({
      services: [
        { value: "all", label: "Tous les services" },
        ...services,
      ],
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "public_services_load_failed",
      route: "/api/services/public",
      method: "GET",
      code: "public_services_load_failed",
      status: 500,
      startedAt,
    });
  }
}
