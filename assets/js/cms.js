// Portfolio CMS Scripting
let state = {
  token: localStorage.getItem('cms2_token') || '',
  username: 'ak-mohammad',
  repo: 'profile',
  branch: 'main',
  proxyUrl: 'https://github-auth-proxy-org.zaidkhan137782.workers.dev',
  posts: [],
  editingPost: null,
  workflowInterval: null
};

// DOM Nodes
const panels = {
  login: document.getElementById('panel-login'),
  dashboard: document.getElementById('panel-dashboard'),
  editor: document.getElementById('panel-editor')
};

const elements = {
  btnLogout: document.getElementById('btn-logout'),
  btnOAuthLogin: document.getElementById('btn-oauth-login'),
  
  btnNewPost: document.getElementById('btn-new-post'),
  postsLoading: document.getElementById('posts-loading'),
  postsEmpty: document.getElementById('posts-empty'),
  postsList: document.getElementById('posts-list'),
  
  editorPanelTitle: document.getElementById('editor-panel-title'),
  postHeadline: document.getElementById('post-headline'),
  postSubheadline: document.getElementById('post-subheadline'),
  postDate: document.getElementById('post-date'),
  postCategories: document.getElementById('post-categories'),
  postImage: document.getElementById('post-image'),
  postContent: document.getElementById('post-content'),
  postFilename: document.getElementById('post-filename'),
  previewRender: document.getElementById('preview-render'),
  btnEditorCancel: document.getElementById('btn-editor-cancel'),
  btnEditorPublish: document.getElementById('btn-editor-publish'),
  
  deploymentTracker: document.getElementById('deployment-tracker'),
  trackerText: document.getElementById('tracker-text'),
  trackerLink: document.getElementById('tracker-link'),
  toast: document.getElementById('toast')
};

// Startup
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Check URL parameters for OAuth authorization code redirect
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  
  if (code) {
    // Clear code from URL bar
    window.history.replaceState({}, document.title, window.location.pathname);
    await exchangeOAuthCode(code);
  } else if (state.token) {
    showPanel('dashboard');
    elements.btnLogout.classList.remove('hidden');
    await fetchPosts();
    startMonitoringWorkflow();
  } else {
    showPanel('login');
    elements.btnLogout.classList.add('hidden');
  }
});

