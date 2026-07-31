import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/vazirmatn/wght.css";
import "@fontsource-variable/noto-sans-arabic/wght.css";
import "@fontsource-variable/noto-naskh-arabic/wght.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppProviders } from "./app/providers";
import { registerStorefrontServiceWorker } from "./app/register-service-worker";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);

registerStorefrontServiceWorker();
