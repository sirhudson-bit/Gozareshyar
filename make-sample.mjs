import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const rows = [
  ["عنوان", "وضعیت", "دسته‌بندی", "درصد پیشرفت", "ساعت", "پروژه", "مسئول", "مانع", "گام بعدی", "تاریخ"],
  ["پیاده‌سازی صفحه‌ی ورود", "انجام‌شده", "توسعه", "۱۰۰", "۳", "سامانه‌ی داخلی", "سارا محمدی", "", "", "۱۴۰۵/۰۲/۱۵"],
  ["رفع خطای گزارش ماهانه", "انجام‌شده", "رفع خطا", "۱۰۰", "۱٫۵", "سامانه‌ی داخلی", "سارا محمدی", "", "", "۱۴۰۵/۰۲/۱۵"],
  ["توسعه‌ی داشبورد مدیریتی", "در حال انجام", "توسعه", "۶۰", "۴", "سامانه‌ی داخلی", "سارا محمدی", "", "تکمیل نمودارها", "۱۴۰۵/۰۲/۱۵"],
  ["اتصال به سرویس احراز هویت", "مسدود", "زیرساخت", "۰", "۲", "سامانه‌ی داخلی", "امیر رضایی", "دسترسی به کلید محیط تولید", "هماهنگی با تیم زیرساخت", "۱۴۰۵/۰۲/۱۵"],
  ["تست یکپارچه‌ی پرداخت", "برنامه‌ی آینده", "تست", "۰", "", "سامانه‌ی داخلی", "سارا محمدی", "", "تست پرداخت", "۱۴۰۵/۰۲/۱۶"],
  ["مستندسازی راهنمای استقرار", "انجام‌شده", "مستندسازی", "۱۰۰", "۱", "سامانه‌ی داخلی", "امیر رضایی", "", "", "۱۴۰۵/۰۲/۱۵"]
];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function dosDateTime(d = new Date()) {
  return {
    time: ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    day: (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f)
  };
}
function zipStore(files) {
  const { time, day } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach((file) => {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    data.copy(local, 30 + name.length);
    locals.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length;
  });
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

const esc = (v) => String(v == null ? "" : v)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const col = (i) => {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) =>
  `<c r="${col(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(cell)}</t></is></c>`
).join("")}</row>`).join("");
const cols = Array.from({ length: rows[0].length }).map((_, i) =>
  `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 38 : 16}" customWidth="1"/>`
).join("");

const files = [
  {
    name: "[Content_Types].xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  },
  {
    name: "_rels/.rels",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  },
  {
    name: "xl/workbook.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="تسک‌ها" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  },
  {
    name: "xl/_rels/workbook.xml.rels",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  },
  {
    name: "xl/worksheets/sheet1.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:J${rows.length}"/>
  <sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`
  }
];

const out = join(root, "نمونه-ورودی-گزارش‌یار.xlsx");
writeFileSync(out, zipStore(files));
console.log(out);
