import "@/App.css";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function Root() {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="h-screen w-full bg-[#0A0A0A] flex items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#FF5F15] animate-pulse">TMAIT — loading</p>
      </div>
    );
  }
  return user ? <Dashboard /> : <Login />;
}

function App() {
  return (
    <AuthProvider>
      <Root />
      <Toaster position="bottom-right" theme="dark" richColors />
    </AuthProvider>
  );
}

export default App;
