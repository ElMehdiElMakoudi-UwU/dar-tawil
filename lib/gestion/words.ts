/**
 * An amount in French words, as Moroccan invoices state it:
 * 1250.5 → "mille deux cent cinquante dirhams et cinquante centimes".
 */

const units = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function belowHundred(n: number): string {
  if (n < 20) return units[n];
  const t = Math.floor(n / 10);
  let u = n % 10;
  // 70–79 and 90–99 count on from 60 and 80: soixante-douze, quatre-vingt-quinze.
  if (t === 7 || t === 9) u += 10;
  if (u === 0) return t === 8 ? "quatre-vingts" : tens[t];
  if ((u === 1 || u === 11) && t !== 8 && t !== 9) return `${tens[t]} et ${units[u]}`;
  return `${tens[t]}-${units[u]}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return belowHundred(r);
  const head = h === 1 ? "cent" : `${units[h]} cent${r === 0 ? "s" : ""}`;
  return r ? `${head} ${belowHundred(r)}` : head;
}

export function integerInWords(n: number): string {
  if (n === 0) return units[0];
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${belowThousand(millions)} million${millions > 1 ? "s" : ""}`);
  // "cents" and "quatre-vingts" lose their s before mille.
  if (thousands) parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands).replace(/s$/, "")} mille`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const dh = Math.floor(cents / 100);
  const c = cents % 100;
  let out = `${integerInWords(dh)} dirham${dh > 1 ? "s" : ""}`;
  if (c) out += ` et ${integerInWords(c)} centime${c > 1 ? "s" : ""}`;
  return out;
}
