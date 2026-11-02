// Flat panorama viewer for the November 1 ground-survey panos.
//
// Why not Babylon PhotoDome: the survey panos are Pixel cylindrical
// sweeps, ~4096x638-678 (about 6.3:1) in their webp derivatives — NOT
// 2:1 equirectangular. Wrapped on a sphere they stretch vertically
// and smear. This viewer shows each pano at its natural projection:
// a full-viewport-height horizontal strip the visitor drags, scrolls,
// swipes, or arrow-keys left-right. No WebGL, no distortion.
//
// Integration (walk.ts owns the wiring; this module owns nothing else):
//
//   import { mountPanoViewer } from "./pano-viewer";
//   const flat = mountPanoViewer(document.body, {
//     onClose: () => hidePano(),
//     onChange: (p, i) => { panoIdx = i; },
//   });
//   // inside showPanoAt(idx), after the usual camera/status work:
//   flat.open(PANOS[idx].id);            // or flat.open(idx)
//   // inside hidePano(): flat.close();
//
// mountPanoViewer imports its own stylesheet, so no HTML/CSS changes
// are needed. The integrator may pass `panos` to override the catalog
// entirely.

import "./pano-viewer.css";
import { COURSES, PANOS } from "./config";
import type { CourseId, PanoView } from "./config";

export interface FlatPano {
  /** stable join key, matches config PanoView.id */
  id: string;
  /** display label, matching config PANOS */
  label: string;
  /** path to the panos-web webp derivative, e.g. data/panos/<file>.webp */
  file: string;
  course: CourseId;
  courseLabel: string;
  lat: number;
  lon: number;
  note: string;
}

// Display labels come from web/src/config.ts, the single source used by
// the map and story surfaces. pano_id values stay the stable keys.

// Prev/next walks the holes in playing order, not config order.
const DISPLAY_ORDER = [
  "tee1-area",
  "basket1",
  "tee2-area",
  "basket2",
  "tiki-vista",
  "tiki-aspen",
] as const;

function toFlatPano(p: PanoView): FlatPano {
  return {
    id: p.id,
    label: p.label,
    file: p.file,
    course: p.course,
    courseLabel:
      p.course === "tiki" ? COURSES.tiki.name : COURSES.community.name,
    lat: p.lat,
    lon: p.lon,
    note: p.note.replace(/\s*Drag to look around\.?$/, ""),
  };
}

/** The six survey panos in hole order. */
export const FLAT_PANOS: FlatPano[] = DISPLAY_ORDER.map((id) =>
  PANOS.find((p) => p.id === id),
)
  .filter((p): p is PanoView => p !== undefined)
  .map(toFlatPano);

