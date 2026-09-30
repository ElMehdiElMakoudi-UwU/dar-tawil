"use client";

import { useState } from "react";
import type { Dictionary } from "@/content/fr";
import { site, whatsappLink } from "@/lib/site";

/**
 * No backend yet, and none is pretended. The form composes the message and
 * hands it to WhatsApp or the visitor's mail client — both of which the client
 * already reads. Swap in a real action when a form endpoint exists.
 */
export function ContactForm({ t }: { t: Dictionary }) {
  const f = t.contactPage.fields;
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    subject: f.subjectOptions[0],
    message: "",
  });

  const set = (key: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setValues((v) => ({ ...v, [key]: event.target.value }));

  const composed = [
    `${f.subject}: ${values.subject}`,
    `${f.name}: ${values.name}`,
    values.phone && `${f.phone}: ${values.phone}`,
    values.email && `${f.email}: ${values.email}`,
    "",
    values.message,
  ]
    .filter(Boolean)
    .join("\n");

  const mailto = `mailto:${site.email}?subject=${encodeURIComponent(
    `${site.name} — ${values.subject}`,
  )}&body=${encodeURIComponent(composed)}`;

  const field =
    "mt-2 w-full border border-or/25 bg-brou/45 px-4 py-3 text-[0.95rem] text-ivoire placeholder:text-ivoire/30 transition-colors focus:border-or focus:outline-none";
  const label = "block text-[0.72rem] uppercase tracking-[0.18em] text-or/80";

  return (
    <form
      className="space-y-7"
      onSubmit={(event) => event.preventDefault()}
      aria-describedby="form-notice"
    >
      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">
            {f.name}
          </label>
          <input
            id="name"
            name="name"
            className={field}
            value={values.name}
            onChange={set("name")}
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label className={label} htmlFor="phone">
            {f.phone}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className={field}
            value={values.phone}
            onChange={set("phone")}
            autoComplete="tel"
            dir="ltr"
          />
        </div>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="email">
            {f.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={field}
            value={values.email}
            onChange={set("email")}
            autoComplete="email"
            dir="ltr"
          />
        </div>
        <div>
          <label className={label} htmlFor="subject">
            {f.subject}
          </label>
          <select
            id="subject"
            name="subject"
            className={field}
            value={values.subject}
            onChange={set("subject")}
          >
            {f.subjectOptions.map((option) => (
              <option key={option} value={option} className="bg-noir">
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="message">
          {f.message}
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          className={`${field} resize-y`}
          placeholder={f.messagePlaceholder}
          value={values.message}
          onChange={set("message")}
          required
        />
      </div>

      <p id="form-notice" className="text-[0.82rem] leading-relaxed text-ivoire/45">
        {t.ui.demoNotice}
      </p>

      <div className="flex flex-wrap gap-4">
        <a
          href={whatsappLink(composed)}
          target="_blank"
          rel="noreferrer"
          className="cta-primary inline-flex items-center gap-3 bg-or px-7 py-3.5 text-[0.76rem] font-medium uppercase tracking-[0.18em] text-noir transition-colors hover:bg-or-clair"
        >
          {f.sendWhatsapp}
        </a>
        <a
          href={mailto}
          className="inline-flex items-center gap-3 border border-or/45 px-7 py-3.5 text-[0.76rem] font-medium uppercase tracking-[0.18em] text-or-clair transition-colors hover:border-or hover:bg-or/10"
        >
          {f.sendEmail}
        </a>
      </div>
    </form>
  );
}
