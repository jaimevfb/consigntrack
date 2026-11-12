-- One-transaction checkout: post the SKU quantity lines and every scanned piece
-- in a single transaction so all resulting SALE ledger entries share one
-- created_at (now() is transaction-stable). The sales history groups a sale by
-- created_at, so this makes a cart check out as ONE grouped sale with a
-- per-product breakdown, instead of one row per piece.
create or replace function public.checkout_sale(p_consignee uuid, p_lines jsonb, p_serials text[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare s text;
begin
  if p_lines is not null and jsonb_array_length(p_lines) > 0 then
    perform public.pos_sale(p_consignee, p_lines, 'POS_SCAN');
  end if;
  if p_serials is not null then
    foreach s in array p_serials loop
      perform public.sell_unit(s);
    end loop;
  end if;
end $$;

grant execute on function public.checkout_sale(uuid, jsonb, text[]) to authenticated;
