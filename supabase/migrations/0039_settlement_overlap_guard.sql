-- [SET-05] A period could be settled twice while the first statement was still
-- unconfirmed: the overlap guard only blocked a 'confirmed' statement. Widen it
-- to block any existing live statement (pending/partial/paid/confirmed) that
-- overlaps the requested period, so the same sales can't be billed (and paid) twice.
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
  if exists (select 1 from public.settlements x where x.agreement_id = p_agreement_id
      and x.status in ('pending','partial','paid','confirmed')
      and x.period_start <= p_period_end and x.period_end >= p_period_start) then
    raise exception 'That period already has a statement — settle or void it before generating another' using errcode = 'check_violation';
  end if;
  insert into public.settlements (agreement_id, period_start, period_end, gross_sales, commission, returns_total, damage_total, net_payable, status, generated_by)
  values (p_agreement_id, p_period_start, p_period_end, 0, 0, 0, 0, 0, 'pending', auth.uid()) returning * into s;
  insert into public.settlement_lines (settlement_id, product_id, qty_sold, gross, unit_price, commission_pct, commission)
  select s.id, p.id, sum(-le.qty)::int,
         round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0)), 2),
         round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0)) / nullif(sum(-le.qty), 0), 2),
         coalesce(co.commission_pct, a.commission_pct),
         round(sum((-le.qty) * coalesce(le.unit_price, p.unit_price, 0) * coalesce(co.commission_pct, a.commission_pct) / 100.0), 2)
  from public.ledger_entries le join public.products p on p.id = le.sku_id
  left join public.commission_overrides co on co.agreement_id = a.id and co.product_id = le.sku_id
  where le.entry_type = 'SALE' and le.consignee_id = a.store_id and p.consignor_id = a.consignor_id
    and le.created_at::date between p_period_start and p_period_end
  group by p.id, coalesce(co.commission_pct, a.commission_pct);
  select coalesce(sum(gross), 0), coalesce(sum(commission), 0) into v_gross, v_comm from public.settlement_lines where settlement_id = s.id;
  update public.settlements set gross_sales = round(v_gross, 2), commission = round(v_comm, 2),
         net_payable = round(v_gross - v_comm - returns_total - damage_total, 2) where id = s.id returning * into s;
  return s;
end $function$;
