import type { NextConfig } from 'next';
import path from 'path';
import dns from 'dns';

if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['ssh2'],
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    proxyClientMaxBodySize: '512mb',
    serverActions: {
      bodySizeLimit: '512mb',
    },
  },
  async redirects() {
    return [
      { source: '/visualweb', destination: '/web', permanent: true },
      { source: '/visualeventos', destination: '/eventos', permanent: true },
      { source: '/visualeventos/:path*', destination: '/eventos/:path*', permanent: true },
      { source: '/visualgifts', destination: '/brindes', permanent: true },
      { source: '/visualgifts/:path*', destination: '/brindes/:path*', permanent: true },
      { source: '/visualpro', destination: '/producoes', permanent: true },
      { source: '/visualpro/:path*', destination: '/producoes/:path*', permanent: true },
      { source: '/visualtransporte', destination: '/transporte', permanent: true },
      { source: '/client', destination: '/cliente', permanent: true },
      { source: '/client/:path*', destination: '/cliente/:path*', permanent: true },
      { source: '/roundcube', destination: '/webmail', permanent: false },
      { source: '/roundcube/:path*', destination: '/webmail/:path*', permanent: false },
      // página "Brevemente" dos sites sem conteúdo: ficheiro à parte, sem menu nem cabeçalho do site
      { source: '/pagina-em-construcao', destination: '/pagina-em-construcao/index.html', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.supabase.co *.google.com accounts.google.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' blob: data: *.gravatar.com *.supabase.co supabase.visualdesignmoz.com visualdesignmoz.com *.visualdesignmoz.com res.cloudinary.com provisualcorporate.co.mz *.provisualcorporate.co.mz *.vercel.app; font-src 'self' fonts.gstatic.com; connect-src 'self' *.supabase.co supabase.visualdesignmoz.com *.google.com accounts.google.com *.visualdesignmoz.com vps.visualdesignmoz.com provisualcorporate.co.mz *.provisualcorporate.co.mz *.vercel.app https://challenges.cloudflare.com; frame-src 'self' *.visualdesignmoz.com *.google.com accounts.google.com https://challenges.cloudflare.com; object-src 'none';"
          }
        ]
      }
    ]
  }
};

export default nextConfig;
