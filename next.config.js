/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      // The real deployment form lives at /guards/deploy. Keep the legacy
      // /deployments/new URL working so bookmarks and <Link href="/deployments/new">
      // in branch detail pages don't break.
      {
        source: '/deployments/new',
        destination: '/guards/deploy',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
