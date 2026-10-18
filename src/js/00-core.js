/* ==========================================================================
   هسته: ابزارها، تاریخ شمسی، وضعیت، ذخیره‌سازی، پوسته
   ========================================================================== */

"use strict";

const STORAGE_KEY = "gozareshyar.v1";
const APP_ID = "gozaresh-yar";
const APP_VERSION = 1;
const ZWNJ = "\u200c";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const STATUS = {
  done: { label: "انجام‌شده", short: "انجام‌شده", emoji: "✅", order: 0 },
  doing: { label: "در حال انجام", short: "در حال انجام", emoji: "🔄", order: 1 },
  blocked: { label: "مسدود", short: "مسدود", emoji: "⛔", order: 2 },
  planned: { label: "برنامه‌ی آینده", short: "آینده", emoji: "📌", order: 3 }
};

const SOURCE_LABEL = {
  manual: "دستی",
  paste: "چسباندن",
  excel: "فایل",
  smart: "تحلیل متن",
  sample: "نمونه"
};

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

const DEFAULT_SETTINGS = {
  author: "",
  role: "",
  team: "",
  defaultProject: "",
  template: "daily",
  theme: "dark",
  aiEnabled: false,
  aiUrl: "https://api.openai.com/v1",
  aiModel: "gpt-4o-mini",
  aiKey: "",
  dailyCapacity: 8
};

