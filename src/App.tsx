import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { AppProvider } from "@/contexts/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index";
import AppFeedback from "./pages/AppFeedback";
import FeedbackDetail from "./pages/FeedbackDetail";
import Changelog from "./pages/Changelog";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { Analytics } from "@vercel/analytics/react";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

if (!RECAPTCHA_SITE_KEY) {
  throw new Error("Missing VITE_RECAPTCHA_SITE_KEY environment variable");
}

const App = () => (
  <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ErrorBoundary>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/app/:slug" element={<AppFeedback />} />
                <Route path="/app/:slug/changelog" element={<Changelog />} />
                <Route path="/app/:slug/:id" element={<FeedbackDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Analytics />
            </BrowserRouter>
          </TooltipProvider>
        </ErrorBoundary>
      </AppProvider>
    </QueryClientProvider>
  </GoogleReCaptchaProvider>
);

export default App;
