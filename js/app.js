// Extracted from: https://xenzio-source-new.vercel.app/app.js

const state = {
  files: [],
  selectedFileId: null,
  selectedIds: new Set(),
  filteredFiles: [],
  techs: [],
  openFolders: new Set()
};

const elements = {
  form: document.getElementById('analysis-form'),
  urlInput: document.getElementById('url-input'),
  analyzeButton: document.getElementById('analyze-button'),
  statusPanel: document.getElementById('status-panel'),
  statusTitle: document.getElementById('status-title'),
  statusValue: document.getElementById('status-value'),
  statusMessage: document.getElementById('status-message'),
  progressBar: document.getElementById('progress-bar'),
  statFiles: document.getElementById('stat-files'),
  statSize: document.getElementById('stat-size'),
  statTech: document.getElementById('stat-tech'),
  statUrl: document.getElementById('stat-url'),
  techCount: document.getElementById('tech-count'),
  techList: document.getElementById('tech-list'),
  groupList: document.getElementById('group-list'),
  groupCount: document.getElementById('group-count'),
  fileList: document.getElementById('file-list'),
  viewer: document.getElementById('viewer'),
  fileSearch: document.getElementById('file-search'),
  selectAllBtn: document.getElementById('select-all-btn'),
  downloadSelectedBtn: document.getElementById('download-selected-btn'),
  downloadZipBtn: document.getElementById('download-zip-btn'),
  historyList: document.getElementById('history-list'),
  historyMeta: document.getElementById('history-meta'),
  welcomeOverlay: document.getElementById('welcome-overlay'),
  visitorForm: document.getElementById('visitor-form'),
  visitorName: document.getElementById('visitor-name'),
  visitorPosition: document.getElementById('visitor-position'),
  visitorList: document.getElementById('visitor-list'),
  errorOverlay: document.getElementById('error-modal'),
  errorMessage: document.getElementById('error-message'),
  errorCloseBtn: document.getElementById('error-close-btn'),
};