const DEFAULT_RULES = [
  {
    id: "rule-verb-start",
    key: "verbStart",
    type: "structural",
    title: "شروع با فعل کاری",
    desc: "هر ردیف با یک فعل روشن شروع شود؛ مثل پیاده‌سازی، رفع، بررسی، تست، مستندسازی یا هماهنگی.",
    enabled: true,
    custom: false,
    config: {
      verbs: [
        "پیاده‌سازی", "توسعه", "رفع", "بررسی", "تست", "مستندسازی", "هماهنگی",
        "آماده‌سازی", "پیکربندی", "پیگیری", "طراحی", "ایجاد", "به‌روزرسانی",
        "اصلاح", "تحلیل", "جلسه", "ارسال", "دریافت", "نصب", "راه‌اندازی",
        "مهاجرت", "بازبینی", "تدوین", "تهیه", "اجرا", "برنامه‌ریزی", "نگهداری",
        "پشتیبانی", "تکمیل", "شروع", "ادامه", "ساخت", "افزودن", "حذف",
        "ویرایش", "انتقال", "ذخیره", "بارگذاری", "کنترل", "پایش", "بهینه‌سازی",
        "یکپارچه‌سازی", "آموزش", "پاسخ", "تماس", "مذاکره", "برآورد", "سنجش"
      ]
    }
  },
  {
    id: "rule-row-structure",
    key: "rowStructure",
    type: "structural",
    title: "ساختار ردیف گزارش",
    desc: "هر ردیف ترجیحاً فعل + موضوع + نتیجه یا وضعیت + عدد باشد. جزئیات وضعیت، درصد، ساعت و پروژه به‌صورت مرتب به ردیف اضافه می‌شود.",
    enabled: true,
    custom: false,
    config: {}
  },
  {
    id: "rule-persian-digits",
    key: "persianDigits",
    type: "structural",
    title: "اعداد فارسی",
    desc: "همه‌ی اعداد گزارش با ارقام فارسی نوشته شوند.",
    enabled: true,
    custom: false,
    config: {}
  },
  {
    id: "rule-hours-unit",
    key: "hoursUnit",
    type: "structural",
    title: "واحد ساعت",
    desc: "زمان صرف‌شده با واحد فارسی «ساعت» نمایش داده شود؛ مثل «۲٫۵ ساعت».",
    enabled: true,
    custom: false,
    config: { unit: "ساعت" }
  },
  {
    id: "rule-percent-symbol",
    key: "percentSymbol",
    type: "structural",
    title: "نماد درصد فارسی",
    desc: "درصد پیشرفت با نماد فارسی «٪» نمایش داده شود؛ مثل «۷۰٪».",
    enabled: true,
    custom: false,
    config: { symbol: "٪" }
  },
  {
    id: "rule-no-first-person",
    key: "noFirstPerson",
    type: "structural",
    title: "بدون ضمیر اول‌شخص",
    desc: "ضمیرهای اول‌شخص از متن گزارش حذف شوند تا لحن رسمی و بی‌طرف بماند.",
    enabled: true,
    custom: false,
    config: { words: ["من", "ما", "خودم", "خودمان", "اینجانب"] }
  },
  {
    id: "rule-vague",
    key: "vagueWarnings",
    type: "structural",
    title: "هشدار عبارت‌های مبهم",
    desc: "عبارت‌های کلی مثل «در حال کار» یا «انجام شد» هشدار می‌گیرند تا نتیجه‌ی روشن‌تری نوشته شود.",
    enabled: true,
    custom: false,
    config: { phrases: ["در حال کار", "کار شد", "انجام شد", "بررسی شد", "ادامه کار", "کارها", "انجام کارها", "پیگیری شد"] }
  },
  {
    id: "rule-blockers",
    key: "blockersSection",
    type: "structural",
    title: "بخش جداگانه‌ی موانع",
    desc: "اگر مانعی وجود دارد، در بخش «موانع و نیازمند اقدام» نمایش داده شود.",
    enabled: true,
    custom: false,
    config: { title: "موانع و نیازمند اقدام" }
  },
  {
    id: "rule-future-tone",
    key: "futureTone",
    type: "structural",
    title: "لحن آینده برای برنامه‌ی فردا",
    desc: "موارد برنامه‌ی آینده با لحن آینده نوشته شوند؛ مثل «انجام خواهد شد».",
    enabled: true,
    custom: false,
    config: { suffix: "انجام خواهد شد." }
  },
  {
    id: "rule-empty-fields",
    key: "emptyFields",
    type: "structural",
    title: "خروجی بدون شکستگی",
    desc: "فیلدهای خالی و بخش‌های بی‌محتوا در گزارش نمایش داده نشوند تا خروجی ناقص یا زشت نشود.",
    enabled: true,
    custom: false,
    config: {}
  },
  {
    id: "rule-admin-intro",
    key: "adminIntro",
    type: "structural",
    title: "مقدمه‌ی گزارش",
    desc: "در قالب گزارش کار اداری، یک مقدمه‌ی کوتاه درباره‌ی هدف و بازه‌ی گزارش بیاور.",
    enabled: true,
    custom: false,
    config: {
      text: "این گزارش شامل فعالیت‌های انجام‌شده در روز {تاریخ} توسط {نویسنده} و نتایج پیگیری کارهاست."
    }
  },
  {
    id: "rule-activity-groups",
    key: "activityGroups",
    type: "structural",
    title: "دسته‌بندی فعالیت‌ها",
    desc: "در قالب اداری، فعالیت‌ها بر اساس وضعیت (انجام‌شده، در حال انجام، مسدود و برنامه‌ی آینده) گروه‌بندی شوند.",
    enabled: true,
    custom: false,
    config: {}
  },
  {
    id: "rule-results-numbers",
    key: "resultsNumbers",
    type: "structural",
    title: "نتایج با عدد و آمار",
    desc: "در قالب اداری، بخش «نتایج و دستاوردها» شامل تعداد فعالیت‌ها، ساعت کار، پیشرفت و موانع باشد.",
    enabled: true,
    custom: false,
    config: {}
  },
  {
    id: "rule-challenge-solutions",
    key: "challengeSolutions",
    type: "structural",
    title: "چالش همراه راهکار",
    desc: "برای هر مانع، یک راهکار یا اقدام بعدی پیشنهاد شود و تسک مسدود بدون راهکار هشدار بگیرد.",
    enabled: true,
    custom: false,
    config: {}
  },
  {
    id: "rule-admin-conclusion",
    key: "adminConclusion",
    type: "structural",
    title: "جمع‌بندی و بازخورد",
    desc: "در قالب اداری، یک جمع‌بندی کوتاه از عملکرد و یک پیشنهاد بهبود بیاور.",
    enabled: true,
    custom: false,
    config: {
      text: "",
      suggestion: "برای بهبود روند، دقت در ثبت اولیه‌ی اطلاعات و پیگیری منظم اقدامات پیشنهاد می‌شود."
    }
  },
  {
    id: "rule-linguistic-admin-tone",
    key: "linguisticAdminTone",
    type: "linguistic",
    title: "لحن اداری و رسمی",
    desc: "در بازنویسی هوشمند، متن با لحن اداری، رسمی و قابل پیگیری نوشته شود.",
    enabled: true,
    custom: false,
    config: { instruction: "متن را با لحن اداری، رسمی و قابل پیگیری بنویس؛ از زبان محاوره و جمله‌های کلی پرهیز کن." }
  },
  {
    id: "rule-linguistic-evidence",
    key: "linguisticEvidence",
    type: "linguistic",
    title: "نتیجه با شاهد و عدد",
    desc: "در بازنویسی هوشمند، عدد، درصد یا ساعتِ موجود در متن حفظ شود و نتیجه با شاهد روشن بیان شود.",
    enabled: true,
    custom: false,
    config: { instruction: "در نتایج، عدد، درصد یا ساعت را حفظ کن و در صورت امکان یک شاهد روشن برای نتیجه بیاور." }
  },
  {
    id: "rule-linguistic-clarity",
    key: "linguisticClarity",
    type: "linguistic",
    title: "پرهیز از کلی‌گویی",
    desc: "در بازنویسی هوشمند، عبارت‌های مبهم با نتیجه یا اقدام مشخص جایگزین شوند.",
    enabled: true,
    custom: false,
    config: { instruction: "عبارت‌های کلی مثل «کار شد» یا «بررسی شد» را با نتیجه یا اقدام مشخص جایگزین کن." }
  },
  {
    id: "rule-linguistic-formal",
    key: "linguisticFormal",
    type: "linguistic",
    title: "لحن رسمی و کوتاه",
    desc: "در بازنویسی هوشمند، جمله‌ها رسمی، کوتاه و بدون تکرار بازنویسی شوند.",
    enabled: true,
    custom: false,
    config: { instruction: "جمله‌ها را رسمی، کوتاه و بدون تکرار بنویس. از زبان محاوره و توضیح اضافه پرهیز کن." }
  },
  {
    id: "rule-linguistic-result",
    key: "linguisticResult",
    type: "linguistic",
    title: "پایان با نتیجه‌ی روشن",
    desc: "در بازنویسی هوشمند، هر ردیف با نتیجه یا وضعیت روشن تمام شود.",
    enabled: true,
    custom: false,
    config: { instruction: "در پایان هر ردیف نتیجه یا وضعیت روشن را بیاور؛ اگر عدد یا پیشرفت وجود دارد، آن را حفظ کن." }
  }
];

