-- KLYX_SKILL_QUALIFICATION_RULES_SERVER_ONLY_12B_13G
-- Qualification rules are internal trust/compliance configuration. Browser
-- components consume them only through authenticated server APIs.

begin;

revoke all privileges on table public.skill_qualification_rules
  from public, anon, authenticated;

grant all privileges on table public.skill_qualification_rules
  to service_role;

commit;
