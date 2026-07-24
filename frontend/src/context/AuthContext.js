import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=logged out

  useEffect(() => {
    const token = localStorage.getItem("tmait_token");
    if (!token) return setUser(false);
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {
      localStorage.removeItem("tmait_token");
      setUser(false);
    });
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("tmait_token", data.access_token);
    setUser(data.user);
  };

  const register = async (name, email, password, role) => {
    const { data } = await api.post("/auth/register", { name, email, password, role });
    localStorage.setItem("tmait_token", data.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("tmait_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
