// --- Rize Badge Generator — full gallery build ---
// Flow: (pick community) -> gallery with filters -> editor (upload, fit, light/dark, download)

const COMMUNITIES = {
  tech:  { name: "Rize Tech+" },
  d2c:   { name: "Rize D2C+" },
  xport: { name: "Rize Xport+" },
};
const FORMAT_LABEL = { square: "Square (1:1)", story: "Story (4:5)" };

let MANIFEST = [];
let community = null;         // chosen community key
let filters = { format: "all", theme: "all" };
let current = null;          // selected design object

// elements
const $ = (id) => document.getElementById(id);
const pickEl = $("pick"), galleryEl = $("gallery"), editorEl = $("editor");
const grid = $("grid"), galTitle = $("galTitle"), subhead = $("subhead");

// ---------- boot ----------
fetch("manifest.json")
  .then((r) => r.json())
  .then((m) => { MANIFEST = m; route(); })
  .catch(() => { grid.innerHTML = '<p class="empty">Could not load designs.</p>'; });

function route() {
  const params = new URLSearchParams(location.search);
  const c = params.get("c");
  if (c && COMMUNITIES[c]) {
    community = c;
    showGallery();
  } else {
    show(pickEl);
  }
}

function show(el) {
  [pickEl, galleryEl, editorEl].forEach((s) => (s.style.display = "none"));
  el.style.display = el === editorEl ? "grid" : "block";
}

// ---------- gallery ----------
function showGallery() {
  show(galleryEl);
  galTitle.textContent = `${COMMUNITIES[community].name} — choose a design`;
  subhead.textContent = "Pick a design, add your logo, download. Your logo stays on your device.";
  renderGrid();
}

document.querySelectorAll(".seg-chips").forEach((group) => {
  group.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    group.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    filters[group.dataset.filter] = chip.dataset.v;
    renderGrid();
  });
});

