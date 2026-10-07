import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

const HERO = "https://images.unsplash.com/photo-1781232770088-6c2e89dc38e5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400";

export default function Login() {
  const { session, signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const sendReset = async (e) => {
    e.preventDefault();
    setForgotBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: "https://qasir-transactions.preview.emergentagent.com/reset-password",
    });
    setForgotBusy(false);
    if (err) return setForgotMsg(`ERR:${err.message}`);
    setForgotMsg("OK:Jika email terdaftar, tautan reset sudah dikirim.");
  };

  if (session) return <Navigate to={loc.state?.from || "/"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err.message === "Invalid login credentials" ? "Email atau password salah" : err.message);
    else nav(loc.state?.from || "/", { replace: true });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#F8FAFC]">
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <div className="flex items-center gap-2 mb-16 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-600 text-white"><Store className="h-5 w-5" /></div>
          <span className="font-heading text-xl font-extrabold tracking-tight">CS Qasir</span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Point of Sale</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight mt-3 max-w-md">Masuk ke kasir Anda.</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-4 max-w-md">Owner melihat semua outlet. Kasir hanya outlet tempatnya bertugas.</p>
        <form onSubmit={submit} className="mt-10 space-y-5 max-w-md" data-testid="login-form">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-white" data-testid="login-email-input" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button type="button" onClick={() => { setForgotMsg(""); setForgotEmail(email); setForgotOpen(true); }}
                className="text-xs font-semibold text-emerald-700 hover:underline" data-testid="login-forgot-password-link">Lupa password?</button>
            </div>
            <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-white" data-testid="login-password-input" />
          </div>
          {error && <p className="text-sm font-medium text-rose-600" data-testid="login-error">{error}</p>}
          <Button type="submit" disabled={busy} className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold active:scale-[0.98] transition-transform" data-testid="login-submit-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
          </Button>
        </form>
        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent className="sm:max-w-sm bg-background" data-testid="forgot-password-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading">Lupa password</DialogTitle>
              <DialogDescription>Kami kirim tautan untuk mengatur password baru.</DialogDescription>
            </DialogHeader>
            <form onSubmit={sendReset} className="space-y-4" data-testid="forgot-password-form">
              <Input type="email" required placeholder="Email Anda" value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)} className="h-12" data-testid="forgot-password-email-input" />
              {forgotMsg && (
                <p className={`text-sm font-medium ${forgotMsg.startsWith("OK:") ? "text-emerald-700" : "text-rose-600"}`} data-testid="forgot-password-message">
                  {forgotMsg.slice(3)}
                </p>
              )}
              <Button type="submit" disabled={forgotBusy} className="h-11 w-full bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="forgot-password-submit-button">
                {forgotBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim tautan reset"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative hidden lg:block">
        <img src={HERO} alt="Kasir toko" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute bottom-10 left-10 right-10 rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 text-white">
          <p className="font-mono text-3xl font-bold">Rp 15.000</p>
          <p className="text-sm mt-1 text-white/80">Checkout atomik — stok tidak pernah minus, tidak ada penjualan ganda.</p>
        </div>
      </div>
    </div>
  );
}
