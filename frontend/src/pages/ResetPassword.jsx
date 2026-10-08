import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

export default function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Recovery link carries a hash session; detectSessionInUrl processes it,
    // then PASSWORD_RECOVERY fires. getSession() covers a late mount.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) { setReady(true); setChecking(false); }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError("Minimal 8 karakter.");
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setBusy(false); return setError(err.message); }
    await supabase.auth.signOut();
    alert("Password changed");
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm" data-testid="reset-password-card">
        <div className="flex items-center gap-2 mb-8">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-600 text-white"><Store className="h-5 w-5" /></div>
          <span className="font-heading text-lg font-extrabold tracking-tight">CS Qasir</span>
        </div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Atur ulang password</h1>
        {checking && <p className="text-sm text-muted-foreground mt-4" data-testid="reset-password-verifying">Memverifikasi tautan pemulihan…</p>}
        {!checking && !ready && (
          <div className="mt-4" data-testid="reset-password-invalid">
            <p className="text-sm text-rose-600">Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru.</p>
            <Link to="/login" data-testid="reset-password-back-login" className="text-sm font-semibold text-emerald-700 hover:underline inline-block mt-2">Kembali ke login</Link>
          </div>
        )}
        {ready && (
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="reset-password-form">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Password baru (min. 8)</Label>
              <Input id="new-password" type="password" required minLength={8} autoFocus value={password}
                onChange={(e) => setPassword(e.target.value)} className="h-12" data-testid="reset-password-input" />
            </div>
            {error && <p className="text-sm font-medium text-rose-600" data-testid="reset-password-error">{error}</p>}
            <Button type="submit" disabled={busy} className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" data-testid="reset-password-submit-button">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save New Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