const SAMPLE_TASKS = [
  {
    title: "پیاده‌سازی مرحله‌ی ورود کاربران", status: "done", progress: 100, hours: 3, category: "توسعه", project: "",
    checklist: [
      { text: "طراحی فرم ورود", done: true },
      { text: "اتصال به سرویس احراز هویت", done: true },
      { text: "تست سناریوهای ورود", done: true }
    ]
  },
  { title: "رفع خطای خروجی گرفتن از گزارش ماهانه", status: "done", hours: 1.5, category: "رفع خطا", project: "" },
  {
    title: "توسعه‌ی داشبورد مدیریتی", status: "doing", progress: 60, hours: 4, category: "توسعه", project: "",
    checklist: [
      { text: "نمودار فروش", done: true },
      { text: "نمودار کاربران فعال", done: false },
      { text: "بازبینی با تیم محصول", done: false }
    ],
    futurePlans: [
      { text: "تکمیل نمودارهای داشبورد", date: "" }
    ]
  },
  {
    title: "اتصال به سرویس احراز هویت", status: "blocked", blocker: "دسترسی به کلیدهای محیط تولید",
    nextStep: "هماهنگی با تیم زیرساخت", category: "زیرساخت", project: "",
    futurePlans: [
      { text: "دریافت کلید محیط تولید", date: "" },
      { text: "تست اتصال در محیط آزمایشی", date: "" }
    ]
  },
  { title: "تست یکپارچه‌ی فرایند پرداخت", status: "planned", nextStep: "تست یکپارچه‌ی فرایند پرداخت", category: "تست", project: "" },
  { title: "مستندسازی راهنمای استقرار", status: "done", hours: 1, category: "مستندسازی", project: "" },
  { title: "هماهنگی جلسه‌ی بازبینی طراحی", status: "doing", progress: 30, hours: 0.75, category: "هماهنگی", project: "" },
  { title: "به‌روزرسانی نسخه‌ی کتابخانه‌ی جدول", status: "planned", nextStep: "بررسی سازگاری نسخه‌ی جدید", category: "نگهداری", project: "" }
];

const SAMPLE_CSV_ROWS = [
  ["عنوان", "وضعیت", "دسته‌بندی", "درصد پیشرفت", "ساعت", "پروژه", "مسئول", "مانع", "گام بعدی", "تاریخ"],
  ["پیاده‌سازی صفحه‌ی ورود", "انجام‌شده", "توسعه", "۱۰۰", "۳", "سامانه‌ی داخلی", "سارا محمدی", "", "", "۱۴۰۵/۰۲/۱۵"],
  ["رفع خطای گزارش ماهانه", "انجام‌شده", "رفع خطا", "۱۰۰", "۱٫۵", "سامانه‌ی داخلی", "سارا محمدی", "", "", "۱۴۰۵/۰۲/۱۵"],
  ["توسعه‌ی داشبورد مدیریتی", "در حال انجام", "توسعه", "۶۰", "۴", "سامانه‌ی داخلی", "سارا محمدی", "", "تکمیل نمودارها", "۱۴۰۵/۰۲/۱۵"],
  ["اتصال به سرویس احراز هویت", "مسدود", "زیرساخت", "۰", "۲", "سامانه‌ی داخلی", "امیر رضایی", "دسترسی به کلید محیط تولید", "هماهنگی با تیم زیرساخت", "۱۴۰۵/۰۲/۱۵"],
  ["تست یکپارچه‌ی پرداخت", "برنامه‌ی آینده", "تست", "۰", "", "سامانه‌ی داخلی", "سارا محمدی", "", "تست پرداخت", "۱۴۰۵/۰۲/۱۶"],
  ["مستندسازی راهنمای استقرار", "انجام‌شده", "مستندسازی", "۱۰۰", "۱", "سامانه‌ی داخلی", "امیر رضایی", "", "", "۱۴۰۵/۰۲/۱۵"]
];

/* ------------------------------ ابزارهای عمومی ------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function icon(name, cls = "") {
  return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function uid(prefix = "t") {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return prefix + "-" + window.crypto.randomUUID();
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function deepClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function debounce(fn, wait = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function faDigits(value) {
  return String(value == null ? "" : value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

function fa2(value) {
  return faDigits(String(value)).padStart(2, "۰");
}

function toLatinDigits(value) {
  return String(value == null ? "" : value)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

function parseNum(value, fallback = null) {
  if (value == null) return fallback;
  let s = toLatinDigits(String(value)).replace(/[٬,\s]/g, "").replace(/٫/g, ".").replace(/[٪%]/g, "");
  s = s.replace(/[^0-9.\-]/g, "");
  if (!s || s === "." || s === "-") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function formatNum(value, maxFrac = 2) {
  let n = Number(value);
  if (!Number.isFinite(n)) return "";
  n = Math.round(n * Math.pow(10, maxFrac)) / Math.pow(10, maxFrac);
  const parts = String(n).split(".");
  const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  const out = parts[1] ? integer + "٫" + parts[1] : integer;
  return faDigits(out);
}

function formatNumLatin(value, maxFrac = 2) {
  let n = Number(value);
  if (!Number.isFinite(n)) return "";
  n = Math.round(n * Math.pow(10, maxFrac)) / Math.pow(10, maxFrac);
  const parts = String(n).split(".");
  return parts[1] ? parts[0] + "." + parts[1] : parts[0];
}

function formatHours(value, plain = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (plain ? formatNumLatin(n) : formatNum(n)) + " " + (activeRuleConfig("hoursUnit", "unit") || "ساعت");
}

function formatPercent(value, plain = false) {
  const n = parseNum(value);
  if (n == null) return "";
  const symbol = activeRuleConfig("percentSymbol", "symbol") || "٪";
  return (plain ? formatNumLatin(n) : formatNum(n)) + symbol;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "۰ کیلوبایت";
  if (bytes < 1024 * 1024) return formatNum(Math.round(bytes / 1024)) + " کیلوبایت";
  return formatNum(Math.round((bytes / (1024 * 1024)) * 10) / 10) + " مگابایت";
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function downloadText(text, filename, type = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([text], { type }), filename);
}

/* ------------------------------ متن فارسی ------------------------------- */

