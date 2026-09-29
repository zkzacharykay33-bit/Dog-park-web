import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configOk = Boolean(url && anonKey);
export const supabase = configOk ? createClient(url, anonKey) : null;

// Browser key for the map (restrict it to your site's address in Google Cloud)
export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// "true" lets you check in without being at the park. Turn off before launch.
export const TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';
