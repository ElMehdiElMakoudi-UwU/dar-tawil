import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/gestion/auth";
import { sql } from "@/lib/gestion/db";
import { getT } from "@/lib/gestion/lang";
import { login } from "../actions";
import { AuthCard } from "../_components/auth-card";
import { ActionForm, Submit } from "../_components/forms";
import { Field } from "../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).auth.signInTitle };
}

export default async function LoginPage() {
  if (await getUser()) redirect("/gestion");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users`;
  if (n === 0) redirect("/gestion/setup");
  const t = await getT();

  return (
    <AuthCard title={t.auth.loginTitle} sub={t.auth.loginSub}>
      <ActionForm action={login} keep className="space-y-4">
        <Field label={t.common.email}>
          <input className="g-input" type="email" name="email" autoComplete="username" required autoFocus />
        </Field>
        <Field label={t.common.password}>
          <input className="g-input" type="password" name="password" autoComplete="current-password" required />
        </Field>
        <Submit className="g-btn w-full">{t.auth.signIn}</Submit>
      </ActionForm>
    </AuthCard>
  );
}
