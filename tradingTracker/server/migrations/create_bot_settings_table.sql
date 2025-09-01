-- Create bot_settings table for storing user bot configuration
CREATE TABLE IF NOT EXISTS bot_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('supervised', 'strict', 'explore')),
  strategy JSONB NOT NULL DEFAULT '{}',
  signal_tf TEXT[] NOT NULL DEFAULT '{15m}' CHECK (array_length(signal_tf, 1) > 0 AND array_length(signal_tf, 1) <= 5),
  min_conf INTEGER NOT NULL DEFAULT 70 CHECK (min_conf >= 0 AND min_conf <= 100),
  tag_filter JSONB NOT NULL DEFAULT '{}',
  initial_capital DECIMAL(15,2) NOT NULL DEFAULT 10000,
  risk_per_trade DECIMAL(5,2) NOT NULL DEFAULT 1,
  auto_close_hours INTEGER NOT NULL DEFAULT 24 CHECK (auto_close_hours > 0),
  notifications BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one settings record per user per mode
  UNIQUE(user_id, mode)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bot_settings_user_mode ON bot_settings(user_id, mode);

-- Enable RLS (Row Level Security)
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own settings
CREATE POLICY "Users can view own bot settings" ON bot_settings
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own settings
CREATE POLICY "Users can insert own bot settings" ON bot_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own settings
CREATE POLICY "Users can update own bot settings" ON bot_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own settings
CREATE POLICY "Users can delete own bot settings" ON bot_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_bot_settings_updated_at 
  BEFORE UPDATE ON bot_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraint to ensure only valid timeframes are allowed
ALTER TABLE bot_settings ADD CONSTRAINT check_valid_timeframes 
  CHECK (signal_tf <@ ARRAY['5m', '15m', '1h', '4h', '1d']::TEXT[]);
