/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.*.*',
    '10.*.*.*',
    '172.*.*.*',
    '26.*.*.*',
  ],
};

export default nextConfig;