const COMPOUND_WORDS = [
  ["به روزرسانی", "به‌روزرسانی"],
  ["به روز", "به‌روز"],
  ["پیاده سازی", "پیاده‌سازی"],
  ["برنامه ریزی", "برنامه‌ریزی"],
  ["برنامه نویس", "برنامه‌نویس"],
  ["برنامه نویسی", "برنامه‌نویسی"],
  ["گزارش گیری", "گزارش‌گیری"],
  ["گزارش دهی", "گزارش‌دهی"],
  ["راه اندازی", "راه‌اندازی"],
  ["عیب یابی", "عیب‌یابی"],
  ["مستند سازی", "مستندسازی"],
  ["آماده سازی", "آماده‌سازی"],
  ["دسترسی پذیری", "دسترسی‌پذیری"],
  ["کاربر پسند", "کاربرپسند"],
  ["زمان بندی", "زمان‌بندی"],
  ["اولویت بندی", "اولویت‌بندی"],
  ["ساده سازی", "ساده‌سازی"],
  ["یکپارچه سازی", "یکپارچه‌سازی"],
  ["بهینه سازی", "بهینه‌سازی"],
  ["پیکربندی", "پیکربندی"],
  ["هماهنگی", "هماهنگی"],
  ["نگهداری", "نگهداری"],
  ["پشتیبانی", "پشتیبانی"]
];

function normalizePersian(input, opts = {}) {
  if (input == null) return "";
  let s = String(input);
  s = s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ۀ/g, "ه").replace(/\u0640/g, "");
  s = s.replace(/[\u200b\u200e\u200f\u202a-\u202e\ufeff]/g, "");
  s = s.replace(/\u00a0/g, " ");
  s = s.replace(/\s*\u200c\s*/g, ZWNJ);
  s = s.replace(/(^|[\s(])(ن?می)\s+([آ-یئءؤ])/g, (m, a, b, c) => a + b + ZWNJ + c);
  s = s.replace(/([آ-یئءؤ])\s+(ها|های|هایی|هایم|هایت|هایش|هایمان|هایتان|هایشان)(?=\s|$|[،؛:!؟.,])/g, "$1" + ZWNJ + "$2");
  s = s.replace(/([آ-یئءؤ])\s+(تر|ترین)(?=\s|$|[،؛:!؟.,])/g, "$1" + ZWNJ + "$2");
  for (const [from, to] of COMPOUND_WORDS) {
    if (from !== to) s = s.split(from).join(to);
  }
  s = s.replace(/\s+([،؛:!؟.])/g, "$1");
  s = s.replace(/([،؛:!؟])(?=[^\s])/g, "$1 ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  if (opts.singleLine) s = s.replace(/\s+/g, " ");
  s = s.trim();
  if (opts.keepPunctuation !== true) s = s.replace(/[،؛.]+$/g, "").trim();
  return s;
}

function cleanTitle(input) {
  let s = normalizePersian(input, { keepPunctuation: false });
  s = s.replace(/^[\s\-–—•●▪◦*]+/, "").replace(/[\s\-–—•●▪◦*]+$/, "");
  return s.trim();
}

function persianDigitsInText(value) {
  return faDigits(String(value == null ? "" : value));
}

function firstWord(value) {
  const s = normalizePersian(value);
  return s.split(/\s+/)[0] || "";
}

/* ------------------------------ تاریخ شمسی ------------------------------ */

function div(a, b) { return ~~(a / b); }
function mod(a, b) { return a - ~~(a / b) * b; }

function jalCal(jy) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;
  let leap = 0;
  let leapG = 0;
  let march = 0;
  let n = 0;
  let i = 0;
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error("سال شمسی نامعتبر است");
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  let jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm;
  let jd;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    jdn1f = g2d(gy - 1, 3, jalCal(jy).march);
    k = jdn - jdn1f;
    if (k < 0) return { jy, jm: 1, jd: 1 };
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

function jToG(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

function gToJ(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

function isLeapJalali(jy) {
  return jalCal(jy).leap === 0;
}

function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
}

function todayJalali() {
  const now = new Date();
  return gToJ(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function weekdayOfJalali(jy, jm, jd) {
  const g = jToG(jy, jm, jd);
  const dow = new Date(g.gy, g.gm - 1, g.gd).getDay();
  return (dow + 1) % 7;
}

function jalaliLabel(j, withWeekday = false, withYear = true) {
  if (!j) return "";
  const parts = [];
  if (withWeekday) parts.push(WEEKDAYS[weekdayOfJalali(j.jy, j.jm, j.jd)]);
  parts.push(faDigits(j.jd));
  parts.push(MONTHS[j.jm - 1]);
  if (withYear) parts.push(faDigits(j.jy));
  return parts.join(" ");
}

function jalaliISO(j) {
  if (!j) return "";
  return String(j.jy).padStart(4, "0") + "-" + String(j.jm).padStart(2, "0") + "-" + String(j.jd).padStart(2, "0");
}

function parseJalaliInput(value) {
  if (!value) return null;
  const s = toLatinDigits(String(value)).trim();
  const m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) return null;
  let jy = Number(m[1]);
  let jm = Number(m[2]);
  let jd = Number(m[3]);
  if (jy > 1700) {
    const g = gToJ(jy, jm, jd);
    return g;
  }
  if (jy < 1200) jy += 1300;
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
}

function jalaliDisplayFromISO(value) {
  const j = parseJalaliInput(value);
  return j ? jalaliLabel(j, false, true) : "";
}

function nowTimeLabel() {
  const d = new Date();
  return faDigits(String(d.getHours()).padStart(2, "0")) + ":" + faDigits(String(d.getMinutes()).padStart(2, "0"));
}

function isoDateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const j = gToJ(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return jalaliLabel(j, false, true);
}

/* ------------------------------ وضعیت ---------------------------------- */

let state = null;
let saveTimer = null;
let saveFailedNotified = false;
const openTasks = new Set();

function defaultState() {
  return {
    app: APP_ID,
    version: APP_VERSION,
    settings: deepClone(DEFAULT_SETTINGS),
    tasks: [],
    projects: [],
    rules: deepClone(DEFAULT_RULES),
    history: [],
    ui: { tab: "tasks", filter: "all", search: "" }
  };
}

function sanitizeChecklist(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return { id: uid("c"), text: normalizePersian(item, { keepPunctuation: true }), done: false };
    }
    const source = item && typeof item === "object" ? item : {};
    return {
      id: typeof source.id === "string" && source.id ? source.id : uid("c"),
      text: normalizePersian(source.text, { keepPunctuation: true }),
      done: Boolean(source.done)
    };
  }).filter((item) => item.text);
}