function renderGrid() {
  const items = MANIFEST.filter(
    (d) =>
      d.community === community &&
      (filters.format === "all" || d.format === filters.format) &&
      (filters.theme === "all" || d.theme === filters.theme)
  );
  grid.innerHTML = "";
  if (!items.length) {
    grid.innerHTML = '<p class="empty">No designs match these filters.</p>';
    return;
  }
  for (const d of items) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <img loading="lazy" src="assets/thumbs/${d.id}.jpg" alt="${d.format} badge" />
      <div class="meta">
        <span class="tag">${d.format === "square" ? "Square" : "Story"}</span>
        <span class="tag">${d.theme === "light" ? "Light" : "Dark"}</span>
      </div>`;
    tile.addEventListener("click", () => openEditor(d));
    grid.appendChild(tile);
  }
}

// ---------- editor ----------
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const drop = $("drop"), fileInput = $("fileInput"), dropTitle = $("dropTitle");
const downloadBtn = $("download"), scaleInput = $("scale");
const backingSeg = $("backing"), autoNote = $("autoNote"), editorFoot = $("editorFoot");
const bgRemoveSeg = $("bgremove"), trimNote = $("trimNote");

let bg = null;                 // background artwork image
let logoSrc = null;            // trimmed logo {canvas,w,h,bg,bgKind,transparentBg}
let logo = null;              // canvas actually drawn (trimmed, maybe bg-removed)
let logoIsLight = false, backingMode = "auto", bgRemoveMode = "off";

function openEditor(design) {
  current = design;
  logoSrc = null; logo = null; logoIsLight = false; backingMode = "auto"; bgRemoveMode = "off";
  dropTitle.textContent = "Click or drop your logo";
  downloadBtn.disabled = true;
  scaleInput.value = 92;
  backingSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === "auto"));
  bgRemoveSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === "off"));
  autoNote.textContent = ""; autoNote.className = "note";
  trimNote.textContent = ""; trimNote.className = "note";
  canvas.width = design.w; canvas.height = design.h;
  editorFoot.textContent = `${COMMUNITIES[design.community].name} · ${FORMAT_LABEL[design.format]} · downloads at ${design.w}×${design.h}`;
  show(editorEl);
  bg = new Image();
  bg.onload = render;
  bg.src = design.file;
  render();
}

$("backBtn").addEventListener("click", showGallery);

// upload — input lives OUTSIDE the drop zone; we trigger it on click
drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

function handleFile(f) {
  if (!f) return;
  if (/pdf/.test(f.type) || /\.pdf$/i.test(f.name)) {
    alert("PDF logos can't be read in the browser. Please export your logo as a PNG (transparent background is best) and upload that.");
    return;
  }
  if (!/image\/(png|jpeg|webp|avif|svg\+xml)/.test(f.type)) {
    alert("Please upload a PNG, JPG, WEBP, AVIF or SVG logo.");
    return;
  }
  const img = new Image();
  img.onload = () => {
    logoSrc = trimLogo(img);
    applyLogo();
    dropTitle.textContent = f.name;
    downloadBtn.disabled = false;
    updateTrimNote();
    updateAutoNote();
    render();
  };
  img.onerror = () => alert("Couldn't read that image. Try a PNG or JPG export.");
  img.src = URL.createObjectURL(f);
}

// Crop away empty padding (transparent OR a uniform colour border) so the
// real mark fills the frame. Detection runs on a downscaled copy for speed;
// the crop is taken from the full-resolution source.
function trimLogo(img) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const scale = Math.min(1, 600 / Math.max(W, H));
  const dw = Math.max(1, Math.round(W * scale)), dh = Math.max(1, Math.round(H * scale));
  const dc = document.createElement("canvas"); dc.width = dw; dc.height = dh;
  const dx = dc.getContext("2d"); dx.drawImage(img, 0, 0, dw, dh);
  let d;
  try { d = dx.getImageData(0, 0, dw, dh).data; }
  catch (e) { return wholeImage(img, W, H); }

  const at = (px, py) => { const i = (py * dw + px) * 4; return [d[i], d[i+1], d[i+2], d[i+3]]; };
  const corners = [at(0,0), at(dw-1,0), at(0,dh-1), at(dw-1,dh-1)];
  const transparentBg = corners.filter((c) => c[3] < 20).length >= 3;
  const cbg = corners[0];
  const cornersAgree = corners.every((c) => Math.abs(c[0]-cbg[0])<=18 && Math.abs(c[1]-cbg[1])<=18 && Math.abs(c[2]-cbg[2])<=18 && Math.abs(c[3]-cbg[3])<=40);
  const tol = 26;
  const isContent = (px, py) => {
    const [r,g,b,a] = at(px, py);
    if (transparentBg) return a > 40;
    if (!cornersAgree) return true;              // busy corners -> don't trim
    return a > 40 && (Math.abs(r-cbg[0])>tol || Math.abs(g-cbg[1])>tol || Math.abs(b-cbg[2])>tol);
  };

  let minX = dw, minY = dh, maxX = -1, maxY = -1;
  for (let py = 0; py < dh; py++)
    for (let px = 0; px < dw; px++)
      if (isContent(px, py)) {
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
  if (maxX < 0) return wholeImage(img, W, H);     // nothing found, keep as-is

  // map detection bbox back to full res, with a 2% safety margin
  const mx = (maxX - minX + 1) * 0.02, my = (maxY - minY + 1) * 0.02;
  const fx0 = Math.max(0, Math.floor((minX - mx) / scale));
  const fy0 = Math.max(0, Math.floor((minY - my) / scale));
  const fx1 = Math.min(W, Math.ceil((maxX + 1 + mx) / scale));
  const fy1 = Math.min(H, Math.ceil((maxY + 1 + my) / scale));
  const bw = fx1 - fx0, bh = fy1 - fy0;
  const trimmed = !(bw >= W * 0.98 && bh >= H * 0.98);

  const out = document.createElement("canvas"); out.width = bw; out.height = bh;
  out.getContext("2d").drawImage(img, fx0, fy0, bw, bh, 0, 0, bw, bh);
  const kind = transparentBg ? "transparent" : (cornersAgree ? "solid" : "busy");
  return { canvas: out, w: bw, h: bh, bg: cbg, bgKind: kind, transparentBg, trimmed };
}

function wholeImage(img, W, H) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  c.getContext("2d").drawImage(img, 0, 0, W, H);
  return { canvas: c, w: W, h: H, bg: [255,255,255,255], bgKind: "busy", transparentBg: true, trimmed: false };
}

// Build the drawable logo from the trimmed source, optionally knocking out
// the uniform background colour (white/solid block behind the mark).
function applyLogo() {
  if (!logoSrc) return;
  if (bgRemoveMode === "on" && !logoSrc.transparentBg) {
    const s = logoSrc.canvas, c = document.createElement("canvas");
    c.width = s.width; c.height = s.height;
    const x = c.getContext("2d"); x.drawImage(s, 0, 0);
    const im = x.getImageData(0, 0, c.width, c.height), p = im.data;
    const [br, bg_, bb] = logoSrc.bg, tol = 32;
    for (let i = 0; i < p.length; i += 4) {
      if (Math.abs(p[i]-br)<=tol && Math.abs(p[i+1]-bg_)<=tol && Math.abs(p[i+2]-bb)<=tol) p[i+3] = 0;
    }
    x.putImageData(im, 0, 0);
    logo = c;
  } else {
    logo = logoSrc.canvas;
  }
  logoIsLight = detectLight(logo);
}

// average brightness of the logo's visible (non-transparent) pixels
function detectLight(src) {
  const s = 80, c = document.createElement("canvas");
  c.width = s; c.height = s;
  const x = c.getContext("2d");
  x.drawImage(src, 0, 0, s, s);
  const d = x.getImageData(0, 0, s, s).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 25) continue;
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    n++;
  }
  return n ? sum / n > 185 : false;
}

function updateTrimNote() {
  if (!logoSrc) { trimNote.textContent = ""; return; }
  if (logoSrc.trimmed) {
    trimNote.textContent = "Trimmed the empty space around your logo so it fills the badge.";
    trimNote.className = "note";
  } else {
    trimNote.textContent = "";
  }
}

// does the logo need a backing to stay visible? (logo tone matches the card tone)
function autoBacking() {
  if (!current) return "none";
  const logoTone = logoIsLight ? "light" : "dark";
  if (logoTone !== current.cardTone) return "none";
  return current.cardTone === "light" ? "dark" : "light";
}

function updateAutoNote() {
  if (backingMode !== "auto") { autoNote.textContent = ""; autoNote.className = "note"; return; }
  if (autoBacking() !== "none") {
    autoNote.textContent = "Your logo blends into this panel, so we added a backing to keep it visible. Use the buttons above to change it.";
    autoNote.className = "note warn";
  } else {
    autoNote.textContent = "Looks good on this design — no backing needed.";
    autoNote.className = "note";
  }
}

backingSeg.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  [...backingSeg.children].forEach((c) => c.classList.remove("active"));
  b.classList.add("active");
  backingMode = b.dataset.v;
  updateAutoNote(); render();
});
bgRemoveSeg.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  [...bgRemoveSeg.children].forEach((c) => c.classList.remove("active"));
  b.classList.add("active");
  bgRemoveMode = b.dataset.v;
  if (logoSrc) { applyLogo(); updateAutoNote(); }
  render();
});
scaleInput.addEventListener("input", render);

// forExport = true draws the final badge only (no guide outline).
function render(forExport) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (bg && bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, W, H);
  if (!current) return;

  const b = current.box;
  const box = { x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H };

  // live target-area guide (screen only, never in the download)
  if (!forExport && logo) {
    ctx.save();
    ctx.setLineDash([Math.max(6, W * 0.006), Math.max(6, W * 0.006)]);
    ctx.lineWidth = Math.max(2, W * 0.0022);
    ctx.strokeStyle = "rgba(120,150,255,.55)";
    roundRect(box.x, box.y, box.w, box.h, Math.max(10, box.w * 0.04));
    ctx.stroke();
    ctx.restore();
  }
  if (!logo) return;

  // 100% fills the container (98% inset for breathing room); slider scales down.
  const fill = scaleInput.value / 100, inset = 0.98;
  const availW = box.w * fill * inset, availH = box.h * fill * inset;
  const r = Math.min(availW / logo.width, availH / logo.height);
  const lw = logo.width * r, lh = logo.height * r;
  const lx = box.x + (box.w - lw) / 2, ly = box.y + (box.h - lh) / 2;

  const mode = backingMode === "auto" ? autoBacking() : backingMode;
  if (mode !== "none") {
    const m = Math.max(lw, lh) * 0.08;
    roundRect(lx - m, ly - m, lw + m * 2, lh + m * 2, Math.max(16, lw * 0.06));
    if (mode === "dark") ctx.fillStyle = "#0b1020";
    else { ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 30; }
    ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.drawImage(logo, lx, ly, lw, lh);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

downloadBtn.addEventListener("click", () => {
  render(true);                 // redraw without the guide outline
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rize-${current.community}-${current.format}-badge.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    render();                    // restore the on-screen guide
  }, "image/png");
});
