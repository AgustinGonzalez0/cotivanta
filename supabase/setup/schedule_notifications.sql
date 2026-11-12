-- Cotivanta: programa el aviso por correo (llama a la función notify-requests cada minuto).
-- Ejecutalo DESPUÉS de desplegar la función notify-requests y de cargar sus secretos.
-- Antes de correrlo, reemplazá PEGA_AQUI_EL_MISMO_NOTIFICATION_JOB_SECRET (una sola vez, abajo)
-- por el mismo valor que cargaste como secreto NOTIFICATION_JOB_SECRET (32 caracteres o más).
-- Requiere las extensiones pg_cron, pg_net y Vault (disponibles en Supabase). No probado contra un proyecto real.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Guarda el secreto en Vault (cifrado) para que no quede en el texto del cron.
-- Si ya existe uno con ese nombre, actualizalo: select vault.update_secret(id, 'nuevo') from vault.secrets where name = 'notification_job_secret';
select vault.create_secret('PEGA_AQUI_EL_MISMO_NOTIFICATION_JOB_SECRET', 'notification_job_secret')
where not exists (select 1 from vault.secrets where name = 'notification_job_secret');

-- Reemplaza el trabajo si ya existía.
select cron.unschedule(jobid) from cron.job where jobname = 'cotivanta-notify-requests';

select cron.schedule(
  'cotivanta-notify-requests',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://eucejksxzyerpuingidd.supabase.co/functions/v1/notify-requests',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notification_job_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);

-- Ver si corre y qué responde (esperá 1-2 minutos):
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select id, status_code, content from net._http_response order by created desc limit 5;
