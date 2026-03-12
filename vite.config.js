import { defineConfig } from 'vite';

// GitHub Actions sets GITHUB_ACTIONS=true → deploy under /FirstOrder/ subpath.
// Vercel and local builds serve from root /.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/FirstOrder/' : '/',
});
