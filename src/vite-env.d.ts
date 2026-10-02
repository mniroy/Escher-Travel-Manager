/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  __ENV__?: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_GOOGLE_MAPS_API_KEY?: string;
    [key: string]: string | undefined;
  };
}


