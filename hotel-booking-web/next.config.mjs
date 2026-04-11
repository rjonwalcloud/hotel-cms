/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // If BACKEND_URL is set (Production), use it. Otherwise default to localhost.
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      }
    ]
  }
};

export default nextConfig;