function sanitizeFuturePlans(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return { id: uid("f"), text: normalizePersian(item, { keepPunctuation: true }), date: "" };
    }
    const source = item && typeof item === "object" ? item : {};
    const parsed = parseJalaliInput(source.date);
    return {
      id: typeof source.id === "string" && source.id ? source.id : uid("f"),
      text: normalizePersian(source.text, { keepPunctuation: true }),
      date: parsed ? jalaliISO(parsed) : ""
    };
  }).filter((item) => item.text);
}

function sanitizeProject(project) {
  const source = project && typeof project === "object" ? project : {};
  const name = normalizePersian(source.name);
  const start = parseJalaliInput(source.startDate);
  const end = parseJalaliInput(source.endDate);
  return {
    id: typeof source.id === "string" && source.id ? source.id : uid("p"),
    name: name || "پروژه‌ی بدون نام",
    startDate: start ? jalaliISO(start) : "",
    endDate: end ? jalaliISO(end) : ""
  };
}

function buildProjectsFromData(rawProjects, settings, tasks) {
  const projects = [];
  const byKey = new Map();
  const keyOf = (name) => normalizePersian(name).toLowerCase();
  const ensure = (name) => {
    const clean = normalizePersian(name);
    if (!clean) return "";
    const key = keyOf(clean);
    if (byKey.has(key)) return byKey.get(key).name;
    const project = { id: uid("p"), name: clean, startDate: "", endDate: "" };
    projects.push(project);
    byKey.set(key, project);
    return project.name;
  };

  if (Array.isArray(rawProjects)) {
    rawProjects.forEach((raw) => {
      const clean = normalizePersian(raw && raw.name);
      if (!clean) return;
      const key = keyOf(clean);
      if (byKey.has(key)) return;
      const project = sanitizeProject(Object.assign({}, raw, { name: clean }));
      projects.push(project);
      byKey.set(key, project);
    });
  }

  if (settings && settings.defaultProject) {
    const canonical = ensure(settings.defaultProject);
    if (canonical) settings.defaultProject = canonical;
  }
  (tasks || []).forEach((task) => {
    if (task.project) task.project = ensure(task.project);
  });
  return projects;
}

