// app/api/conversations/route.ts
// List conversations for the authenticated user.
// GET /api/conversations — returns recent conversations
// GET /api/conversations?id=<uuid> — returns messages for a specific conversation

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('id');

    // If an ID is provided, return messages for that conversation
    if (conversationId) {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, role, content, metadata, created_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ messages: messages ?? [] });
    }

    // Otherwise, return list of conversations
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, title, mode, created_at, updated_at, total_tokens_used, is_active')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: conversations ?? [] });
  } catch (err) {
    console.error('[Conversations API]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
