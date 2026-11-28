import { cloneDefaultContent } from './cms-v2-data.js';

const firebaseConfig = {
  apiKey: "AIzaSyCQ0P7Ph-gYKyD1RhUcHEtd155UpPLslpk",
  authDomain: "dashboard-dfc4b.firebaseapp.com",
  projectId: "dashboard-dfc4b",
  storageBucket: "dashboard-dfc4b.firebasestorage.app",
  messagingSenderId: "573840272334",
  appId: "1:573840272334:web:021236d32f576778f9d99f",
  measurementId: "G-3NZW8N8J2Z"
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const loginScreen = $('#loginScreen');
const appScreen = $('#appScreen');
const loginMessage = $('#loginMessage');
const saveStatus = $('#saveStatus');

let auth;
let db;
let currentUser = null;
let content = cloneDefaultContent();
let dirty = false;
let currentPanel = 'overview';
const panelStack = [];
const historyCache = new Map();

const schemas = {
  qualifications: [
    { key: 'status', label: 'Status label' },
    { key: 'state', label: 'Status type', type: 'select', options: [['ongoing','In progress'],['completed','Completed']] },
    { key: 'title', label: 'Qualification title' },
    { key: 'institution', label: 'Institution' },
    { key: 'description', label: 'Description', type: 'textarea', full: true }
  ],
  skills: [
    { key: 'number', label: 'Card number' },
    { key: 'title', label: 'Skill title' },
    { key: 'description', label: 'Description', type: 'textarea', full: true },
    { key: 'tags', label: 'Tags (separate with dots)' }
  ],
  research: [
    { key: 'code', label: 'Research code' },
    { key: 'title', label: 'Research title' },
    { key: 'description', label: 'Description', type: 'textarea', full: true },
    { key: 'status', label: 'Status label' },
    { key: 'url', label: 'Destination URL (optional)', type: 'url' },
    { key: 'button', label: 'Button label (optional)' }
  ],
  projects: [
    { key: 'number', label: 'Project number' },
    { key: 'category', label: 'Category / label' },
    { key: 'title', label: 'Project title' },
    { key: 'description', label: 'Description', type: 'textarea', full: true },
    { key: 'url', label: 'Project URL', type: 'url' },
    { key: 'button', label: 'Link label' },
    { key: 'featured', label: 'Use large featured card', type: 'checkbox', full: true }
  ],
  navLinks: [
    { key: 'label', label: 'Menu label' },
    { key: 'url', label: 'Destination (https:// or #section)', type: 'text' }
  ]
};

const collectionTitles = {
  qualifications: 'Qualification', skills: 'Skill', research: 'Research item',
  projects: 'Project', navLinks: 'Menu link'
};

function setStatus(message, kind = '') {
  saveStatus.textContent = message;
  saveStatus.className = `status ${kind}`.trim();
}

function deepGet(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function deepSet(object, path, value) {
  const parts = path.split('.');
  let target = object;
  for (const part of parts.slice(0, -1)) {
    if (!target[part] || typeof target[part] !== 'object') target[part] = {};
    target = target[part];
  }
  target[parts.at(-1)] = value;
}

// Merge saved CMS content with the newest schema without discarding saved arrays or legacy values.
function mergeContentWithDefaults(savedContent) {
  const defaults = cloneDefaultContent();
  const merge = (base, source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return source ?? base;
    const result = { ...base };
    Object.entries(source).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = merge(base && typeof base[key] === 'object' && !Array.isArray(base[key]) ? base[key] : {}, value);
      } else {
        result[key] = value;
      }
    });
    return result;
  };

  const saved = savedContent && typeof savedContent === 'object' ? savedContent : {};
  const merged = merge(defaults, saved);
  const savedDesign = saved.design && typeof saved.design === 'object' ? saved.design : {};
  const legacyKeys = ['bg', 'panel', 'line', 'text', 'muted', 'green', 'green2'];

  // Before the dual-profile system, all colors were stored flat under design.*.
  // Preserve those existing choices as the starting Dark Mode palette.
  if (!savedDesign.dark || typeof savedDesign.dark !== 'object') {
    legacyKeys.forEach(key => {
      if (typeof savedDesign[key] === 'string' && /^#[0-9a-f]{6}$/i.test(savedDesign[key])) {
        merged.design.dark[key] = savedDesign[key];
      }
    });
  }
  return merged;
}

function markDirty() {
  dirty = true;
  setStatus('Unsaved changes', 'bad');
  updateCounts();
}

