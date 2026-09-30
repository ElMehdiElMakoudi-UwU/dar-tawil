import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/gestion/db";
import { getT } from "@/lib/gestion/lang";
import { setup } from "../actions";
import { AuthCard } from "../_components/auth-card";
import { ActionForm, Submit } from "../_components/forms";
import { Field } from "../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).auth.setupTitle };
}

/** Only reachable while there are no users: creates the owner's admin account. */
export default async function SetupPage() {
  await connection(); // per request: whether users exist is only known at runtime
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users`;
  if (n > 0) redirect("/gestion/login");
  const t = await getT();

  return (
    <AuthCard title={t.auth.welcome} sub={t.auth.setupSub}>
      <ActionForm action={setup} keep className="space-y-4">
        <Field label={t.auth.yourName}>
          <input className="g-input" name="name" autoComplete="name" required autoFocus />
        </Field>
        <Field label={t.common.email}>
          <input className="g-input" type="email" name="email" autoComplete="username" required />
        </Field>
        <Field label={t.common.password8}>
          <input className="g-input" type="password" name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Submit className="g-btn w-full">{t.auth.createAdmin}</Submit>
      </ActionForm>
    </AuthCard>
  );
}