/** `32.962347, -105.742392` — exported for caption reuse and tests. */
export function formatGps(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/**
 * Clamp a strip offset so the image always covers the viewport.
 * Offsets are <= 0 (image shifted left). When the displayed image is
 * narrower than the viewport (ultrawide screen), center it instead.
 */
export function clampOffset(
  offset: number,
  viewportW: number,
  imageW: number,
): number {
  if (imageW <= viewportW) return (viewportW - imageW) / 2;
  return Math.min(0, Math.max(viewportW - imageW, offset));
}

export interface PanoViewerOptions {
  /** catalog override; defaults to FLAT_PANOS */
  panos?: readonly FlatPano[];
  /** label for the return button; default "Back to walk" */
  returnLabel?: string;
  /** when set, renders an extra "Return to map" link with this href */
  mapHref?: string;
  /** fill the host (absolute) instead of the viewport (fixed) */
  embedded?: boolean;
  /** called when the viewer closes (Back, Escape, close()) */
  onClose?: () => void;
  /** called after the displayed pano changes (open, prev, next, goTo) */
  onChange?: (pano: FlatPano, index: number) => void;
}

export interface PanoViewerHandle {
  /** show the viewer at a pano id or catalog index (wraps) */
  open: (idOrIndex?: string | number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  goTo: (idOrIndex: string | number) => void;
  /** re-center the current strip */
  recenter: () => void;
  destroy: () => void;
  readonly isOpen: boolean;
  readonly index: number;
  readonly pano: FlatPano | undefined;
  readonly element: HTMLElement;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

export function mountPanoViewer(
  host: HTMLElement,
  options: PanoViewerOptions = {},
): PanoViewerHandle {
  const panos: readonly FlatPano[] = options.panos ?? FLAT_PANOS;
  if (panos.length === 0) throw new Error("mountPanoViewer: no panos");
  const reducedMq = window.matchMedia(REDUCED_QUERY);
  const reduced = (): boolean => reducedMq.matches;

  // ---- DOM -------------------------------------------------------------
  const root = document.createElement("section");
  root.className =
    "pano-viewer" + (options.embedded ? " pano-viewer--embedded" : "");
  root.hidden = true;
  root.setAttribute("aria-label", "Panorama viewer");
  root.innerHTML = `
    <div class="pano-viewer-viewport" tabindex="0" role="img"
         aria-roledescription="panorama"
         aria-label="Panorama. Drag, scroll, swipe, or use the left and right arrow keys to look along it. Home and End jump to its ends.">
      <img class="pano-viewer-img" alt="" draggable="false" decoding="async" />
      <div class="pano-viewer-status" role="status" aria-live="polite"></div>
    </div>
    <button type="button" class="pano-viewer-side pano-viewer-prev" aria-label="Previous pano">&#8249;</button>
    <button type="button" class="pano-viewer-side pano-viewer-next" aria-label="Next pano">&#8250;</button>
    <div class="pano-viewer-track" aria-hidden="true"><div class="pano-viewer-thumb"></div></div>
    <div class="pano-viewer-bar">
      <strong class="pano-viewer-title"></strong>
      <p class="pano-viewer-meta"></p>
      <p class="pano-viewer-hint">drag, scroll, or use &#8592; &#8594; to look along the pano &middot; [ and ] switch pano</p>
      <div class="pano-viewer-actions">
        <button type="button" class="pano-viewer-back"></button>
      </div>
    </div>`;
  host.appendChild(root);

  const viewport = root.querySelector<HTMLElement>(".pano-viewer-viewport")!;
  const img = root.querySelector<HTMLImageElement>(".pano-viewer-img")!;
  const status = root.querySelector<HTMLElement>(".pano-viewer-status")!;
  const title = root.querySelector<HTMLElement>(".pano-viewer-title")!;
  const meta = root.querySelector<HTMLElement>(".pano-viewer-meta")!;
  const thumb = root.querySelector<HTMLElement>(".pano-viewer-thumb")!;
  const backBtn = root.querySelector<HTMLButtonElement>(".pano-viewer-back")!;
  backBtn.textContent = options.returnLabel ?? "Back to walk";
  if (options.mapHref) {
    const a = document.createElement("a");
    a.href = options.mapHref;
    a.textContent = "Return to map";
    a.className = "pano-viewer-maplink";
    backBtn.after(a);
  }

  // ---- state -------------------------------------------------------------
  let idx = 0;
  let offset = 0; // px, <= 0 unless centered-narrow
  let imageW = 0; // displayed width at viewport height
  let raf = 0;
  let tween: { from: number; to: number; t0: number; ms: number } | null = null;
  let loadToken = 0;
  let returnFocus: HTMLElement | null = null;
  const preloaded = new Set<string>();

  const viewportW = (): number => viewport.clientWidth;
  const viewportH = (): number => viewport.clientHeight;

  function measure(): void {
    if (img.naturalWidth > 0 && viewportH() > 0) {
      imageW = (img.naturalWidth / img.naturalHeight) * viewportH();
    }
  }

  function render(): void {
    offset = clampOffset(offset, viewportW(), imageW);
    img.style.transform = `translate3d(${offset}px, 0, 0)`;
    if (imageW > viewportW()) {
      const frac = viewportW() / imageW;
      thumb.style.width = `${Math.max(4, frac * 100)}%`;
      thumb.style.left = `${(-offset / imageW) * 100}%`;
      thumb.parentElement!.style.visibility = "visible";
    } else {
      thumb.parentElement!.style.visibility = "hidden";
    }
  }

  function cancelTween(): void {
    tween = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function panTo(target: number, animate = true): void {
    cancelTween();
    const to = clampOffset(target, viewportW(), imageW);
    if (!animate || reduced() || imageW === 0) {
      offset = to;
      render();
      return;
    }
    tween = { from: offset, to, t0: performance.now(), ms: 280 };
    const step = (now: number): void => {
      if (!tween) return;
      const k = Math.min(1, (now - tween.t0) / tween.ms);
      const ease = 1 - Math.pow(1 - k, 3);
      offset = tween.from + (tween.to - tween.from) * ease;
      render();
      if (k < 1) raf = requestAnimationFrame(step);
      else tween = null;
    };
    raf = requestAnimationFrame(step);
  }

  function centerOffset(): number {
    return (viewportW() - imageW) / 2;
  }

  function preload(i: number): void {
    const p = panos[((i % panos.length) + panos.length) % panos.length];
    if (preloaded.has(p.file)) return;
    preloaded.add(p.file);
    const probe = new Image();
    probe.decoding = "async";
    probe.src = p.file;
  }

  // Swap only after decode(): the visitor never sees a blurry upscale
  // or a half-painted strip. The previous pano stays up meanwhile.
  async function show(i: number): Promise<void> {
    idx = ((i % panos.length) + panos.length) % panos.length;
    const p = panos[idx];
    const token = ++loadToken;
    title.textContent = p.label;
    meta.textContent =
      `${p.courseLabel} · ${idx + 1} of ${panos.length} panos · ` +
      `${formatGps(p.lat, p.lon)} · ground survey, Nov 1`;
    viewport.setAttribute(
      "aria-label",
      `Panorama: ${p.label}, ${p.courseLabel}, at ${formatGps(p.lat, p.lon)}. ` +
        "Drag, scroll, swipe, or use the left and right arrow keys to look along it.",
    );
    img.alt = `${p.label} — ${p.note}`;
    // Fire now, with the caption — not after decode, so a fast
    // prev/next sequence never leaves the integrator's index stale.
    options.onChange?.(p, idx);
    status.textContent = `Loading ${p.label}…`;
    root.classList.add("is-loading");
    try {
      const next = new Image();
      next.decoding = "async";
      next.src = p.file;
      await next.decode();
      if (token !== loadToken) return; // superseded by a faster prev/next
      img.src = p.file;
      preloaded.add(p.file);
      measure();
      img.style.width = imageW > 0 ? `${imageW}px` : "";
      offset = centerOffset();
      render();
      status.textContent = `${p.label} — drag to look along the pano`;
    } catch {
      if (token !== loadToken) return;
      status.textContent = `Could not load ${p.label}. Check the connection and try the next pano.`;
    } finally {
      if (token === loadToken) root.classList.remove("is-loading");
    }
    preload(idx + 1);
    preload(idx - 1);
  }

  function resolve(idOrIndex: string | number | undefined): number {
    if (typeof idOrIndex === "number") return idOrIndex;
    if (typeof idOrIndex === "string") {
      const found = panos.findIndex((p) => p.id === idOrIndex);
      return found >= 0 ? found : idx;
    }
    return idx;
  }

  // ---- interaction -------------------------------------------------------
  let dragging = false;
  let dragX = 0;
  let dragOffset = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0; // px per ms

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    cancelTween();
    dragging = true;
    dragX = lastX = e.clientX;
    dragOffset = offset;
    lastT = performance.now();
    velocity = 0;
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add("is-dragging");
  }
  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocity = 0.8 * ((e.clientX - lastX) / dt) + 0.2 * velocity;
    lastX = e.clientX;
    lastT = now;
    offset = dragOffset + (e.clientX - dragX);
    render();
  }
  function onPointerUp(): void {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("is-dragging");
    if (reduced() || Math.abs(velocity) < 0.05) return;
    // Inertia: glide, decaying, until the strip edge or a stop.
    let v = velocity;
    let prev = performance.now();
    const glide = (now: number): void => {
      const dt = now - prev;
      prev = now;
      offset += v * dt;
      const before = offset;
      render();
      v *= Math.pow(0.94, dt / 16.7);
      if (Math.abs(v) > 0.02 && offset === before) {
        raf = requestAnimationFrame(glide);
      }
    };
    raf = requestAnimationFrame(glide);
  }
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    cancelTween();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? viewportW() : 1;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    offset -= delta * unit;
    render();
  }
  function onKey(e: KeyboardEvent): void {
    const step = viewportW() * 0.18;
    switch (e.key) {
      case "ArrowLeft":
        panTo(offset + step);
        break;
      case "ArrowRight":
        panTo(offset - step);
        break;
      case "PageUp":
        panTo(offset + viewportW() * 0.9);
        break;
      case "PageDown":
        panTo(offset - viewportW() * 0.9);
        break;
      case "Home":
        panTo(0);
        break;
      case "End":
        panTo(viewportW() - imageW);
        break;
      case "[":
        void show(idx - 1);
        break;
      case "]":
        void show(idx + 1);
        break;
      case "Escape":
        handle.close();
        break;
      default:
        return;
    }
    e.preventDefault();
  }
  function onDblClick(): void {
    panTo(centerOffset());
  }
  function onResize(): void {
    // Keep the point at viewport center fixed across the resize.
    const frac = imageW > 0 ? (viewportW() / 2 - offset) / imageW : 0.5;
    measure();
    img.style.width = imageW > 0 ? `${imageW}px` : "";
    offset = viewportW() / 2 - frac * imageW;
    render();
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("keydown", onKey);
  viewport.addEventListener("dblclick", onDblClick);
  window.addEventListener("resize", onResize);
  const prevBtn = root.querySelector<HTMLButtonElement>(".pano-viewer-prev")!;
  const nextBtn = root.querySelector<HTMLButtonElement>(".pano-viewer-next")!;
  const goPrev = (): void => void show(idx - 1);
  const goNext = (): void => void show(idx + 1);
  prevBtn.addEventListener("click", goPrev);
  nextBtn.addEventListener("click", goNext);
  const goBack = (): void => handle.close();
  backBtn.addEventListener("click", goBack);

  const handle: PanoViewerHandle = {
    open(idOrIndex) {
      if (root.hidden) {
        returnFocus =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }
      root.hidden = false;
      void show(resolve(idOrIndex)).then(() => viewport.focus());
    },
    close() {
      if (root.hidden) return;
      cancelTween();
      root.hidden = true;
      returnFocus?.focus();
      options.onClose?.();
    },
    next: goNext,
    prev: goPrev,
    goTo(idOrIndex) {
      root.hidden = false;
      void show(resolve(idOrIndex));
    },
    recenter() {
      panTo(centerOffset());
    },
    destroy() {
      cancelTween();
      loadToken++; // invalidate any in-flight decode
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerUp);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("keydown", onKey);
      viewport.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("resize", onResize);
      prevBtn.removeEventListener("click", goPrev);
      nextBtn.removeEventListener("click", goNext);
      backBtn.removeEventListener("click", goBack);
      root.remove();
    },
    get isOpen() {
      return !root.hidden;
    },
    get index() {
      return idx;
    },
    get pano() {
      return panos[idx];
    },
    element: root,
  };
  return handle;
}