function updateCounts() {
  for (const key of ['qualifications','skills','research','projects']) {
    const target = $(`#count${key[0].toUpperCase()}${key.slice(1)}`);
    if (target) target.textContent = Array.isArray(content[key]) ? content[key].length : 0;
  }
}

function showPanel(name, remember = true) {
  const panel = $(`#${name}Panel`);
  if (!panel) return;
  if (remember && currentPanel !== name) panelStack.push(currentPanel);
  currentPanel = name;
  $$('.panel').forEach(element => element.classList.add('hidden'));
  panel.classList.remove('hidden');
  $$('.navbtn').forEach(button => button.classList.toggle('active', button.dataset.panel === name));
  if (schemas[name]) renderCollection(name);
  if (name === 'history') loadHistory();
  $('#backButton').disabled = name === 'overview' && panelStack.length === 0;
}

function goBack() {
  const previous = panelStack.pop() || 'overview';
  showPanel(previous, false);
}

function fillBindings() {
  $$('[data-bind]').forEach(element => {
    const value = deepGet(content, element.dataset.bind);
    if (element.type === 'checkbox') element.checked = Boolean(value);
    else element.value = value ?? '';
  });
  updateCounts();
}

function makeField(collection, index, schema) {
  const wrapper = document.createElement('div');
  wrapper.className = `item-field${schema.full ? ' full' : ''}`;
  const label = document.createElement('label');
  label.textContent = schema.label;
  wrapper.appendChild(label);
  let input;
  if (schema.type === 'textarea') {
    input = document.createElement('textarea');
  } else if (schema.type === 'select') {
    input = document.createElement('select');
    for (const [value, labelText] of schema.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = labelText;
      input.appendChild(option);
    }
  } else if (schema.type === 'checkbox') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.style.width = '20px';
    input.style.height = '20px';
  } else {
    input = document.createElement('input');
    input.type = schema.type === 'url' ? 'url' : 'text';
  }
  input.dataset.array = collection;
  input.dataset.index = String(index);
  input.dataset.field = schema.key;
  const value = content[collection][index]?.[schema.key];
  if (input.type === 'checkbox') input.checked = Boolean(value);
  else input.value = value ?? '';
  wrapper.appendChild(input);
  return wrapper;
}

