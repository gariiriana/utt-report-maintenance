
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./lib/firebase"; // Ensure firebase/analytics is initialized


  createRoot(document.getElementById("root")!).render(<App />);
  