(function () {
  'use strict';

  var DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  var MEALS = ['dejeuner', 'diner'];
  var MEAL_LABELS = { dejeuner: '☀️ Déjeuner', diner: '🌙 Dîner' };
  var HISTORY_KEY = 'menuweek-dish-history';
  var HISTORY_LIMIT = 60;

  // ---------- date helpers ----------

  function mondayOf(date) {
    var d = new Date(date);
    var day = d.getDay() === 0 ? 7 : d.getDay();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day + 1);
    return d;
  }

  function weekMonday(offset) {
    var now = new Date();
    now.setDate(now.getDate() + offset * 7);
    return mondayOf(now);
  }

  function getWeekKey(offset) {
    var monday = weekMonday(offset);
    var y = monday.getFullYear();
    var m = String(monday.getMonth() + 1).padStart(2, '0');
    var d = String(monday.getDate()).padStart(2, '0');
    return 'menuweek-' + y + '-' + m + '-' + d;
  }

  function getWeekLabel(offset) {
    var monday = weekMonday(offset);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    var fmt = function (d) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
    return fmt(monday) + ' – ' + fmt(sunday);
  }

  function getWeekTitle(offset) {
    if (offset === 0) return 'Cette semaine';
    if (offset === 1) return 'Semaine prochaine';
    if (offset === -1) return 'Semaine dernière';
    return 'Semaine ' + (offset > 0 ? '+' + offset : offset);
  }

  // ---------- storage helpers ----------

  var storageOK = true;
  try {
    var t = '__menuweek_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
  } catch (e) {
    storageOK = false;
  }

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- state ----------

  var state = {
    weekOffset: 0,
    plan: {},
    history: loadJSON(HISTORY_KEY, []),
    activeCell: null, // { day, meal }
    draftValue: '',
    highlightIndex: -1
  };

  var lastFailedSave = null;

  function currentWeekKey() { return getWeekKey(state.weekOffset); }

  function loadWeek() {
    state.plan = loadJSON(currentWeekKey(), {});
  }

  // ---------- DOM refs ----------

  var els = {
    weekTitle: document.getElementById('weekTitle'),
    weekDates: document.getElementById('weekDates'),
    prevWeek: document.getElementById('prevWeek'),
    nextWeek: document.getElementById('nextWeek'),
    grid: document.getElementById('grid'),
    emptyHint: document.getElementById('emptyHint'),
    historySection: document.getElementById('historySection'),
    historyCount: document.getElementById('historyCount'),
    historyChips: document.getElementById('historyChips'),
    statusBadge: document.getElementById('statusBadge'),
    toast: document.getElementById('toast')
  };

  var statusTimer = null;
  function showStatus(kind, text) {
    els.statusBadge.textContent = text;
    els.statusBadge.className = 'status-badge show ' + kind;
    clearTimeout(statusTimer);
    if (kind !== 'error') {
      statusTimer = setTimeout(function () {
        els.statusBadge.classList.remove('show');
      }, 1400);
    }
  }

  var toastTimer = null;
  function showToast(message, opts) {
    els.toast.innerHTML = '';
    els.toast.appendChild(document.createTextNode(message));
    if (opts && opts.retry) {
      var btn = document.createElement('button');
      btn.textContent = 'Réessayer';
      btn.className = 'retry-btn';
      btn.style.cssText = 'background:#FAF7F1;color:#2B2620;border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;';
      btn.addEventListener('click', opts.retry);
      els.toast.appendChild(btn);
    }
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, opts && opts.retry ? 5000 : 2200);
  }

  // ---------- persistence actions ----------

  function persistPlan() {
    var key = currentWeekKey();
    var snapshot = Object.assign({}, state.plan);
    var ok = saveJSON(key, snapshot);
    if (ok) {
      lastFailedSave = null;
      showStatus('saved', 'Enregistré ✓');
    } else {
      lastFailedSave = { key: key, plan: snapshot };
      showStatus('error', 'Erreur');
      showToast('Échec de la sauvegarde — réessaie', {
        retry: function () {
          if (lastFailedSave) {
            var again = saveJSON(lastFailedSave.key, lastFailedSave.plan);
            if (again) {
              lastFailedSave = null;
              showStatus('saved', 'Enregistré ✓');
              els.toast.hidden = true;
            }
          }
        }
      });
    }
  }

  function addToHistory(dish) {
    var trimmed = dish.trim();
    if (!trimmed) return;
    var filtered = state.history.filter(function (d) {
      return d.toLowerCase() !== trimmed.toLowerCase();
    });
    state.history = [trimmed].concat(filtered).slice(0, HISTORY_LIMIT);
    saveJSON(HISTORY_KEY, state.history);
  }

  function commitCell(day, meal, value) {
    var key = day + '|' + meal;
    var next = Object.assign({}, state.plan);
    var trimmed = (value || '').trim();
    if (trimmed) {
      next[key] = trimmed;
    } else {
      delete next[key];
    }
    state.plan = next;
    persistPlan();
    if (trimmed) addToHistory(trimmed);
  }

  // ---------- editing ----------

  function openCell(day, meal) {
    var key = day + '|' + meal;
    state.activeCell = { day: day, meal: meal };
    state.draftValue = state.plan[key] || '';
    state.highlightIndex = -1;
    render();
    var input = els.grid.querySelector('.cell-input');
    if (input) {
      input.focus();
      var v = input.value;
      input.setSelectionRange(v.length, v.length);
    }
  }

  function closeCell(commit) {
    if (state.activeCell && commit) {
      commitCell(state.activeCell.day, state.activeCell.meal, state.draftValue);
    }
    state.activeCell = null;
    state.draftValue = '';
    state.highlightIndex = -1;
    render();
  }

  function pickSuggestion(dish) {
    if (!state.activeCell) return;
    commitCell(state.activeCell.day, state.activeCell.meal, dish);
    state.activeCell = null;
    state.draftValue = '';
    state.highlightIndex = -1;
    render();
  }

  function filteredHistory() {
    var q = state.draftValue.trim().toLowerCase();
    if (!q) return state.history.slice(0, 8);
    return state.history.filter(function (d) {
      return d.toLowerCase().includes(q);
    }).slice(0, 6);
  }

  // ---------- rendering ----------

  function render() {
    els.weekTitle.textContent = getWeekTitle(state.weekOffset);
    els.weekDates.textContent = getWeekLabel(state.weekOffset);
    renderGrid();
    renderHistory();
  }

  function todayIndex() {
    if (state.weekOffset !== 0) return -1;
    var d = new Date().getDay(); // 0 = Sunday
    return d === 0 ? 6 : d - 1; // Monday-first index into DAYS
  }

  function renderGrid() {
    els.grid.innerHTML = '';
    var anyValue = false;
    var todayIdx = todayIndex();

    DAYS.forEach(function (day, dayIdx) {
      var dayRow = document.createElement('div');
      dayRow.className = 'day-row' + (dayIdx === todayIdx ? ' today' : '');

      var dayLabel = document.createElement('div');
      dayLabel.className = 'day-label';
      var dayName = document.createElement('span');
      dayName.className = 'day-name';
      dayName.textContent = day;
      dayLabel.appendChild(dayName);
      if (dayIdx === todayIdx) {
        var pill = document.createElement('span');
        pill.className = 'today-pill';
        pill.textContent = "Aujourd'hui";
        dayLabel.appendChild(pill);
      }
      dayRow.appendChild(dayLabel);

      var mealCells = document.createElement('div');
      mealCells.className = 'meal-cells';

      MEALS.forEach(function (meal) {
        var key = day + '|' + meal;
        var value = state.plan[key];
        if (value) anyValue = true;
        var isActive = !!(state.activeCell && state.activeCell.day === day && state.activeCell.meal === meal);

        var mealBlock = document.createElement('div');
        mealBlock.className = 'meal-block';

        var mealLabel = document.createElement('span');
        mealLabel.className = 'meal-label';
        mealLabel.textContent = MEAL_LABELS[meal];
        mealBlock.appendChild(mealLabel);

        if (isActive) {
          mealBlock.appendChild(buildEditWrap());
        } else {
          mealBlock.appendChild(buildCell(day, meal, value));
        }

        mealCells.appendChild(mealBlock);
      });

      dayRow.appendChild(mealCells);
      els.grid.appendChild(dayRow);
    });

    els.emptyHint.hidden = anyValue;
  }

  function buildCell(day, meal, value) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';

    var text = document.createElement('span');
    if (value) {
      text.className = 'cell-text';
      text.textContent = value;
    } else {
      text.className = 'cell-placeholder';
      text.textContent = 'Ajouter un plat';
    }
    btn.appendChild(text);

    if (value) {
      var clearBtn = document.createElement('span');
      clearBtn.className = 'clear-btn';
      clearBtn.setAttribute('role', 'button');
      clearBtn.setAttribute('aria-label', 'Effacer');
      clearBtn.textContent = '×';
      clearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        commitCell(day, meal, '');
        render();
      });
      btn.appendChild(clearBtn);
    }

    btn.addEventListener('click', function () { openCell(day, meal); });
    return btn;
  }

  function buildEditWrap() {
    var wrap = document.createElement('div');
    wrap.className = 'edit-wrap';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.placeholder = 'Écrire un plat…';
    input.value = state.draftValue;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'sentences');

    input.addEventListener('input', function (e) {
      state.draftValue = e.target.value;
      state.highlightIndex = -1;
      renderSuggestionsOnly(wrap);
    });

    input.addEventListener('keydown', function (e) {
      var list = filteredHistory();
      if (e.key === 'Enter') {
        e.preventDefault();
        if (state.highlightIndex >= 0 && list[state.highlightIndex]) {
          pickSuggestion(list[state.highlightIndex]);
        } else {
          closeCell(true);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCell(false);
      } else if (e.key === 'ArrowDown') {
        if (list.length) {
          e.preventDefault();
          state.highlightIndex = Math.min(state.highlightIndex + 1, list.length - 1);
          renderSuggestionsOnly(wrap);
        }
      } else if (e.key === 'ArrowUp') {
        if (list.length) {
          e.preventDefault();
          state.highlightIndex = Math.max(state.highlightIndex - 1, -1);
          renderSuggestionsOnly(wrap);
        }
      }
    });

    input.addEventListener('blur', function () {
      // Suggestion clicks call preventDefault on mousedown, so a genuine
      // blur here always means "focus left the input" -> safe to commit.
      closeCell(true);
    });

    wrap.appendChild(input);
    wrap.appendChild(buildSuggestions());
    return wrap;
  }

  function buildSuggestions() {
    var list = filteredHistory();
    var box = document.createElement('div');
    box.className = 'suggestions';

    if (!list.length) {
      box.hidden = true;
      return box;
    }

    if (!state.draftValue.trim()) {
      var header = document.createElement('div');
      header.className = 'suggestion-header';
      header.textContent = 'Plats récents';
      box.appendChild(header);
    }

    list.forEach(function (dish, i) {
      var item = document.createElement('div');
      item.className = 'suggestion-item' + (i === state.highlightIndex ? ' active' : '');
      item.textContent = dish;
      item.addEventListener('mousedown', function (e) { e.preventDefault(); });
      item.addEventListener('click', function () { pickSuggestion(dish); });
      box.appendChild(item);
    });

    return box;
  }

  function renderSuggestionsOnly(wrap) {
    var old = wrap.querySelector('.suggestions');
    var fresh = buildSuggestions();
    if (old) wrap.replaceChild(fresh, old);
    else wrap.appendChild(fresh);
  }

  function renderHistory() {
    var count = state.history.length;
    els.historyCount.textContent = String(count);
    els.historySection.hidden = count === 0;
    els.historyChips.innerHTML = '';
    state.history.slice(0, 20).forEach(function (dish) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = dish;
      els.historyChips.appendChild(chip);
    });
  }

  // ---------- backup (export / import, for switching devices) ----------

  var WEEK_KEY_RE = /^menuweek-\d{4}-\d{2}-\d{2}$/;

  function exportData() {
    var data = { exportedAt: new Date().toISOString(), history: loadJSON(HISTORY_KEY, []), weeks: {} };
    Object.keys(localStorage).forEach(function (k) {
      if (WEEK_KEY_RE.test(k)) data.weeks[k] = loadJSON(k, {});
    });
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'menu-semaine-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    showToast('Sauvegarde téléchargée');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var data;
      try {
        data = JSON.parse(e.target.result);
      } catch (err) {
        showToast('Fichier de sauvegarde invalide');
        return;
      }
      var weekCount = 0;
      if (data && typeof data.weeks === 'object' && data.weeks) {
        Object.keys(data.weeks).forEach(function (k) {
          if (WEEK_KEY_RE.test(k)) { saveJSON(k, data.weeks[k]); weekCount++; }
        });
      }
      if (data && Array.isArray(data.history)) {
        saveJSON(HISTORY_KEY, data.history);
        state.history = data.history;
      }
      if (!weekCount && !(data && Array.isArray(data.history))) {
        showToast('Fichier de sauvegarde invalide');
        return;
      }
      loadWeek();
      render();
      showToast('Sauvegarde restaurée ✓');
    };
    reader.onerror = function () { showToast('Échec de la lecture du fichier'); };
    reader.readAsText(file);
  }

  els.exportBtn = document.getElementById('exportBtn');
  els.importFile = document.getElementById('importFile');
  els.exportBtn.addEventListener('click', exportData);
  els.importFile.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });

  // ---------- navigation ----------

  els.prevWeek.addEventListener('click', function () {
    state.weekOffset -= 1;
    state.activeCell = null;
    loadWeek();
    render();
  });

  els.nextWeek.addEventListener('click', function () {
    state.weekOffset += 1;
    state.activeCell = null;
    loadWeek();
    render();
  });

  // Note: no extra "click outside closes the cell" listener is needed —
  // clicking anywhere else already blurs the open input (the browser moves
  // focus away), and the input's own blur handler commits + closes it.

  // ---------- init ----------

  if (!storageOK) {
    showToast('Stockage local indisponible sur ce navigateur (mode privé ?)');
  }

  loadWeek();
  render();

  // ---------- service worker (offline support) ----------

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // offline support degrades gracefully if registration fails
      });
    });
  }
})();
