// site-nav.js — one top nav shared by story, map, and walk.
// Mounts into every [data-site-nav] element. Highlights the current page
// from the pathname. Same shared-component pattern as radio-tuner.js.
(function () {
  "use strict";
  var ROOT = "/cloudcroft-disc-golf";
  var css =
    ".sn{--sn-on-pine:#fff;display:flex;gap:.35rem;flex-wrap:wrap;align-items:center}" +
    ".sn a{font:inherit;font-size:.82rem;padding:.32rem .65rem;border-radius:999px;" +
    "text-decoration:none;border:1px solid var(--line,#d8d4c6);color:var(--ink,#22271f);" +
    "background:var(--card,#fff)}" +
    '.sn a[aria-current="page"]{background:var(--pine-dark,#143d2a);color:var(--sn-on-pine);' +
    "border-color:var(--pine-dark,#143d2a)}" +
    // dark themes redefine --pine-dark as a light mint (#a8dfc0), so
    // white-on-pine fails contrast (~1.5:1); ink on mint is ~12:1
    'html[data-theme="dark"] .sn{--sn-on-pine:#10140f}' +
    '@media (prefers-color-scheme: dark){html[data-theme="auto"] .sn{--sn-on-pine:#10140f}}';
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var path = location.pathname.replace(/\/$/, "");
  var links = [
    { href: ROOT + "/", label: "Story", here: path === ROOT },
    { href: ROOT + "/app/", label: "Map", here: /\/app\/?$/.test(path) },
    {
      href: ROOT + "/app/walk.html",
      label: "Walk",
      here: /\/app\/walk\.html$/.test(path),
    },
  ];
  document.querySelectorAll("[data-site-nav]").forEach(function (mount) {
    mount.classList.add("sn");
    mount.setAttribute("aria-label", "Cloudcroft disc golf sections");
    mount.innerHTML = links
      .map(function (l) {
        return (
          '<a href="' +
          l.href +
          '"' +
          (l.here ? ' aria-current="page"' : "") +
          ">" +
          l.label +
          "</a>"
        );
      })
      .join("");
  });
})();
