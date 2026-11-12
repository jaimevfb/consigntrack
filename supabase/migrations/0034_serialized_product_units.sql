-- Model B: serialized per-piece barcodes, layered over the count-based ledger.
create table if not exists public.product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  consignor_id uuid not null references public.consignors(id) on delete cascade,
  serial text not null unique,
  status text not null default 'in_stock' check (status in ('in_stock','sold','returned','void')),
  store_id uuid references public.stores(id),
  sold_at timestamptz,
  sold_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_units_product on public.product_units (product_id);
create index if not exists idx_product_units_consignor on public.product_units (consignor_id);

alter table public.product_units enable row level security;
drop policy if exists product_units_select on public.product_units;
create policy product_units_select on public.product_units for select using (
  public.is_admin()
  or (public.is_consignor_user() and consignor_id = (select public.current_consignor_id()))
  or public.is_store_user()
);

create or replace function public.mint_units(p_sku uuid, p_qty integer)
returns setof text
language plpgsql security definer set search_path to 'public' as $$
declare v_consignor uuid; v_prefix text; v_start int; i int; v_serial text;
begin
  select consignor_id, sku into v_consignor, v_prefix from public.products where id = p_sku;
  if v_consignor is null then raise exception 'Unknown product' using errcode='check_violation'; end if;
  if not (public.is_admin() or (public.is_consignor_user() and v_consignor = public.current_consignor_id())) then
    raise exception 'Not authorized to label this product' using errcode='insufficient_privilege';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be at least 1' using errcode='check_violation'; end if;
  select coalesce(max(nullif(regexp_replace(serial, '^.*-', ''), '')::int), 0) into v_start
    from public.product_units where product_id = p_sku;
  for i in 1..p_qty loop
    v_serial := v_prefix || '-' || lpad((v_start + i)::text, 4, '0');
    insert into public.product_units (product_id, consignor_id, serial) values (p_sku, v_consignor, v_serial);
    return next v_serial;
  end loop;
end $$;
grant execute on function public.mint_units(uuid, integer) to authenticated;

create or replace function public.sell_unit(p_serial text)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_unit public.product_units; v_store uuid; v_price numeric; v_name text; v_onhand int;
begin
  v_store := public.current_store_id();
  if not (public.is_admin() or v_store is not null) then
    raise exception 'Only store accounts can record sales' using errcode='insufficient_privilege';
  end if;
  select * into v_unit from public.product_units where serial = p_serial;
  if v_unit.id is null then raise exception 'No piece found for barcode %', p_serial using errcode='check_violation'; end if;
  if v_unit.status = 'sold' then raise exception 'That piece (%) is already sold', p_serial using errcode='check_violation'; end if;
  if v_unit.status <> 'in_stock' then raise exception 'That piece is not sellable (%)', v_unit.status using errcode='check_violation'; end if;
  select unit_price, name into v_price, v_name from public.products where id = v_unit.product_id;
  v_onhand := public.get_on_hand(v_store, v_unit.product_id);
  if v_onhand < 1 then raise exception 'OVERSELL: no % on hand at this store', v_name using errcode='check_violation'; end if;
  insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, unit_price, price_flag, ref_type, actor_user_id, reason)
  values (v_store, v_unit.product_id, 'SALE', -1, v_price, false, 'sale', auth.uid(), 'POS_SCAN · piece ' || p_serial);
  update public.product_units set status='sold', store_id=v_store, sold_at=now(), sold_by=auth.uid() where id = v_unit.id;
  return jsonb_build_object('name', v_name, 'serial', p_serial, 'price', v_price);
end $$;
grant execute on function public.sell_unit(text) to authenticated;
