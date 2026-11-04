import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./theme/styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Suite Budget: #root is missing");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
