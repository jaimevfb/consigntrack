-- 0026: every package carries a unique, hard-to-guess QR token.
-- The QR label encodes this token (not the human pkg_code), so a scan only
-- validates against the exact issued QR for that package — guessing or reusing
-- a reference code no longer actions a package.

alter table public.packages add column if not exists qr_token text;

update public.packages
   set qr_token = upper(substr(md5(gen_random_uuid()::text || id::text), 1, 8))
 where qr_token is null;

alter table public.packages
  alter column qr_token set default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  alter column qr_token set not null;

create unique index if not exists packages_qr_token_key on public.packages (qr_token);
