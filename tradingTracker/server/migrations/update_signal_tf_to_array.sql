-- Migration to update signal_tf from single TEXT to TEXT[] array
-- This allows users to select multiple timeframes for signal scanning

-- First, backup existing data (optional but recommended)
-- CREATE TABLE bot_settings_backup AS SELECT * FROM bot_settings;

-- Update existing records to convert single timeframe to array format
UPDATE bot_settings 
SET signal_tf = ARRAY[signal_tf]::TEXT[] 
WHERE signal_tf IS NOT NULL AND array_length(signal_tf, 1) IS NULL;

-- Alter the column type from TEXT to TEXT[]
ALTER TABLE bot_settings 
ALTER COLUMN signal_tf TYPE TEXT[] USING signal_tf::TEXT[];

-- Update the default value
ALTER TABLE bot_settings 
ALTER COLUMN signal_tf SET DEFAULT '{15m}';

-- Drop the old constraint and add new ones
ALTER TABLE bot_settings DROP CONSTRAINT IF EXISTS bot_settings_signal_tf_check;

-- Add new constraints for array validation
ALTER TABLE bot_settings ADD CONSTRAINT check_signal_tf_array_length 
  CHECK (array_length(signal_tf, 1) > 0 AND array_length(signal_tf, 1) <= 5);

ALTER TABLE bot_settings ADD CONSTRAINT check_valid_timeframes 
  CHECK (signal_tf <@ ARRAY['5m', '15m', '1h', '4h', '1d']::TEXT[]);

-- Verify the migration
SELECT 
  id, 
  signal_tf, 
  array_length(signal_tf, 1) as tf_count,
  signal_tf @> ARRAY['15m'] as has_15m
FROM bot_settings 
LIMIT 5;
