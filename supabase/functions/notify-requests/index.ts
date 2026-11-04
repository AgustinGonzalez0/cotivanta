// Cron-only worker. Queue entries contain references, never email payloads from visitors.
import { createNotificationHandler } from "./worker.ts";
Deno.serve(createNotificationHandler(Deno.env));
