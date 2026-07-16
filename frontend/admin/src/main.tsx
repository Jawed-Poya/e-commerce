import React from "react";
import ReactDOM from "react-dom/client";

import { RouterProvider } from "react-router-dom";
import { router } from "./routes/routes";
import "@/index.css";
import { ThemeProvider } from "./components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const client = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider>
            <QueryClientProvider client={client}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </ThemeProvider>
    </React.StrictMode>,
);
