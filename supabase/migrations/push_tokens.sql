-- Push token storage
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own push tokens
CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own push tokens
CREATE POLICY "Users can insert own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own push tokens
CREATE POLICY "Users can delete own push tokens" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Add new notification types to existing check constraint
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('follow', 'like', 'comment', 'contact_joined', 'friend_round'));

-- Track when users last received a friend_round notification (spam prevention)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_friend_round_push TIMESTAMP WITH TIME ZONE;

-- Function to create notification when friends post rounds (with spam prevention)
CREATE OR REPLACE FUNCTION notify_friend_round()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for followers who haven't been notified recently (24 hours)
  INSERT INTO notifications (user_id, type, actor_id, round_id)
  SELECT f.follower_id, 'friend_round', NEW.user_id, NEW.id
  FROM friendships f
  JOIN profiles p ON p.id = f.follower_id
  WHERE f.following_id = NEW.user_id
    AND f.follower_id != NEW.user_id
    AND (p.last_friend_round_push IS NULL
         OR p.last_friend_round_push < NOW() - INTERVAL '24 hours');

  -- Update last_friend_round_push for notified users
  UPDATE profiles
  SET last_friend_round_push = NOW()
  WHERE id IN (
    SELECT f.follower_id
    FROM friendships f
    JOIN profiles p ON p.id = f.follower_id
    WHERE f.following_id = NEW.user_id
      AND f.follower_id != NEW.user_id
      AND (p.last_friend_round_push IS NULL
           OR p.last_friend_round_push < NOW() - INTERVAL '24 hours')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for friend round notifications
DROP TRIGGER IF EXISTS on_round_insert_notify_friends ON rounds;
CREATE TRIGGER on_round_insert_notify_friends
AFTER INSERT ON rounds
FOR EACH ROW EXECUTE FUNCTION notify_friend_round();
