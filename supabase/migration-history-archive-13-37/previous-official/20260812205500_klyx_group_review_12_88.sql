-- KLYX_GROUP_REVIEW_12_88

alter table public.reviews
  add column if not exists booking_group_id uuid
    references public.booking_groups(id)
    on delete cascade;

create index if not exists
  reviews_booking_group_idx
on public.reviews (
  booking_group_id
);

create unique index if not exists
  reviews_booking_group_author_uidx
on public.reviews (
  booking_group_id,
  author_id
)
where booking_group_id is not null;