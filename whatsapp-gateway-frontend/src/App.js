import React, { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import { NotificationProvider } from "./context/NotificationContext";
import LoginScreen from "./components/Login/LoginScreen";
import MainApp from "./components/Layout/MainApp";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

function AppContent() {
  const { isAuthenticated } = useAuth();

  // Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <div className="min-h-screen bg-white transition-all duration-300">
      {isAuthenticated ? <MainApp /> : <LoginScreen />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
