// Public inquiry endpoint. Only the Edge Function can write to the DB.
// Configure strict allowed origins, Turnstile verification, and server-only Supabase secret.

type Payload = Record<string, unknown>;
const services = new Set(['website','app','automation','custom-software','integrations','other']);
const clientTypes = new Set(['individual','entrepreneur','professional','business']);
const budgets = new Set(['unsure','under-500','500-1500','1500-5000','over-5000']);
const timelines = new Set(['flexible','within-month','1-3-months','later']);
const origins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
const hostnames = (Deno.env.get('ALLOWED_TURNSTILE_HOSTNAMES') ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const requestWindowMs = 10 * 60 * 1000;
const requestLimit = 5;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const str = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const validEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const cors = (o: string) => ({ 'Access-Control-Allow-Origin':o, 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'content-type', 'Vary':'Origin' });
const respond = (status: number, body: object, origin: string) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store', ...(origins.includes(origin)?cors(origin):{})}});
const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
const rateLimit = (key: string) => {
  const now = Date.now();
  const current = requestCounts.get(key);
  if (!current || current.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + requestWindowMs });
    return null;
  }
  current.count += 1;
  if (current.count > requestLimit) return Math.ceil((current.resetAt - now) / 1000);
  return null;
};
Deno.serve(async req => {
  const origin = req.headers.get('origin') ?? '';
  if (!origin || !origins.includes(origin)) return new Response('Origin not allowed',{status:403});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=='POST') return respond(405,{error:'Method not allowed'},origin);
  const type=req.headers.get('content-type')??'';
  if(!type.toLowerCase().includes('application/json'))return respond(415,{error:'JSON required'},origin);
  let payload:Payload;
  try {const text=await req.text(); if(text.length>8000)return respond(413,{error:'Too large'},origin); payload=JSON.parse(text);} catch{return respond(400,{error:'Invalid JSON'},origin);}
  if(!payload||Array.isArray(payload)||typeof payload!=='object')return respond(400,{error:'Invalid data'},origin);
  if(str(payload.faxNumber))return respond(200,{ok:true},origin); // honeypot
  const name=str(payload.name),email=str(payload.email).toLowerCase(),clientType=str(payload.clientType),service=str(payload.service),description=str(payload.description),budget=str(payload.budget),timeline=str(payload.timeline),organization=str(payload.organization),language=str(payload.language),token=str(payload.turnstileToken);
  if(name.length<2||name.length>100||!validEmail(email)||!clientTypes.has(clientType)||!services.has(service)||description.length<20||description.length>2500||!budgets.has(budget)||!timelines.has(timeline)||organization.length>150||!['es','en'].includes(language)||payload.consent!==true||token.length<1||token.length>2048) return respond(400,{error:'Invalid form values'},origin);
  const secret=Deno.env.get('TURNSTILE_SECRET_KEY');
  const supabaseUrl=Deno.env.get('SUPABASE_URL');
  let supabaseKey=Deno.env.get('SUPABASE_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!supabaseKey){
    try { supabaseKey=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '')?.default; } catch { /* missing or malformed secret map */ }
  }
  if(!secret||!supabaseUrl||!supabaseKey||!hostnames.length)return respond(503,{error:'Server not configured'},origin);
  try {
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:token})});
    if(!response.ok)return respond(502,{error:'Security check unavailable'},origin);
    const result:{success?:boolean;hostname?:string;action?:string}=await response.json();
    if(result.success!==true||!hostnames.includes((result.hostname??'').toLowerCase())||result.action!=='project_request')return respond(403,{error:'Security check failed'},origin);
    const retryAfter=rateLimit(clientIp(req));
    if(retryAfter!==null)return new Response(JSON.stringify({error:'Too many requests'}),{status:429,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Retry-After':String(retryAfter),...cors(origin)}});
    const insertHeaders: Record<string, string> = {'Content-Type':'application/json','Prefer':'return=minimal','apikey':supabaseKey};
    if(!supabaseKey.startsWith('sb_secret_')) insertHeaders.Authorization=`Bearer ${supabaseKey}`;
    const insertResponse=await fetch(`${supabaseUrl}/rest/v1/project_requests`,{method:'POST',headers:insertHeaders,body:JSON.stringify({name,email,client_type:clientType,service,description,budget,timeline,organization:organization||null,language,consent_at:new Date().toISOString(),source:'landing'})});
    if(!insertResponse.ok){console.error('Database insert failed',insertResponse.status);return respond(500,{error:'Could not store request'},origin);}
    return respond(200,{ok:true},origin);
  } catch(err){console.error('Inquiry request failed',err instanceof Error?err.name:'unknown');return respond(500,{error:'Unexpected error'},origin);}
});