function setupEventListeners() {
  // Navigation & Logout
  elements.btnLogout.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
    }
  });

  // OAuth Redirect
  elements.btnOAuthLogin.addEventListener('click', async () => {
    const clientId = 'Ov23liMqFfd1qv8S2Ha5'; // Registered Client ID
    const redirectUri = window.location.origin + window.location.pathname;
    
    // Generate PKCE code verifier and challenge
    const verifier = generateRandomString(64);
    localStorage.setItem('cms_code_verifier', verifier);
    const challenge = await generateChallenge(verifier);
    
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256`;
  });

  // Dashboard actions
  elements.btnNewPost.addEventListener('click', () => startEditorView());

  // Editor actions
  elements.btnEditorCancel.addEventListener('click', () => {
    if (confirm('Discard changes?')) {
      showPanel('dashboard');
    }
  });

  elements.btnEditorPublish.addEventListener('click', handlePublishPost);

  // Dynamic listeners
  elements.postHeadline.addEventListener('input', () => {
    if (!state.editingPost || !state.editingPost.sha) calcFilename();
    renderLivePreview();
  });
  elements.postDate.addEventListener('change', () => {
    if (!state.editingPost || !state.editingPost.sha) calcFilename();
    renderLivePreview();
  });
  elements.postSubheadline.addEventListener('input', renderLivePreview);
  elements.postImage.addEventListener('input', renderLivePreview);
  elements.postCategories.addEventListener('input', renderLivePreview);
  elements.postContent.addEventListener('input', renderLivePreview);
}

function showPanel(panelName) {
  Object.keys(panels).forEach(name => {
    if (name === panelName) {
      panels[name].classList.remove('hidden');
    } else {
      panels[name].classList.add('hidden');
    }
  });
}

function logout() {
  state.token = '';
  localStorage.removeItem('cms2_token');
  clearInterval(state.workflowInterval);
  elements.deploymentTracker.classList.add('hidden');
  elements.btnLogout.classList.add('hidden');
  showPanel('login');
}

// PKCE Helper Functions
function generateRandomString(length) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('').substring(0, length);
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
  let str = "";
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

// OAuth Code exchange via Public CORS Proxy (No secret required with PKCE)
async function exchangeOAuthCode(code) {
  showToast('Completing authorization...', 'info');
  const verifier = localStorage.getItem('cms_code_verifier');
  
  if (!verifier) {
    showToast('Authentication failed: PKCE code verifier is missing.', 'error');
    showPanel('login');
    return;
  }
  
  try {
    const clientId = 'Ov23liMqFfd1qv8S2Ha5';
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://github.com/login/oauth/access_token');
    
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        code: code,
        code_verifier: verifier
      })
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Failed to exchange token.');

    state.token = data.access_token;
    localStorage.setItem('cms2_token', state.token);
    localStorage.removeItem('cms_code_verifier');
    
    showToast('Signed in with GitHub!', 'success');
    showPanel('dashboard');
    elements.btnLogout.classList.remove('hidden');
    await fetchPosts();
    startMonitoringWorkflow();
  } catch (err) {
    showToast(err.message, 'error');
    showPanel('login');
  }
}

// Fetch files in _posts/
async function fetchPosts() {
  elements.postsLoading.classList.remove('hidden');
  elements.postsEmpty.classList.add('hidden');
  elements.postsList.classList.add('hidden');

  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts?ref=${state.branch}`, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) {
      elements.postsLoading.classList.add('hidden');
      elements.postsEmpty.classList.remove('hidden');
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const files = await res.json();
    state.posts = files.filter(f => f.name.endsWith('.md') || f.name.endsWith('.markdown'));
    state.posts.sort((a, b) => b.name.localeCompare(a.name));

    elements.postsLoading.classList.add('hidden');
    if (state.posts.length === 0) {
      elements.postsEmpty.classList.remove('hidden');
    } else {
      renderPosts();
    }
  } catch (err) {
    elements.postsLoading.classList.add('hidden');
    elements.postsEmpty.classList.remove('hidden');
    elements.postsEmpty.querySelector('p').textContent = `Loading failed: ${err.message}`;
  }
}

function renderPosts() {
  elements.postsList.innerHTML = '';
  elements.postsList.classList.remove('hidden');

  state.posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'glass-panel post-card';
    card.style.padding = '1.5rem';
    
    const dateMatch = post.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    const dateStr = dateMatch ? dateMatch[1] : '';
    const rawTitle = dateMatch ? dateMatch[2].replace(/-/g, ' ') : post.name;
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    card.innerHTML = `
      <div>
        <span class="post-card-date">${dateStr || 'Draft'}</span>
        <h3 class="post-card-title">${title}</h3>
        <p class="post-card-desc" style="font-size: 0.8rem; font-family: monospace; color: var(--text-muted);">${post.name}</p>
      </div>
      <div class="post-card-actions">
        <button class="btn btn-secondary btn-edit" data-name="${post.name}">Edit</button>
        <button class="btn btn-danger btn-delete" data-name="${post.name}" data-sha="${post.sha}">Delete</button>
      </div>
    `;

    card.querySelector('.btn-edit').addEventListener('click', () => editPost(post.name));
    card.querySelector('.btn-delete').addEventListener('click', () => deletePost(post.name, post.sha));

    elements.postsList.appendChild(card);
  });
}

