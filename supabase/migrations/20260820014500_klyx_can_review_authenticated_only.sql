-- KLYX_CAN_REVIEW_AUTHENTICATED_ONLY_12B_13M
-- klyx_can_review is a SECURITY DEFINER policy helper for authenticated review
-- writes. Anonymous callers do not need direct RPC execution and must not be
-- able to use it as a booking/client/provider relationship oracle.

begin;

revoke all on function public.klyx_can_review(uuid, uuid, uuid)
  from public, anon;

grant execute on function public.klyx_can_review(uuid, uuid, uuid)
  to authenticated, service_role;

commit;
