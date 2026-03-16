  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./themes/index.css";
  import "./api/firebase"; // Ensure firebase/analytics is initialized


  createRoot(document.getElementById("root")!).render(<App />);
  