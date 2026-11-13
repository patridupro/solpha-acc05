// Kiểm tra gói thương mại: node --test tests/commercial.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const B = require("../tools/build-commercial.js");

let R; // kết quả build
const PKG = B.OUT_DIR;
const rd = (rel) => fs.readFileSync(path.join(PKG, rel), "utf8");
const has = (rel) => fs.existsSync(path.join(PKG, rel));

test.before(() => { R = B.build(); });

test("zip được tạo, hợp lệ và khớp thư mục gói", () => {
  assert.ok(R.zip, "phải có zip");
  assert.match(path.basename(R.zip.path), /^solpha-futures-desk-v\d+\.\d+\.\d+\.zip$/);
  const buf = fs.readFileSync(R.zip.path);
  assert.strictEqual(buf.length, R.zip.size);
  assert.strictEqual(crypto.createHash("sha256").update(buf).digest("hex"), R.zip.sha256);
  // Đọc lại danh mục trung tâm bằng tay: tên + CRC + nội dung khớp từng tệp.
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0);
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < n; i++) {
    assert.strictEqual(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nl);
    names.push(name);
    const lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28);
    const raw = buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.strictEqual(data.length, size, name);
    assert.strictEqual(zlib.crc32 ? zlib.crc32(data) >>> 0 : crc, crc, "CRC " + name);
    const rel = name.slice(name.indexOf("/") + 1);
    assert.ok(fs.readFileSync(path.join(PKG, rel)).equals(data), "nội dung " + rel);
    p += 46 + nl + el + cl;
  }
  assert.strictEqual(names.length, R.files.length);
  // Công cụ ngoài (nếu có) cũng phải chấp nhận.
  const unzip = spawnSync("unzip", ["-tq", R.zip.path]);
  if (!unzip.error) assert.strictEqual(unzip.status, 0, String(unzip.stdout) + String(unzip.stderr));
  const py = spawnSync("python3", ["-I", "-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(len(z.namelist()))", R.zip.path]);
  if (!py.error) assert.strictEqual(py.status, 0, String(py.stderr));
});

test("build lặp lại cho cùng một mã băm (zip xác định)", () => {
  const first = R.zip.sha256;
  const again = B.build();
  assert.strictEqual(again.zip.sha256, first);
  R = again;
});

test("không rò rỉ thương hiệu nội bộ: tên tệp, nội dung, metadata", () => {
  assert.deepStrictEqual(B.scanDir(PKG, new Set()), []);
  for (const rel of B.listFiles(PKG)) {
    assert.ok(!/etek/i.test(rel), "tên tệp: " + rel);
    const buf = fs.readFileSync(path.join(PKG, rel));
    if (/\.(png)$/i.test(rel)) continue; // PNG: kiểm bằng scanDir (bỏ qua IDAT)
    const s = buf.toString("latin1");
    assert.ok(!/etek/i.test(s), "nội dung: " + rel);
    assert.ok(!/189848/.test(s), "màu cũ: " + rel);
  }
  // Mọi PNG: không có chuỗi trong chunk phụ.
  for (const rel of B.listFiles(PKG).filter((f) => f.endsWith(".png"))) {
    const buf = fs.readFileSync(path.join(PKG, rel));
    assert.strictEqual(buf.readUInt32BE(0), 0x89504e47, rel);
    let p = 8;
    while (p + 8 <= buf.length) {
      const len = buf.readUInt32BE(p), type = buf.toString("latin1", p + 4, p + 8);
      if (type !== "IDAT") assert.ok(!/etek|power/i.test(buf.toString("latin1", p + 8, p + 8 + len)), rel + " chunk " + type);
      p += 12 + len;
    }
  }
  // Không có tệp bị loại trừ lọt vào gói.
  for (const gone of ["icon.svg", "manifest-solpha.webmanifest", "netlify.toml", "icons/etek-logo.png", "skills", "dist", "docs/PWA-DEPLOY-GUIDE.md", "docs/PWA-DEPLOY-GUIDE.pdf", "docs/GOOGLE-PLAY-GUIDE.md", "docs/GOOGLE-PLAY-GUIDE.pdf", "tools/build-commercial.js", "tests/commercial.test.js", "docs/play/POLICY-ANSWERS.md"]) {
    assert.ok(!has(gone), "không được có " + gone);
  }
  assert.ok(R.forbiddenCount >= 8, "danh sách băm tệp nội bộ phải được dựng");
});

