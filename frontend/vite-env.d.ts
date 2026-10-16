// ============================================================================
// FILE: frontend/vite-env.d.ts
// Deskripsi: Deklarasi Tipe TypeScript Global Lingkungan Bundler Vite & PWA Client.
//            Memberikan dukungan impor gambar biner (.png, .jpg, .jpeg, .gif, .svg)
//            sebagai string URL/Data-URI di TypeScript.
// ============================================================================

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Diisi `define` di vite.config.ts saat build: hash commit & waktu build (ISO)
declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}
