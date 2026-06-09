import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // No empaquetar el binario de ffmpeg: debe resolverse desde node_modules en runtime.
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
