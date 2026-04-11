import type { Config } from 'tailwindcss';
const config: Config = { content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { brand: { DEFAULT:'#5b4ccc',light:'#7c6fe0',bg:'#5b4ccc12' }, surface: { DEFAULT:'#fff',alt:'#f0efe9',bg:'#f8f7f4' } } } }, plugins: [] };
export default config;