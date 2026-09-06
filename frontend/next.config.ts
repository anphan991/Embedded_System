import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cấp quyền cho mạng nội bộ (WSL/VPN/Điện thoại) tải tính năng Hot Reload
  allowedDevOrigins: [
    "172.29.176.1", // IP mạng hiện tại của bạn
    "localhost", 
    "127.0.0.1"
  ],
};

export default nextConfig;
