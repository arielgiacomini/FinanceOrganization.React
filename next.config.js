/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://api.financeiro.arielgiacomini.com.br',
  },
}

module.exports = nextConfig
