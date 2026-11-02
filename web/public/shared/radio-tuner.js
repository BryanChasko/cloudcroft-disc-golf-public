// radio-tuner.js — one mountain-radio tuner shared by the story page
// (/cloudcroft-disc-golf/), the map app (/disc-golf/), and the 3D walk
// (/disc-golf/walk.html). Mounts into every [data-radio-tuner] element.
// Station choice persists in localStorage (dg-radio-station) so the
// station follows you across pages. First load defaults to NV1 —
// Native Voice One; a stored choice always wins. Direct streams only
// (verified audio/mpeg); aggregator stations stay outbound links on
// the story page. Each mount registers { mount, audio } on
// window.__dgRadioMounts so page code (e.g. the walk's Babylon
// equalizer) can hook the playing element without touching playback.
(function () {
  "use strict";
  var STATIONS = [
    {
      id: "khii",
      name: "KHII 88.9 / 100.5",
      desc: "Cloudcroft's own — classic + red dirt country from the Sacramento Mountains",
      src: "https://stream.aiir.com/nk0mvkzpgppuv",
    },
    {
      id: "ktmn",
      name: "KTMN Rock 97.9",
      desc: "Classic rock, licensed to Cloudcroft",
      src: "https://stream.aiir.com/teg6piefk9qvv",
    },
    {
      id: "nv1",
      name: "NV1 — Native Voice One",
      desc: "Mescalero regional + national Native programming",
      src: "https://playerservices.streamtheworld.com/api/livestream-redirect/NV1.mp3",
    },
  ];
  var KEY = "dg-radio-station";
  var DEFAULT_ID = "nv1";
  function byId(id) {
    for (var i = 0; i < STATIONS.length; i++)
      if (STATIONS[i].id === id) return STATIONS[i];
    return null;
  }
  function saved() {
    try {
      var picked = byId(localStorage.getItem(KEY));
      if (picked) return picked;
    } catch (e) {}
    return byId(DEFAULT_ID) || STATIONS[0];
  }
  var css =
    ".rt{--rt-on-pine:#fff;border:1px solid var(--line,#d8d4c6);border-radius:12px;padding:.7rem .8rem;background:var(--card,#fff);box-shadow:0 1px 4px rgb(20 61 42/.08);margin:.6rem 0}" +
    ".rt-head{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}" +
    ".rt-play{width:2.6rem;height:2.6rem;border-radius:999px;border:1px solid var(--line,#d8d4c6);background:var(--pine-dark,#143d2a);color:var(--rt-on-pine);font-size:1.05rem;cursor:pointer;line-height:1;flex:none}" +
    ".rt-now{min-width:0;flex:1}" +
    ".rt-name{font-weight:700;color:var(--pine-dark,#143d2a)}" +
    ".rt-status{font-size:.85rem;line-height:1.45;color:var(--muted,#5c665c)}" +
    ".rt-dial{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.55rem}" +
    ".rt-st{font:inherit;font-size:.82rem;padding:.3rem .6rem;border:1px solid var(--line,#d8d4c6);border-radius:999px;background:var(--paper,#f7f5ef);color:var(--ink,#22271f);cursor:pointer}" +
    '.rt-st[aria-pressed="true"]{background:var(--pine-dark,#143d2a);color:var(--rt-on-pine);border-color:var(--pine-dark,#143d2a)}' +
    ".rt-vol{display:flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--muted,#5c665c);margin-top:.5rem}" +
    ".rt-vol input{flex:1;accent-color:var(--pine-dark,#143d2a)}" +
    ".rt audio{display:none}" +
    // equalizer canvas (walk page only); transparent so the card shows through
    ".rt-eq{display:block;width:100%;height:34px;margin-top:.5rem}" +
    // dark themes redefine --pine-dark as a light mint (#a8dfc0), so
    // white-on-pine fails contrast (~1.5:1); ink on mint is ~12:1
    'html[data-theme="dark"] .rt{--rt-on-pine:#10140f}' +
    '@media (prefers-color-scheme: dark){html[data-theme="auto"] .rt{--rt-on-pine:#10140f}}';
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  document.querySelectorAll("[data-radio-tuner]").forEach(function (mount) {
    var cur = saved();
    mount.classList.add("rt");
    mount.setAttribute("role", "group");
    mount.setAttribute("aria-label", "Mountain radio tuner");
    mount.innerHTML =
      '<div class="rt-head"><button type="button" class="rt-play" aria-label="Play mountain radio">▶</button>' +
      '<div class="rt-now"><span class="rt-name"></span><div class="rt-status" role="status" aria-live="polite"></div></div></div>' +
      '<div class="rt-dial" role="group" aria-label="Stations"></div>' +
      '<label class="rt-vol">Volume <input type="range" min="0" max="1" step="0.05" value="0.8" aria-label="Radio volume"></label>' +
      '<audio preload="none"></audio>';
    var audio = mount.querySelector("audio");
    var playBtn = mount.querySelector(".rt-play");
    var nameEl = mount.querySelector(".rt-name");
    var statusEl = mount.querySelector(".rt-status");
    var dial = mount.querySelector(".rt-dial");
    var vol = mount.querySelector(".rt-vol input");
    audio.volume = 0.8;
    function tune(st, autoplay) {
      cur = st;
      try {
        localStorage.setItem(KEY, st.id);
      } catch (e) {}
      nameEl.textContent = st.name;
      statusEl.textContent = st.desc;
      dial.querySelectorAll(".rt-st").forEach(function (b) {
        b.setAttribute(
          "aria-pressed",
          b.dataset.id === st.id ? "true" : "false",
        );
      });
      if (audio.getAttribute("src") !== st.src) audio.src = st.src;
      if (autoplay)
        audio.play().catch(function () {
          statusEl.textContent = st.desc + " — press play";
        });
    }
    STATIONS.forEach(function (st) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rt-st";
      b.dataset.id = st.id;
      b.textContent = st.name.split(" — ")[0];
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        tune(st, !audio.paused);
      });
      dial.appendChild(b);
    });
    playBtn.addEventListener("click", function () {
      if (audio.paused) {
        if (!audio.getAttribute("src")) tune(cur, false);
        audio.play().catch(function () {
          statusEl.textContent = "Stream did not start — try again";
        });
      } else {
        audio.pause();
      }
    });
    audio.addEventListener("playing", function () {
      playBtn.textContent = "❚❚";
      playBtn.setAttribute("aria-label", "Pause mountain radio");
      statusEl.textContent = "Live — " + cur.desc;
    });
    audio.addEventListener("pause", function () {
      playBtn.textContent = "▶";
      playBtn.setAttribute("aria-label", "Play mountain radio");
      statusEl.textContent = cur.desc;
    });
    audio.addEventListener("error", function () {
      statusEl.textContent =
        cur.name + " stream unavailable right now — try another station";
    });
    vol.addEventListener("input", function () {
      audio.volume = parseFloat(vol.value);
    });
    tune(cur, false);
    // opt-in hook for page-side extras (walk equalizer); playback unchanged
    (window.__dgRadioMounts = window.__dgRadioMounts || []).push({
      mount: mount,
      audio: audio,
      station: function () {
        return cur;
      },
    });
  });
})();
