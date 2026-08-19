-- ============================================================
-- KLYX 12B.12U NOTIFICATION UNIFICATION + LEGACY HARDENING
--
-- KLYX now uses public.user_notifications as the canonical notification
-- store. The legacy public.notifications table used a different unread column
-- (`is_read`) while NotificationButton expected `read_at`, and the historical
-- booking-status trigger duplicated the modern server notification path.
--
-- KLYX_NOTIFICATION_UNIFICATION_12B_12U
-- ============================================================

begin;

create or replace function public.notify_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'accepted' then
      insert into public.user_notifications (
        user_id,
        booking_id,
        type,
        title,
        message,
        href,
        deduplication_key
      )
      values (
        new.parent_id,
        new.id,
        'booking_accepted',
        'Réservation acceptée',
        'Le prestataire a accepté ta demande. Tu peux maintenant payer.',
        '/bookings/' || new.id::text,
        'booking:' || new.id::text || ':accepted'
      )
      on conflict (deduplication_key) do nothing;
    elsif new.status = 'rejected' then
      insert into public.user_notifications (
        user_id,
        booking_id,
        type,
        title,
        message,
        href,
        deduplication_key
      )
      values (
        new.parent_id,
        new.id,
        'booking_rejected',
        'Réservation refusée',
        coalesce(
          nullif(btrim(new.provider_response), ''),
          'Le prestataire n’est pas disponible pour cette demande.'
        ),
        '/bookings/' || new.id::text,
        'booking:' || new.id::text || ':rejected'
      )
      on conflict (deduplication_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- Trigger execution does not require browser roles to call this SECURITY
-- DEFINER function directly. Keep explicit execution only for service_role.
revoke all privileges on function public.notify_booking_status()
  from public, anon, authenticated;
grant execute on function public.notify_booking_status()
  to service_role;

-- The legacy table remains as historical data only. No active KLYX UI or
-- booking-status trigger should use it after this migration.
revoke all privileges on table public.notifications
  from public, anon, authenticated;
drop policy if exists "klyx_notifications_all"
  on public.notifications;
grant all privileges on table public.notifications
  to service_role;

commit;
