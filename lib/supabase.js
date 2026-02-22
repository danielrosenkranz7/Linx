import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://auemxjfzfknhebncscrr.supabase.co';
const supabaseAnonKey = 'sb_publishable_Yz6KEjeMNxgJEIYpLHyUZQ_J7OU07Ai'; // Replace with your actual key

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});