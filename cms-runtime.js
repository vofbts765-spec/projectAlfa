/* CyberAlfa CMS Runtime
   Reads only the published document written by admin-dashboard.html:
   sites/cyberalfa/content/published
*/
(async function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyCQ0P7Ph-gYKyD1RhUcHEtd155UpPLslpk",
    authDomain: "dashboard-dfc4b.firebaseapp.com",
    projectId: "dashboard-dfc4b",
    storageBucket: "dashboard-dfc4b.firebasestorage.app",
    messagingSenderId: "573840272334",
    appId: "1:573840272334:web:021236d32f576778f9d99f",
    measurementId: "G-3NZW8N8J2Z"
  };

  const SITE_ID = "cyberalfa";
  const PUBLISHED_PATH = ["sites", SITE_ID, "content", "published"];

  function setHeadline(element, value) {
    // Accept plain text/new lines only. The middle line keeps the original lime accent.
    const lines = value.split(/\r?\n/);
    element.replaceChildren();

    lines.forEach((line, index) => {
      if (index === 1) {
        const accent = document.createElement("span");
        accent.textContent = line;
        element.appendChild(accent);
      } else {
        element.appendChild(document.createTextNode(line));
      }

      if (index < lines.length - 1) {
        element.appendChild(document.createElement("br"));
      }
    });
  }

  function safeHref(value, prefix) {
    const raw = String(value || "").trim();

    if (!raw) return null;

    if (prefix === "mailto:") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
        ? "mailto:" + raw
        : null;
    }

    try {
      const url = new URL(raw);
      return url.protocol === "https:" ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  try {
    const [appModule, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
    ]);

    const { initializeApp, getApps } = appModule;
    const { getFirestore, doc, getDoc } = firestoreModule;

    const app = getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);

    const db = getFirestore(app);

    const snapshot = await getDoc(
      doc(db, ...PUBLISHED_PATH)
    );

    if (!snapshot.exists()) {
      console.info(
        "CyberAlfa CMS: no published content yet; displaying the original page content."
      );
      return;
    }

    const content = snapshot.data().content || {};

    document.querySelectorAll("[data-cms]").forEach((element) => {
      const key = element.getAttribute("data-cms");

      if (
        !Object.prototype.hasOwnProperty.call(content, key) ||
        typeof content[key] !== "string"
      ) return;

      const value = content[key];

      if (
        key === "heroTitle" &&
        element.dataset.cmsFormat === "headline"
      ) {
        setHeadline(element, value);

      } else if (element.matches("input, textarea")) {
        element.value = value;

      } else {
        // Saved CMS text is treated as plain text, not HTML.
        element.textContent = value;
      }
    });

    document.querySelectorAll("[data-cms-href]").forEach((element) => {
      const key = element.getAttribute("data-cms-href");

      if (
        !Object.prototype.hasOwnProperty.call(content, key) ||
        typeof content[key] !== "string"
      ) return;

      const href = safeHref(
        content[key],
        element.getAttribute("data-cms-href-prefix")
      );

      if (href) {
        element.setAttribute("href", href);
      }
    });

    if (
      typeof content.siteTitle === "string" &&
      content.siteTitle.trim()
    ) {
      document.title = content.siteTitle.trim();
    }

    if (
      typeof content.metaDescription === "string" &&
      content.metaDescription.trim()
    ) {
      document.querySelectorAll('meta[name="description"]').forEach((meta) => {
        meta.setAttribute(
          "content",
          content.metaDescription.trim()
        );
      });
    }

    console.info("CyberAlfa CMS: published content applied.");

  } catch (error) {
    // A CMS read failure must not prevent the portfolio's normal content from loading.
    console.warn(
      "CyberAlfa CMS content was not loaded; original page content remains visible.",
      error
    );
  }
})();
