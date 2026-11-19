import { PERMISSION } from "@lifex/shared";
import { useState } from "react";
import { useNavigate } from "react-router";
import { fetchMe, login, logout } from "@/api/auth.ts";
import { isApiError } from "@/api/errors.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import { adminTexts as tx } from "../admin-texts.ts";
import { EmailStep } from "./EmailStep.tsx";
import { PasswordStep } from "./PasswordStep.tsx";

/** Login del panel en dos pasos: correo y luego clave. El logo es el horizontal de la web. */
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn(password: string) {
    setPending(true);
    setError(null);
    try {
      const session = await login({ email, password });
      const me = await fetchMe(session.accessToken);
      if (!me.permissions.includes(PERMISSION.dashboardRead)) {
        // Sin permiso: se cierra la sesión recién abierta y no se entra al panel.
        await logout().catch(() => undefined);
        useStaffSession.getState().clear();
        setError(tx.noAccess);
        return;
      }
      useStaffSession.getState().setSession(session.accessToken, me, session.expiresIn);
      await navigate("/admin");
    } catch (caught) {
      setError(isApiError(caught) && caught.code !== "NETWORK" ? caught.message : tx.networkError);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" aria-label={tx.backToSite} className="self-center">
          <img src="/logo/lifex-horizontal.svg" alt="lifex" className="h-10 w-auto" />
        </a>
        <div className="bg-card flex flex-col gap-6 rounded-xl border p-6 shadow-sm">
          <header className="flex flex-col gap-1 text-center">
            <h1 className="text-xl font-semibold">{tx.loginTitle}</h1>
            <p className="text-muted-foreground text-sm">{tx.loginSubtitle}</p>
          </header>
          {step === "email" ? (
            <EmailStep
              initialEmail={email}
              onNext={(value) => {
                setEmail(value);
                setError(null);
                setStep("password");
              }}
            />
          ) : (
            <PasswordStep
              email={email}
              error={error}
              pending={pending}
              onBack={() => {
                setError(null);
                setStep("email");
              }}
              onSubmit={(password) => void signIn(password)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
