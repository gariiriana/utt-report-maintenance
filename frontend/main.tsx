// ============================================================================
// FILE: frontend/main.tsx
// Deskripsi: Titik Masuk Utama (Main Entry Point) Aplikasi React Client-Side.
//            Menginisialisasi pendaftaran Progressive Web App (PWA Service Worker),
//            menerapkan DOM Polyfill pengaman crash React DOM `removeChild`/`insertBefore`,
//            dan merender komponen utama `<App />` ke elemen DOM `#root`.
// ============================================================================

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./themes/index.css";
import "./api/firebase";
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker PWA secara otomatis untuk dukungan akses offline & caching
registerSW({ immediate: true });

/**
 * Polyfill DOM Node Prototype Pengaman Crash React
 * Junior Dev Notes: Ekstensi browser (seperti Google Translate atau Password Manager)
 * dan Framer Motion sering memanipulasi node DOM secara langsung tanpa sepengetahuan React.
 * Polyfill ini mencegah error fatal `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
 */
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) {
        return child.parentNode.removeChild(child);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode);
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Render Komponen Utama React <App /> ke elemen <div id="root">
createRoot(document.getElementById("root")!).render(<App />);
