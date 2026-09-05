-- KLY-10: pin handle_new_user to an empty search_path without replacing its body.
alter function public.handle_new_user()
  set search_path = '';
