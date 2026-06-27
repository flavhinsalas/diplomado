/* ============================================================
   PROMPT MANAGER — Frontend Application Logic
   ============================================================
   SPA que se conecta a Google Sheets vía Google Apps Script.
   ============================================================ */

(function () {
  'use strict';

  // =====================================================
  // =====================================================
  const API_URL = 'https://script.google.com/macros/s/AKfycbw4FX7668jbnUkIk7abCR4-QfHPNd9CN6WonMEGhC-54lhpcKDBdGeU1HRTL97fJtImUg/exec'; // ← URL de la Web App publicada

  // =====================================================
  // STATE
  // =====================================================
  let allPrompts = [];
  let categorias = [];
  let activeCategory = 'all';
  let currentView = 'grid'; // 'grid' | 'list'
  let editingPrompt = null;   // prompt actualmente en edición
  let deletingPrompt = null;  // prompt a eliminar
  let detailPrompt = null;   // prompt en vista de detalle

  // =====================================================
  // DOM REFS
  // =====================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const elGrid = $('#promptGrid');
  const elEmpty = $('#emptyState');
  const elLoading = $('#loadingState');
  const elContentTitle = $('#contentTitle');
  const elContentCount = $('#contentCount');
  const elCategoryList = $('#categoryList');
  const elSearchInput = $('#searchInput');
  const elCountAll = $('#countAll');
  const elBtnLoadSamples = $('#btnLoadSamples');

  // Theme
  const elThemeToggle = $('#themeToggle');

  // Modal create/edit
  const elModalOverlay = $('#modalOverlay');
  const elModalTitle = $('#modalTitle');
  const elForm = $('#promptForm');
  const elPromptId = $('#promptId');
  const elCategoria = $('#inputCategoria');
  const elNombre = $('#inputNombre');
  const elPrompt = $('#inputPrompt');
  const elEjemplos = $('#inputEjemplos');
  const elBtnSubmit = $('#btnSubmit');
  const elBtnSubmitText = elBtnSubmit.querySelector('.btn-text');
  const elBtnSubmitLoader = elBtnSubmit.querySelector('.btn-loader');
  const elSuggestions = $('#categoriaSuggestions');

  // Modal delete
  const elDeleteOverlay = $('#deleteOverlay');
  const elDeleteName = $('#deletePromptName');
  const elBtnConfirmDel = $('#btnConfirmDelete');

  // Detail modal
  const elDetailOverlay = $('#detailOverlay');
  const elDetailTitle = $('#detailTitle');
  const elDetailCat = $('#detailCategoria');
  const elDetailNombre = $('#detailNombre');
  const elDetailPrompt = $('#detailPrompt');
  const elDetailEjemplos = $('#detailEjemplos');
  const elDetailEjSec = $('#detailEjemplosSection');

  // Views
  const elBtnGrid = $('#btnGrid');
  const elBtnList = $('#btnList');

  // Toast
  const elToastContainer = $('#toastContainer');

  // =====================================================
  // THEME
  // =====================================================
  function initTheme() {
    const saved = localStorage.getItem('pm-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pm-theme', next);
  }

  // =====================================================
  // TOAST
  // =====================================================
  function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    elToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
  }

  // =====================================================
  // API
  // =====================================================
  function checkConfig() {
    if (!API_URL || API_URL.trim() === '') {
      elLoading.classList.add('hidden');
      elEmpty.classList.remove('hidden');
      elEmpty.innerHTML = `
        <div class="empty-icon">⚙️</div>
        <h3>Configuración Requerida</h3>
        <p>Abre <strong>app.js</strong> y pega la URL de tu Google Apps Script Web App en la variable <code>API_URL</code> (línea 11).</p>
        <br>
        <p style="font-size:0.8rem;color:var(--text-tertiary)">Consulta el archivo <strong>README.md</strong> para instrucciones detalladas.</p>
      `;
      return false;
    }
    return true;
  }

  async function fetchPrompts() {
    if (!checkConfig()) return;

    try {
      showLoading(true);
      const res = await fetch(API_URL);
      const json = await res.json();

      if (json.success) {
        allPrompts = json.data || [];
        categorias = json.categorias || [];
        renderCategories();
        renderPrompts();
      } else {
        showToast('Error al cargar: ' + (json.error || 'desconocido'), 'error');
      }
    } catch (err) {
      showToast('No se pudo conectar con la API. Verifica la URL.', 'error');
      console.error(err);
    } finally {
      showLoading(false);
    }
  }

  async function apiPost(body) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    return await res.json();
  }

  // =====================================================
  // RENDER — CATEGORIES
  // =====================================================
  const CATEGORY_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#a855f7', '#e11d48'
  ];

  function getCategoryColor(idx) {
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
  }

  function renderCategories() {
    // Keep the "Todas" item
    const allItem = elCategoryList.querySelector('[data-category="all"]');
    // Remove dynamic items
    elCategoryList.querySelectorAll('.category-item:not([data-category="all"])').forEach(el => el.remove());

    elCountAll.textContent = allPrompts.length;

    categorias.forEach((cat, idx) => {
      const count = allPrompts.filter(p => p.categoria === cat).length;
      const li = document.createElement('li');
      li.className = 'category-item' + (activeCategory === cat ? ' active' : '');
      li.dataset.category = cat;
      li.innerHTML = `
        <span class="cat-dot" style="background:${getCategoryColor(idx)}"></span>
        ${escapeHtml(cat)}
        <span class="cat-count">${count}</span>
      `;
      li.addEventListener('click', () => selectCategory(cat));
      elCategoryList.appendChild(li);
    });

    // Update "Todas" active
    if (activeCategory === 'all') {
      allItem.classList.add('active');
    } else {
      allItem.classList.remove('active');
    }

    // Category suggestions for form datalist
    elSuggestions.innerHTML = categorias.map(c => `<option value="${escapeHtml(c)}">`).join('');
  }

  function selectCategory(cat) {
    activeCategory = cat;
    // Update active UI
    elCategoryList.querySelectorAll('.category-item').forEach(el => {
      el.classList.toggle('active', el.dataset.category === cat);
    });
    elContentTitle.textContent = cat === 'all' ? 'Todos los Prompts' : cat;
    renderPrompts();
  }

  // =====================================================
  // RENDER — PROMPT CARDS
  // =====================================================
  function getFilteredPrompts() {
    let filtered = allPrompts;

    // Category filter
    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.categoria === activeCategory);
    }

    // Search filter
    const query = elSearchInput.value.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(p =>
        p.nombrePrompt.toLowerCase().includes(query) ||
        p.prompt.toLowerCase().includes(query) ||
        p.categoria.toLowerCase().includes(query) ||
        p.ejemplos.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  function renderPrompts() {
    const filtered = getFilteredPrompts();
    elGrid.innerHTML = '';

    if (filtered.length === 0) {
      elEmpty.classList.remove('hidden');
      elGrid.style.display = 'none';
    } else {
      elEmpty.classList.add('hidden');
      elGrid.style.display = '';
    }

    elContentCount.textContent = `${filtered.length} prompt${filtered.length !== 1 ? 's' : ''}`;

    filtered.forEach(p => {
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.addEventListener('click', (e) => {
        // Don't open detail if clicking action buttons
        if (e.target.closest('.card-action-btn') || e.target.closest('.card-copy-btn')) return;
        openDetail(p);
      });

      card.innerHTML = `
        <div class="card-top">
          <span class="card-badge">${escapeHtml(p.categoria)}</span>
          <div class="card-actions">
            <button class="card-action-btn" title="Editar" data-action="edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="card-action-btn danger" title="Eliminar" data-action="delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <h3 class="card-title">${escapeHtml(p.nombrePrompt)}</h3>
        <p class="card-prompt">${escapeHtml(p.prompt)}</p>
        <div class="card-footer">
          <span class="card-examples-tag">
            ${p.ejemplos ? '📝 Tiene ejemplos' : ''}
          </span>
          <button class="card-copy-btn" title="Copiar prompt">Copiar</button>
        </div>
      `;

      // Action listeners
      card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(p);
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(p);
      });
      card.querySelector('.card-copy-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(p.prompt);
      });

      elGrid.appendChild(card);
    });
  }

  // =====================================================
  // MODAL — CREATE / EDIT
  // =====================================================
  function openCreateModal() {
    editingPrompt = null;
    elModalTitle.textContent = 'Nuevo Prompt';
    elBtnSubmitText.textContent = 'Guardar Prompt';
    elPromptId.value = '';
    elForm.reset();
    elModalOverlay.classList.remove('hidden');
    elCategoria.focus();
  }

  function openEditModal(p) {
    editingPrompt = p;
    elModalTitle.textContent = 'Editar Prompt';
    elBtnSubmitText.textContent = 'Actualizar Prompt';
    elPromptId.value = p.id;
    elCategoria.value = p.categoria;
    elNombre.value = p.nombrePrompt;
    elPrompt.value = p.prompt;
    elEjemplos.value = p.ejemplos;
    elModalOverlay.classList.remove('hidden');
    elCategoria.focus();
  }

  function closeModal() {
    elModalOverlay.classList.add('hidden');
    editingPrompt = null;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const body = {
      categoria: elCategoria.value.trim(),
      nombrePrompt: elNombre.value.trim(),
      prompt: elPrompt.value.trim(),
      ejemplos: elEjemplos.value.trim()
    };

    if (!body.categoria || !body.nombrePrompt || !body.prompt) {
      showToast('Completa todos los campos obligatorios.', 'error');
      return;
    }

    setSubmitLoading(true);

    try {
      let json;
      if (editingPrompt) {
        body.action = 'update';
        body.id = editingPrompt.id;
        json = await apiPost(body);
        showToast('Prompt actualizado exitosamente.', 'success');
      } else {
        body.action = 'create';
        json = await apiPost(body);
        showToast('Prompt creado exitosamente.', 'success');
      }

      closeModal();
      await fetchPrompts();
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  }

  function setSubmitLoading(loading) {
    elBtnSubmit.disabled = loading;
    elBtnSubmitText.classList.toggle('hidden', loading);
    elBtnSubmitLoader.classList.toggle('hidden', !loading);
  }

  // =====================================================
  // MODAL — DELETE
  // =====================================================
  function openDeleteModal(p) {
    deletingPrompt = p;
    elDeleteName.textContent = p.nombrePrompt;
    elDeleteOverlay.classList.remove('hidden');
  }

  function closeDeleteModal() {
    elDeleteOverlay.classList.add('hidden');
    deletingPrompt = null;
  }

  async function handleDelete() {
    if (!deletingPrompt) return;

    const delLoader = elBtnConfirmDel.querySelector('.btn-loader');
    const delText = elBtnConfirmDel.querySelector('.btn-text');
    elBtnConfirmDel.disabled = true;
    delText.classList.add('hidden');
    delLoader.classList.remove('hidden');

    try {
      await apiPost({ action: 'delete', id: deletingPrompt.id });
      showToast('Prompt eliminado.', 'success');
      closeDeleteModal();
      // Also close detail if open
      closeDetailModal();
      await fetchPrompts();
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    } finally {
      elBtnConfirmDel.disabled = false;
      delText.classList.remove('hidden');
      delLoader.classList.add('hidden');
    }
  }

  // =====================================================
  // SEED DATA
  // =====================================================
  async function handleSeedData() {
    if (!elBtnLoadSamples) return;

    const seedLoader = elBtnLoadSamples.querySelector('.btn-loader');
    const seedText = elBtnLoadSamples.querySelector('.btn-text');

    elBtnLoadSamples.disabled = true;
    if (seedText) seedText.classList.add('hidden');
    if (seedLoader) seedLoader.classList.remove('hidden');

    try {
      const json = await apiPost({ action: 'seed' });
      if (json.success) {
        showToast(json.message || 'Datos de ejemplo cargados con éxito.', 'success');
        await fetchPrompts();
      } else {
        showToast(json.error || 'No se pudieron cargar los datos.', 'error');
      }
    } catch (err) {
      showToast('Error al conectar con el backend: ' + err.message, 'error');
      console.error(err);
    } finally {
      elBtnLoadSamples.disabled = false;
      if (seedText) seedText.classList.remove('hidden');
      if (seedLoader) seedLoader.classList.add('hidden');
    }
  }

  // =====================================================
  // MODAL — DETAIL VIEW
  // =====================================================
  function openDetail(p) {
    detailPrompt = p;
    elDetailTitle.textContent = 'Detalle del Prompt';
    elDetailCat.textContent = p.categoria;
    elDetailNombre.textContent = p.nombrePrompt;
    elDetailPrompt.textContent = p.prompt;

    if (p.ejemplos) {
      elDetailEjSec.style.display = '';
      elDetailEjemplos.textContent = p.ejemplos;
    } else {
      elDetailEjSec.style.display = 'none';
    }

    elDetailOverlay.classList.remove('hidden');
  }

  function closeDetailModal() {
    elDetailOverlay.classList.add('hidden');
    detailPrompt = null;
  }

  // =====================================================
  // UTILITIES
  // =====================================================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Prompt copiado al portapapeles.', 'success');
      });
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Prompt copiado al portapapeles.', 'success');
    }
  }

  function showLoading(show) {
    elLoading.classList.toggle('hidden', !show);
    if (show) {
      elGrid.style.display = 'none';
      elEmpty.classList.add('hidden');
    }
  }

  // =====================================================
  // VIEW TOGGLE
  // =====================================================
  function setView(view) {
    currentView = view;
    elGrid.classList.toggle('list-view', view === 'list');
    elBtnGrid.classList.toggle('active', view === 'grid');
    elBtnList.classList.toggle('active', view === 'list');
  }

  // =====================================================
  // EVENT LISTENERS
  // =====================================================
  function bindEvents() {
    // Theme
    elThemeToggle.addEventListener('click', toggleTheme);

    // Create
    $('#btnNuevoPrompt').addEventListener('click', openCreateModal);

    // Form
    elForm.addEventListener('submit', handleFormSubmit);

    // Seed Data
    if (elBtnLoadSamples) {
      elBtnLoadSamples.addEventListener('click', handleSeedData);
    }

    // Close modals
    $('#btnCloseModal').addEventListener('click', closeModal);
    $('#btnCancelModal').addEventListener('click', closeModal);
    elModalOverlay.addEventListener('click', (e) => {
      if (e.target === elModalOverlay) closeModal();
    });

    // Delete modal
    $('#btnCloseDelete').addEventListener('click', closeDeleteModal);
    $('#btnCancelDelete').addEventListener('click', closeDeleteModal);
    elDeleteOverlay.addEventListener('click', (e) => {
      if (e.target === elDeleteOverlay) closeDeleteModal();
    });
    elBtnConfirmDel.addEventListener('click', handleDelete);

    // Detail modal
    $('#btnCloseDetail').addEventListener('click', closeDetailModal);
    elDetailOverlay.addEventListener('click', (e) => {
      if (e.target === elDetailOverlay) closeDetailModal();
    });
    $('#btnDetailEdit').addEventListener('click', () => {
      if (detailPrompt) {
        closeDetailModal();
        openEditModal(detailPrompt);
      }
    });
    $('#btnDetailDelete').addEventListener('click', () => {
      if (detailPrompt) {
        closeDetailModal();
        openDeleteModal(detailPrompt);
      }
    });
    $('#btnCopyPrompt').addEventListener('click', () => {
      if (detailPrompt) copyToClipboard(detailPrompt.prompt);
    });

    // Category: "Todas"
    elCategoryList.querySelector('[data-category="all"]').addEventListener('click', () => {
      selectCategory('all');
    });

    // Refresh
    $('#btnRefresh').addEventListener('click', () => {
      const icon = $('#btnRefresh').querySelector('svg');
      icon.classList.add('spinning');
      fetchPrompts().then(() => {
        setTimeout(() => icon.classList.remove('spinning'), 500);
      });
    });

    // Search
    elSearchInput.addEventListener('input', debounce(() => {
      renderPrompts();
    }, 250));

    // View toggle
    elBtnGrid.addEventListener('click', () => setView('grid'));
    elBtnList.addEventListener('click', () => setView('list'));

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!elModalOverlay.classList.contains('hidden')) closeModal();
        if (!elDeleteOverlay.classList.contains('hidden')) closeDeleteModal();
        if (!elDetailOverlay.classList.contains('hidden')) closeDetailModal();
      }
    });
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // =====================================================
  // INIT
  // =====================================================
  function init() {
    initTheme();
    bindEvents();
    fetchPrompts();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
