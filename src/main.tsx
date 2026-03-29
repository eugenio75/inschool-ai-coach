import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./App.css";
import "./index.css";
import "./lib/i18nConfig";

// Initialize theme — default to light, only dark if explicitly chosen
const savedTheme = localStorage.getItem("inschool-theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
