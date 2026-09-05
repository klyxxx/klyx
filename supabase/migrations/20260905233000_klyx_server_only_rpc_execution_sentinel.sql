-- KLYX SERVER-ONLY RPC EXECUTION SENTINEL
--
-- Sensitive SECURITY DEFINER functions can bypass ordinary table RLS by design.
-- This migration makes deployment fail if a browser role ever regains EXECUTE
-- on RPCs that are reserved for authenticated KLYX server orchestration.

begin;

do $$
declare
  function_signature text;
  function_oid regprocedure;
  role_name text;
begin
  foreach function_signature in array array[
    'public.klyx_attach_split_checkout_13_27(uuid,text,text,text)',
    'public.klyx_claim_split_payment_unit_13_27(uuid,uuid,text)',
    'public.klyx_confirm_split_booking_prices_13_23(uuid,uuid,text,jsonb,integer,bigint,text)',
    'public.klyx_confirm_split_payment_plan_13_26(uuid,uuid,uuid,text,jsonb,integer,integer,bigint,text)',
    'public.klyx_confirm_split_plan_13_18(uuid,uuid,text,jsonb,integer,integer)',
    'public.klyx_finalize_split_payment_run_13_27(uuid,uuid)',
    'public.klyx_recompute_split_refund_run_13_28(uuid)',
    'public.klyx_release_split_checkout_13_27(uuid,text)',
    'public.klyx_resolve_group_cancellation(uuid,uuid,text)',
    'public.klyx_security_audit()'
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
          'KLYX_SECURITY_SENTINEL_RPC_EXECUTE_LEAK:role=% function=%',
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
        'KLYX_SECURITY_SENTINEL_SERVICE_ROLE_EXECUTE_MISSING:function=%',
        function_signature
        using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

commit;
