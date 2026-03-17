import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getAccountRef(userId: string) {
  const admin = getAdmin();
  const { data } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return data?.account_ref as string | undefined;
}

/* GET /api/strategies — list all strategies for the user */
export async function GET() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const accountRef = await getAccountRef(user.id);
  if (!accountRef) return Response.json({ strategies: [] });

  const admin = getAdmin();
  const { data, error } = await admin
    .from('strategies')
    .select('*')
    .eq('account_ref', accountRef)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ strategies: data ?? [] });
}

/* POST /api/strategies — create a new strategy */
export async function POST(req: Request) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const accountRef = await getAccountRef(user.id);
  if (!accountRef) return Response.json({ error: 'No account found' }, { status: 400 });

  const body = await req.json();
  const tag = (body.tag ?? '').trim();
  if (!tag) return Response.json({ error: 'Strategy name is required' }, { status: 400 });

  const admin = getAdmin();
  const { data, error } = await admin
    .from('strategies')
    .insert({
      account_ref: accountRef,
      tag,
      description: body.description || null,
      color: body.color || null,
      is_default: false,
      active: true,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: `Strategy "${tag}" already exists` }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ strategy: data });
}
