// vite.config.js  (frontend)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Any fetch to "/graphql" from the browser will be forwarded to your Node server
      "/graphql": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // secure: false, // uncomment if your backend is self-signed https
      },
    },
  },
});
