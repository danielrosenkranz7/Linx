import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  type: 'INSERT';
  table: 'notifications';
  record: {
    id: string;
    user_id: string;
    type: 'follow' | 'like' | 'comment' | 'contact_joined' | 'friend_round';
    actor_id: string;
    round_id?: string;
    comment_id?: string;
    read: boolean;
    created_at: string;
  };
}

interface ExpoPushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();

    // Only process INSERT events on notifications table
    if (payload.type !== 'INSERT' || !payload.record) {
      return new Response(
        JSON.stringify({ message: 'Not a notification insert event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const notification = payload.record;

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get recipient's push tokens
    const { data: pushTokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', notification.user_id);

    if (tokensError || !pushTokens?.length) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get actor details
    const { data: actor } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', notification.actor_id)
      .single();

    const actorName = actor?.name || actor?.username || 'Someone';

    // Get course name if it's a round-related notification
    let courseName = '';
    if (notification.round_id) {
      const { data: round } = await supabase
        .from('rounds')
        .select('courses(name)')
        .eq('id', notification.round_id)
        .single();

      courseName = (round?.courses as any)?.name || '';
    }

    // Build notification content based on type
    let title = '';
    let body = '';
    const data: Record<string, string> = { type: notification.type };

    switch (notification.type) {
      case 'follow':
        title = 'New Follower';
        body = `${actorName} started following you`;
        data.userId = notification.actor_id;
        break;
      case 'like':
        title = 'New Like';
        body = courseName
          ? `${actorName} liked your round at ${courseName}`
          : `${actorName} liked your round`;
        if (notification.round_id) data.roundId = notification.round_id;
        break;
      case 'comment':
        title = 'New Comment';
        body = `${actorName} commented on your round`;
        if (notification.round_id) data.roundId = notification.round_id;
        break;
      case 'contact_joined':
        title = 'Friend on Linx';
        body = `${actorName} just joined Linx!`;
        data.userId = notification.actor_id;
        break;
      case 'friend_round':
        title = 'New Round';
        body = courseName
          ? `${actorName} ranked ${courseName}. Check it out!`
          : `${actorName} posted a new round`;
        if (notification.round_id) data.roundId = notification.round_id;
        break;
      default:
        return new Response(
          JSON.stringify({ message: 'Unknown notification type' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    // Prepare messages for all user's devices
    const messages: ExpoPushMessage[] = pushTokens.map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title,
      body,
      data,
    }));

    // Send push notifications via Expo
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN')
          ? { 'Authorization': `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });

    const expoResult = await expoResponse.json();

    return new Response(
      JSON.stringify({ success: true, result: expoResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
