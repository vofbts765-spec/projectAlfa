/* CyberAlfa CMS v2 public runtime.
   Additive layer: leaves existing site markup, styles and scripts in place. */
(async function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyCQ0P7Ph-gYKyD1RhUcHEtd155UpPLslpk",
    authDomain: "dashboard-dfc4b.firebaseapp.com",
    projectId: "dashboard-dfc4b",
    storageBucket: "dashboard-dfc4b.firebasestorage.app",
    messagingSenderId: "573840272334",
    appId: "1:573840272334:web:021236d32f576778f9d99f",
    measurementId: "G-3NZW8N8J2Z"
  };
  const publishedPath = ['sites', 'cyberalfa', 'content', 'published'];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const plain = value => typeof value === 'string' ? value : '';

  function safeUrl(value, allowMailto = false) {
    const raw = plain(value).trim();
    if (!raw) return null;
    if (raw.startsWith('#') || raw.startsWith('/')) return raw;
    try {
      const url = new URL(raw, window.location.href);
      if (url.protocol === 'https:') return url.href;
      if (allowMailto && url.protocol === 'mailto:') return url.href;
    } catch (_) {}
    if (allowMailto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return `mailto:${raw}`;
    return null;
  }

  function accentHeading(element, value) {
    if (!element || typeof value !== 'string') return;
    const lines = value.split(/\r?\n/);
    element.replaceChildren();
    lines.forEach((line, index) => {
      if (index === 1 && line) {
        const span = document.createElement('span');
        span.textContent = line;
        element.appendChild(span);
      } else {
        element.appendChild(document.createTextNode(line));
      }
      if (index < lines.length - 1) element.appendChild(document.createElement('br'));
    });
  }

  function setText(selector, value, root = document) {
    const element = $(selector, root);
    if (element && typeof value === 'string') element.textContent = value;
  }

  function accentLastWord(element, value) {
    if (!element || typeof value !== 'string') return;
    const words = value.trim().split(/\s+/);
    if (!words.length || !words[0]) { element.textContent = ''; return; }
    const accent = words.pop();
    element.replaceChildren(document.createTextNode(words.length ? `${words.join(' ')} ` : ''));
    const span = document.createElement('span');
    span.textContent = accent;
    element.appendChild(span);
  }

  function setLink(element, value, allowMailto = false) {
    if (!element) return;
    const href = safeUrl(value, allowMailto);
    if (href) element.setAttribute('href', href);
    else element.removeAttribute('href');
  }

  function make(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined && value !== null) element.textContent = String(value);
    return element;
  }

  function renderQualifications(items) {
    const grid = $('.qualifications-grid');
    if (!grid || !Array.isArray(items)) return;
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const state = item.state === 'ongoing' ? 'ongoing' : 'completed';
      const card = make('div', `qual-card${state === 'ongoing' ? ' active-card' : ''}`);
      const header = make('div', 'qual-header');
      header.appendChild(make('span', `qual-status status-${state}`, `[ ${plain(item.status) || state.toUpperCase()} ]`));
      card.appendChild(header);
      card.appendChild(make('h3', 'qual-title', item.title));
      card.appendChild(make('h4', 'qual-institution', item.institution));
      card.appendChild(make('p', 'qual-desc', item.description));
      fragment.appendChild(card);
    });
    grid.replaceChildren(fragment);
  }

  function renderSkills(items) {
    const grid = $('.skill-grid');
    if (!grid || !Array.isArray(items)) return;
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const article = make('article');
      article.appendChild(make('b', '', item.number));
      article.appendChild(make('h3', '', item.title));
      article.appendChild(make('p', '', item.description));
      article.appendChild(make('div', 'tags', item.tags));
      fragment.appendChild(article);
    });
    grid.replaceChildren(fragment);
  }

  function renderResearch(items) {
    const section = $('#research');
    if (!section || !Array.isArray(items)) return;
    const existing = $$('.thesis-card', section);
    items.forEach((item, index) => {
      let card = existing[index];
      if (!card) {
        card = make('div', 'thesis-card');
        const anchor = existing.length ? existing[existing.length - 1] : $('.section-head', section);
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
        else section.appendChild(card);
        existing.push(card);
      }
      card.hidden = false;
      let code = $('span', card);
      if (!code) { code = make('span'); card.prepend(code); }
      code.textContent = plain(item.code);
      let title = $('h3', card);
      if (!title) { title = make('h3'); card.appendChild(title); }
      title.textContent = plain(item.title);
      let description = $('p', card);
      if (!description) { description = make('p', 'thesis-line'); card.appendChild(description); }
      description.className = 'thesis-line';
      description.textContent = plain(item.description);
      let action = $('a', card);
      let status = $('b', card);
      if (safeUrl(item.url)) {
        if (!action) { action = make('a', 'cinematic-btn'); card.appendChild(action); }
        setLink(action, item.url);
        action.textContent = plain(item.button) || 'EXPLORE →';
        if (status) status.hidden = true;
      } else {
        if (action) action.hidden = true;
        if (!status) { status = make('b'); card.appendChild(status); }
        status.hidden = false;
        status.textContent = `${plain(item.status) || 'ACTIVE'} ->`;
      }
    });
    existing.slice(items.length).forEach(card => { card.hidden = true; });
  }

  function renderProjects(items) {
    const grid = $('.project-grid');
    if (!grid || !Array.isArray(items)) return;
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const article = make('article', `project${item.featured ? ' featured' : ''}`);
      article.appendChild(make('div', 'project-no', item.number));
      const body = make('div', 'mini');
      if (item.category) body.appendChild(make('p', '', item.category));
      body.appendChild(make('h3', '', item.title));
      body.appendChild(make('p', '', item.description));
      const link = make('a', '', plain(item.button) || 'Open →');
      setLink(link, item.url);
      body.appendChild(link);
      article.appendChild(body);
      fragment.appendChild(article);
    });
    grid.replaceChildren(fragment);
  }

  function applyContent(content) {
    if (!content || typeof content !== 'object') return;

    if (plain(content.siteTitle).trim()) document.title = content.siteTitle.trim();
    if (plain(content.metaDescription).trim()) {
      $$('meta[name="description"]').forEach(meta => meta.setAttribute('content', content.metaDescription.trim()));
    }

    const status = $('#home .status');
    if (status && typeof content.heroStatus === 'string') {
      const icon = $('i', status);
      status.replaceChildren();
      if (icon) status.appendChild(icon);
      status.appendChild(document.createTextNode(content.heroStatus));
    }
    setText('[data-cms="heroEyebrow"]', content.heroEyebrow);
    const heroTitle = $('[data-cms="heroTitle"]');
    if (heroTitle && typeof content.heroTitle === 'string') accentHeading(heroTitle, content.heroTitle);
    setText('[data-cms="heroDescription"]', content.heroDescription);

    if (typeof content.aboutTitle === 'string') accentHeading($('#about h2'), content.aboutTitle);
    const aboutParagraphs = $$('#about .about-copy p');
    if (aboutParagraphs[0] && typeof content.aboutText === 'string') aboutParagraphs[0].textContent = content.aboutText;
    if (aboutParagraphs[1] && typeof content.aboutExtra === 'string') aboutParagraphs[1].textContent = content.aboutExtra;

    if (typeof content.qualificationsTitle === 'string') accentHeading($('#QUALIFICATIONS .qual-header-wrapper h2'), content.qualificationsTitle);
    if (typeof content.skillsTitle === 'string') accentHeading($('#skills h2'), content.skillsTitle);
    if (typeof content.researchTitle === 'string') accentHeading($('#research .section-head h2'), content.researchTitle);
    if (typeof content.projectsTitle === 'string') accentHeading($('#project h2'), content.projectsTitle);
    if (typeof content.contactTitle === 'string') accentHeading($('#contact h2'), content.contactTitle);

    renderQualifications(content.qualifications);
    renderSkills(content.skills);
    renderResearch(content.research);
    renderProjects(content.projects);

    const toolkit = $('#tool .toolkit-showcase');
    if (toolkit) {
      const badge = $('.toolkit-badge', toolkit);
      if (badge && typeof content.toolkitBadge === 'string') badge.textContent = content.toolkitBadge;
      const h3 = $('h3', toolkit);
      if (h3) accentLastWord(h3, plain(content.toolkitTitle));
      const paragraph = $('p', toolkit);
      if (paragraph && typeof content.toolkitDescription === 'string') paragraph.textContent = content.toolkitDescription;
      const link = $('a', toolkit);
      setLink(link, content.toolkitUrl);
    }

    const researchTool = $('.bug-bounty-card');
    if (researchTool) {
      const title = $('h3', researchTool);
      if (title && typeof content.researchToolTitle === 'string') accentLastWord(title, content.researchToolTitle);
      const paragraph = $('p', researchTool);
      if (paragraph && typeof content.researchToolDescription === 'string') paragraph.textContent = content.researchToolDescription;
      setLink($('a', researchTool), content.researchToolUrl);
    }

    const hosting = $('.hosting-preview');
    if (hosting) {
      setText('.hosting-content h2', content.hostingTitle, hosting);
      setText('.hosting-content p', content.hostingDescription, hosting);
    }
    const feedback = $('#community-review .review-container');
    if (feedback) {
      setText('.review-title', content.feedbackTitle, feedback);
      setText('.review-desc', content.feedbackDescription, feedback);
      setLink($('.btn-give-feedback', feedback), content.feedbackUrl);
    }

    const contact = $('#contact');
    if (contact) {
      const intro = $(':scope > p:not(.eyebrow)', contact);
      if (intro && typeof content.contactDescription === 'string') intro.textContent = content.contactDescription;
      const links = $$('.contact-links a', contact);
      if (links[0]) setLink(links[0], content.contactEmail && `mailto:${content.contactEmail}`, true);
      if (links[1]) setLink(links[1], content.githubUrl);
      if (links[2]) setLink(links[2], content.linkedinUrl);
    }

    if (Array.isArray(content.navLinks)) {
      $$('.nav-links a').forEach((anchor, index) => {
        const item = content.navLinks[index];
        if (!item) { anchor.hidden = true; return; }
        anchor.hidden = false;
        anchor.textContent = plain(item.label);
        setLink(anchor, item.url);
      });
    }

    if (content.media && typeof content.media === 'object') {
      const logo = safeUrl(content.media.logoUrl);
      if (logo) $$('.nav-logo, #preloader-logo').forEach(img => img.setAttribute('src', logo));
      const profile = safeUrl(content.media.profileUrl);
      if (profile && $('.profile-img')) $('.profile-img').setAttribute('src', profile);
      const backgroundVideo = safeUrl(content.media.backgroundVideoUrl);
      const source = $('#bg-video source');
      if (backgroundVideo && source && source.getAttribute('src') !== backgroundVideo) {
        source.setAttribute('src', backgroundVideo);
        const video = $('#bg-video');
        if (video) { try { video.load(); } catch (_) {} }
      }
    }

    if (content.design && typeof content.design === 'object') {
      const properties = { bg: '--bg', panel: '--panel', line: '--line', text: '--text', muted: '--muted', green: '--green', green2: '--green2' };
      Object.entries(properties).forEach(([key, cssName]) => {
        const value = plain(content.design[key]).trim();
        if (/^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty(cssName, value);
      });
    }

    const footer = $('footer');
    if (footer && typeof content.footerText === 'string') {
      const textNodes = Array.from(footer.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
      if (textNodes.length) textNodes[0].textContent = content.footerText;
      else footer.prepend(document.createTextNode(content.footerText));
    }
  }

  // Private preview bridge: only accept messages from the same site origin.
  let previewOverride = null;
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'CYBERALFA_CMS_PREVIEW' && event.data.content) {
      previewOverride = event.data.content;
      applyContent(previewOverride);
    }
  });

  try {
    const [appModule, firestoreModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    const { initializeApp, getApps } = appModule;
    const { getFirestore, doc, getDoc } = firestoreModule;
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snapshot = await getDoc(doc(db, ...publishedPath));
    if (previewOverride) {
      applyContent(previewOverride);
      console.info('CyberAlfa CMS v2: draft preview applied.');
    } else if (snapshot.exists()) {
      const stored = snapshot.data();
      applyContent(stored.content || {});
      console.info('CyberAlfa CMS v2: published content applied.');
    } else {
      console.info('CyberAlfa CMS v2: no published v2 content found; original portfolio remains visible.');
    }
  } catch (error) {
    console.warn('CyberAlfa CMS v2 could not load published content; original portfolio remains visible.', error);
  }
})();
