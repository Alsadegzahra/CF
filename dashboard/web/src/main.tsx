import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./context/AuthContext";
import { MatchHistoryProvider } from "./context/MatchHistoryContext";
import { PreferencesProvider } from "./context/PreferencesContext";
import { SocialProvider } from "./context/SocialContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreferencesProvider>
      <AuthProvider>
        <MatchHistoryProvider>
          <SocialProvider>
            <App />
          </SocialProvider>
        </MatchHistoryProvider>
      </AuthProvider>
    </PreferencesProvider>
  </StrictMode>,
);
