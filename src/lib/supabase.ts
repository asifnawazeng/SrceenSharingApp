import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://fkxczekohpwlucfvziir.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZreGN6ZWtvaHB3bHVjZnZ6aWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MDg2NjcsImV4cCI6MjEwNTM4NDY2N30.Iuyb_21LhdhHnrr2sRpSggnVzoaw9b7qKC_mgpwZ0YU';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
