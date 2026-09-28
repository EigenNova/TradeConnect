-- ============================================================================
-- TradeConnect — 005 REFERENCE DATA
-- Pilot trades for Lae. Safe to re-run.
-- ============================================================================

insert into public.categories (id, name, slug) values
  (1, 'Electrical', 'electrical'),
  (2, 'Mechanical', 'mechanical'),
  (3, 'Plumbing',   'plumbing')
on conflict (id) do update set name = excluded.name, slug = excluded.slug;

-- keep the identity sequence ahead of the explicit ids above
select setval(pg_get_serial_sequence('public.categories', 'id'),
              (select max(id) from public.categories));
