import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js verfolgt nur Dateien, die importiert werden. `content/` wird zur
  // Laufzeit über `fs` gelesen und fehlt sonst im Produktions-Build — lokal
  // fällt das nie auf, weil dort das ganze Repo liegt.
  outputFileTracingIncludes: {
    "/api/session/[id]/next": ["./content/**/*.yaml"],
    "/api/attempt/[id]/answer": ["./content/**/*.yaml"],
    "/practice": ["./content/**/*.yaml"],
    "/practice/[sessionId]": ["./content/**/*.yaml"],
  },
};

export default nextConfig;
