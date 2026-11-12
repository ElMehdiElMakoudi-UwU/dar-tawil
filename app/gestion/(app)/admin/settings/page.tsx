import type { Metadata } from "next";
import { requireAdmin } from "@/lib/gestion/auth";
import { fill } from "@/lib/gestion/i18n";
import { getT } from "@/lib/gestion/lang";
import { getBusiness, getListRows, getUsers, type ListKind } from "@/lib/gestion/queries";
import { addListItem, createUser, deleteListItem, saveBusiness, updateUser } from "../../../actions";
import { ActionButton, ActionForm, Submit } from "../../../_components/forms";
import { Field, PageHeader, Section, Select } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.settings };
}

export default async function SettingsPage() {
  const me = await requireAdmin();
  const [users, listRows, business, t] = await Promise.all([getUsers(), getListRows(), getBusiness(), getT()]);
  const listLabels: Record<ListKind, string> = t.settings.lists;
  const roles = [
    { value: "staff", label: t.settings.roleStaff },
    { value: "admin", label: t.settings.roleAdmin },
  ];

  return (
    <>
      <PageHeader title={t.nav.settings} />

      <Section title={t.settings.whoTitle}>
        <p className="g-muted mb-4 text-sm">
          <strong className="font-medium text-[var(--color-ivoire)]">{t.settings.staffStrong}</strong>
          {t.settings.staffText}
          <strong className="font-medium text-[var(--color-ivoire)]">{t.settings.adminStrong}</strong>
          {t.settings.adminText}
        </p>
        <div className="space-y-2">
          {users.map((u) => (
            <details key={u.id} className="g-card py-3">
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                <span className={u.active ? "font-medium" : "g-muted"}>
                  {u.name} <span className="g-muted font-normal">· {u.email}</span>
                  {u.id === me.id && <span className="g-muted font-normal">{t.settings.you}</span>}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className={`g-badge ${u.role === "admin" ? "g-badge-good" : "g-badge-muted"}`}>{t.roles[u.role]}</span>
                  {!u.active && <span className="g-badge g-badge-bad">{t.settings.disabled}</span>}
                  <span className="g-muted">{t.common.edit}</span>
                </span>
              </summary>
              <ActionForm action={updateUser} keep className="mt-4">
                <input type="hidden" name="id" value={u.id} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t.common.role}>
                    <Select name="role" options={roles} defaultValue={u.role} blank={false} />
                  </Field>
                  <Field label={t.settings.newPassword}>
                    <input className="g-input" type="password" name="password" autoComplete="new-password" minLength={8} />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input type="checkbox" name="active" defaultChecked={u.active} className="size-4 accent-[var(--color-accent)]" />
                    {t.settings.canSignIn}
                  </label>
                </div>
                <div className="mt-4">
                  <Submit>{t.common.save}</Submit>
                </div>
              </ActionForm>
            </details>
          ))}
        </div>

        <ActionForm action={createUser} className="g-card mt-4">
          <h3 className="mb-3 font-medium">{t.settings.addTitle}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.common.name}>
              <input className="g-input" name="name" required />
            </Field>
            <Field label={t.settings.emailLogin}>
              <input className="g-input" type="email" name="email" required autoComplete="off" />
            </Field>
            <Field label={t.common.password8}>
              <input className="g-input" type="password" name="password" required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label={t.common.role}>
              <Select name="role" options={roles} defaultValue="staff" blank={false} />
            </Field>
          </div>
          <div className="mt-4">
            <Submit>{t.settings.createAccount}</Submit>
          </div>
        </ActionForm>
      </Section>

      <Section title={t.settings.businessTitle}>
        <ActionForm action={saveBusiness} keep className="g-card">
          <p className="g-muted mb-4 text-sm">{t.settings.businessSub}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["business_name", t.settings.biz.business_name],
                ["legal_name", t.settings.biz.legal_name],
                ["phone", t.common.phone],
                ["address", t.settings.biz.address],
                ["city", t.common.city],
                ["email", t.common.email],
                ["ice", "ICE"],
                ["if_no", t.settings.biz.if_no],
                ["rc", t.settings.biz.rc],
                ["patente", t.settings.biz.patente],
                ["cnss", "CNSS"],
                ["vat_rate", t.settings.biz.vat_rate],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input className="g-input" name={key} defaultValue={business[key]} inputMode={key === "vat_rate" ? "decimal" : undefined} />
              </Field>
            ))}
            <Field label={t.settings.biz.receipt_footer} className="sm:col-span-2 lg:col-span-3">
              <input className="g-input" name="receipt_footer" defaultValue={business.receipt_footer} />
            </Field>
            <Field label={t.settings.biz.invoice_footer} className="sm:col-span-2 lg:col-span-3">
              <input className="g-input" name="invoice_footer" defaultValue={business.invoice_footer} placeholder={t.settings.biz.invoiceFooterPh} />
            </Field>
          </div>
          <p className="g-muted mt-3 text-xs">{t.settings.biz.vatHint}</p>
          <div className="mt-4">
            <Submit>{t.common.save}</Submit>
          </div>
        </ActionForm>
      </Section>

      <Section title={t.settings.listsTitle}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(listLabels) as ListKind[]).map((kind) => (
            <div key={kind} className="g-card">
              <h3 className="mb-3 font-medium">{listLabels[kind]}</h3>
              <ul className="mb-3 space-y-1">
                {listRows
                  .filter((r) => r.kind === kind)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      {r.value}
                      <ActionButton action={deleteListItem} fields={{ id: r.id }} className="g-link-danger">
                        {t.common.remove}
                      </ActionButton>
                    </li>
                  ))}
              </ul>
              <ActionForm action={addListItem} className="flex gap-2">
                <input type="hidden" name="kind" value={kind} />
                <input
                  className="g-input"
                  name="value"
                  placeholder={t.settings.newOption}
                  required
                  aria-label={fill(t.settings.newOptionFor, { list: listLabels[kind] })}
                />
                <Submit className="g-btn g-btn-ghost">{t.common.add}</Submit>
              </ActionForm>
            </div>
          ))}
        </div>
        <p className="g-muted mt-3 text-xs">{t.settings.removeNote}</p>
      </Section>
    </>
  );
}
