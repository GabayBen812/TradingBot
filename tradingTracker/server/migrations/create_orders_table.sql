-- Create orders table for storing pending and executed orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID REFERENCES signals(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  entry DECIMAL(15,8) NOT NULL,
  stop DECIMAL(15,8) NOT NULL,
  take DECIMAL(15,8) NOT NULL,
  size DECIMAL(15,8) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'FILLED', 'CANCELED', 'EXPIRED')) DEFAULT 'PENDING',
  mode TEXT NOT NULL CHECK (mode IN ('supervised', 'strict', 'explore')),
  executor TEXT NOT NULL CHECK (executor IN ('human', 'bot_strict', 'bot_explore')) DEFAULT 'human',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filled_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_mode ON orders(mode);
CREATE INDEX IF NOT EXISTS idx_orders_executor ON orders(executor);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to view orders (for demo purposes)
CREATE POLICY "Allow all users to view orders" ON orders
  FOR SELECT USING (true);

-- Create policy to allow all users to insert orders
CREATE POLICY "Allow all users to insert orders" ON orders
  FOR INSERT WITH CHECK (true);

-- Create policy to allow all users to update orders
CREATE POLICY "Allow all users to update orders" ON orders
  FOR UPDATE USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_orders_updated_at();
