-- Schedules the reminder dispatcher (Section 4: Notifications).
--
-- Apply this only AFTER deploying the send-reminders function, and replace the
-- two placeholders below first. Nothing secret is committed here: the shared
-- secret is read from Vault at call time, so it never appears in the cron job
-- definition, in `cron.job` output, or in a schema dump.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Generate a secret, then store it under this name. The SAME value must also be
-- set as the function's CRON_SECRET env var, or every call returns 401.
--
--   select vault.create_secret(
--     '<generated-secret>',
--     'lume_cron_secret',
--     'Shared secret the reminder cron presents to the send-reminders function'
--   );

select cron.schedule(
  'lume-send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'lume_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Inspect:  select * from cron.job;
--           select * from cron.job_run_details order by start_time desc limit 20;
-- Stop it:  select cron.unschedule('lume-send-reminders');
