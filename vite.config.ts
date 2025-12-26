
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量，允许 process.env.API_KEY 在构建时被替换
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 这里的 define 会在构建时将代码中的 process.env.API_KEY 替换为实际的字符串
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY)
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  }
})