function ensureProject(name) {
  const clean = normalizePersian(name);
  if (!clean) return "";
  if (!state || !Array.isArray(state.projects)) return clean;
  const existing = state.projects.find((project) => project.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing.name;
  state.projects.push({ id: uid("p"), name: clean, startDate: "", endDate: "" });
  return clean;
}

function sanitizeTask(task) {
  const t = task && typeof task === "object" ? task : {};
  const status = STATUS[t.status] ? t.status : "doing";
  const progressRaw = t.progress == null || t.progress === "" ? null : parseNum(t.progress);
  const hoursRaw = t.hours == null || t.hours === "" ? null : parseNum(t.hours);
  return {
    id: typeof t.id === "string" && t.id ? t.id : uid(),
    title: String(t.title == null ? "" : t.title),
    raw: String(t.raw == null ? "" : t.raw),
    status,
    category: String(t.category == null ? "" : t.category),
    progress: progressRaw == null ? null : clamp(progressRaw, 0, 100),
    hours: hoursRaw == null ? null : Math.max(0, hoursRaw),
    project: String(t.project == null ? "" : t.project),
    owner: String(t.owner == null ? "" : t.owner),
    blocker: String(t.blocker == null ? "" : t.blocker),
    nextStep: String(t.nextStep == null ? "" : t.nextStep),
    date: String(t.date == null ? "" : t.date),
    source: SOURCE_LABEL[t.source] ? t.source : "manual",
    order: Number.isFinite(Number(t.order)) ? Number(t.order) : 0,
    checklist: sanitizeChecklist(t.checklist),
    futurePlans: sanitizeFuturePlans(t.futurePlans)
  };
}

function sanitizeSettings(settings) {
  const s = Object.assign(deepClone(DEFAULT_SETTINGS), settings && typeof settings === "object" ? settings : {});
  if (s.theme !== "light" && s.theme !== "dark") s.theme = "dark";
  if (!["daily", "brief", "admin"].includes(s.template)) s.template = "daily";
  s.aiEnabled = Boolean(s.aiEnabled);
  s.author = String(s.author || "");
  s.role = String(s.role || "");
  s.team = String(s.team || "");
  s.defaultProject = String(s.defaultProject || "");
  s.aiUrl = String(s.aiUrl || DEFAULT_SETTINGS.aiUrl);
  s.aiModel = String(s.aiModel || DEFAULT_SETTINGS.aiModel);
  s.aiKey = String(s.aiKey || "");
  const cap = parseNum(s.dailyCapacity, 8);
  s.dailyCapacity = cap && cap > 0 ? cap : 8;
  return s;
}

function sanitizeRule(rule) {
  const r = rule && typeof rule === "object" ? rule : {};
  return {
    id: typeof r.id === "string" && r.id ? r.id : uid("rule"),
    key: typeof r.key === "string" && r.key ? r.key : "custom-" + uid("rule"),
    type: r.type === "linguistic" ? "linguistic" : "structural",
    title: String(r.title || "قانون بدون عنوان"),
    desc: String(r.desc || ""),
    enabled: r.enabled !== false,
    custom: Boolean(r.custom),
    config: r.config && typeof r.config === "object" ? deepClone(r.config) : {}
  };
}

function sanitizeHistoryItem(item) {
  const h = item && typeof item === "object" ? item : {};
  return {
    id: typeof h.id === "string" && h.id ? h.id : uid("h"),
    key: String(h.key || ""),
    savedAt: String(h.savedAt || new Date().toISOString()),
    dateLabel: String(h.dateLabel || ""),
    jdate: h.jdate && typeof h.jdate === "object" ? { jy: Number(h.jdate.jy), jm: Number(h.jdate.jm), jd: Number(h.jdate.jd) } : null,
    title: String(h.title || "گزارش روزانه"),
    template: ["brief", "admin", "daily"].includes(h.template) ? h.template : (String(h.title || "").indexOf("خلاصه") === 0 ? "brief" : "daily"),
    author: String(h.author || ""),
    role: String(h.role || ""),
    team: String(h.team || ""),
    project: String(h.project || ""),
    text: String(h.text || ""),
    markdown: String(h.markdown || ""),
    counts: h.counts && typeof h.counts === "object" ? h.counts : {},
    tasks: Array.isArray(h.tasks) ? h.tasks.map(sanitizeTask) : []
  };
}

function loadState() {
  const base = defaultState();
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    raw = null;
  }
  if (!raw) return { state: base, error: false };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { state: base, error: true };
    const loaded = defaultState();
    loaded.settings = sanitizeSettings(parsed.settings);
    loaded.tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(sanitizeTask) : [];
    loaded.tasks.forEach((t, index) => { t.order = index; });
    loaded.projects = buildProjectsFromData(parsed.projects, loaded.settings, loaded.tasks);
    loaded.rules = (() => {
      const savedRules = Array.isArray(parsed.rules) ? parsed.rules.map(sanitizeRule) : [];
      if (!savedRules.length) return deepClone(DEFAULT_RULES);
      const savedByKey = new Map(savedRules.map((rule) => [rule.key, rule]));
      const merged = DEFAULT_RULES.map((rule) => (savedByKey.has(rule.key) ? savedByKey.get(rule.key) : deepClone(rule)));
      savedRules.forEach((rule) => {
        if (!DEFAULT_RULES.some((defaultRule) => defaultRule.key === rule.key)) merged.push(rule);
      });
      return merged;
    })();
    loaded.history = Array.isArray(parsed.history) ? parsed.history.map(sanitizeHistoryItem).slice(0, 100) : [];
    return { state: loaded, error: false };
  } catch (e) {
    return { state: base, error: true };
  }
}