const VISITOR_ID_KEY = 'xenzio-visitor-id-v1';
const VISITOR_DONE_KEY = 'xenzio-visitor-welcome-done-v1';
function getVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`); localStorage.setItem(VISITOR_ID_KEY, id); }
  return id;
}
function renderVisitors(names = []) {
  if (!elements.visitorList) return;
  elements.visitorList.innerHTML = '';
  if (!names.length) { elements.visitorList.innerHTML = '<li>Belum ada nama.</li>'; return; }
  names.forEach(item => { const li = document.createElement('li'); li.textContent = item.name; elements.visitorList.appendChild(li); });
}
async function loadVisitorWelcome() {
  try {
    const response = await fetch('/api/visitors');
    const payload = await response.json();
    if (payload.ok) { renderVisitors(payload.names || []); if (elements.visitorPosition) elements.visitorPosition.textContent = payload.count + 1; }
  } catch (_) {
    if (elements.visitorPosition) elements.visitorPosition.textContent = 'baru';
  }
  if (!localStorage.getItem(VISITOR_DONE_KEY) && elements.welcomeOverlay) {
    elements.welcomeOverlay.classList.add('is-open');
    elements.welcomeOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => elements.visitorName?.focus(), 100);
  }
}
async function submitVisitor(event) {
  event.preventDefault();
  const name = elements.visitorName?.value.trim();
  if (!name) return;
  const button = elements.visitorForm?.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Memproses...'; }
  try {
    const response = await fetch('/api/visitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, visitorId: getVisitorId() }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'Nama tidak dapat disimpan.');
    if (elements.visitorPosition) elements.visitorPosition.textContent = payload.position;
    renderVisitors(payload.names || []);
    localStorage.setItem(VISITOR_DONE_KEY, '1');
    elements.welcomeOverlay?.classList.remove('is-open');
    elements.welcomeOverlay?.setAttribute('aria-hidden', 'true');
  } catch (error) { alert(error.message || 'Terjadi kesalahan.'); }
  finally { if (button) { button.disabled = false; button.textContent = 'OK'; } }
}

function showErrorModal(message = 'Maaf, website ini tidak dapat di-fetch.') {
  if (!elements.errorOverlay) return;
  if (elements.errorMessage) elements.errorMessage.textContent = message;
  elements.errorOverlay.classList.add('is-open');
  elements.errorOverlay.setAttribute('aria-hidden', 'false');
}

function closeErrorModal() {
  if (!elements.errorOverlay) return;
  elements.errorOverlay.classList.remove('is-open');
  elements.errorOverlay.setAttribute('aria-hidden', 'true');
}

function setStatus(progress, title, message) {
  if (!elements.statusPanel) return;

  elements.statusPanel.classList.remove('hidden');
  if (elements.statusValue) elements.statusValue.textContent = `${progress}%`;
  if (elements.statusTitle) elements.statusTitle.textContent = title;
  if (elements.statusMessage) elements.statusMessage.textContent = message;
  if (elements.progressBar) elements.progressBar.style.width = `${progress}%`;
}

function formatBytes(size) {
  if (!size) return '0 KB';
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function renderTechs(techs) {
  if (!elements.techList) return;

  elements.techList.innerHTML = '';
  if (!techs || techs.length === 0) {
    elements.techList.innerHTML = '<span class="tech-pill">HTML5</span>';
    return;
  }

  techs.forEach((tech) => {
    const chip = document.createElement('span');
    chip.className = 'tech-pill';
    chip.textContent = tech;
    elements.techList.appendChild(chip);
  });
  if (elements.techCount) elements.techCount.textContent = techs.length;
}

function renderGroups(files) {
  if (!elements.groupList) return;

  const groups = {};
  files.forEach((file) => {
    groups[file.type] = (groups[file.type] || 0) + 1;
  });

  const items = Object.entries(groups).map(([type, count]) => ({ type, count }));
  elements.groupList.innerHTML = '';
  items.forEach(({ type, count }) => {
    const pill = document.createElement('span');
    pill.className = 'group-pill';
    pill.innerHTML = `<span>${type.toUpperCase()}</span><strong>${count}</strong>`;
    elements.groupList.appendChild(pill);
  });

  if (elements.groupCount) elements.groupCount.textContent = items.length;
}

function updateStats({ fileCount, totalSize, technologies, url }) {
  if (elements.statFiles) elements.statFiles.textContent = fileCount;
  if (elements.statSize) elements.statSize.textContent = formatBytes(totalSize);
  if (elements.statTech) elements.statTech.textContent = technologies.length;
  if (elements.statUrl) elements.statUrl.textContent = new URL(url).hostname;
}

function renderFileList() {
  if (!elements.fileSearch) return;
  const query = elements.fileSearch.value.trim().toLowerCase();
  const matching = state.files.filter((file) => `${file.name} ${file.type} ${file.content || ''}`.toLowerCase().includes(query));
  state.filteredFiles = matching;
  if (!elements.fileList) return;
  elements.fileList.innerHTML = '';
  if (!matching.length) { elements.fileList.innerHTML = '<div class="viewer-empty"><p>No files match your search.</p></div>'; return; }

  const folders = new Map();
  matching.forEach((file) => {
    const parts = file.name.split('/').filter(Boolean);
    let current = folders;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts.slice(0, i + 1).join('/');
      if (!current.has(parts[i])) current.set(parts[i], { key, children: new Map(), files: [] });
      current = current.get(parts[i]).children;
    }
    const parentKey = parts.slice(0, -1).join('/');
    if (parentKey) {
      let node = folders;
      for (const part of parts.slice(0, -1)) node = node.get(part).children;
    }
  });

  const renderEntries = (prefix = '') => {
    const folderNames = new Set();
    matching.forEach((file) => {
      const parts = file.name.split('/').filter(Boolean);
      if (prefix) {
        if (!file.name.startsWith(prefix + '/')) return;
        const rest = file.name.slice(prefix.length + 1).split('/');
        if (rest.length > 1) folderNames.add(rest[0]);
      } else if (parts.length > 1) folderNames.add(parts[0]);
    });
    [...folderNames].sort().forEach((folder) => {
      const key = prefix ? `${prefix}/${folder}` : folder;
      const open = state.openFolders.has(key) || !!query;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'file-item folder-item';
      btn.style.marginLeft = `${prefix ? Math.min(prefix.split('/').length * 14, 70) : 0}px`;
      btn.innerHTML = `<div class="file-main"><span class="folder-toggle">${open ? '▼' : '▶'}</span><div class="file-meta"><span class="folder-name">${folder}</span><small>Folder</small></div></div>`;
      btn.addEventListener('click', () => { if (state.openFolders.has(key)) state.openFolders.delete(key); else state.openFolders.add(key); renderFileList(); });
      elements.fileList.appendChild(btn);
      if (open) renderEntries(key);
    });
    matching.filter((file) => {
      const dir = file.name.split('/').slice(0, -1).join('/'); return dir === prefix;
    }).sort((a,b)=>a.name.localeCompare(b.name)).forEach((file) => {
      const button = document.createElement('button'); button.type='button';
      button.style.marginLeft = `${prefix ? Math.min(prefix.split('/').length * 14, 70) : 0}px`;
      button.className=`file-item ${state.selectedFileId===file.id?'active':''} ${state.selectedIds.has(file.id)?'selected':''}`;
      button.innerHTML=`<div class="file-main"><span class="file-icon">${file.type.toUpperCase().slice(0,2)}</span><div class="file-meta"><span class="file-name">${file.name.split('/').pop()}</span><small>${file.type.toUpperCase()} • ${formatBytes(file.size||file.content?.length||0)}</small></div></div><span class="file-check"></span>`;
      button.addEventListener('click',(event)=>{ if(event.target.closest('.file-check')) { toggleSelect(file.id); return; } state.selectedFileId=file.id; renderViewer(file); renderFileList(); });
      elements.fileList.appendChild(button);
    });
  };
  renderEntries('');
}
function renderViewer(file) {
  if (!elements.viewer) return;

  if (!file) {
    elements.viewer.innerHTML = '<div class="viewer-empty"><p>Select a file to inspect its source code.</p></div>';
    return;
  }

  const isBinary = file.encoding === 'base64';
  const mime = file.contentType || 'application/octet-stream';
  const preview = isBinary && file.type === 'image'
    ? `<div class="binary-preview"><img src="data:${mime};base64,${file.content || ''}" alt="${escapeHtml(file.name)}" /></div>`
    : isBinary
      ? `<div class="viewer-empty"><p>Binary file preview is not available.</p></div>`
      : `<pre class="code-block">${escapeHtml(file.content || '')}</pre>`;

  elements.viewer.innerHTML = `
    <div class="viewer-header">
      <h4>${file.name}</h4>
      <div class="viewer-actions">
        ${isBinary ? '' : '<button type="button" data-action="copy">Copy</button>'}
        <button type="button" data-action="download">Download</button>
      </div>
    </div>
    ${preview}
  `;

  const copyBtn = elements.viewer.querySelector('[data-action="copy"]');
  const downloadBtn = elements.viewer.querySelector('[data-action="download"]');

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(file.content || '');
        copyBtn.textContent = 'Copied';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1400);
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const blob = file.encoding === 'base64' ? base64ToBlob(file.content || '', mime) : new Blob([file.content || ''], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.split('/').pop();
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}

function base64ToBlob(base64, mime) {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toggleSelect(fileId) {
  if (state.selectedIds.has(fileId)) {
    state.selectedIds.delete(fileId);
  } else {
    state.selectedIds.add(fileId);
  }
  renderFileList();
}

function selectAllFiles() {
  const ids = state.filteredFiles.map((file) => file.id);
  if (ids.length === 0) return;

  const allSelected = ids.every((id) => state.selectedIds.has(id));
  if (allSelected) {
    ids.forEach((id) => state.selectedIds.delete(id));
  } else {
    ids.forEach((id) => state.selectedIds.add(id));
  }
  renderFileList();
}

async function analyzeWebsite(url) {
  setStatus(8, 'Preparing extraction', 'Validating URL and preparing analysis pipeline...');

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || 'Unable to analyze this website.');
  }

  return payload.data;
}

function showProgressSequence() {
  const steps = [
    { progress: 18, title: 'Connecting to target URL', message: 'Checking public accessibility and resolving target website.' },
    { progress: 42, title: 'Fetching public source', message: 'Downloading HTML and referenced resources.' },
    { progress: 68, title: 'Parsing structure', message: 'Mapping project files, folders, and metadata.' },
    { progress: 86, title: 'Detecting technologies', message: 'Classifying frameworks, libraries, and stack signatures.' },
    { progress: 100, title: 'Analysis complete', message: 'Modeling the result set and preparing export.' }
  ];

  steps.forEach((step, index) => {
    setTimeout(() => {
      setStatus(step.progress, step.title, step.message);
    }, 250 * (index + 1));
  });
}

const HISTORY_KEY = 'xenzio-fetch-history-v1';
const HISTORY_TTL = 60 * 60 * 1000;
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').filter(item => Date.now() - item.createdAt < HISTORY_TTL); } catch (_) { return []; }
}
function saveHistory(data) {
  const list = getHistory().filter(item => item.url !== data.url);
  list.unshift({ url: data.url, fileCount: data.fileCount, createdAt: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
  renderHistory();
}
function renderHistory() {
  const list = getHistory();
  if (!list.length) localStorage.removeItem(HISTORY_KEY);
  if (elements.historyMeta) elements.historyMeta.textContent = 'Resets every 1 hour';
  if (!elements.historyList) return;
  elements.historyList.innerHTML = '';
  if (!list.length) { elements.historyList.innerHTML='<div class="viewer-empty"><p>No fetch history yet.</p></div>'; return; }
  list.forEach(item => {
    const button=document.createElement('button'); button.type='button'; button.className='history-item';
    button.innerHTML=`<span><strong>${escapeHtml(new URL(item.url).hostname)}</strong><small>${escapeHtml(item.url)} • ${item.fileCount} files</small></span><time>${new Date(item.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time>`;
    button.addEventListener('click',()=>{ elements.urlInput.value=item.url; elements.urlInput.focus(); });
    elements.historyList.appendChild(button);
  });
}
setInterval(renderHistory, 60 * 1000);

async function handleSubmit(event) {
  event.preventDefault();
  const url = elements.urlInput.value.trim();

  if (!url) {
    alert('The URL field is required.');
    return;
  }

  try {
    const checkUrl = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (`${checkUrl.hostname}${checkUrl.pathname}`.toLowerCase().includes('xenzio')) {
      showErrorModal('Maaf, website yang mengandung nama Xenzio tidak dapat di-fetch. Soalnya website atau halaman ini dilindungi oleh sistem Xenzio dan tidak boleh diproses melalui fitur fetch.');
      return;
    }
  } catch (_) {}

  try {
    showProgressSequence();
    const data = await analyzeWebsite(url);

    state.files = data.files || [];
    state.selectedFileId = state.files[0]?.id || null;
    state.selectedIds = new Set();
    elements.fileSearch.value = '';

    saveHistory(data);

    updateStats({
      fileCount: data.fileCount,
      totalSize: data.totalSize,
      technologies: data.technologies,
      url: data.url
    });

    renderTechs(data.technologies);
    renderGroups(state.files);
    renderFileList();
    const firstFile = state.filteredFiles[0] || null;
    renderViewer(firstFile || null);
    if (firstFile) {
      state.selectedFileId = firstFile.id;
      renderFileList();
    }

    setStatus(100, 'Analysis complete', `Found ${data.fileCount} files and ${data.technologies.length} technologies.`);
  } catch (error) {
    setStatus(0, 'Analysis failed', error.message || 'The URL could not be processed.');
    showErrorModal(error.message || 'The URL could not be processed.');
  }
}

async function downloadZip() {
  const selected = state.files.filter((file) => state.selectedIds.has(file.id));
  const payload = selected.length ? selected : state.files;

  if (!payload.length) {
    alert('No files available for ZIP export.');
    return;
  }

  const response = await fetch('/api/download-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: payload.map((file) => ({ name: file.name, content: file.content || '' })) })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'ZIP export failed.' }));
    alert(error.message || 'ZIP export failed.');
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fenc-all-code.zip';
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadSelected() {
  const selected = state.files.filter((file) => state.selectedIds.has(file.id));
  if (!selected.length) {
    alert('Select at least one file to download.');
    return;
  }

  selected.forEach((file) => {
    const blob = file.encoding === 'base64' ? base64ToBlob(file.content || '', file.contentType || 'application/octet-stream') : new Blob([file.content || ''], { type: file.contentType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name.split('/').pop();
    link.click();
    URL.revokeObjectURL(url);
  });
}

function bindEvents() {
  elements.form?.addEventListener('submit', handleSubmit);
  elements.fileSearch?.addEventListener('input', renderFileList);
  elements.selectAllBtn?.addEventListener('click', selectAllFiles);
  elements.downloadZipBtn?.addEventListener('click', downloadZip);
  elements.downloadSelectedBtn?.addEventListener('click', downloadSelected);
  elements.visitorForm?.addEventListener('submit', submitVisitor);
  elements.errorCloseBtn?.addEventListener('click', closeErrorModal);
}

bindEvents();
setStatus(0, 'Ready for analysis', 'Enter a public URL to begin source extraction.');
renderTechs([]);
renderGroups([]);
renderViewer(null);
renderFileList();

renderHistory();
loadVisitorWelcome();
