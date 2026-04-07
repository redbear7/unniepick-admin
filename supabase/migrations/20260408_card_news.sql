-- Create card_news table for storing generated cardnews videos
CREATE TABLE IF NOT EXISTS card_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  naver_url text,
  store_name text NOT NULL,
  store_address text,
  store_phone text,
  store_category text,
  store_image_url text,
  template text DEFAULT 'modern', -- modern, bright, minimal
  voice_id text,                   -- fish_voice_id
  cards jsonb NOT NULL,            -- Array of card data: [{ type, title, subtitle, image_url }]
  tts_script text,                 -- Full TTS script
  tts_url text,                    -- Fish Audio MP3 URL
  video_url text,                  -- Final MP4 URL
  status text DEFAULT 'pending',   -- pending, rendering, done, error
  error_message text,              -- Error details if status = error
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX idx_card_news_store_id ON card_news(store_id);
CREATE INDEX idx_card_news_status ON card_news(status);
CREATE INDEX idx_card_news_created_at ON card_news(created_at DESC);
