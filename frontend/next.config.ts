import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cáº¥p quyá»n cho máº¡ng ná»™i bá»™ (WSL/VPN/Äiá»‡n thoáº¡i) táº£i tÃ­nh nÄƒng Hot Reload
  allowedDevOrigins: [
    "172.29.176.1", "100.125.37.122", // IP máº¡ng hiá»‡n táº¡i cá»§a báº¡n
    "localhost", 
    "127.0.0.1"
  ],
};

export default nextConfig;
