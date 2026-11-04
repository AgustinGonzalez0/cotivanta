// Minimal compile-time boundary. Runtime and secrets are supplied by Supabase/Deno.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
