  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./themes/index.css";
  import "./api/firebase";

  createRoot(document.getElementById("root")!).render(<App />);
