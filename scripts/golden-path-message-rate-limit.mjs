import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const MESSAGE_ACTION = "message_send";
const MESSAGE_LIMIT = 30;

async function expectRejectedInsert(promise, sentinel) {
  const { error } = await promise;

  if (!error || !String(error.message).includes(sentinel)) {
    throw new Error(
      `Expected direct message insert to fail with ${sentinel}.`
    );
  }
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden message-rate proof is allowed only on ephemeral local Supabase."
    );
  }

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    throw new Error("Unable to authenticate golden message-rate account.");
  }

  const userId = signInData.user.id;
  const keyHash = createHash("sha256")
    .update(`klyx-rate-limit:${userId}`, "utf8")
    .digest("hex");
  let createdMessageIds = [];

  try {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, account_type")
      .eq("owner_user_id", userId);

    if (profilesError) {
      throw new Error(
        `Unable to load golden message-rate profiles: ${profilesError.message}`
      );
    }

    const client = (profiles ?? []).find(
      (profile) => profile.account_type === "client"
    );
    const provider = (profiles ?? []).find(
      (profile) => profile.account_type === "provider"
    );

    if (!client || !provider) {
      throw new Error("Golden message-rate profiles are missing.");
    }

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, parent_id, provider_id")
      .eq("parent_id", client.id)
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bookingError || !booking) {
      throw new Error(
        `Golden message-rate booking is missing: ${
          bookingError?.message ?? "no booking"
        }`
      );
    }

    await expectRejectedInsert(
      userClient.from("messages").insert({
        booking_id: booking.id,
        sender_id: client.id,
        receiver_id: provider.id,
        message: "   ",
        is_read: false,
      }),
      "klyx_messages_nonblank_check"
    );

    await expectRejectedInsert(
      userClient.from("messages").insert({
        booking_id: booking.id,
        sender_id: client.id,
        receiver_id: provider.id,
        message: "x".repeat(2001),
        is_read: false,
      }),
      "klyx_messages_length_check"
    );

    const { data: invalidCounter, error: invalidCounterError } = await admin
      .from("api_rate_limits")
      .select("request_count")
      .eq("key_hash", keyHash)
      .eq("action", MESSAGE_ACTION)
      .maybeSingle();

    if (invalidCounterError || invalidCounter) {
      throw new Error(
        "Rejected invalid message inserts must not consume committed quota."
      );
    }

    const rows = Array.from({ length: MESSAGE_LIMIT }, (_, index) => ({
      booking_id: booking.id,
      sender_id: client.id,
      receiver_id: provider.id,
      message: `Golden anti-abuse message ${index + 1}`,
      is_read: true,
    }));

    const { data: inserted, error: insertError } = await userClient
      .from("messages")
      .insert(rows)
      .select("id, is_read");

    if (insertError || !inserted || inserted.length !== MESSAGE_LIMIT) {
      throw new Error(
        `Unable to insert allowed golden messages: ${
          insertError?.message ?? "unexpected inserted row count"
        }`
      );
    }

    createdMessageIds = inserted.map((row) => row.id);

    if (inserted.some((row) => row.is_read !== false)) {
      throw new Error("New direct messages must be forced to unread state.");
    }

    const notificationKeys = createdMessageIds.map((id) => `message:${id}`);
    const { data: notifications, error: notificationError } = await admin
      .from("user_notifications")
      .select("deduplication_key")
      .in("deduplication_key", notificationKeys);

    if (
      notificationError ||
      !notifications ||
      notifications.length !== MESSAGE_LIMIT ||
      notificationKeys.some(
        (key) =>
          !notifications.some(
            (notification) => notification.deduplication_key === key
          )
      )
    ) {
      throw new Error(
        `Golden message notifications are incomplete: ${
          notificationError?.message ?? String(notifications?.length ?? 0)
        }`
      );
    }

    await expectRejectedInsert(
      userClient.from("messages").insert({
        booking_id: booking.id,
        sender_id: client.id,
        receiver_id: provider.id,
        message: "Golden over-limit message",
        is_read: false,
      }),
      "KLYX_MESSAGE_RATE_LIMITED"
    );

    const { data: counter, error: counterError } = await admin
      .from("api_rate_limits")
      .select("key_hash, action, request_count")
      .eq("key_hash", keyHash)
      .eq("action", MESSAGE_ACTION)
      .single();

    if (
      counterError ||
      !counter ||
      counter.key_hash !== keyHash ||
      counter.action !== MESSAGE_ACTION ||
      Number(counter.request_count) !== MESSAGE_LIMIT
    ) {
      throw new Error(
        `Golden message-rate counter is invalid: ${
          counterError?.message ?? JSON.stringify(counter)
        }`
      );
    }

    process.stdout.write(
      `${JSON.stringify({
        messageDbAbuseGuardVerified: true,
        allowedPerMinute: MESSAGE_LIMIT,
        overLimitRejected: true,
        invalidContentRejected: true,
        newMessagesForcedUnread: true,
        messageNotificationsVerified: MESSAGE_LIMIT,
        directSupabaseClientProtected: true,
        localSupabaseOnly: true,
      })}\n`
    );
  } finally {
    if (createdMessageIds.length > 0) {
      await admin
        .from("user_notifications")
        .delete()
        .in(
          "deduplication_key",
          createdMessageIds.map((id) => `message:${id}`)
        );
      await admin.from("messages").delete().in("id", createdMessageIds);
    }

    await admin
      .from("api_rate_limits")
      .delete()
      .eq("key_hash", keyHash)
      .eq("action", MESSAGE_ACTION);

    await userClient.auth.signOut();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden message-rate proof failed: ${message}`);
  process.exitCode = 1;
});
