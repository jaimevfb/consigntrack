-- ConsignTrack — 0017 unit of measure + mandatory, auto-issued, unique SKUs
--
-- 1. Products gain a unit_of_measure (piece/dozen/kg/…) so quantities are
--    quantifiable in their real unit. Per the per-QR-item model, each issued
--    item is one labeled package and the unit describes that package.
-- 2. SKU becomes NOT NULL + auto-generated + unique per consignor. It was
--    nullable and blank on 13/15 products; those are backfilled. SKUs are no
--    longer hand-entered — a trigger issues one on insert.

-- ---------------------------------------------------------------------------
-- Unit of measure
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists unit_of_measure text not null default 'piece';
alter table public.products drop constraint if exists products_unit_of_measure_check;
alter table public.products add constraint products_unit_of_measure_check
  check (unit_of_measure in ('piece','dozen','pack','set','kilogram','gram','liter','meter'));

-- ---------------------------------------------------------------------------
-- SKU generator — <3-letter consignor prefix>-<zero-padded sequence>, unique
-- within the consignor. Loops past collisions.
-- ---------------------------------------------------------------------------
create or replace function public.gen_product_sku(p_consignor_id uuid)
returns text
language plpgsql
as $$
declare
  v_name text;
  v_prefix text;
  v_seq int;
  v_candidate text;
begin
  select name into v_name from public.consignors where id = p_consignor_id;
  v_prefix := upper(regexp_replace(coalesce(v_name, 'SKU'), '[^A-Za-z0-9]', '', 'g'));
  v_prefix := rpad(left(coalesce(nullif(v_prefix, ''), 'SKU'), 3), 3, 'X');
  v_seq := coalesce((select count(*) from public.products where consignor_id = p_consignor_id), 0) + 1;
  loop
    v_candidate := v_prefix || '-' || lpad(v_seq::text, 4, '0');
    exit when not exists (
      select 1 from public.products where consignor_id = p_consignor_id and sku = v_candidate
    );
    v_seq := v_seq + 1;
  end loop;
  return v_candidate;
end;
$$;

-- Auto-issue a SKU whenever one is missing. SKUs are not user-editable.
create or replace function public.set_product_sku()
returns trigger
language plpgsql
as $$
begin
  if NEW.sku is null or trim(NEW.sku) = '' then
    NEW.sku := public.gen_product_sku(NEW.consignor_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_product_sku on public.products;
create trigger trg_set_product_sku
  before insert or update on public.products
  for each row execute function public.set_product_sku();

-- ---------------------------------------------------------------------------
-- Backfill the blank SKUs, one row at a time so each sees the prior ones.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id, consignor_id from public.products where sku is null or trim(sku) = '' loop
    update public.products set sku = public.gen_product_sku(consignor_id) where id = r.id;
  end loop;
end $$;

alter table public.products alter column sku set not null;