test("công cụ quét bắt được rò rỉ (kiểm chứng phía âm)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "leak-"));
  try {
    const crcChunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
      return Buffer.concat([len, body, crc]);
    };
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const png = (extra) => Buffer.concat([sig, crcChunk("IHDR", Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])), ...extra, crcChunk("IDAT", Buffer.from([1, 2, 3])), crcChunk("IEND", Buffer.alloc(0))]);
    fs.writeFileSync(path.join(tmp, "a.txt"), "xin chao ETEK Power");
    fs.writeFileSync(path.join(tmp, "b.css"), "a{color:#189848}");
    fs.writeFileSync(path.join(tmp, "c.js"), "var u='https://etekpower.example';");
    fs.writeFileSync(path.join(tmp, "d.md"), "Công ty Tân Phát");
    fs.writeFileSync(path.join(tmp, "e.svg"), '<svg aria-label="Etek"></svg>');
    fs.mkdirSync(path.join(tmp, "icons"));
    fs.writeFileSync(path.join(tmp, "icons", "etek-logo.png"), png([]));
    fs.writeFileSync(path.join(tmp, "f.png"), png([crcChunk("tEXt", Buffer.from("Title\0ETEK Power logo", "latin1"))]));
    fs.writeFileSync(path.join(tmp, "g.png"), png([crcChunk("zTXt", Buffer.concat([Buffer.from("Comment\0\0", "latin1"), zlib.deflateSync(Buffer.from("by ETEK"))]))]));
    fs.writeFileSync(path.join(tmp, "h.png"), png([])); // sạch
    const found = B.scanDir(tmp, new Set());
    const files = new Set(found.map((f) => f.file.replace(/^\(tên tệp\) /, "").replace(/ \[.*\]$/, "")));
    for (const f of ["a.txt", "b.css", "c.js", "d.md", "e.svg", "icons/etek-logo.png", "f.png", "g.png"]) assert.ok(files.has(f), "phải bắt được " + f);
    assert.ok(!files.has("h.png"), "PNG sạch không được báo");
    // Trùng byte với tệp nội bộ.
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(tmp, "h.png"))).digest("hex");
    assert.ok(B.scanDir(tmp, new Set([hash])).some((f) => f.file === "h.png" && /trùng byte/.test(f.rule)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("có đủ tệp chính", () => {
  const need = [
    "index.html", "privacy.html", "terms.html", "app.js", "signals.js", "journal.js", "brand.js", "styles.css", "solpha-theme.css", "sw.js",
    "manifest.webmanifest", "twa-manifest.json", ".well-known/assetlinks.json", "_headers", "_redirects", ".nojekyll", "package.json", "VERSION",
    "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
    "play-assets/icon-512.png", "play-assets/feature-graphic-1024x500.png", "tests/signals.test.js", "tools/make-icons.js", "tools/play-assets.js",
    "README.md", "LICENSE.md", "CHANGELOG.md", "docs/INSTALL.md", "docs/CUSTOMIZE.md", "docs/SUPPORT.md", "docs/ANDROID.md",
  ];
  for (const f of need) assert.ok(has(f), "thiếu " + f);
});

test("giao diện luôn là SOLPHA: data-brand, theme-color, không logo ngoài", () => {
  for (const f of ["index.html", "privacy.html", "terms.html"]) {
    const h = rd(f);
    assert.match(h, /<html[^>]*data-brand="solpha"/, f);
    assert.match(h, /<meta name="theme-color" content="#07080c"/, f);
    assert.ok(!/data-src=/.test(h), f + " còn data-src");
    assert.ok(!/class="etek-logo"/.test(h));
    assert.match(h, /href="solpha-theme\.css"/, f);
  }
  const idx = rd("index.html");
  assert.match(idx, /<link rel="manifest" href="manifest\.webmanifest"/);
  assert.match(idx, /<img class="logo" src="icons\/icon\.svg"/);
  const brand = rd("brand.js");
  assert.match(brand, /"solpha"/);
  assert.ok(!/sessionStorage|URLSearchParams|referrer/.test(brand), "brand.js phải rút gọn, không có nhánh chọn thương hiệu");
  assert.match(rd("solpha-theme.css"), /html\[data-brand="solpha"\]/);
});

test("mọi đường dẫn tài nguyên trong HTML/manifest/sw đều tồn tại", () => {
  const check = (ref, from) => {
    if (/^(https?:|data:|#|mailto:)/.test(ref) || ref.includes("{{")) return;
    const clean = ref.split("#")[0].split("?")[0].replace(/^\.\//, "");
    if (clean === "" || clean === "/" || clean === "./") return;
    assert.ok(has(clean.replace(/^\//, "")), `${from} trỏ tới ${ref} không có trong gói`);
  };
  for (const f of ["index.html", "privacy.html", "terms.html"]) {
    for (const m of rd(f).matchAll(/(?:href|src)="([^"]+)"/g)) check(m[1], f);
  }
  const man = JSON.parse(rd("manifest.webmanifest"));
  man.icons.forEach((i) => check(i.src, "manifest"));
  (man.shortcuts || []).forEach((s) => (s.icons || []).forEach((i) => check(i.src, "manifest.shortcuts")));
  assert.strictEqual(man.theme_color, "#07080c");
  assert.strictEqual(man.start_url, "./");
  const sw = rd("sw.js");
  const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
  assert.ok(assets.length > 10);
  assets.forEach((a) => check(a, "sw.js"));
  for (const must of ["./index.html", "./solpha-theme.css", "./brand.js", "./manifest.webmanifest"]) assert.ok(assets.includes(must), must);
  assert.ok(!/manifest-solpha|icons\/solpha/.test(sw + rd("index.html") + rd("app.js")));
});

test("JS hợp lệ cú pháp", () => {
  const files = B.listFiles(PKG).filter((f) => f.endsWith(".js"));
  assert.ok(files.length >= 8);
  for (const f of files) {
    const src = rd(f);
    if (/^\s*export\s|^\s*import\s/m.test(src)) {
      const r = spawnSync(process.execPath, ["--check", path.join(PKG, f)]);
      assert.strictEqual(r.status, 0, f + "\n" + r.stderr);
    } else {
      assert.doesNotThrow(() => new vm.Script(src, { filename: f }), f);
    }
  }
  for (const f of ["manifest.webmanifest", "twa-manifest.json", ".well-known/assetlinks.json", "package.json"]) assert.doesNotThrow(() => JSON.parse(rd(f)), f);
});

test("signals.js giống hệt bản gốc, journal.js nguyên vẹn", () => {
  assert.ok(fs.readFileSync(path.join(PKG, "signals.js")).equals(fs.readFileSync(path.join(B.ROOT, "signals.js"))));
  assert.ok(fs.readFileSync(path.join(PKG, "journal.js")).equals(fs.readFileSync(path.join(B.ROOT, "journal.js"))));
  assert.ok(fs.readFileSync(path.join(PKG, "tests/signals.test.js")).equals(fs.readFileSync(path.join(B.ROOT, "tests/signals.test.js"))));
});

test("node tests/signals.test.js chạy được ngay trong thư mục gói", () => {
  const r = spawnSync(process.execPath, ["tests/signals.test.js"], { cwd: PKG, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /OK/);
});

test("placeholder đúng chỗ, không còn chữ giữ chỗ cũ, app chạy không chứa {{...}}", () => {
  for (const f of ["privacy.html", "terms.html"]) {
    const h = rd(f);
    assert.match(h, /\{\{COMPANY_NAME\}\}/, f);
    assert.match(h, /\{\{CONTACT_EMAIL\}\}/, f);
    assert.match(h, /\{\{WEBSITE\}\}/, f);
    assert.ok(!/\[EMAIL\]|\[WEBSITE\]|\[TÊN PHÁP NHÂN/.test(h), f + " còn placeholder cũ");
  }
  for (const f of ["index.html", "app.js", "sw.js", "brand.js", "signals.js", "journal.js", "styles.css", "solpha-theme.css", "manifest.webmanifest"]) {
    assert.ok(!/\{\{/.test(rd(f)), f + " (tệp chạy được) không được chứa {{...}}");
    assert.ok(!/pages\.dev/.test(rd(f)), f + " không được hard-code tên miền");
  }
  const twa = JSON.parse(rd("twa-manifest.json"));
  assert.strictEqual(twa.host, "{{DOMAIN}}");
  assert.ok(!/pages\.dev/.test(rd("twa-manifest.json")));
  for (const f of B.listFiles(PKG).filter((x) => /\.(md|json|toml|js)$/.test(x))) {
    if (f === "VERSION") continue;
    assert.ok(!/solpha\.pages\.dev/.test(rd(f)), f + " còn domain cứng");
  }
});

test("trang pháp lý và tài liệu có cảnh báo rủi ro", () => {
  assert.match(rd("README.md"), /KHÔNG phải tư vấn/);
  assert.match(rd("LICENSE.md"), /LUẬT SƯ SOÁT|LAWYER REVIEW/i);
  assert.match(rd("LICENSE.md"), /Single/);
  assert.match(rd("LICENSE.md"), /Extended/);
  assert.match(rd("docs/SUPPORT.md"), /3 ngày làm việc/);
  assert.match(rd("CHANGELOG.md"), /\[1\.0\.0\]/);
  assert.match(rd("terms.html"), /tư vấn|rủi ro/i);
});
