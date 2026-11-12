import { createHandler } from "./handler.ts";

// EdgeRuntime.waitUntil keeps the isolate alive for the fire-and-forget notification attempt after we have replied.
const edge = (globalThis as { EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void } }).EdgeRuntime;
Deno.serve(createHandler(Deno.env, fetch, () => Date.now(), task => edge?.waitUntil?.(task)));
