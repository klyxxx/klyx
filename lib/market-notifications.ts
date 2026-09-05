import { supabaseAdmin } from "@/lib/supabase-admin";

type CompatibleProviderNotificationResult = {
  candidateCount: number;
  deliveryFailed: boolean;
};

export async function createMarketNotification(params: {
  userId: string;
  marketRequestId: string;
  title: string;
  message: string;
  href: string;
}) {
  const { error } = await supabaseAdmin
    .from("user_notifications")
    .insert({
      user_id: params.userId,
      booking_id: null,
      market_request_id: params.marketRequestId,
      type: "market_update",
      title: params.title,
      message: params.message,
      href: params.href,
    });

  if (error) {
    console.error(
      "Market notification error:",
      error.message
    );
  }
}

export async function notifyCompatibleProviders(params: {
  marketRequestId: string;
  serviceId: string;
  serviceName: string;
  city: string;
}): Promise<CompatibleProviderNotificationResult> {
  const { data: userServices, error } =
    await supabaseAdmin
      .from("user_services")
      .select("user_id")
      .eq("service_id", params.serviceId)
      .eq("active", true)
      .eq("provider_enabled", true);

  if (error) {
    console.error(
      "Compatible provider notification lookup error:",
      error.message
    );
    return {
      candidateCount: 0,
      deliveryFailed: true,
    };
  }

  const providerIds = [
    ...new Set(
      (userServices ?? [])
        .map((item) => item.user_id)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  if (providerIds.length === 0) {
    return {
      candidateCount: 0,
      deliveryFailed: false,
    };
  }

  const rows = providerIds.map((providerId) => ({
    user_id: providerId,
    booking_id: null,
    market_request_id: params.marketRequestId,
    type: "market_update",
    title: "Nouvelle mission compatible",
    message: `${params.serviceName} · ${params.city}. Une nouvelle demande correspond à un métier actif de ton profil.`,
    href: "/provider/jobs",
    idempotency_key:
      `market-provider:${params.marketRequestId}:${providerId}`,
  }));

  const { error: insertError } =
    await supabaseAdmin
      .from("user_notifications")
      .upsert(rows, {
        onConflict: "idempotency_key",
        ignoreDuplicates: true,
      });

  if (insertError) {
    console.error(
      "Compatible provider notifications insert error:",
      insertError.message
    );
    return {
      candidateCount: providerIds.length,
      deliveryFailed: true,
    };
  }

  return {
    candidateCount: providerIds.length,
    deliveryFailed: false,
  };
}
