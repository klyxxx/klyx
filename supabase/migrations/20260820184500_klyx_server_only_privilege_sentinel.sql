-- ============================================================
-- KLYX SERVER-ONLY PRIVILEGE SENTINEL
--
-- This migration intentionally makes the deployment fail if a browser role
-- still has any direct table privilege on state that KLYX has classified as
-- server-only. It turns the previous hardening migrations into an executable
-- production invariant instead of relying on migration-file presence alone.
-- ============================================================

do $$
declare
  table_name text;
  role_name text;
  privilege_name text;
begin
  foreach table_name in array array[
    'booking_financial_ledger',
    'booking_group_cancellation_events',
    'stripe_webhook_events',
    'sumsub_webhook_events',
    'market_split_plan_confirmations',
    'split_booking_batch_items',
    'split_booking_batches',
    'split_booking_price_confirmations',
    'split_booking_payment_confirmations',
    'split_booking_payment_runs',
    'split_booking_payment_units',
    'split_booking_payment_refunds',
    'split_booking_proof_consumptions',
    'user_preferences',
    'client_memory_profiles',
    'user_memory_events',
    'client_agent_plans',
    'provider_service_zones',
    'skill_qualification_rules',
    'stores',
    'photo_service_requests',
    'reviews',
    'service_proposals'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception
        'KLYX_SECURITY_SENTINEL_TABLE_MISSING:%',
        table_name
        using errcode = 'P0001';
    end if;

    foreach role_name in array array['anon', 'authenticated']
    loop
      foreach privilege_name in array array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
        'MAINTAIN'
      ]
      loop
        if has_table_privilege(
          role_name,
          format('public.%I', table_name),
          privilege_name
        ) then
          raise exception
            'KLYX_SECURITY_SENTINEL_PRIVILEGE_LEAK:role=% table=% privilege=%',
            role_name,
            table_name,
            privilege_name
            using errcode = 'P0001';
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- If this migration is recorded as applied, every table above was present and
-- neither anon nor authenticated had any direct privilege on it at apply time.
