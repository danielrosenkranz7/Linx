-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment')),
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries by user
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- System can insert notifications (via triggers or service role)
CREATE POLICY "Allow insert for authenticated users" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Function to create notification on new follow
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification on new like
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  round_owner_id UUID;
BEGIN
  SELECT user_id INTO round_owner_id FROM rounds WHERE id = NEW.round_id;
  -- Don't notify if user liked their own round
  IF round_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, round_id)
    VALUES (round_owner_id, 'like', NEW.user_id, NEW.round_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification on new comment
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  round_owner_id UUID;
BEGIN
  SELECT user_id INTO round_owner_id FROM rounds WHERE id = NEW.round_id;
  -- Don't notify if user commented on their own round
  IF round_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, round_id, comment_id)
    VALUES (round_owner_id, 'comment', NEW.user_id, NEW.round_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS on_follow_notification ON friendships;
CREATE TRIGGER on_follow_notification
  AFTER INSERT ON friendships
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

DROP TRIGGER IF EXISTS on_like_notification ON likes;
CREATE TRIGGER on_like_notification
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

DROP TRIGGER IF EXISTS on_comment_notification ON comments;
CREATE TRIGGER on_comment_notification
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();
