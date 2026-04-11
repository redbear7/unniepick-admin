import type { NextConfig } from "next";

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : '*.supabase.co';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'esbuild',
    '@esbuild/darwin-arm64',
    '@esbuild/darwin-x64',
    '@remotion/renderer',
    '@remotion/bundler',
    '@remotion/cli',
    '@remotion/compositor-darwin-arm64',
    '@remotion/compositor-darwin-x64',
    'remotion',
    '@orrery/core',
    'ssaju',
    '@fal-ai/client',
  ],
  async headers() {
    return [
      {
        // Supabase Storage 오디오 프록시 응답에 캐시 헤더 부여
        source: '/api/audio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return [];
    return [
      {
        // /api/audio/music-tracks/audio/xxx.mp3
        // → Supabase Storage 직접 프록시 (브라우저 캐시 활용)
        source: '/api/audio/:path*',
        destination: `${supabaseUrl}/storage/v1/object/public/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: SUPABASE_HOST },
    ],
  },
};

export default nextConfig;
