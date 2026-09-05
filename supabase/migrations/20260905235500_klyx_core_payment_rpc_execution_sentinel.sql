-- KLYX core payment RPC execution hardening
--
-- Core payment/state-transition RPCs are orchestrated by authenticated KLYX
-- server routes through the Supabase service role. They must never be callable
-- directly from browser roles, because SECURITY DEFINER functions can bypass
-- ordinary table RLS by design.
--
-- This migration is intentionally self-verifying: deployment fails if a future
-- migration or concurrent agent re-opens EXECUTE to anon/authenticated.

begin;

revoke all on function public.klyx_claim_booking_payment(uuid, uuid, uuid) from public;
revoke all on function public.klyx_claim_booking_payment(uuid, uuid, uuid) from anon;
revoke all on function public.klyx_claim_booking_payment(uuid, uuid, uuid) from authenticated;
grant execute on function public.klyx_claim_booking_payment(uuid, uuid, uuid) to service_role;

revoke all on function public.klyx_claim_booking_group_payment(uuid, uuid, uuid) from public;
revoke all on function public.klyx_claim_booking_group_payment(uuid, uuid, uuid) from anon;
revoke all on function public.klyx_claim_booking_group_payment(uuid, uuid, uuid) from authenticated;
grant execute on function public.klyx_claim_booking_group_payment(uuid, uuid, uuid) to service_role;

revoke all on function public.klyx_release_expired_booking_checkout(uuid, text) from public;
revoke all on function public.klyx_release_expired_booking_checkout(uuid, text) from anon;
revoke all on function public.klyx_release_expired_booking_checkout(uuid, text) from authenticated;
grant execute on function public.klyx_release_expired_booking_checkout(uuid, text) to service_role;

revoke all on function public.klyx_create_multi_slot_booking_group(uuid, uuid, uuid) from public;
revoke all on function public.klyx_create_multi_slot_booking_group(uuid, uuid, uuid) from anon;
revoke all on function public.klyx_create_multi_slot_booking_group(uuid, uuid, uuid) from authenticated;
grant execute on function public.klyx_create_multi_slot_booking_group(uuid, uuid, uuid) to service_role;

revoke all on function public.klyx_provider_group_decision(uuid, uuid, text, text) from public;
revoke all on function public.klyx_provider_group_decision(uuid, uuid, text, text) from anon;
revoke all on function public.klyx_provider_group_decision(uuid, uuid, text, text) from authenticated;
grant execute on function public.klyx_provider_group_decision(uuid, uuid, text, text) to service_role;

do $$
declare
  function_signature text;
  function_oid regprocedure;
  role_name text;
begin
  foreach function_signature in array array[
    'public.klyx_claim_booking_payment(uuid,uuid,uuid)',
    'public.klyx_claim_booking_group_payment(uuid,uuid,uuid)',
    'public.klyx_release_expired_booking_checkout(uuid,text)',
    'public.klyx_create_multi_slot_booking_group(uuid,uuid,uuid)',
    'public.klyx_provider_group_decision(uuid,uuid,text,text)'
  ]
  loop
    function_oid := to_regprocedure(function_signature);

    if function_oid is null then
      raise exception
        'KLYX_SECURITY_SENTINEL_FUNCTION_MISSING:%',
        function_signature
        using errcode = 'P0001';
    end if;

    foreach role_name in array array['anon', 'authenticated']
    loop
      if has_function_privilege(
        role_name,
        function_oid,
        'EXECUTE'
      ) then
        raise exception
          'KLYX_SECURITY_SENTINEL_CORE_PAYMENT_RPC_EXECUTE_LEAK:role=% function=%',
          role_name,
          function_signature
          using errcode = 'P0001';
      end if;
    end loop;

    if not has_function_privilege(
      'service_role',
      function_oid,
      'EXECUTE'
    ) then
      raise exception
        'KLYX_SECURITY_SENTINEL_CORE_PAYMENT_SERVICE_ROLE_EXECUTE_MISSING:function=%',
        function_signature
        using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

comment on function public.klyx_claim_booking_payment(uuid, uuid, uuid) is
  'Server-only atomic claim for one KLYX booking payment attempt.';
comment on function public.klyx_claim_booking_group_payment(uuid, uuid, uuid) is
  'Server-only atomic claim for one KLYX grouped-booking payment attempt.';
comment on function public.klyx_release_expired_booking_checkout(uuid, text) is
  'Server-only release of the exact expired Stripe Checkout session for a booking.';
comment on function public.klyx_create_multi_slot_booking_group(uuid, uuid, uuid) is
  'Server-only creation of a KLYX multi-slot booking group after API ownership checks.';
comment on function public.klyx_provider_group_decision(uuid, uuid, text, text) is
  'Server-only provider decision transition for a KLYX booking group.';

commit;
