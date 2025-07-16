import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TMC Noter - 音声から議事録を自動生成",
    short_name: "TMC Noter",
    description: "音声ファイルをアップロードして、AIが文字起こしと議事録を自動生成します。",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#9333ea",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
