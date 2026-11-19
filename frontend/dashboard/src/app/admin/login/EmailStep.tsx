import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { adminTexts as tx } from "../admin-texts.ts";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Paso 1: solo valida el formato. No consulta si el correo existe (evita revelar quién es del staff). */
export function EmailStep({
  initialEmail,
  onNext,
}: {
  initialEmail: string;
  onNext: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_FORMAT.test(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onNext(value);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="email">{tx.email}</FieldLabel>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder={tx.emailPlaceholder}
          value={email}
          aria-invalid={invalid}
          onChange={(event) => setEmail(event.target.value)}
        />
        {invalid ? <FieldError>{tx.emailInvalid}</FieldError> : null}
      </Field>
      <Button type="submit">{tx.continue}</Button>
    </form>
  );
}
