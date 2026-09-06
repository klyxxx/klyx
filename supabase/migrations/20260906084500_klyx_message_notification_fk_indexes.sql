-- KLY-17: cover the five live unindexed foreign keys in messaging/notifications.
-- Scope is intentionally limited to index creation; no policies, constraints,
-- data, payments, or application behavior are changed here.

create index if not exists messages_booking_id_idx
  on public.messages (booking_id);

create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

create index if not exists messages_receiver_id_idx
  on public.messages (receiver_id);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

create index if not exists user_notifications_booking_id_idx
  on public.user_notifications (booking_id);

-- Fail closed if an existing same-name index caused IF NOT EXISTS to skip a
-- structurally incorrect definition. Each target index must be valid and its
-- leading key column must be the foreign-key column it is intended to cover.
do $$
declare
  target record;
begin
  for target in
    select *
    from (
      values
        ('messages', 'messages_booking_id_idx', 'booking_id'),
        ('messages', 'messages_sender_id_idx', 'sender_id'),
        ('messages', 'messages_receiver_id_idx', 'receiver_id'),
        ('notifications', 'notifications_user_id_idx', 'user_id'),
        ('user_notifications', 'user_notifications_booking_id_idx', 'booking_id')
    ) as expected(table_name, index_name, column_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_index as index_meta
      join pg_catalog.pg_class as index_class
        on index_class.oid = index_meta.indexrelid
      join pg_catalog.pg_namespace as index_namespace
        on index_namespace.oid = index_class.relnamespace
      join pg_catalog.pg_class as table_class
        on table_class.oid = index_meta.indrelid
      join pg_catalog.pg_namespace as table_namespace
        on table_namespace.oid = table_class.relnamespace
      join lateral unnest(index_meta.indkey) with ordinality as key_column(attnum, ordinal)
        on key_column.ordinal = 1
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = table_class.oid
       and attribute.attnum = key_column.attnum
      where index_namespace.nspname = 'public'
        and table_namespace.nspname = 'public'
        and table_class.relname = target.table_name
        and index_class.relname = target.index_name
        and attribute.attname = target.column_name
        and index_meta.indisvalid
    ) then
      raise exception 'KLYX_KLY17_FK_INDEX_DRIFT: %.% must lead with %',
        target.table_name,
        target.index_name,
        target.column_name;
    end if;
  end loop;
end
$$;
