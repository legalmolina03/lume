-- Schedules the reminder dispatcher (Section 4: Notifications).
--
-- Apply this only AFTER `supabase functions deploy send-reminders`, and edit
-- the two placeholders below first. The service role key is stored in Vault
-- rather than inline so it never appears in the cron job definition.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Run once, replacing the placeholder, to store the key:
--   select vault.create_secret('<service-role-key>', 'service_role_key');

select cron.schedule(
  'lume-send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To stop it:  select cron.unschedule('lume-send-reminders');
