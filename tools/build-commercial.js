#!/usr/bin/env node
/* Sinh "gói thương mại" SOLPHA Futures Desk từ repo này.
 *
 *   node tools/build-commercial.js            # build + kiểm tra rò rỉ + nén zip
 *   node tools/build-commercial.js --scan     # chỉ quét rò rỉ thư mục dist/solpha-commercial đã có
 *   node tools/build-commercial.js --no-zip   # chỉ tạo thư mục
 *
 * Gói LUÔN mang thương hiệu SOLPHA: không có nhánh thương hiệu khác, không có tệp/tên/màu/logo của thương hiệu nội bộ.
 * Gói được tạo bằng cách sao chép + biến đổi; script này không sửa bất kỳ tệp nguồn nào.
 * Chỉ dùng module có sẵn của Node (fs, path, zlib, crypto).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const OUT_NAME = "solpha-commercial";
const OUT_DIR = path.join(ROOT, "dist", OUT_NAME);

// ---------------------------------------------------------------- quét rò rỉ

// Mẫu bị cấm trong MỌI tệp văn bản và tên tệp của gói.
const LEAK_PATTERNS = [
  [/etek/i, "chuỗi 'etek'"],
  [/ETEK Power/, "'ETEK Power'"],
  [/etekpower/i, "'etekpower'"],
  [/189848/, "màu xanh nhận diện cũ (#189848)"],
  [/24\s*,\s*152\s*,\s*72\b/, "màu xanh nhận diện cũ dạng rgb(24,152,72)"],
  [/T[âa]n\s*Ph[áa]t/i, "'Tân Phát'"],
];
const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".json", ".html", ".htm", ".css", ".md", ".svg", ".webmanifest", ".txt", ".toml", ".xml", ".yml", ".yaml", ".map", ".csv"]);

function isProbablyText(rel, buf) {
  const ext = path.extname(rel).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  if (ext === "" || path.basename(rel).startsWith("_") || path.basename(rel).startsWith(".")) return buf.indexOf(0) === -1;
  return false;
}

function testPatterns(str, where, out) {
  for (const [re, label] of LEAK_PATTERNS) {
    const m = re.exec(str);
    if (m) {
      const i = m.index;
      out.push({ file: where, rule: label, sample: str.slice(Math.max(0, i - 24), i + 40).replace(/\s+/g, " ") });
    }
  }
}

// Đọc các chunk của PNG, bỏ qua IDAT (dữ liệu điểm ảnh nén) để tránh trùng ngẫu nhiên; giải nén zTXt/iTXt.
function pngMetadataStrings(buf) {
  const out = [];
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type !== "IDAT") {
      out.push(type + ":" + data.toString("latin1"));
      try {
        if (type === "zTXt") {
          const nul = data.indexOf(0);
          out.push("zTXt-text:" + zlib.inflateSync(data.subarray(nul + 2)).toString("utf8"));
        } else if (type === "iTXt") {
          // keyword\0 flag method lang\0 translated\0 text
          const nul = data.indexOf(0);
          const compressed = data[nul + 1] === 1;
          let q = nul + 3;
          q = data.indexOf(0, q) + 1;
          q = data.indexOf(0, q) + 1;
          const body = data.subarray(q);
          out.push("iTXt-text:" + (compressed ? zlib.inflateSync(body) : body).toString("utf8"));
        }
      } catch (e) { /* chunk lỗi: vẫn đã quét thô ở trên */ }
    }
    p += 12 + len;
  }
  return out;
}

function listFiles(dir, base) {
  base = base || dir;
  const res = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) res.push(...listFiles(full, base));
    else res.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return res;
}

