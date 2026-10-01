import rmaekersData from './data/rmaekers.json';
import rrproductionsData from './data/rrproductions.json';
import maupData from './data/maup.json';
import vaguelyvulgarData from './data/vaguelyvulgar.json';
import manifest from './data/manifest.json';

const PORTFOLIOS = {
  rmaekers: rmaekersData,
  rrproductions: rrproductionsData,
  maup: maupData,
  vaguelyvulgar: vaguelyvulgarData
};

const HERO_BADGES = {
  rmaekers: 'Festival Decors & Stage Builds',
  rrproductions: 'Fine Art, Sculptures & Inventions',
  maup: 'Bespoke Adaptive Furniture',
  vaguelyvulgar: 'Theatrical Performance & Acting'
};

// State
let currentPortfolioKey = 'rmaekers';
let currentCategory = 'All';
let searchQuery = '';
let currentLightboxImages = [];
let currentLightboxIndex = 0;

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const heroBadge = document.getElementById('hero-badge');
const heroTitle = document.getElementById('hero-title');
const heroSubtitle = document.getElementById('hero-subtitle');
const metaPosts = document.getElementById('meta-posts');
const metaMedia = document.getElementById('meta-media');
const searchInput = document.getElementById('search-input');
const categoriesContainer = document.getElementById('categories-container');
const projectsGrid = document.getElementById('projects-grid');
const emptyState = document.getElementById('empty-state');
const btnResetFilters = document.getElementById('btn-reset-filters');

// Modal Elements
const modalBackdrop = document.getElementById('modal-backdrop');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalBody = document.getElementById('modal-body');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
const lightboxPrevBtn = document.getElementById('lightbox-prev-btn');
const lightboxNextBtn = document.getElementById('lightbox-next-btn');

// Initialize Counts in Tabs
Object.keys(manifest).forEach((key) => {
  const el = document.getElementById(`count-${key}`);
  if (el && manifest[key]) {
    el.textContent = manifest[key].post_count || manifest[key].media_count || '0';
  }
});

// Format dates (e.g. 2016-05-24 -> May 2016)
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr.split(' ')[0] || '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

// Switch Active Portfolio
function switchPortfolio(key) {
  if (!PORTFOLIOS[key]) return;
  currentPortfolioKey = key;
  currentCategory = 'All';
  searchQuery = '';
  if (searchInput) searchInput.value = '';

  // Update tabs
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.portfolio === key;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const p = PORTFOLIOS[key];

  // Update Hero
  if (heroBadge) heroBadge.textContent = HERO_BADGES[key] || 'Portfolio Archive';
  if (heroTitle) heroTitle.textContent = p.name || p.title;
  if (heroSubtitle) heroSubtitle.textContent = p.subtitle || '';
  if (metaPosts) metaPosts.textContent = p.post_count || (p.standalone_media ? p.standalone_media.length : 0);
  if (metaMedia) metaMedia.textContent = p.media_count || 0;

  // Build Categories
  buildCategoryChips(p);

  // Render Grid
  renderGrid();

  // Update URL hash
  window.location.hash = key;
}

// Build Category Filter Chips
function buildCategoryChips(portfolio) {
  if (!categoriesContainer) return;
  categoriesContainer.innerHTML = '';

  const catSet = new Set();
  (portfolio.posts || []).forEach((post) => {
    (post.categories || []).forEach((c) => catSet.add(c));
  });

  const categories = ['All', ...Array.from(catSet).sort()];

  // Only render if more than just "All"
  if (categories.length <= 1) {
    categoriesContainer.style.display = 'none';
    return;
  }
  categoriesContainer.style.display = 'flex';

  categories.forEach((cat) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip-btn ${cat === currentCategory ? 'active' : ''}`;
    chip.textContent = cat;
    chip.addEventListener('click', () => {
      currentCategory = cat;
      document.querySelectorAll('.chip-btn').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderGrid();
    });
    categoriesContainer.appendChild(chip);
  });
}

// Render Project Grid
function renderGrid() {
  if (!projectsGrid) return;
  projectsGrid.innerHTML = '';

  const p = PORTFOLIOS[currentPortfolioKey];
  let items = p.posts || [];

  // If portfolio has standalone media without posts (like Vaguely Vulgar)
  if (items.length === 0 && p.standalone_media && p.standalone_media.length > 0) {
    renderStandaloneMedia(p.standalone_media);
    return;
  }

  // Filter by category
  if (currentCategory !== 'All') {
    items = items.filter((item) => (item.categories || []).includes(currentCategory));
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    items = items.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      (item.excerpt && item.excerpt.toLowerCase().includes(q)) ||
      (item.categories && item.categories.some((c) => c.toLowerCase().includes(q))) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }

  if (items.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View project details for ${item.title}`);

    const coverImg = item.featured_image || (item.images && item.images.length > 0 ? item.images[0] : null);
    const photoCount = (item.images && item.images.length) || 0;
    const dateFormatted = formatDate(item.date);

    card.innerHTML = `
      <div class="card-media">
        ${coverImg
          ? `<img class="card-img" src="${coverImg}" alt="${item.title}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'card-placeholder\\'>🎨</div>';">`
          : `<div class="card-placeholder">🎪</div>`
        }
        ${photoCount > 0 ? `
          <span class="card-photo-count">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>
            ${photoCount}
          </span>
        ` : ''}
      </div>
      <div class="card-content">
        <div class="card-meta">
          <span>${dateFormatted}</span>
          ${item.categories && item.categories.length > 0 ? `<span>&bull; ${item.categories[0]}</span>` : ''}
        </div>
        <h2 class="card-title">${item.title}</h2>
        <p class="card-excerpt">${item.excerpt || ''}</p>
        <div class="card-tags">
          ${(item.categories || []).map((cat) => `<span class="card-tag">${cat}</span>`).join('')}
          ${(item.tags || []).slice(0, 3).map((tag) => `<span class="card-tag">#${tag}</span>`).join('')}
        </div>
      </div>
    `;

    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(item);
      }
    });

    projectsGrid.appendChild(card);
  });
}

// Render Standalone Media (e.g. Vaguely Vulgar)
function renderStandaloneMedia(mediaList) {
  if (emptyState) emptyState.style.display = 'none';

  mediaList.forEach((media, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View photo ${media.title}`);

    card.innerHTML = `
      <div class="card-media">
        <img class="card-img" src="${media.url}" alt="${media.title}" loading="lazy">
      </div>
      <div class="card-content">
        <h2 class="card-title" style="font-size: 1.1rem; margin: 0;">${media.title}</h2>
      </div>
    `;

    card.addEventListener('click', () => {
      openLightbox(mediaList.map((m) => m.url), idx);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(mediaList.map((m) => m.url), idx);
      }
    });

    projectsGrid.appendChild(card);
  });
}

