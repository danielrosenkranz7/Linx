-- Add osm_id column to courses table for OpenStreetMap integration
ALTER TABLE courses ADD COLUMN IF NOT EXISTS osm_id TEXT UNIQUE;

-- Create index for faster lookups by osm_id
CREATE INDEX IF NOT EXISTS courses_osm_id_idx ON courses(osm_id);
