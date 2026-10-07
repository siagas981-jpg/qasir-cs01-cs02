import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { RouteGuard } from "@/components/RouteGuard";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import POS from "@/pages/POS";
import Transactions from "@/pages/Transactions";
import Products from "@/pages/Products";
import Outlets from "@/pages/Outlets";
import Staff from "@/pages/Staff";

const Owner = ({ children }) => <RouteGuard ownerOnly>{children}</RouteGuard>;

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RouteGuard><AppShell /></RouteGuard>}>
            <Route index element={<POS />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="products" element={<Owner><Products /></Owner>} />
            <Route path="outlets" element={<Owner><Outlets /></Owner>} />
            <Route path="staff" element={<Owner><Staff /></Owner>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
