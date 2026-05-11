import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./themes/index.css";
  import "./api/firebase";
  import { registerSW } from 'virtual:pwa-register';

  registerSW({ immediate: true });

  createRoot(document.getElementById("root")!).render(<App />);