/** Quét thư mục gói. Trả về mảng phát hiện (rỗng = sạch). forbiddenHashes: SHA-256 của tệp nguồn không được xuất hiện. */
function scanDir(dir, forbiddenHashes) {
  const findings = [];
  const files = listFiles(dir);
  for (const rel of files) {
    testPatterns(rel, "(tên tệp) " + rel, findings);
    const buf = fs.readFileSync(path.join(dir, rel));
    if (forbiddenHashes && forbiddenHashes.size) {
      const h = crypto.createHash("sha256").update(buf).digest("hex");
      if (forbiddenHashes.has(h)) findings.push({ file: rel, rule: "trùng byte với tệp thương hiệu nội bộ", sample: h });
    }
    if (isProbablyText(rel, buf)) {
      testPatterns(buf.toString("utf8"), rel, findings);
    } else {
      const meta = pngMetadataStrings(buf);
      if (meta) {
        for (const s of meta) testPatterns(s, rel + " [metadata PNG]", findings);
      } else {
        testPatterns(buf.toString("latin1"), rel + " [nhị phân]", findings);
      }
    }
  }
  // Tên tệp icon không được chứa etek (đã phủ bởi mẫu trên, giữ lại kiểm tra tường minh).
  for (const rel of files) if (/^icons\//.test(rel) && /etek/i.test(rel)) findings.push({ file: rel, rule: "tên tệp icon", sample: rel });
  return findings;
}

// ---------------------------------------------------------------- tiện ích biến đổi

function read(rel) { return fs.readFileSync(path.join(ROOT, rel)); }
function readText(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

/** Thay thế bắt buộc phải khớp; nếu nguồn đổi cấu trúc thì build báo lỗi rõ ràng thay vì lặng lẽ sai. */
function sub(text, re, repl, what, optional) {
  const hit = typeof re === "string" ? text.includes(re) : re.test(text);
  if (!hit) {
    if (optional) return text;
    throw new Error("Không tìm thấy mẫu cần biến đổi: " + what);
  }
  if (typeof re === "string") return text.split(re).join(repl);
  return text.replace(re, repl);
}

const DOMAIN_RE = /solpha\.pages\.dev/g;
const toDomain = (t) => t.replace(DOMAIN_RE, "{{DOMAIN}}");
const toPlaceholders = (t) =>
  t.replace(/\[TÊN PHÁP NHÂN(?: \/ CÁ NHÂN PHÁT HÀNH)?\]/g, "{{COMPANY_NAME}}")
    .replace(/\[EMAIL\]/g, "{{CONTACT_EMAIL}}")
    .replace(/\[WEBSITE\]/g, "{{WEBSITE}}");

const DARK_ROOT = `:root {
  /* Bảng màu SOLPHA (tối). Đổi thương hiệu: sửa các biến này và khối html[data-brand="solpha"] trong solpha-theme.css */
  --bg: #07080c;
  --card: #10131b;
  --line: #1e2430;
  --text: #e8edf7;
  --muted: #8b95a8;
  --brand: #3ecbff;
  --brand-dark: #1a6d88;
  --tint: #131a26;
  --cyan: #3ecbff;
  --violet: #9b5cff;
  --lime: #c6ff3a;
  --gold: #e2b84a;
  --up: #3ee0a0;
  --down: #ff5d73;
  --warn: #ffb020;
  --raise: #161b26;
  --soft: #1a202c;
  color-scheme: dark;
}`;

const BRAND_JS = `/* SOLPHA — nhận diện thương hiệu của bản thương mại. Nạp đồng bộ trong <head>.
 * Muốn đổi tên/màu/logo: xem docs/CUSTOMIZE.md (tên trong index.html + manifest.webmanifest, màu trong solpha-theme.css, icon trong icons/). */
(function () {
  var BRAND = { id: "solpha", name: "SOLPHA", icon192: "icons/icon-192.png" };
  document.documentElement.setAttribute("data-brand", BRAND.id);
  window.SOLPHA_BRAND = BRAND;
})();
`;

function transformStyles(css) {
  css = sub(css, /:root\s*\{[\s\S]*?\n\}/, DARK_ROOT, "khối :root của styles.css");
  css = sub(css, /\/\* ---- [^\n]*ETEK[^\n]*---- \*\//g, "/* ---- Header gọn, thẻ nền tối ---- */", "tiêu đề ETEK header", true);
  css = sub(css, /\/\* ---- Header gọn 1 dòng:[^\n]*\*\//, "/* ---- Header gọn 1 dòng: thương hiệu · nút ---- */", "tiêu đề header gọn", true);
  css = css.replace(/^\.etek-logo\s*\{[^}]*\}\s*\n/gm, "");
  css = css.replace(/\.etek-logo\s*\{[^}]*\}\s*/g, "");
  css = css.replace(/rgba\(\s*24\s*,\s*152\s*,\s*72\s*,/g, "rgba(62,224,160,");
  css = css.replace(/#189848/gi, "var(--brand)");
  return css;
}

function transformTheme(css) {
  css = css.replace(/^.*\.etek-logo.*\n/gm, "");
  css = css.replace(/^\/\*[^\n]*\*\/\n/, '/* Giao diện tối SOLPHA — áp dụng khi <html data-brand="solpha"> (brand.js và index.html đã đặt sẵn). Đổi màu: sửa khối biến CSS đầu tiên. */\n');
  return css;
}

function transformHtml(html, opts) {
  html = sub(html, /<html([^>]*)>/, (m, a) => (/data-brand=/.test(a) ? m : `<html${a} data-brand="solpha">`), "thẻ <html>");
  html = html.replace(/<meta name="theme-color" content="[^"]*"\s*\/?>/, '<meta name="theme-color" content="#07080c" />');
  html = html.replace(/^[ \t]*<img[^>]*class="etek-logo"[^>]*>[ \t]*\r?\n/gm, "");
  if (opts && opts.index) {
    html = sub(html, 'data-src="icon.svg"', 'src="icons/icon.svg"', "ảnh logo data-src");
    html = sub(html, /href="icon\.svg"/, 'href="icons/icon.svg"', "link icon svg");
  }
  html = html.replace(/<img[^>]*data-src="[^"]*etek[^"]*"[^>]*>/gi, "");
  html = toPlaceholders(html);
  if (/data-src=/.test(html)) throw new Error("Còn thuộc tính data-src sau biến đổi HTML");
  return html;
}

function transformSw(sw, version, assets) {
  sw = sub(sw, /const CACHE = "[^"]*";/, `const CACHE = "solpha-c${version}";`, "tên cache sw.js");
  sw = sub(sw, /const ASSETS = \[[\s\S]*?\];/, "const ASSETS = [\n  " + assets.map((a) => JSON.stringify(a)).join(",\n  ") + "\n];", "mảng ASSETS sw.js");
  return sw;
}

function transformManifest(text) {
  const m = JSON.parse(text);
  m.id = "./";
  m.start_url = "./";
  m.icons = m.icons.map((i) => Object.assign({}, i, { src: i.src.replace("icons/solpha/", "icons/") }));
  if (m.shortcuts) m.shortcuts = m.shortcuts.map((s) => Object.assign({}, s, {
    url: s.url.replace(/&?source=play/, "").replace(/\?&/, "?"),
    icons: (s.icons || []).map((i) => Object.assign({}, i, { src: i.src.replace("icons/solpha/", "icons/") })),
  }));
  return JSON.stringify(m, null, 2) + "\n";
}

function transformTwa(text) {
  const t = JSON.parse(text);
  const swap = (s) => (typeof s === "string" ? s.replace("https://solpha.pages.dev/icons/solpha/", "https://{{DOMAIN}}/icons/").replace("https://solpha.pages.dev/manifest-solpha.webmanifest", "https://{{DOMAIN}}/manifest.webmanifest") : s);
  const walk = (o) => {
    for (const k of Object.keys(o)) {
      if (o[k] && typeof o[k] === "object") walk(o[k]);
      else o[k] = swap(o[k]);
    }
  };
  walk(t);
  t.host = "{{DOMAIN}}";
  t.fullScopeUrl = "https://{{DOMAIN}}/";
  if (t.startUrl) t.startUrl = "/";
  if (t.shortcuts) t.shortcuts.forEach((s) => { s.url = s.url.replace(/&?source=play/, ""); });
  return toDomain(JSON.stringify(t, null, 2) + "\n");
}

function transformApp(js) {
  // Thông báo hướng dẫn bật quyền có ghi sẵn tên miền: bản thương mại dùng tên miền người mua nên nói chung.
  js = js.replace(/cho phép solpha\.pages\.dev\./g, "cho phép trang web này.");
  if (DOMAIN_RE.test(js)) throw new Error("app.js còn tham chiếu solpha.pages.dev");
  DOMAIN_RE.lastIndex = 0;
  return js;
}

function transformMakeIcons(js) {
  js = js.replace(/^\/\/ Tạo bộ icon PWA[^\n]*\n\/\/ Chạy:[^\n]*\n/, "// Tạo bộ icon PWA (PNG 192/512, maskable, apple-touch, favicon) từ icons/icon.svg.\n// Chạy: node tools/make-icons.js   (đặt ICON_SRC / ICON_OUT để đổi tệp nguồn / thư mục đầu ra)\n");
  js = js.replace(/process\.env\.ICON_SRC \|\| "icon\.svg"/, 'process.env.ICON_SRC || "icons/icon.svg"');
  return js;
}

function transformPlayAssets(js) {
  js = js.replace(/"icons\/solpha\/icon\.svg", "utf8"\);[^\n]*/, '"icons/icon.svg", "utf8");');
  return js;
}

function dropLinesMatching(text, re) {
  return text.split("\n").filter((l) => !re.test(l)).join("\n");
}

// ---------------------------------------------------------------- zip thuần Node (xác định: thứ tự + thời gian cố định)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const DOS_TIME = 0; // 00:00:00
  const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = e.data;
    let method = 8;
    let comp = data.length ? zlib.deflateRawSync(data, { level: 9 }) : Buffer.alloc(0);
    if (!data.length || comp.length >= data.length) { method = 0; comp = data; }
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(DOS_TIME, 10);
    lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    chunks.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(0x031e, 4); // made by: Unix, 3.0
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(DOS_TIME, 12);
    ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(((0o100644 << 16) >>> 0), 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

// ---------------------------------------------------------------- build

function build(options) {
  options = options || {};
  const twa = JSON.parse(readText("twa-manifest.json"));
  const version = options.version || twa.appVersion || "1.0.0";
  const outDir = options.outDir || OUT_DIR;
  const zipPath = path.join(path.dirname(outDir), `solpha-futures-desk-v${version}.zip`);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  const put = (rel, data) => {
    const full = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
    written.push(rel);
  };
  const copy = (rel, as) => put(as || rel, read(rel));

  // Tệp thương hiệu nội bộ KHÔNG được vào gói: ghi lại băm để kiểm tra trùng byte.
  const forbidden = new Set();
  const addForbidden = (rel) => { if (exists(rel)) forbidden.add(crypto.createHash("sha256").update(read(rel)).digest("hex")); };
  ["icon.svg", "manifest.webmanifest", "icons/etek-logo.png"].forEach(addForbidden);
  if (exists("icons")) for (const f of fs.readdirSync(path.join(ROOT, "icons"))) if (f.endsWith(".png")) addForbidden("icons/" + f);

  // --- mã nguồn app
  put("signals.js", read("signals.js")); // giữ nguyên từng byte
  put("journal.js", read("journal.js"));
  put("app.js", transformApp(readText("app.js")));
  put("brand.js", BRAND_JS);
  put("styles.css", transformStyles(readText("styles.css")));
  put("solpha-theme.css", transformTheme(readText("solpha-theme.css")));
  const hasBilling = exists("billing.js");
  if (hasBilling) put("billing.js", read("billing.js"));

  // --- trang
  put("index.html", transformHtml(readText("index.html"), { index: true }));
  put("privacy.html", transformHtml(readText("privacy.html")));
  put("terms.html", transformHtml(readText("terms.html")));

  // --- manifest, icon (bộ SOLPHA đặt ra icons/)
  put("manifest.webmanifest", transformManifest(readText("manifest-solpha.webmanifest")));
  const iconFiles = fs.readdirSync(path.join(ROOT, "icons", "solpha")).sort();
  for (const f of iconFiles) copy("icons/solpha/" + f, "icons/" + f);

  // --- phông Roboto tự host (không gọi Google Fonts)
  const fontFiles = exists("fonts") ? fs.readdirSync(path.join(ROOT, "fonts")).sort() : [];
  for (const f of fontFiles) copy("fonts/" + f);

  // --- service worker (danh sách cache lập từ tệp thực sự có trong gói)
  const assets = ["./", "./index.html", "./styles.css", "./solpha-theme.css", "./brand.js", "./signals.js", "./app.js", "./journal.js"];
  if (hasBilling) assets.push("./billing.js");
  assets.push("./manifest.webmanifest");
  for (const f of iconFiles) if (/\.(png|svg)$/.test(f)) assets.push("./icons/" + f);
  for (const f of fontFiles) if (/\.woff2$/.test(f)) assets.push("./fonts/" + f);
  assets.push("./privacy.html", "./terms.html");
  put("sw.js", transformSw(readText("sw.js"), version, assets));

  // --- cấu hình host tĩnh
  for (const f of ["_headers", "_redirects", ".nojekyll"]) if (exists(f)) copy(f);

  // --- Android (TWA)
  put("twa-manifest.json", transformTwa(readText("twa-manifest.json")));
  if (exists(".well-known/assetlinks.json")) copy(".well-known/assetlinks.json");
  if (exists("play-assets")) for (const f of fs.readdirSync(path.join(ROOT, "play-assets")).sort()) copy("play-assets/" + f);
  if (exists("docs/play/LISTING.md")) {
    let t = readText("docs/play/LISTING.md");
    t = dropLinesMatching(t, /etek/i);
    put("docs/play/LISTING.md", toPlaceholders(toDomain(t)));
  }

  // --- backend thanh toán (nếu repo có)
  if (exists("worker/src/index.js")) put("worker/src/index.js", toDomain(readText("worker/src/index.js")));
  if (exists("worker/wrangler.toml")) put("worker/wrangler.toml", toDomain(readText("worker/wrangler.toml")));
  if (exists("worker/README.md")) put("worker/README.md", toPlaceholders(toDomain(readText("worker/README.md"))));

  // --- công cụ + test
  if (exists("tests/signals.test.js")) copy("tests/signals.test.js");
  if (exists("tools/make-icons.js")) put("tools/make-icons.js", transformMakeIcons(readText("tools/make-icons.js")));
  if (exists("tools/play-assets.js")) put("tools/play-assets.js", transformPlayAssets(readText("tools/play-assets.js")));
  put("package.json", JSON.stringify({
    name: "solpha-futures-desk",
    version,
    private: true,
    description: "SOLPHA Futures Desk — PWA tĩnh theo dõi tín hiệu futures đa khung (bản thương mại).",
    license: "SEE LICENSE IN LICENSE.md",
    scripts: { test: "node tests/signals.test.js", icons: "node tools/make-icons.js", serve: "python3 -m http.server 8080" },
    devDependencies: { playwright: ">=1.40.0" },
  }, null, 2) + "\n");
  put("VERSION", version + "\n");

  // --- tài liệu thương mại (nguồn: thư mục commercial/)
  const docMap = {
    "README.md": "README.md", "LICENSE.md": "LICENSE.md", "CHANGELOG.md": "CHANGELOG.md",
    "INSTALL.md": "docs/INSTALL.md", "CUSTOMIZE.md": "docs/CUSTOMIZE.md", "SUPPORT.md": "docs/SUPPORT.md", "ANDROID.md": "docs/ANDROID.md",
  };
  for (const [src, dst] of Object.entries(docMap)) {
    const rel = "commercial/" + src;
    if (!exists(rel)) {
      if (src === "ANDROID.md") continue; // tuỳ chọn
      throw new Error("Thiếu tài liệu thương mại: " + rel);
    }
    copy(rel, dst);
  }

  // --- kiểm tra rò rỉ (bắt buộc)
  const findings = scanDir(outDir, forbidden);
  if (findings.length) {
    const msg = findings.map((f) => `  - ${f.file}: ${f.rule}  «${f.sample}»`).join("\n");
    const err = new Error("PHÁT HIỆN RÒ RỈ THƯƠNG HIỆU:\n" + msg);
    err.findings = findings;
    throw err;
  }

  // --- danh sách tệp, placeholder còn lại
  const files = listFiles(outDir);
  const placeholders = {};
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(outDir, rel));
    if (!isProbablyText(rel, buf)) continue;
    const m = buf.toString("utf8").match(/\{\{[A-Z_]+\}\}/g);
    if (m) placeholders[rel] = [...new Set(m)];
  }

  let zipInfo = null;
  if (!options.noZip) {
    const prefix = `solpha-futures-desk-v${version}/`;
    const entries = files.map((rel) => ({ name: prefix + rel, data: fs.readFileSync(path.join(outDir, rel)) }));
    const zip = makeZip(entries);
    fs.writeFileSync(zipPath, zip);
    const sha = crypto.createHash("sha256").update(zip).digest("hex");
    fs.writeFileSync(zipPath + ".sha256", `${sha}  ${path.basename(zipPath)}\n`);
    zipInfo = { path: zipPath, size: zip.length, sha256: sha, entries: entries.length, prefix };
  }
  return { version, outDir, files, placeholders, forbiddenCount: forbidden.size, zip: zipInfo };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--scan")) {
    if (!fs.existsSync(OUT_DIR)) { console.error("Chưa có " + OUT_DIR); process.exit(2); }
    const f = scanDir(OUT_DIR, new Set());
    if (f.length) { console.error("PHÁT HIỆN RÒ RỈ:\n" + f.map((x) => `  - ${x.file}: ${x.rule} «${x.sample}»`).join("\n")); process.exit(1); }
    console.log("Quét rò rỉ: sạch (" + listFiles(OUT_DIR).length + " tệp).");
    return;
  }
  let r;
  try {
    r = build({ noZip: args.includes("--no-zip") });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  console.log(`SOLPHA Futures Desk v${r.version} — ${r.files.length} tệp trong ${path.relative(ROOT, r.outDir)}/`);
  for (const f of r.files) console.log("  " + f);
  console.log("\nQuét rò rỉ: SẠCH (tên tệp, nội dung văn bản, metadata PNG/SVG, băm tệp nội bộ " + r.forbiddenCount + " mục).");
  const keys = Object.keys(r.placeholders);
  if (keys.length) {
    console.log("\nPlaceholder người mua cần điền:");
    for (const k of keys) console.log("  " + k + ": " + r.placeholders[k].join(" "));
  }
  if (r.zip) {
    console.log(`\nZip: ${path.relative(ROOT, r.zip.path)}  (${r.zip.size} byte, ${r.zip.entries} mục)`);
    console.log("SHA-256: " + r.zip.sha256);
  }
}

module.exports = { build, scanDir, makeZip, listFiles, LEAK_PATTERNS, OUT_DIR, ROOT };
if (require.main === module) main();
