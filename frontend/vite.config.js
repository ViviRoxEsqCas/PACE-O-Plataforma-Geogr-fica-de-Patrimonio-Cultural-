import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// En desarrollo, /api y /media se redirigen al backend Django: el navegador solo habla
// con un origen y no hace falta CORS. (CORS sigue configurado en el backend para
// el caso de usar VITE_API_URL apuntando directamente a la API.)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const destino = env.VITE_PROXY_TARGET || "http://127.0.0.1:8000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": destino, "/media": destino },
    },
    test: { environment: "node", include: ["src/**/*.test.js"] },
  };
});
