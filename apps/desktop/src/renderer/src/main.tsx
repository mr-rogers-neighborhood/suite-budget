import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./theme/styles.css";
import { initTheme } from "./theme/theme";

// Before the first paint, so the window opens in the theme it was left in.
initTheme();

const container = document.getElementById("root");
if (!container) throw new Error("Suite Budget: #root is missing");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
