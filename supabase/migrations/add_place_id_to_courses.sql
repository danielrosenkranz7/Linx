-- Add place_id column to courses table for Google Places integration
ALTER TABLE courses ADD COLUMN IF NOT EXISTS place_id TEXT UNIQUE;

-- Create index for faster lookups by place_id
CREATE INDEX IF NOT EXISTS courses_place_id_idx ON courses(place_id);
