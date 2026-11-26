import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";

import { queryClient } from "./lib/queries";
import Landing from "./pages/Landing";
import { PageLoader } from "./components/app/PageLoader";
import NotFound from "./pages/NotFound";

const AppShell = lazy(() => import("./components/app/AppShell"));
const Overview = lazy(() => import("./pages/app/Overview"));
const Customers = lazy(() => import("./pages/app/Customers"));
const Restock = lazy(() => import("./pages/app/Restock"));
const Wallet = lazy(() => import("./pages/app/Wallet"));
const Activity = lazy(() => import("./pages/app/Activity"));
const Settings = lazy(() => import("./pages/app/Settings"));
const Pay = lazy(() => import("./pages/Pay"));

const s = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  {
    path: "/app",
    element: s(<AppShell />),
    children: [
      { index: true, element: s(<Overview />) },
      { path: "customers", element: s(<Customers />) },
      { path: "restock", element: s(<Restock />) },
      { path: "wallet", element: s(<Wallet />) },
      { path: "activity", element: s(<Activity />) },
      { path: "settings", element: s(<Settings />) },
    ],
  },
  { path: "/pay", element: s(<Pay />) },
  { path: "/pay/:wallet", element: s(<Pay />) },
  { path: "*", element: <NotFound /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipPrimitive.Provider>
          <RouterProvider router={router} />
          <Toaster
            position="bottom-right"
            gap={8}
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-[14px] !border !border-line !bg-surface !text-ink !shadow-pop !font-sans !text-[13.5px] !gap-3",
                description: "!text-muted",
                icon: "!text-ink",
              },
            }}
          />
        </TooltipPrimitive.Provider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
