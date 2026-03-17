import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/**
 * PATCH /api/cooldown/close
 *
 * Called when the trader closes cooldown mode.
 * Sets closed_at and calculates duration_seconds.
 *
 * Body: { activation_id: string }
 */
export async function PATCH(req: Request) {
  /* 1. Auth */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  /* 2. Parse body */
  let activationId: string;
  try {
    const body = await req.json();
    activationId = body.activation_id;
    if (!activationId) throw new Error('Missing activation_id');
  } catch {
    return Response.json({ error: 'activation_id required' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  /* 3. Fetch the activation to compute duration */
  const { data: activation } = await admin
    .from('cooldown_activations')
    .select('activated_at, closed_at')
    .eq('activation_id', activationId)
    .eq('user_id', user.id)
    .single();

  if (!activation) {
    return Response.json({ error: 'Activation not found' }, { status: 404 });
  }

  if (activation.closed_at) {
    return Response.json({ error: 'Already closed' }, { status: 409 });
  }

  /* 4. Calculate duration and close */
  const now = new Date();
  const activatedAt = new Date(activation.activated_at);
  const durationSeconds = Math.round((now.getTime() - activatedAt.getTime()) / 1000);

  const { error: updateErr } = await admin
    .from('cooldown_activations')
    .update({
      closed_at: now.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('activation_id', activationId)
    .eq('user_id', user.id);

  if (updateErr) {
    return Response.json({ error: 'Failed to close' }, { status: 500 });
  }

  return Response.json({
    activation_id: activationId,
    duration_seconds: durationSeconds,
    closed_at: now.toISOString(),
  });
}