function renderCollection(collection) {
  const container = $(`#${collection}Editor`);
  if (!container) return;
  container.replaceChildren();
  const entries = Array.isArray(content[collection]) ? content[collection] : [];
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = `There are no ${collectionTitles[collection].toLowerCase()} items yet. Use Add to create one.`;
    container.appendChild(empty);
  }
  entries.forEach((entry, index) => {
    const card = document.createElement('article');
    card.className = 'item-card';
    const top = document.createElement('div');
    top.className = 'item-top';
    const heading = document.createElement('strong');
    heading.textContent = `${collectionTitles[collection]} ${index + 1}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.dataset.deleteCollection = collection;
    remove.dataset.deleteIndex = String(index);
    remove.textContent = 'Delete';
    top.append(heading, remove);
    const fields = document.createElement('div');
    fields.className = 'item-fields';
    schemas[collection].forEach(schema => fields.appendChild(makeField(collection, index, schema)));
    card.append(top, fields);
    container.appendChild(card);
  });
}

function addItem(collection) {
  const blank = {};
  schemas[collection].forEach(schema => {
    blank[schema.key] = schema.type === 'checkbox' ? false : (schema.key === 'state' ? 'ongoing' : '');
  });
  if (collection === 'qualifications') blank.state = 'ongoing';
  if (collection === 'projects') blank.featured = false;
  content[collection].push(blank);
  markDirty();
  renderCollection(collection);
}

function validateContent() {
  const urlFields = [
    ['githubUrl', content.githubUrl], ['linkedinUrl', content.linkedinUrl],
    ['feedbackUrl', content.feedbackUrl], ['toolkitUrl', content.toolkitUrl],
    ['researchToolUrl', content.researchToolUrl], ['media.logoUrl', content.media?.logoUrl],
    ['media.profileUrl', content.media?.profileUrl], ['media.backgroundVideoUrl', content.media?.backgroundVideoUrl]
  ];
  for (const [label, value] of urlFields) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:') throw new Error();
    } catch {
      throw new Error(`${label} must be a valid HTTPS URL.`);
    }
  }
  if (content.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.contactEmail)) {
    throw new Error('Contact email address does not look valid.');
  }
  for (const collection of ['qualifications','skills','research','projects']) {
    for (const [index, item] of (content[collection] || []).entries()) {
      if (!String(item.title || '').trim()) throw new Error(`${collectionTitles[collection]} ${index + 1} needs a title.`);
      if (item.url) {
        try { if (new URL(item.url).protocol !== 'https:') throw new Error(); }
        catch { throw new Error(`${collectionTitles[collection]} ${index + 1} URL must use HTTPS.`); }
      }
    }
  }
}

function getPayload() {
  return {
    content: JSON.parse(JSON.stringify(content)),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.uid,
    schemaVersion: 2
  };
}

async function saveDraft() {
  validateContent();
  const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const payload = getPayload();
  payload.updatedAt = serverTimestamp();
  await setDoc(doc(db, 'sites', 'cyberalfa', 'content', 'draft'), payload);
  dirty = false;
  setStatus('Draft saved successfully', 'good');
}

async function publish() {
  validateContent();
  const { doc, setDoc, serverTimestamp, collection: makeCollection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const payload = getPayload();
  payload.updatedAt = serverTimestamp();
  await setDoc(doc(db, 'sites', 'cyberalfa', 'content', 'draft'), payload);
  await setDoc(doc(db, 'sites', 'cyberalfa', 'content', 'published'), payload);
  try {
    await addDoc(makeCollection(db, 'sites', 'cyberalfa', 'versions'), {
      content: JSON.parse(JSON.stringify(content)),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
      schemaVersion: 2
    });
  } catch (historyError) {
    console.warn('Published successfully, but the history snapshot could not be saved.', historyError);
  }
  dirty = false;
  setStatus('Published successfully', 'good');
  await loadHistory();
}

function dateLabel(timestamp) {
  if (!timestamp) return 'Date unavailable';
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

async function loadHistory() {
  const container = $('#historyList');
  container.innerHTML = '<div class="empty">Loading version history…</div>';
  try {
    const { collection: makeCollection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const ref = makeCollection(db, 'sites', 'cyberalfa', 'versions');
    const snapshot = await getDocs(query(ref, orderBy('createdAt', 'desc'), limit(20)));
    container.replaceChildren();
    historyCache.clear();
    if (snapshot.empty) {
      container.innerHTML = '<div class="empty">No published versions are saved yet. Publish once to create the first restore point.</div>';
      return;
    }
    snapshot.forEach(documentSnapshot => {
      const data = documentSnapshot.data();
      historyCache.set(documentSnapshot.id, data.content);
      const row = document.createElement('div');
      row.className = 'history-row';
      const info = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = `Published version · ${dateLabel(data.createdAt)}`;
      const detail = document.createElement('p');
      detail.textContent = `Saved by: ${String(data.createdBy || 'CMS administrator').slice(0, 12)}…`;
      info.append(heading, detail);
      const restore = document.createElement('button');
      restore.className = 'btn';
      restore.type = 'button';
      restore.textContent = 'Restore to editor';
      restore.dataset.restoreVersion = documentSnapshot.id;
      row.append(info, restore);
      container.appendChild(row);
    });
  } catch (error) {
    container.innerHTML = '<div class="empty">Could not load history. Check Firestore rules and ensure the versions collection is readable by the admin.</div>';
    console.error(error);
  }
}

function openPreview() {
  const wrap = $('#previewWrap');
  const frame = $('#previewFrame');
  wrap.classList.add('open');
  wrap.setAttribute('aria-hidden', 'false');
  frame.onload = () => {
    let attempts = 0;
    const send = () => {
      if (!frame.contentWindow) return;
      frame.contentWindow.postMessage({ type: 'CYBERALFA_CMS_PREVIEW', content: JSON.parse(JSON.stringify(content)) }, window.location.origin);
      attempts += 1;
      if (attempts < 8) window.setTimeout(send, 300);
    };
    send();
  };
  frame.src = `home.html?cmsPreview=1&v=${Date.now()}`;
}

function showLogin(message = '') {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  loginMessage.textContent = message;
}

function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  fillBindings();
  showPanel('overview', false);
  dirty = false;
  setStatus('Connected · ready to edit', 'good');
}

async function loadContent() {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const draftSnapshot = await getDoc(doc(db, 'sites', 'cyberalfa', 'content', 'draft'));
  if (draftSnapshot.exists() && draftSnapshot.data().content) {
    content = mergeContentWithDefaults(draftSnapshot.data().content);
    return 'Draft loaded';
  }
  const publishedSnapshot = await getDoc(doc(db, 'sites', 'cyberalfa', 'content', 'published'));
  if (publishedSnapshot.exists() && publishedSnapshot.data().content) {
    content = mergeContentWithDefaults(publishedSnapshot.data().content);
    return 'Published content loaded';
  }
  content = cloneDefaultContent();
  return 'Starter content loaded from your existing website';
}

function connectBindings() {
  document.addEventListener('input', event => {
    const element = event.target;
    if (element.matches('[data-bind]')) {
      const value = element.type === 'checkbox' ? element.checked : element.value;
      deepSet(content, element.dataset.bind, value);
      markDirty();
    } else if (element.matches('[data-array][data-index][data-field]')) {
      const arrayName = element.dataset.array;
      const index = Number(element.dataset.index);
      const field = element.dataset.field;
      if (content[arrayName]?.[index]) {
        content[arrayName][index][field] = element.type === 'checkbox' ? element.checked : element.value;
        markDirty();
      }
    }
  });
  document.addEventListener('change', event => {
    const element = event.target;
    if (element.matches('[data-array][data-index][data-field]') && element.type === 'checkbox') {
      const arrayName = element.dataset.array;
      const index = Number(element.dataset.index);
      const field = element.dataset.field;
      if (content[arrayName]?.[index]) content[arrayName][index][field] = element.checked;
      markDirty();
    }
  });
}

async function init() {
  const [{ initializeApp, getApps }, authModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js')
  ]);
  const { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } = authModule;
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    loginMessage.textContent = 'Signing in…';
    try {
      await signInWithEmailAndPassword(auth, $('#loginEmail').value.trim(), $('#loginPassword').value);
      $('#loginPassword').value = '';
      loginMessage.textContent = '';
    } catch (error) {
      loginMessage.textContent = error.code === 'auth/invalid-credential'
        ? 'Email or password is incorrect.'
        : `Sign-in failed: ${error.message}`;
    }
  });

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) { showLogin(); return; }
    try {
      const message = await loadContent();
      showApp();
      setStatus(message, 'good');
    } catch (error) {
      showLogin(`Signed in, but Firestore could not be read. Check the CMS security rules. ${error.message}`);
      console.error(error);
    }
  });

  $('#logoutButton').addEventListener('click', async () => {
    if (dirty && !confirm('You have unsaved changes. Log out anyway?')) return;
    await signOut(auth);
  });
  $('#backButton').addEventListener('click', goBack);
  $('#previewButton').addEventListener('click', openPreview);
  $('#closePreviewButton').addEventListener('click', () => {
    $('#previewWrap').classList.remove('open');
    $('#previewWrap').setAttribute('aria-hidden', 'true');
    $('#previewFrame').src = 'about:blank';
  });
  $('#saveDraftButton').addEventListener('click', async () => {
    try { await saveDraft(); } catch (error) { setStatus(error.message, 'bad'); alert(error.message); }
  });
  $('#publishButton').addEventListener('click', async () => {
    if (!confirm('Publish these changes to the public CyberAlfa website?')) return;
    try { await publish(); alert('Your content has been published.'); }
    catch (error) { setStatus(error.message, 'bad'); alert(error.message); }
  });
  $('#refreshHistoryButton').addEventListener('click', loadHistory);

  $$('.navbtn').forEach(button => button.addEventListener('click', () => showPanel(button.dataset.panel)));
  $$('[data-add]').forEach(button => button.addEventListener('click', () => addItem(button.dataset.add)));

  document.addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-delete-collection]');
    if (deleteButton) {
      const collection = deleteButton.dataset.deleteCollection;
      const index = Number(deleteButton.dataset.deleteIndex);
      const label = collectionTitles[collection].toLowerCase();
      if (!confirm(`Delete this ${label} from your CMS draft? This does not change the live site until you publish.`)) return;
      content[collection].splice(index, 1);
      markDirty();
      renderCollection(collection);
      return;
    }
    const restoreButton = event.target.closest('[data-restore-version]');
    if (restoreButton) {
      const snapshot = historyCache.get(restoreButton.dataset.restoreVersion);
      if (!snapshot || !confirm('Load this version into the editor? Your current unsaved editor content will be replaced.')) return;
      content = mergeContentWithDefaults(JSON.parse(JSON.stringify(snapshot)));
      dirty = true;
      fillBindings();
      Object.keys(schemas).forEach(renderCollection);
      setStatus('Historical version loaded into editor — save or publish it to keep changes.', 'bad');
      showPanel('overview');
    }
  });

  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  connectBindings();
}

init().catch(error => {
  console.error(error);
  showLogin(`CMS could not initialize: ${error.message}`);
});