// Open Project Detail Modal
function openModal(project) {
  if (!modalBody || !modalBackdrop) return;

  const dateFormatted = formatDate(project.date);
  const images = project.images || [];

  modalBody.innerHTML = `
    <header class="modal-header">
      <div class="modal-meta">
        <span>${dateFormatted}</span>
        ${project.categories && project.categories.length > 0 ? `<span>&bull; ${project.categories.join(', ')}</span>` : ''}
      </div>
      <h2 class="modal-title" id="modal-title">${project.title}</h2>
      ${project.tags && project.tags.length > 0 ? `
        <div class="card-tags" style="margin-top: 0.5rem;">
          ${project.tags.map((t) => `<span class="card-tag">#${t}</span>`).join('')}
        </div>
      ` : ''}
    </header>

    ${project.content ? `
      <div class="modal-body-text">
        ${project.content}
      </div>
    ` : ''}

    ${images.length > 0 ? `
      <div class="modal-gallery-section">
        <h3 class="modal-gallery-title">Project Gallery (${images.length} Photographs)</h3>
        <div class="modal-gallery-grid">
          ${images.map((imgUrl, i) => `
            <div class="gallery-thumb" data-index="${i}">
              <img src="${imgUrl}" alt="${project.title} photo ${i + 1}" loading="lazy">
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  // Attach lightbox clicks to thumbnails
  modalBody.querySelectorAll('.gallery-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const idx = parseInt(thumb.dataset.index, 10);
      openLightbox(images, idx);
    });
  });

  modalBackdrop.classList.add('open');
  modalBackdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!modalBackdrop) return;
  modalBackdrop.classList.remove('open');
  modalBackdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Lightbox Controls
function openLightbox(images, index = 0) {
  if (!images || images.length === 0 || !lightbox) return;
  currentLightboxImages = images;
  currentLightboxIndex = index;
  updateLightbox();
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
}

function updateLightbox() {
  if (!lightboxImg) return;
  const currentUrl = currentLightboxImages[currentLightboxIndex];
  lightboxImg.src = currentUrl;
  if (lightboxCaption) {
    lightboxCaption.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
  }
}

function prevLightbox() {
  if (currentLightboxImages.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
  updateLightbox();
}

function nextLightbox() {
  if (currentLightboxImages.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
  updateLightbox();
}

// Event Listeners
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchPortfolio(btn.dataset.portfolio));
});

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderGrid();
  });
}

if (btnResetFilters) {
  btnResetFilters.addEventListener('click', () => {
    currentCategory = 'All';
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.chip-btn').forEach((c, idx) => c.classList.toggle('active', idx === 0));
    renderGrid();
  });
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (modalBackdrop) {
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
}

if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
if (lightboxPrevBtn) lightboxPrevBtn.addEventListener('click', prevLightbox);
if (lightboxNextBtn) lightboxNextBtn.addEventListener('click', nextLightbox);
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-stage')) {
      closeLightbox();
    }
  });
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (lightbox && lightbox.classList.contains('open')) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') prevLightbox();
    else if (e.key === 'ArrowRight') nextLightbox();
  } else if (modalBackdrop && modalBackdrop.classList.contains('open')) {
    if (e.key === 'Escape') closeModal();
  }
});

// Hash routing on initial load and navigation
function handleHashRoute() {
  const hash = window.location.hash.replace('#', '');
  if (hash && PORTFOLIOS[hash]) {
    if (hash !== currentPortfolioKey) {
      switchPortfolio(hash);
    }
  } else if (!window.location.hash) {
    switchPortfolio('rmaekers');
  }
}

window.addEventListener('DOMContentLoaded', handleHashRoute);
window.addEventListener('hashchange', handleHashRoute);

