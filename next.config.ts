import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Allow the app to run behind a dev/preview proxy (e.g. Codespaces, e2b, ngrok)
  // so Server Actions posted from that host are not rejected.
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.e2b.app', '*.app.github.dev'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.e2b.app', '*.app.github.dev'],
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/**' }]
      : [],
  },
};

export default nextConfig;