async function editPost(filename) {
  showToast('Reading file contents...', 'info');
  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts/${filename}?ref=${state.branch}`, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const content = atob(data.content.replace(/\s/g, ''));

    startEditorView({
      filename: data.name,
      sha: data.sha,
      content: content
    });
  } catch (err) {
    showToast(`Fetch failed: ${err.message}`, 'error');
  }
}

async function deletePost(filename, sha) {
  if (!confirm(`Permanently delete "${filename}" from the repository?`)) return;

  showToast('Deleting post...', 'info');
  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts/${filename}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `CMS: Remove ${filename}`,
        sha: sha,
        branch: state.branch
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast('File deleted successfully!', 'success');
    await fetchPosts();
    triggerWorkflowCheck();
  } catch (err) {
    showToast(`Deletion failed: ${err.message}`, 'error');
  }
}

function startEditorView(postData = null) {
  showPanel('editor');

  if (postData) {
    state.editingPost = postData;
    elements.editorPanelTitle.textContent = 'Edit Article';
    elements.postFilename.disabled = true;

    const parsed = parseJekyllFrontMatter(postData.content);
    elements.postHeadline.value = parsed.title || '';
    elements.postSubheadline.value = parsed.subtitle || parsed.description || '';
    elements.postDate.value = parsed.date || new Date().toISOString().split('T')[0];
    elements.postCategories.value = parsed.categories ? parsed.categories.join(', ') : '';
    elements.postImage.value = parsed.image || '';
    elements.postContent.value = parsed.body || '';
    elements.postFilename.value = postData.filename;
  } else {
    state.editingPost = { filename: '', content: '', sha: null };
    elements.editorPanelTitle.textContent = 'New Article';
    elements.postFilename.disabled = false;

    elements.postHeadline.value = '';
    elements.postSubheadline.value = '';
    elements.postDate.value = new Date().toISOString().split('T')[0];
    elements.postCategories.value = 'marketing, digital';
    elements.postImage.value = '';
    elements.postContent.value = `Write content in Markdown...`;
    calcFilename();
  }
  
  renderLivePreview();
}

function calcFilename() {
  const date = elements.postDate.value;
  const headline = elements.postHeadline.value.trim();
  if (!date) return;
  
  let slug = 'draft';
  if (headline) {
    slug = headline
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  elements.postFilename.value = `${date}-${slug}.md`;
}

function renderLivePreview() {
  const title = elements.postHeadline.value || 'Headline';
  const sub = elements.postSubheadline.value || '';
  const date = elements.postDate.value || new Date().toISOString().split('T')[0];
  const image = elements.postImage.value || '';
  const categories = elements.postCategories.value;
  const content = elements.postContent.value;

  const formattedDate = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let headerHtml = `
    <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem; margin-bottom: 2rem;">
      <span style="color: var(--secondary); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${formattedDate}</span>
      <h1 style="font-size: 2.25rem; color: var(--text-primary); margin-top: 0.5rem; line-height: 1.25;">${title}</h1>
      ${sub ? `<p style="font-size: 1.15rem; color: var(--text-secondary); font-style: italic; margin-top: 0.5rem;">${sub}</p>` : ''}
      ${image ? `<img src="${image}" alt="Banner" style="width: 100%; border-radius: var(--border-radius-md); margin-top: 1.5rem; border: 1px solid var(--border-color);" onerror="this.style.display='none'">` : ''}
      ${categories ? `<div style="margin-top: 1.25rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${categories.split(',').map(c => `<span style="background: rgba(255,255,255,0.05); font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 50px; border: 1px solid var(--border-color); color: var(--text-muted);">${c.trim()}</span>`).join('')}
      </div>` : ''}
    </div>
  `;

  let renderedBody = '';
  if (typeof marked !== 'undefined') {
    renderedBody = marked.parse(content);
  } else {
    renderedBody = `<pre style="white-space: pre-wrap;">${content}</pre>`;
  }

  elements.previewRender.innerHTML = headerHtml + renderedBody;
}

// Publish post back to profile repo
async function handlePublishPost() {
  const headline = elements.postHeadline.value.trim();
  const date = elements.postDate.value;
  const filename = elements.postFilename.value.trim();
  const content = elements.postContent.value.trim();

  if (!headline || !date || !filename || !content) {
    showToast('Please fill out all required fields.', 'error');
    return;
  }

  elements.btnEditorPublish.disabled = true;
  showToast('Committing post to GitHub profile...', 'info');

  try {
    const md = buildJekyllMarkdown();
    const isUpdate = !!(state.editingPost && state.editingPost.sha);

    const body = {
      message: `CMS: ${isUpdate ? 'Update' : 'Create'} ${filename}`,
      content: btoa(unescape(encodeURIComponent(md))),
      branch: state.branch
    };

    if (isUpdate) body.sha = state.editingPost.sha;

    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    showToast('Post published successfully!', 'success');
    showPanel('dashboard');
    await fetchPosts();
    triggerWorkflowCheck();
  } catch (err) {
    showToast(`Publish failed: ${err.message}`, 'error');
  } finally {
    elements.btnEditorPublish.disabled = false;
  }
}

function buildJekyllMarkdown() {
  const title = elements.postHeadline.value.trim();
  const subtitle = elements.postSubheadline.value.trim();
  const date = elements.postDate.value;
  const image = elements.postImage.value.trim();
  const rawCats = elements.postCategories.value.split(',');
  const categories = rawCats.map(c => c.trim()).filter(c => c !== '');
  const body = elements.postContent.value;

  let md = '---\n';
  md += 'layout: post\n';
  md += `title: "${title.replace(/"/g, '\\"')}"\n`;
  if (subtitle) md += `subtitle: "${subtitle.replace(/"/g, '\\"')}"\n`;
  md += `date: ${date} 12:00:00 +0530\n`;
  if (image) md += `image: "${image}"\n`;
  if (categories.length > 0) md += `categories: [${categories.join(', ')}]\n`;
  md += '---\n\n';
  
  return md + body;
}

