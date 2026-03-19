import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./App.css";
import "./index.css";

// Initialize theme before render to prevent flash
const savedTheme = localStorage.getItem("inschool-theme");
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
