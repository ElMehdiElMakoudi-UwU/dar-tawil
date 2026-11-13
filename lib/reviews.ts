/**
 * Customer messages shown on the Avis page — cropped from the house's
 * "Reviews" Instagram highlight.
 *
 * To add one: crop the screenshot (no phone status bar, no names or avatars),
 * drop it in `public/photos/avis/`, and add an entry below with its pixel size
 * and a transcription of what it says. The transcription is the image's alt
 * text, so screen readers and search engines get the words, not just a picture.
 */
export type Review = {
  src: string;
  width: number;
  height: number;
  /** ISO date the message was posted to the highlight. */
  date: string;
  /** "story" is a customer's own post; "messages" is a board of DMs. */
  kind: "story" | "messages";
  /** Every message on the board, verbatim. */
  transcript: string[];
};

export const reviews: Review[] = [
  {
    src: "/photos/avis/avis-14-oct.jpg",
    width: 589,
    height: 783,
    date: "2026-10-14",
    kind: "messages",
    transcript: [
      "Wslatni la commande très bonne qualité",
      "Merci bcp",
      "Vraiment trop bon ❤️",
      "Amlou j'adoooreee",
      "Ferreroo roche Hta hiaaa",
      "Amaaa konafa pistache hadeeek buhdaaa 🙌 le goût exact du pistache 👌",
      "C'est trop bon tbarkelah 3lik",
      "Tbarkllh 3likom les goûts wa3rin",
      "Lah iysser likom",
    ],
  },
  {
    src: "/photos/avis/avis-28-sept.jpg",
    width: 473,
    height: 702,
    date: "2026-09-28",
    kind: "story",
    transcript: [
      "Y a pas mieux pour démarrer votre journée qu'un café et un bon chocolat de chez « Dar Tawil »",
    ],
  },
  {
    src: "/photos/avis/avis-08-oct.jpg",
    width: 589,
    height: 465,
    date: "2026-10-08",
    kind: "messages",
    transcript: [
      "Salut dakchi ghzal les goûts kamlin wa3rin",
      "Saraha raw3a machallah mada9at kayhamko w qualité dial chocolat meziwna allah ywefa9kom 🙏",
      "سلام تبارك الله مزيون وكالتي غدي نزوركم انشاء الله لمحل",
      "Tbrklah fna fna ghtrja3 idman inchalah",
    ],
  },
  {
    src: "/photos/avis/avis-02-oct.jpg",
    width: 589,
    height: 465,
    date: "2026-10-02",
    kind: "messages",
    transcript: [
      "Tbarkellah 3likom",
      "Vraiment 9bayla Mcjit",
      "Wallah c different",
      "Khdit boite de chocolat barah",
      "Mziiiiounin tabreklah",
      "صراحة راجلي جابلي اليوم شيكولة من عندكم رائعة كونسيبت واعر",
    ],
  },
  {
    src: "/photos/avis/avis-18-oct.jpg",
    width: 589,
    height: 495,
    date: "2026-10-18",
    kind: "messages",
    transcript: [
      "Slm a khti",
      "Hmd",
      "Meziwen dakxi tbarkllah 3likom",
      "Ghzaaala wlah ❤️",
      "Salinaha 😂",
      "Kont kanchriha mn whda f casa hadi hssn",
      "Ok do9et chocolat dialkom mada9o kihama9 tbarklah elikom",
    ],
  },
];
