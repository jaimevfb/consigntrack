-- 0025: auditable settlement statements
-- The generator only wrote the settlement header; the per-product breakdown
-- (settlement_lines) was never populated, so statements couldn't be audited.
-- This freezes a line item per product (qty, gross, effective commission%),
-- records who generated the statement, derives the header from the lines so
-- header == Σ lines always holds, and backfills existing settlements.

alter table public.settlement_lines
  add column if not exists unit_price numeric,
  add column if not exists commission_pct numeric,
  add column if not exists commission numeric not null default 0;

alter table public.settlements
  add column if not exists generated_by uuid;

create or replace function public.generate_settlement_ledger(p_agreement_id uuid, p_period_start date, p_period_end date)
returns settlements
language plpgsql
security definer
set search_path to 'public'
as $function$
declare a public.agreements; s public.settlements; v_gross numeric; v_comm numeric;
begin
  select * into a from public.agreements where id = p_agreement_id;
  if not found then raise exception 'agreement not found'; end if;

  if exists (
    select 1 from public.settlements x
    where x.agreement_id = p_agreement_id and x.status = 'confirmed'
      and x.period_start <= p_period_end and x.period_end >= p_period_start
  ) then
    raise exception 'That period overlaps a settled statement — corrections post to the next statement' using errcode = 'check_violation';
  end if;

  insert into public.settlements
    (agreement_id, period_start, period_end, gross_sales, commission, returns_total, damage_total, net_payable, status, generated_by)
  values
    (p_agreement_id, p_period_start, p_period_end, 0, 0, 0, 0, 0, 'pending', auth.uid())
  returning * into s;

  -- One frozen line per product sold in the window, with its effective rate.
  insert into public.settlement_lines
    (settlement_id, product_id, qty_sold, gross, unit_price, commission_pct, commission)
  select s.id, p.id,
         sum(-le.qty)::int,
         round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0)), 2),
         round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0)) / nullif(sum(-le.qty), 0), 2),
         coalesce(co.commission_pct, a.commission_pct),
         round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0) * coalesce(co.commission_pct, a.commission_pct) / 100.0), 2)
  from public.ledger_entries le
  join public.products p on p.id = le.sku_id
  left join public.commission_overrides co on co.agreement_id = a.id and co.product_id = le.sku_id
  where le.entry_type = 'SALE' and le.consignee_id = a.store_id and p.consignor_id = a.consignor_id
    and le.created_at::date between p_period_start and p_period_end
  group by p.id, coalesce(co.commission_pct, a.commission_pct);

  select coalesce(sum(gross), 0), coalesce(sum(commission), 0) into v_gross, v_comm
  from public.settlement_lines where settlement_id = s.id;

  update public.settlements
     set gross_sales = round(v_gross, 2), commission = round(v_comm, 2),
         net_payable = round(v_gross - v_comm - returns_total - damage_total, 2)
   where id = s.id
  returning * into s;

  return s;
end $function$;

-- Backfill line items for settlements that predate this migration.
insert into public.settlement_lines
  (settlement_id, product_id, qty_sold, gross, unit_price, commission_pct, commission)
select s.id, p.id,
       sum(-le.qty)::int,
       round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0)), 2),
       round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0)) / nullif(sum(-le.qty), 0), 2),
       coalesce(co.commission_pct, a.commission_pct),
       round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0) * coalesce(co.commission_pct, a.commission_pct) / 100.0), 2)
from public.settlements s
join public.agreements a on a.id = s.agreement_id
join public.ledger_entries le on le.entry_type = 'SALE' and le.consignee_id = a.store_id
join public.products p on p.id = le.sku_id and p.consignor_id = a.consignor_id
left join public.commission_overrides co on co.agreement_id = a.id and co.product_id = le.sku_id
where le.created_at::date between s.period_start and s.period_end
  and not exists (select 1 from public.settlement_lines sl where sl.settlement_id = s.id)
group by s.id, p.id, coalesce(co.commission_pct, a.commission_pct);
