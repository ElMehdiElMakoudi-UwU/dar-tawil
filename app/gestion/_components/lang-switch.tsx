import { langs, langShort } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { setLang } from "../actions";

/** FR | عربي — a plain form, so it works before any JavaScript has loaded. */
export async function LangSwitch() {
  const [lang, t] = await Promise.all([getLang(), getT()]);
  return (
    <form action={setLang} className="flex gap-1" role="group" aria-label={t.lang}>
      {langs.map((l) => (
        <button
          key={l}
          name="lang"
          value={l}
          lang={l}
          className={`g-btn g-btn-sm ${l === lang ? "" : "g-btn-ghost"}`}
          aria-pressed={l === lang}
        >
          {langShort[l]}
        </button>
      ))}
    </form>
  );
}
