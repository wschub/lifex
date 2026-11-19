import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { adminTexts as tx } from "../admin-texts.ts";

/** Paso 2: la clave. El correo del paso 1 se muestra y se puede cambiar sin perderlo. */
export function PasswordStep({
  email,
  error,
  pending,
  onBack,
  onSubmit,
}: {
  email: string;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== "") onSubmit(password);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span className="truncate">{email}</span>
        <button type="button" onClick={onBack} className="text-primary text-sm underline">
          {tx.changeEmail}
        </button>
      </div>
      <Field data-invalid={error !== null || undefined}>
        <FieldLabel htmlFor="password">{tx.password}</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          aria-invalid={error !== null}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error !== null ? <FieldError>{error}</FieldError> : null}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? tx.signingIn : tx.signIn}
      </Button>
    </form>
  );
}