function persistNow(silent = false) {
  try {
    const payload = {
      app: APP_ID,
      version: APP_VERSION,
      settings: state.settings,
      tasks: state.tasks,
      projects: state.projects,
      rules: state.rules,
      history: state.history
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    saveFailedNotified = false;
    if (!silent) setSaveState("saved");
    return true;
  } catch (e) {
    setSaveState("error");
    if (!saveFailedNotified) {
      saveFailedNotified = true;
      toast("ذخیره‌سازی محلی انجام نشد؛ ممکن است حافظه‌ی مرورگر پر شده باشد. یک پشتیبان بگیر.", { type: "error", duration: 7000 });
    }
    return false;
  }
}

function scheduleSave(silent = true) {
  setSaveState("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistNow(silent), 380);
}

function setSaveState(mode) {
  const el = $("#save-state");
  if (!el) return;
  el.classList.remove("is-saving", "is-saved", "is-error");
  if (mode === "saving") {
    el.classList.add("is-saving");
    el.innerHTML = `<span class="pulse"></span><span class="save-text">در حال ذخیره…</span>`;
  } else if (mode === "error") {
    el.classList.add("is-error");
    el.innerHTML = `${icon("alert")}<span class="save-text">ذخیره نشد</span>`;
  } else {
    el.classList.add("is-saved");
    el.innerHTML = `${icon("check-circle")}<span class="save-text">ذخیره شد</span>`;
  }
}

function activeRuleConfig(key, configKey, fallback = "") {
  const rule = state && Array.isArray(state.rules) ? state.rules.find((r) => r.key === key) : null;
  if (!rule || !rule.config) return fallback;
  const value = rule.config[configKey];
  return value == null ? fallback : value;
}

function ruleOn(key) {
  if (!state) return true;
  const rule = state.rules.find((r) => r.key === key);
  return rule ? rule.enabled !== false : true;
}

/* ------------------------------ پوسته ---------------------------------- */

function applyTheme(theme, persist = false) {
  const value = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", value);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", value === "light" ? "#f1f4ef" : "#0d1512");
  const btn = $("#btn-theme");
  if (btn) {
    btn.innerHTML = icon(value === "dark" ? "sun" : "moon");
    const label = value === "dark" ? "روشن‌کردن پوسته" : "تاریک‌کردن پوسته";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }
  $$('input[name="set-theme"]').forEach((input) => { input.checked = input.value === value; });
  if (state && state.settings) {
    state.settings.theme = value;
    if (persist) scheduleSave();
  }
}

/* ------------------------------ اعلان‌ها ------------------------------- */

function toast(message, options = {}) {
  const root = $("#toast-root");
  if (!root) return;
  const { type = "info", duration = 4300, action = "", onAction = null } = options;
  const el = document.createElement("div");
  el.className = "toast " + type;
  const iconName = type === "success" ? "check-circle" : type === "error" ? "alert" : "info";
  el.innerHTML = `${icon(iconName)}<span>${escapeHtml(message)}</span>${action ? `<button type="button">${escapeHtml(action)}</button>` : ""}`;
  root.appendChild(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  let timer = null;
  const remove = () => {
    clearTimeout(timer);
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 220);
  };
  timer = setTimeout(remove, duration);
  if (action && onAction) {
    el.querySelector("button").addEventListener("click", () => {
      try { onAction(); } finally { remove(); }
    });
  }
}

/* ------------------------------ پنجره‌ها -------------------------------- */

let activeModal = null;
let modalCounter = 0;

function closeModal() {
  if (!activeModal) return;
  closeDatePicker();
  const { layer, onClose, previousFocus } = activeModal;
  activeModal = null;
  layer.remove();
  document.body.style.overflow = "";
  if (previousFocus && typeof previousFocus.focus === "function") {
    try { previousFocus.focus({ preventScroll: true }); } catch (e) { /* بی‌اهمیت */ }
  }
  if (typeof onClose === "function") onClose(false);
}

function openModal(options = {}) {
  const {
    title = "",
    sub = "",
    body = "",
    footer = "",
    size = "",
    iconName = "file",
    onMount = null,
    onClose = null,
    labelledBy = "",
    closeOnBackdrop = true
  } = options;
  closeDatePicker();
  closeModal();
  const previousFocus = document.activeElement;
  const layer = document.createElement("div");
  layer.className = "modal-layer";
  layer.dir = "rtl";
  modalCounter += 1;
  const titleId = labelledBy || "modal-title-" + modalCounter;
  layer.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="modal-head">
        <div class="modal-head-icon">${icon(iconName)}</div>
        <div class="modal-titles">
          <h2 class="modal-title" id="${titleId}">${escapeHtml(title)}</h2>
          ${sub ? `<p class="modal-sub">${escapeHtml(sub)}</p>` : ""}
        </div>
        <button class="icon-btn modal-close" type="button" data-modal-close aria-label="بستن پنجره">${icon("x")}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
    </div>`;
  $("#modal-root").appendChild(layer);
  document.body.style.overflow = "hidden";
  activeModal = { layer, onClose, previousFocus };

  const modal = layer.querySelector(".modal");
  layer.addEventListener("click", (event) => {
    if (closeOnBackdrop && event.target === layer) closeModal();
  });
  layer.querySelectorAll("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal());
  });
  layer.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusables = Array.from(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (typeof onMount === "function") onMount(layer, modal);
  setTimeout(() => {
    const target = modal.querySelector("[autofocus]") || modal.querySelector(".modal-body input, .modal-body textarea, .modal-body select, .modal-body button") || modal.querySelector(".modal-close");
    if (target) {
      try { target.focus({ preventScroll: true }); } catch (e) { /* بی‌اهمیت */ }
    }
  }, 50);
  return layer;
}

function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    const {
      title = "تأیید",
      message = "",
      confirmText = "تأیید",
      cancelText = "انصراف",
      danger = false,
      iconName = "help"
    } = options;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    openModal({
      title,
      sub: "",
      iconName,
      size: "modal-sm",
      body: `<p style="font-size:12.5px;line-height:1.9;color:var(--ink-2)">${escapeHtml(message)}</p>`,
      footer: `
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="button" data-confirm>${escapeHtml(confirmText)}</button>
        <button class="btn" type="button" data-cancel>${escapeHtml(cancelText)}</button>
        <span class="spacer"></span>`,
      onClose: () => finish(false),
      onMount: (layer) => {
        layer.querySelector("[data-confirm]").addEventListener("click", () => {
          finish(true);
          closeModal();
        });
        layer.querySelector("[data-cancel]").addEventListener("click", () => {
          finish(false);
          closeModal();
        });
      }
    });
  });
}

/* ------------------------------ تاریخ‌گزین ------------------------------ */

let datePicker = null;

function closeDatePicker() {
  if (!datePicker) return;
  const { pop, outside, onKey } = datePicker;
  document.removeEventListener("pointerdown", outside, true);
  document.removeEventListener("keydown", onKey);
  pop.remove();
  datePicker = null;
}

function openDatePicker(anchor, currentValue, onSelect) {
  closeDatePicker();
  if (!anchor || !anchor.isConnected) return;
  const current = parseJalaliInput(currentValue) || todayJalali();
  const view = { jy: current.jy, jm: current.jm };
  const selected = parseJalaliInput(currentValue);
  const pop = document.createElement("div");
  pop.className = "date-pop";
  pop.dir = "rtl";
  $("#date-pop-root").appendChild(pop);

  const render = () => {
    const firstG = jToG(view.jy, view.jm, 1);
    const startDow = (new Date(firstG.gy, firstG.gm - 1, firstG.gd).getDay() + 1) % 7;
    const len = jalaliMonthLength(view.jy, view.jm);
    const today = todayJalali();
    let cells = "";
    for (let i = 0; i < startDow; i += 1) cells += `<span class="date-day is-empty"></span>`;
    for (let d = 1; d <= len; d += 1) {
      const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === d;
      const isSelected = selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === d;
      cells += `<button class="date-day${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}" type="button" data-day="${d}">${faDigits(d)}</button>`;
    }
    pop.innerHTML = `
      <div class="date-pop-head">
        <button class="icon-btn" type="button" data-nav="prev" aria-label="ماه قبل">${icon("chevron-right")}</button>
        <div class="date-pop-title">${MONTHS[view.jm - 1]} ${faDigits(view.jy)}</div>
        <button class="icon-btn" type="button" data-nav="next" aria-label="ماه بعد">${icon("chevron-left")}</button>
      </div>
      <div class="date-pop-grid">
        ${WEEKDAYS.map((d) => `<span class="date-pop-dow">${d.slice(0, 1)}</span>`).join("")}
        ${cells}
      </div>
      <div class="date-pop-foot">
        <button class="btn btn-sm btn-soft" type="button" data-today>امروز</button>
        <button class="btn btn-sm btn-ghost" type="button" data-clear>بدون تاریخ</button>
      </div>`;
    position();
    pop.querySelector('[data-nav="prev"]').addEventListener("click", () => {
      view.jm -= 1;
      if (view.jm < 1) { view.jm = 12; view.jy -= 1; }
      render();
    });
    pop.querySelector('[data-nav="next"]').addEventListener("click", () => {
      view.jm += 1;
      if (view.jm > 12) { view.jm = 1; view.jy += 1; }
      render();
    });
    pop.querySelector("[data-today]").addEventListener("click", () => {
      const t = todayJalali();
      onSelect(jalaliISO(t));
      closeDatePicker();
    });
    pop.querySelector("[data-clear]").addEventListener("click", () => {
      onSelect("");
      closeDatePicker();
    });
    pop.querySelectorAll("[data-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const j = { jy: view.jy, jm: view.jm, jd: Number(btn.dataset.day) };
        onSelect(jalaliISO(j));
        closeDatePicker();
      });
    });
  };

  const position = () => {
    const rect = anchor.getBoundingClientRect();
    const width = pop.offsetWidth || 264;
    const height = pop.offsetHeight || 300;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
    let left = rect.right - width;
    left = clamp(left, 8, Math.max(8, window.innerWidth - width - 8));
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  };

  const outside = (event) => {
    if (!pop.contains(event.target) && !anchor.contains(event.target)) closeDatePicker();
  };
  const onKey = (event) => {
    if (event.key === "Escape") closeDatePicker();
  };
  datePicker = { pop, outside, onKey };
  render();
  setTimeout(() => {
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", onKey);
  }, 0);
}

/* ------------------------------ تب‌ها ----------------------------------- */

function switchTab(name, options = {}) {
  const valid = ["tasks", "rules", "preview", "settings"];
  const tab = valid.includes(name) ? name : "tasks";
  if (state) state.ui.tab = tab;
  $$(".tab").forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.tabIndex = isActive ? 0 : -1;
  });
  $$("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
  if (tab === "preview") renderPreview();
  if (tab === "rules") renderRules();
  if (tab === "settings") {
    renderSettings();
    renderHistory();
    updateStorageInfo();
  }
  if (tab === "tasks") {
    renderTasks();
    updateSummary();
  }
  if (options.scroll !== false) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }
}