function parseJekyllFrontMatter(fullText) {
  const result = { title: '', subtitle: '', date: '', categories: [], image: '', body: '' };
  if (!fullText.startsWith('---\n')) {
    result.body = fullText;
    return result;
  }
  const parts = fullText.split('---\n');
  if (parts.length < 3) {
    result.body = fullText;
    return result;
  }
  result.body = parts.slice(2).join('---\n').trim();
  const fmLines = parts[1].split('\n');

  fmLines.forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);

    if (key === 'title') result.title = val;
    else if (key === 'subtitle' || key === 'description') result.subtitle = val;
    else if (key === 'image') result.image = val;
    else if (key === 'date') {
      const match = val.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) result.date = match[0];
    }
    else if (key === 'categories') {
      const arrayMatch = val.match(/\[(.*)\]/);
      if (arrayMatch) {
        result.categories = arrayMatch[1].split(',').map(c => c.trim());
      } else {
        result.categories = val.split(',').map(c => c.trim());
      }
    }
  });

  return result;
}

// Workflow Monitoring (for profile repo)
function startMonitoringWorkflow() {
  triggerWorkflowCheck();
  clearInterval(state.workflowInterval);
  state.workflowInterval = setInterval(triggerWorkflowCheck, 10000);
}

async function triggerWorkflowCheck() {
  if (!state.token || !state.username || !state.repo) return;

  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/actions/runs?per_page=5&branch=${state.branch}`, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) return;
    const data = await res.json();
    const runs = data.workflow_runs || [];

    if (runs.length === 0) {
      elements.deploymentTracker.classList.add('hidden');
      return;
    }

    const latest = runs[0];
    elements.deploymentTracker.classList.remove('hidden');

    const siteUrl = `https://${state.username}.github.io/${state.repo}`;
    elements.trackerLink.href = siteUrl;

    if (latest.status === 'queued' || latest.status === 'in_progress') {
      elements.deploymentTracker.className = 'tracker-panel building';
      elements.trackerText.textContent = 'Building Jekyll site...';
      elements.trackerLink.classList.add('hidden');
    } else if (latest.status === 'completed') {
      if (latest.conclusion === 'success') {
        elements.deploymentTracker.className = 'tracker-panel success';
        
        const duration = Math.floor((new Date() - new Date(latest.completed_at)) / 1000);
        let timeText = 'just now';
        if (duration >= 60) {
          const mins = Math.floor(duration / 60);
          timeText = `${mins}m ago`;
        }
        elements.trackerText.textContent = `Portfolio is Live! (Built ${timeText})`;
        elements.trackerLink.classList.remove('hidden');
      } else {
        elements.deploymentTracker.className = 'tracker-panel failed';
        elements.trackerText.textContent = 'Last Jekyll build failed.';
        elements.trackerLink.classList.add('hidden');
      }
    }
  } catch (e) {
    elements.deploymentTracker.classList.add('hidden');
  }
}

// Toast alerts
let toastTimeout;
function showToast(message, type = 'success') {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');

  toastTimeout = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 4000);
}
