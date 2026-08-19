-- KLYX_TRIGGER_FUNCTION_EXECUTION_HARDENING_12B_12Z
--
-- PostgreSQL functions are executable by PUBLIC by default, and the canonical
-- baseline additionally granted future public-schema functions to anon and
-- authenticated. KLYX 12B.12F hardened future tables/sequences but intentionally
-- did not yet cover functions.
--
-- Trigger and event-trigger functions are infrastructure entry points, not
-- browser RPCs. Existing triggers continue to invoke their functions without
-- requiring anon/authenticated EXECUTE privileges. Revoke browser execution
-- from every SECURITY DEFINER trigger/event-trigger in public and make future
-- postgres-owned functions fail closed unless a later migration opens an RPC
-- explicitly.

begin;

alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

do $$
declare
  function_signature text;
begin
  for function_signature in
    select format(
      '%I.%I(%s)',
      namespace.nspname,
      procedure.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid)
    )
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_type as return_type
      on return_type.oid = procedure.prorettype
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and return_type.typname in ('trigger', 'event_trigger')
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated',
      function_signature
    );
    execute format(
      'grant execute on function %s to service_role',
      function_signature
    );
  end loop;
end;
$$;

commit;
