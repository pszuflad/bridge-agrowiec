import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/index.css";

const kontener = document.getElementById("root");
if (!kontener) throw new Error("Brak elementu #root w index.html.");

createRoot(kontener).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
