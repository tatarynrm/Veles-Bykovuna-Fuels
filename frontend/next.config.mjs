/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
    `next build` і `next dev` ділять один каталог `.next`, тож перевірочна
    збірка при піднятому dev-сервері трощить його чанки («Cannot find module
    './230.js'»). NEXT_DIST_DIR дозволяє зібрати збоку, не чіпаючи dev:

        NEXT_DIST_DIR=.next-build npm run build

    Без змінної поведінка звичайна.
  */
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
