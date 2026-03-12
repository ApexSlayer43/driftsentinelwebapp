import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// Rule ID → engine mode mapping (mirrors backend protocol.ts)
const RULE_TO_MODE: Record<string, string> = {
  'tier-shield': 'OVERSIZE',
  'tier-sword': 'OVERSIZE',
  'tier-hammer': 'OVERSIZE',
  'max-fills': 'FREQUENCY',
  'session-window': 'OFF_SESSION',
  'ghost-equity': 'OFF_SESSION',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

function getAdmin(): AdminClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function resolveAccountRef(admin: AdminClient, userId: string) {
  const { data: accounts } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('user_id', userId);
  return (accounts ?? [])[0]?.account_ref as string | undefined;
}

/**
 * GET /api/protocol — fetch stored protocol rules for the authenticated user
 */
export async function GET() {
  const supabase = await createAuthClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = getAdmin();
  if (!admin) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const accountRef = await resolveAccountRef(admin, user.id);
  if (!accountRef) {
    return Response.json({ rules: [] });
  }

  const { data, error } = await admin
    .from('protocol_rules')
    .select('*')
    .eq('account_ref', accountRef)
    .order('category', { ascending: true });

  if (error) {
    return Response.json({ error: 'fetch_failed', detail: error.message }, { status: 500 });
  }

  return Response.json({ rules: data ?? [] });
}

/**
 * POST /api/protocol — upsert protocol rules + sync enforceable values to user_configs
 */
export async function POST(req: Request) {
  const supabase = await createAuthClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = getAdmin();
  if (!admin) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const accountRef = await resolveAccountRef(admin, user.id);
  if (!accountRef) {
    return Response.json({ error: 'No account found' }, { status: 404 });
  }

  const body = await req.json();
  const { rules, source_file } = body as {
    rules: Array<{
      rule_id: string;
      category: string;
      name: string;
      description?: string;
      params: Record<string, unknown>;
      enabled: boolean;
    }>;
    source_file?: string;
  };

  if (!rules || !Array.isArray(rules)) {
    return Response.json({ error: 'missing_rules' }, { status: 400 });
  }

  try {
    // 1) Upsert all protocol rules
    const rows = rules.map((r) => ({
      account_ref: accountRef,
      rule_id: r.rule_id,
      category: r.category,
      name: r.name,
      description: r.description ?? null,
      params: r.params,
      enabled: r.enabled,
      enforcement: RULE_TO_MODE[r.rule_id] ? 'AUTOMATED' : 'MANUAL_CHECK',
      source_file: source_file ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await admin
      .from('protocol_rules')
      .upsert(rows, { onConflict: 'account_ref,rule_id' });

    if (upsertErr) throw new Error(`upsert_failed: ${upsertErr.message}`);

    // 2) Delete rules no longer in the incoming set
    const incomingIds = rules.map((r) => r.rule_id);
    const { data: existingRules } = await admin
      .from('protocol_rules')
      .select('rule_id')
      .eq('account_ref', accountRef);

    const toDelete = (existingRules ?? [])
      .map((r: { rule_id: string }) => r.rule_id)
      .filter((id: string) => !incomingIds.includes(id));

    if (toDelete.length > 0) {
      for (const ruleId of toDelete) {
        await admin
          .from('protocol_rules')
          .delete()
          .eq('account_ref', accountRef)
          .eq('rule_id', ruleId);
      }
    }

    // 3) Sync enforceable values to user_configs
    const synced: Record<string, unknown> = {};

    // Position sizing tiers → max_contracts
    const tierRules = rules.filter(
      (r) => ['tier-shield', 'tier-sword', 'tier-hammer'].includes(r.rule_id) && r.enabled,
    );
    if (tierRules.length > 0) {
      const sorted = tierRules.sort(
        (a, b) => Number(a.params.risk_pct ?? 100) - Number(b.params.risk_pct ?? 100),
      );
      const riskPct = Number(sorted[0].params.risk_pct ?? 25);
      synced.max_contracts = Math.max(1, Math.floor(riskPct / 10));
    }

    // Max fills → max_fills_per_day
    const fillsRule = rules.find((r) => r.rule_id === 'max-fills' && r.enabled);
    if (fillsRule) {
      synced.max_fills_per_day = Number(fillsRule.params.max_fills ?? 20);
    }

    // Session window → sessions_utc
    const sessionRule = rules.find((r) => r.rule_id === 'session-window' && r.enabled);
    if (sessionRule && sessionRule.params.sessions) {
      synced.sessions_utc = sessionRule.params.sessions;
    }

    if (Object.keys(synced).length > 0) {
      await admin
        .from('user_configs')
        .update({ ...synced, updated_at: new Date().toISOString() })
        .eq('account_ref', accountRef);
    }

    return Response.json({
      ok: true,
      rules_saved: rows.length,
      rules_deleted: toDelete.length,
      synced_configs: synced,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'protocol_save_failed', detail: msg }, { status: 500 });
  }
}
