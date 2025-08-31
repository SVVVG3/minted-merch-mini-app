/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SPIN_REGISTRY_CONTRACT_ADDRESS: process.env.SPIN_REGISTRY_CONTRACT_ADDRESS,
  },
};

export default nextConfig;
