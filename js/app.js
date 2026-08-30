/**
 * PIXEL QUEST - CORE APPLICATION LOGIC (INSTANT 0MS TAB SWITCHING + OPTIMIZED FAB & INLINE ADD BUTTON)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // App State
  let db = await StorageBridge.getData();
  // Immediate sync on boot to guarantee native SharedPreferences & Widget are live
  await StorageBridge.setData(db);

  // Sync to native whenever user switches out of app (e.g. goes to home screen)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      StorageBridge.setData(db);
    }
  });

  let selectedDate = new Date(); // Current date view
  let calendarMonth = new Date(); // Calendar month view
  let activeTab = 'tabQuests';
  let activeCategoryFilter = 'all';
  let activeGardenSubtab = 'garden';

  // Focus Timer State
  let focusInterval = null;
  let focusTotalSeconds = 25 * 60;
  let focusRemainingSeconds = 25 * 60;
  let isFocusRunning = false;
  let focusEndTime = null;
  let selectedFocusMins = 25;

  // 25+ Flora Catalog Pool
  const FLORA_CATALOG = [
    { type: 'oak', name: 'Pixel Oak', icon: '🌳' },
    { type: 'pine', name: 'Pixel Pine', icon: '🌲' },
    { type: 'sakura', name: 'Sakura Tree', icon: '🌸' },
    { type: 'crystal', name: 'Crystal Tree', icon: '🔮' },
    { type: 'sunflower', name: 'Golden Sunflower', icon: '🌻' },
    { type: 'rose', name: 'Red Rose', icon: '🌹' },
    { type: 'tulip', name: 'Royal Tulip', icon: '🌷' },
    { type: 'cactus', name: 'Desert Cactus', icon: '🌵' },
    { type: 'bonsai', name: 'Ancient Bonsai', icon: '🪴' },
    { type: 'bamboo', name: 'Lucky Bamboo', icon: '🎋' },
    { type: 'lotus', name: 'Sacred Lotus', icon: '🪷' },
    { type: 'mushroom', name: 'Magic Mushroom', icon: '🍄' },
    { type: 'palm', name: 'Coconut Palm', icon: '🌴' },
    { type: 'maple', name: 'Autumn Maple', icon: '🍁' },
    { type: 'lavender', name: 'Lavender Bush', icon: '🪻' },
    { type: 'fern', name: 'Forest Fern', icon: '🌿' },
    { type: 'apple', name: 'Golden Apple Tree', icon: '🍎' },
    { type: 'dragon', name: 'Dragon Plant', icon: '🪸' },
    { type: 'willow', name: 'Weeping Willow', icon: '🌾' },
    { type: 'clover', name: '4-Leaf Clover', icon: '🍀' },
    { type: 'dandelion', name: 'Pixel Dandelion', icon: '🌼' },
    { type: 'fire_flower', name: 'Flame Flower', icon: '🔥' },
    { type: 'star_flower', name: 'Star Blossom', icon: '⭐' },
    { type: 'cosmic_tree', name: 'Cosmic Tree', icon: '✨' },
    { type: 'moon_tree', name: 'Moonlit Tree', icon: '🌙' }
  ];

  // DOM Elements
  const headerPointsVal = document.getElementById('headerPointsVal');
  const headerStreakVal = document.getElementById('headerStreakVal');
  const currentDateTitle = document.getElementById('currentDateTitle');
  const currentDateSubtitle = document.getElementById('currentDateSubtitle');

  const pendingTasksContainer = document.getElementById('pendingTasksContainer');
  const completedTasksContainer = document.getElementById('completedTasksContainer');
  const emptyTasksState = document.getElementById('emptyTasksState');
  const questProgressFill = document.getElementById('questProgressFill');
  const questProgressCount = document.getElementById('questProgressCount');
  const categoryFilterContainer = document.getElementById('categoryFilterContainer');

  // Modals
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const taskModalTitle = document.getElementById('taskModalTitle');
  const taskRecurrenceType = document.getElementById('taskRecurrenceType');
  const weeklyDaysGroup = document.getElementById('weeklyDaysGroup');
  const monthlyDateGroup = document.getElementById('monthlyDateGroup');
  const taskEmojiChips = document.getElementById('taskEmojiChips');

  const rewardModal = document.getElementById('rewardModal');
  const rewardForm = document.getElementById('rewardForm');
  const rewardModalTitle = document.getElementById('rewardModalTitle');
  const categoryModal = document.getElementById('categoryModal');
  const categoryForm = document.getElementById('categoryForm');

  // Pixel Confirm Modal
  const confirmModal = document.getElementById('confirmModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmOkBtn = document.getElementById('confirmOkBtn');
  const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
  let confirmCallback = null;

  function showPixelConfirm(title, message, onConfirm) {
    if (confirmModalTitle) confirmModalTitle.textContent = title || '⚠️ ยืนยันการทำรายการ';
    if (confirmModalMessage) confirmModalMessage.textContent = message;
    confirmCallback = onConfirm;
    confirmModal.classList.remove('hidden');
  }

  function closePixelConfirm() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
  }

  if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closePixelConfirm);
  if (closeConfirmModalBtn) closeConfirmModalBtn.addEventListener('click', closePixelConfirm);

  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', () => {
      if (typeof confirmCallback === 'function') {
        confirmCallback();
      }
      closePixelConfirm();
    });
  }

  // Emoji Chips Handler for Task Form
  if (taskEmojiChips) {
    taskEmojiChips.querySelectorAll('.emoji-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const emoji = chip.getAttribute('data-emoji');
        const titleInput = document.getElementById('taskTitle');
        if (titleInput) {
          titleInput.value = titleInput.value ? `${titleInput.value} ${emoji}` : emoji;
          titleInput.focus();
          PixelAudio.playClickSound();
        }
      });
    });
  }

  // Focus Elements
  const focusPlantVisual = document.getElementById('focusPlantVisual');
  const focusTimerDigits = document.getElementById('focusTimerDigits');
  const focusStatusBadge = document.getElementById('focusStatusBadge');
  const startFocusBtn = document.getElementById('startFocusBtn');
  const giveupFocusBtn = document.getElementById('giveupFocusBtn');
  const expectedPointsVal = document.getElementById('expectedPointsVal');
  const expectedTreeVal = document.getElementById('expectedTreeVal');
  const customFocusMinsInput = document.getElementById('customFocusMinsInput');
  const applyCustomTimeBtn = document.getElementById('applyCustomTimeBtn');

  // Helper Functions
  function formatDateKey(dateObj) {
    if (!dateObj) dateObj = new Date();
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function isSameDay(d1, d2) {
    return formatDateKey(d1) === formatDateKey(d2);
  }

  function formatThaiDate(dateObj) {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thaiYear = dateObj.getFullYear() + 543;
    return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${thaiYear}`;
  }

  function showToast(message, icon = '✨') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'pixel-toast';
    toast.innerHTML = `<span style="font-size:1.2rem;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2800);
  }

  async function saveData() {
    await StorageBridge.setData(db);
    renderHeaderStats();
    checkAchievements();
  }

  function processMissedTaskPenalties() {
    if (!db.penaltiesProcessed) db.penaltiesProcessed = {};
    let totalDeducted = 0;
    let modified = false;

    db.tasks.forEach(t => {
      if (t.archived) return;

      for (let i = 1; i <= 7; i++) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - i);
        const pastKey = formatDateKey(pastDate);

        if (isTaskDueOnDate(t, pastDate)) {
          const penaltyKey = `${t.id}_${pastKey}`;
          const isDone = t.completions && t.completions[pastKey];

          if (!isDone && !db.penaltiesProcessed[penaltyKey]) {
            const points = t.points || 10;
            db.pointsBalance = Math.max(0, (db.pointsBalance || 0) - points);
            db.penaltiesProcessed[penaltyKey] = true;
            totalDeducted += points;
            modified = true;
          }
        }
      }
    });

    if (modified) {
      if (totalDeducted > 0) {
        showToast(`ถูกหัก -${totalDeducted} 🪙 เนื่องจากไม่ได้ทำเควสต์ในวันที่ผ่านมา`, '⚠️');
      }
      saveData();
    }
  }

  // ==========================================================================
  // INSTANT 0MS BOTTOM NAV TAB SWITCHING
  // ==========================================================================

  const navItems = document.querySelectorAll('.nav-item');
  const tabPages = document.querySelectorAll('.tab-page');

  function switchTab(targetTab) {
    if (!targetTab || activeTab === targetTab) return;

    // 1. Instant 0ms visual class toggle
    navItems.forEach(n => {
      if (n.getAttribute('data-tab') === targetTab) {
        n.classList.add('active');
      } else {
        n.classList.remove('active');
      }
    });

    tabPages.forEach(p => {
      if (p.id === targetTab) {
        p.classList.add('active-tab');
      } else {
        p.classList.remove('active-tab');
      }
    });

    activeTab = targetTab;
    PixelAudio.playClickSound();

    // 2. Render tab contents
    requestAnimationFrame(() => {
      renderCurrentTab();
    });
  }

  navItems.forEach(btn => {
    // pointerdown fires immediately on physical screen touch with 0ms delay
    btn.addEventListener('pointerdown', (e) => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  function renderCurrentTab() {
    renderHeaderStats();
    if (activeTab === 'tabQuests') {
      renderCategoryFilters();
      renderTasks();
    } else if (activeTab === 'tabFocus') {
      updateFocusDisplay();
    } else if (activeTab === 'tabGarden') {
      renderGardenTab();
    } else if (activeTab === 'tabRewards') {
      renderRewards();
    } else if (activeTab === 'tabSettings') {
      renderSettings();
    }
  }

  function renderHeaderStats() {
    if (headerPointsVal) headerPointsVal.textContent = db.pointsBalance || 0;
    const streak = calculateStreak();
    if (headerStreakVal) headerStreakVal.textContent = `${streak}d`;
  }

  function calculateStreak() {
    let streak = 0;
    let curr = new Date();
    while (true) {
      const key = formatDateKey(curr);
      const dayTasks = db.tasks.filter(t => isTaskDueOnDate(t, curr));
      if (dayTasks.length === 0) {
        curr.setDate(curr.getDate() - 1);
        if (streak > 365) break;
        continue;
      }
      const completedCount = dayTasks.filter(t => t.completions && t.completions[key]).length;
      if (completedCount > 0) {
        streak++;
        curr.setDate(curr.getDate() - 1);
      } else {
        if (!isSameDay(curr, new Date())) break;
        curr.setDate(curr.getDate() - 1);
      }
    }
    return streak;
  }

  // ==========================================================================
  // TAB 1: QUEST BOARD
  // ==========================================================================

  const prevDateBtn = document.getElementById('prevDateBtn');
  const nextDateBtn = document.getElementById('nextDateBtn');
  const todayDateBtn = document.getElementById('todayDateBtn');

  if (prevDateBtn) {
    prevDateBtn.addEventListener('click', () => {
      selectedDate.setDate(selectedDate.getDate() - 1);
      PixelAudio.playClickSound();
      updateDateDisplay();
      renderTasks();
    });
  }

  if (nextDateBtn) {
    nextDateBtn.addEventListener('click', () => {
      selectedDate.setDate(selectedDate.getDate() + 1);
      PixelAudio.playClickSound();
      updateDateDisplay();
      renderTasks();
    });
  }

  if (todayDateBtn) {
    todayDateBtn.addEventListener('click', () => {
      selectedDate = new Date();
      PixelAudio.playClickSound();
      updateDateDisplay();
      renderTasks();
    });
  }

  function updateDateDisplay() {
    const today = new Date();
    if (isSameDay(selectedDate, today)) {
      currentDateTitle.textContent = 'วันนี้';
    } else {
      const diffDays = Math.round((selectedDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays === -1) currentDateTitle.textContent = 'เมื่อวาน';
      else if (diffDays === 1) currentDateTitle.textContent = 'พรุ่งนี้';
      else currentDateTitle.textContent = selectedDate.toLocaleDateString('th-TH', { weekday: 'short' });
    }
    currentDateSubtitle.textContent = formatThaiDate(selectedDate);
  }

  function isTaskDueOnDate(task, dateObj) {
    if (task.archived) return false;
    const dateStr = formatDateKey(dateObj);
    
    let createdStr = task.createdAtKey;
    if (!createdStr && task.createdAt) {
      createdStr = formatDateKey(new Date(task.createdAt));
    }
    if (!createdStr) createdStr = formatDateKey(new Date());

    if (dateStr < createdStr) return false;

    const rec = task.recurrence || { type: 'daily' };
    if (rec.type === 'none') {
      return dateStr === createdStr;
    } else if (rec.type === 'daily') {
      return true;
    } else if (rec.type === 'weekly') {
      const dayOfWeek = dateObj.getDay();
      return Array.isArray(rec.days) && rec.days.includes(dayOfWeek);
    } else if (rec.type === 'monthly') {
      const dayOfMonth = dateObj.getDate();
      return rec.dateOfMonth === dayOfMonth;
    }
    return true;
  }

  function getTaskDueBadge(task, viewDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const viewD = new Date(viewDate);
    viewD.setHours(0, 0, 0, 0);

    const rec = task.recurrence || { type: 'daily' };
    let recLabel = '';
    if (rec.type === 'daily') recLabel = ' 🔁';
    else if (rec.type === 'weekly') recLabel = ' 🔁 สัปดาห์';
    else if (rec.type === 'monthly') recLabel = ' 🔁 เดือน';

    const dateKey = formatDateKey(viewDate);
    const isDone = task.completions && task.completions[dateKey];

    if (isDone) {
      return { text: `✔ เสร็จแล้ว${recLabel}`, type: 'done' };
    }

    const diffDays = Math.round((viewD - today) / (1000 * 60 * 60 * 24));
    const timeStr = task.reminderTime ? `, ${task.reminderTime}` : '';

    if (diffDays === 0) {
      return { text: `🕒 Today${timeStr}${recLabel}`, type: 'today' };
    } else if (diffDays === 1) {
      return { text: `🕒 Tomorrow${timeStr}${recLabel}`, type: 'upcoming' };
    } else if (diffDays > 1) {
      if (diffDays <= 7) {
        return { text: `🕒 อีก ${diffDays} วัน${timeStr}${recLabel}`, type: 'upcoming' };
      }
      const thaiStr = viewD.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      return { text: `🕒 ${thaiStr}${timeStr}${recLabel}`, type: 'upcoming' };
    } else {
      const thaiStr = viewD.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      return { text: `🕒 ${thaiStr}${timeStr}${recLabel}`, type: 'today' };
    }
  }

  function renderCategoryFilters() {
    if (!categoryFilterContainer) return;
    let html = `<div class="cat-chip ${activeCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">🌟 ทั้งหมด</div>`;
    db.categories.forEach(cat => {
      html += `
        <div class="cat-chip ${activeCategoryFilter === cat.id ? 'active' : ''}" data-cat="${cat.id}">
          <span>${cat.icon || '🏷️'}</span>
          <span>${cat.name}</span>
        </div>
      `;
    });
    categoryFilterContainer.innerHTML = html;

    categoryFilterContainer.querySelectorAll('.cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeCategoryFilter = chip.getAttribute('data-cat');
        PixelAudio.playClickSound();
        renderCategoryFilters();
        renderTasks();
      });
    });
  }

  function renderTasks() {
    if (!pendingTasksContainer || !completedTasksContainer) return;

    const dateKey = formatDateKey(selectedDate);
    let dayTasks = db.tasks.filter(t => isTaskDueOnDate(t, selectedDate));

    if (activeCategoryFilter !== 'all') {
      dayTasks = dayTasks.filter(t => t.categoryId === activeCategoryFilter);
    }

    const pendingTasks = dayTasks.filter(t => !(t.completions && t.completions[dateKey]));
    const completedTasks = dayTasks.filter(t => t.completions && t.completions[dateKey]);

    updateProgress(completedTasks.length, dayTasks.length);

    if (dayTasks.length === 0) {
      pendingTasksContainer.innerHTML = '';
      completedTasksContainer.innerHTML = '';
      emptyTasksState.classList.remove('hidden');
      return;
    }

    emptyTasksState.classList.add('hidden');

    pendingTasksContainer.innerHTML = renderTaskListHTML(pendingTasks, false);
    completedTasksContainer.innerHTML = renderTaskListHTML(completedTasks, true);

    attachTaskItemListeners(pendingTasksContainer);
    attachTaskItemListeners(completedTasksContainer);
  }

  function renderTaskListHTML(tasksArray, isDone) {
    if (tasksArray.length === 0) {
      return `<div class="text-sm text-muted text-center" style="padding: 10px;">${isDone ? 'ยังไม่มีเควสต์ที่เสร็จแล้ว' : 'ไม่มีเควสต์ที่ต้องทำ'}</div>`;
    }

    let html = '';
    tasksArray.forEach(task => {
      const cat = db.categories.find(c => c.id === task.categoryId) || { name: 'ทั่วไป', color: '#ff6b00', icon: '⚔️' };
      const hasNote = task.note && task.note.trim().length > 0;
      const dueInfo = getTaskDueBadge(task, selectedDate);

      html += `
        <div class="task-item ${isDone ? 'completed' : ''}" data-id="${task.id}">
          <div class="task-checkbox" data-action="toggle" title="${isDone ? 'กดเพื่อ Undo ย้อนกลับ' : 'กดเพื่อติ๊กเสร็จ'}">
            ${isDone ? '✓' : ''}
          </div>
          <div class="task-content">
            <div class="task-title">${escapeHtml(task.title)}</div>
            ${hasNote ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}
            <div class="task-meta">
              <span class="due-badge due-${dueInfo.type}">${dueInfo.text}</span>
              <span class="cat-badge" style="background:${cat.color}">
                <span>${cat.icon}</span> ${escapeHtml(cat.name)}
              </span>
              <span class="points-badge">+${task.points || 10} 🪙</span>
            </div>
          </div>
          <div class="task-actions">
            <button class="action-btn-sm" data-action="edit" title="แก้ไข">✏️</button>
            <button class="action-btn-sm" data-action="delete" title="ลบ">🗑️</button>
          </div>
        </div>
      `;
    });
    return html;
  }

  function attachTaskItemListeners(container) {
    container.querySelectorAll('.task-item').forEach(item => {
      const taskId = item.getAttribute('data-id');

      item.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleTaskComplete(taskId));
      item.querySelector('[data-action="edit"]').addEventListener('click', () => openEditTaskModal(taskId));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(taskId));
    });
  }

  function updateProgress(done, total) {
    if (!questProgressFill || !questProgressCount) return;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    questProgressFill.style.width = `${pct}%`;
    questProgressCount.textContent = `${done} / ${total} Done`;
  }

  async function toggleTaskComplete(taskId) {
    const task = db.tasks.find(t => t.id === taskId);
    if (!task) return;

    const dateKey = formatDateKey(selectedDate);
    if (!task.completions) task.completions = {};

    const isCurrentlyDone = !!task.completions[dateKey];
    const points = task.points || 10;

    if (isCurrentlyDone) {
      delete task.completions[dateKey];
      db.pointsBalance = Math.max(0, (db.pointsBalance || 0) - points);
      PixelAudio.playUncheckSound();
      showToast(`Undo ย้อนกลับเควสต์แล้ว (-${points} 🪙)`, '↩️');
    } else {
      task.completions[dateKey] = true;
      db.pointsBalance = (db.pointsBalance || 0) + points;
      PixelAudio.playCheckSound();
      showToast(`ทำเควสต์สำเร็จ! (+${points} 🪙)`, '🎉');
    }

    await saveData();
    renderTasks();
  }

  // Task Modal Handlers
  const addTaskFab = document.getElementById('addTaskFab');
  const inlineAddTaskBtn = document.getElementById('inlineAddTaskBtn');
  const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
  const cancelTaskBtn = document.getElementById('cancelTaskBtn');

  if (addTaskFab) {
    addTaskFab.addEventListener('click', openAddTaskModal);
  }

  if (inlineAddTaskBtn) {
    inlineAddTaskBtn.addEventListener('click', openAddTaskModal);
  }

  if (closeTaskModalBtn) closeTaskModalBtn.addEventListener('click', closeTaskModal);
  if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeTaskModal);

  if (taskRecurrenceType) {
    taskRecurrenceType.addEventListener('change', () => {
      const val = taskRecurrenceType.value;
      weeklyDaysGroup.classList.toggle('hidden', val !== 'weekly');
      monthlyDateGroup.classList.toggle('hidden', val !== 'monthly');
    });
  }

  function populateCategorySelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    let html = '';
    db.categories.forEach(cat => {
      html += `<option value="${cat.id}">${cat.icon || ''} ${escapeHtml(cat.name)}</option>`;
    });
    select.innerHTML = html;
  }

  function openAddTaskModal(defaultCategoryId) {
    populateCategorySelect('taskCategory');
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskNote').value = '';
    document.getElementById('taskPoints').value = 10;
    
    if (typeof defaultCategoryId === 'string' && defaultCategoryId) {
      document.getElementById('taskCategory').value = defaultCategoryId;
    } else if (activeCategoryFilter !== 'all') {
      document.getElementById('taskCategory').value = activeCategoryFilter;
    }

    taskRecurrenceType.value = 'daily';
    weeklyDaysGroup.classList.add('hidden');
    monthlyDateGroup.classList.add('hidden');
    document.getElementById('taskReminderTime').value = '';
    taskModalTitle.textContent = 'เพิ่มเควสต์ใหม่';
    taskModal.classList.remove('hidden');
    
    setTimeout(() => {
      const titleInput = document.getElementById('taskTitle');
      if (titleInput) titleInput.focus();
    }, 100);
  }

  function openEditTaskModal(taskId) {
    const task = db.tasks.find(t => t.id === taskId);
    if (!task) return;

    populateCategorySelect('taskCategory');
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskNote').value = task.note || '';
    document.getElementById('taskCategory').value = task.categoryId || (db.categories[0] ? db.categories[0].id : '');
    document.getElementById('taskPoints').value = task.points || 10;

    const rec = task.recurrence || { type: 'daily' };
    taskRecurrenceType.value = rec.type || 'none';

    weeklyDaysGroup.classList.toggle('hidden', rec.type !== 'weekly');
    monthlyDateGroup.classList.toggle('hidden', rec.type !== 'monthly');

    if (rec.type === 'weekly' && Array.isArray(rec.days)) {
      document.querySelectorAll('#weeklyDaysGroup input[type="checkbox"]').forEach(cb => {
        cb.checked = rec.days.includes(parseInt(cb.value));
      });
    }

    if (rec.type === 'monthly' && rec.dateOfMonth) {
      document.getElementById('taskMonthDate').value = rec.dateOfMonth;
    }

    document.getElementById('taskReminderTime').value = task.reminderTime || '';
    taskModalTitle.textContent = 'แก้ไขเควสต์';
    taskModal.classList.remove('hidden');
  }

  function closeTaskModal() {
    taskModal.classList.add('hidden');
  }

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('taskId').value;
      const title = document.getElementById('taskTitle').value.trim();
      const note = document.getElementById('taskNote').value.trim();
      const categoryId = document.getElementById('taskCategory').value;
      const points = parseInt(document.getElementById('taskPoints').value) || 10;
      const recType = taskRecurrenceType.value;
      const reminderTime = document.getElementById('taskReminderTime').value;

      let recurrence = { type: recType, days: [], dateOfMonth: null };
      if (recType === 'weekly') {
        const days = [];
        document.querySelectorAll('#weeklyDaysGroup input[type="checkbox"]:checked').forEach(cb => {
          days.push(parseInt(cb.value));
        });
        recurrence.days = days;
      } else if (recType === 'monthly') {
        recurrence.dateOfMonth = parseInt(document.getElementById('taskMonthDate').value) || 1;
      }

      const todayStr = formatDateKey(new Date());

      if (id) {
        const task = db.tasks.find(t => t.id === id);
        if (task) {
          task.title = title;
          task.note = note;
          task.categoryId = categoryId;
          task.points = points;
          task.recurrence = recurrence;
          task.reminderTime = reminderTime;
        }
      } else {
        const newTask = {
          id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          title,
          note,
          categoryId,
          points,
          recurrence,
          reminderTime,
          completions: {},
          createdAt: new Date().toISOString(),
          createdAtKey: todayStr,
          archived: false
        };
        db.tasks.push(newTask);
      }

      if (activeCategoryFilter !== 'all' && activeCategoryFilter !== categoryId) {
        activeCategoryFilter = 'all';
      }

      await saveData();
      closeTaskModal();
      renderCategoryFilters();
      renderTasks();
      if (activeTab === 'tabSettings') renderMasterQuestDashboard();
      showToast(id ? 'บันทึกการแก้ไขเควสต์แล้ว' : 'เพิ่มเควสต์ใหม่สำเร็จ!', '⚔️');
    });
  }

  function deleteTask(taskId) {
    showPixelConfirm('ลบเควสต์', 'คุณต้องการลบเควสต์นี้หรือไม่?', async () => {
      db.tasks = db.tasks.filter(t => t.id !== taskId);
      await saveData();
      renderTasks();
      if (activeTab === 'tabSettings') renderMasterQuestDashboard();
      showToast('ลบเควสต์เรียบร้อย', '🗑️');
    });
  }

  // ==========================================================================
  // TAB 2: FOCUS REALM
  // ==========================================================================

  const focusPresetButtons = document.querySelectorAll('#focusPresetGroup .preset-btn');
  focusPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isFocusRunning) return;
      focusPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFocusMins = parseInt(btn.getAttribute('data-mins')) || 25;
      if (customFocusMinsInput) customFocusMinsInput.value = '';
      focusTotalSeconds = selectedFocusMins * 60;
      focusRemainingSeconds = focusTotalSeconds;
      updateFocusDisplay();
    });
  });

  if (applyCustomTimeBtn && customFocusMinsInput) {
    applyCustomTimeBtn.addEventListener('click', () => {
      if (isFocusRunning) return;
      const customVal = parseInt(customFocusMinsInput.value);
      if (isNaN(customVal) || customVal < 1 || customVal > 300) {
        showToast('กรุณาระบุเวลา 1 ถึง 300 นาที', '⚠️');
        return;
      }
      focusPresetButtons.forEach(b => b.classList.remove('active'));
      selectedFocusMins = customVal;
      focusTotalSeconds = selectedFocusMins * 60;
      focusRemainingSeconds = focusTotalSeconds;
      PixelAudio.playClickSound();
      showToast(`ตั้งเวลาสมาธิ ${selectedFocusMins} นาที`, '⏱️');
      updateFocusDisplay();
    });
  }

  if (startFocusBtn) {
    startFocusBtn.addEventListener('click', () => {
      if (isFocusRunning) return;
      startFocusTimer();
    });
  }

  if (giveupFocusBtn) {
    giveupFocusBtn.addEventListener('click', () => {
      showPixelConfirm('ยกเลิกสมาธิ', 'คุณแน่ใจหรือว่าต้องการยกเลิกการสะสมสมาธิรอบนี้?', () => {
        stopFocusTimer(false);
      });
    });
  }

  function startFocusTimer() {
    isFocusRunning = true;
    focusEndTime = Date.now() + focusRemainingSeconds * 1000;

    startFocusBtn.classList.add('hidden');
    giveupFocusBtn.classList.remove('hidden');
    focusStatusBadge.textContent = 'FOCUSED & GROWING...';
    focusStatusBadge.style.color = '#00e5ff';

    PixelAudio.playClickSound();

    focusInterval = setInterval(() => {
      const now = Date.now();
      const remainingMs = focusEndTime - now;
      focusRemainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

      updateFocusDisplay();

      if (focusRemainingSeconds <= 0) {
        stopFocusTimer(true);
      }
    }, 1000);
  }

  async function stopFocusTimer(isSuccess) {
    clearInterval(focusInterval);
    focusInterval = null;
    isFocusRunning = false;

    startFocusBtn.classList.remove('hidden');
    giveupFocusBtn.classList.add('hidden');

    if (isSuccess) {
      const pointsEarned = Math.round(selectedFocusMins * 0.6);
      db.pointsBalance = (db.pointsBalance || 0) + pointsEarned;

      const randomFlora = FLORA_CATALOG[Math.floor(Math.random() * FLORA_CATALOG.length)];

      const newTree = {
        id: 'tree-' + Date.now(),
        treeType: randomFlora.type,
        treeName: randomFlora.name,
        treeIcon: randomFlora.icon,
        stage: 4,
        durationMinutes: selectedFocusMins,
        plantedAt: new Date().toISOString()
      };

      if (!db.garden) db.garden = [];
      db.garden.push(newTree);

      if (!db.focusHistory) db.focusHistory = [];
      db.focusHistory.push({
        id: 'foc-' + Date.now(),
        durationMinutes: selectedFocusMins,
        completedAt: new Date().toISOString(),
        pointsEarned,
        treeType: randomFlora.type
      });

      PixelAudio.playFocusCompleteSound();
      showToast(`ปลูก ${randomFlora.icon} ${randomFlora.name} สำเร็จ! ได้รับ +${pointsEarned} 🪙`, '🌳');
      await saveData();
    } else {
      PixelAudio.playUncheckSound();
      showToast('ยกเลิกการโฟกัส', '❌');
    }

    focusRemainingSeconds = focusTotalSeconds;
    focusStatusBadge.textContent = 'READY TO FOCUS';
    focusStatusBadge.style.color = 'var(--text-muted)';
    updateFocusDisplay();
  }

  function updateFocusDisplay() {
    const mins = Math.floor(focusRemainingSeconds / 60);
    const secs = focusRemainingSeconds % 60;
    if (focusTimerDigits) {
      focusTimerDigits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    const pts = Math.round(selectedFocusMins * 0.6);
    if (expectedPointsVal) expectedPointsVal.textContent = `+${pts} 🪙`;

    const progressPct = 1 - (focusRemainingSeconds / focusTotalSeconds);
    let stage = 1;
    if (progressPct >= 0.95) stage = 4;
    else if (progressPct >= 0.65) stage = 3;
    else if (progressPct >= 0.3) stage = 2;

    renderTreeSVG(stage);
  }

  function renderTreeSVG(stage) {
    if (!focusPlantVisual) return;
    let svgContent = '';
    if (stage === 1) {
      svgContent = `
        <svg width="80" height="80" viewBox="0 0 100 100">
          <ellipse cx="50" cy="85" rx="15" ry="5" fill="#3e2723"/>
          <path d="M50 85 Q50 65 52 55" stroke="#4caf50" stroke-width="6" fill="none"/>
          <circle cx="56" cy="52" r="6" fill="#81c784"/>
        </svg>
      `;
    } else if (stage === 2) {
      svgContent = `
        <svg width="100" height="100" viewBox="0 0 100 100">
          <path d="M50 85 L50 45" stroke="#388e3c" stroke-width="8" stroke-linecap="round"/>
          <path d="M50 60 Q30 50 35 40 Q50 45 50 60" fill="#66bb6a"/>
          <path d="M50 50 Q70 40 65 30 Q50 35 50 50" fill="#81c784"/>
        </svg>
      `;
    } else if (stage === 3) {
      svgContent = `
        <svg width="120" height="120" viewBox="0 0 100 100">
          <path d="M50 90 L50 40" stroke="#4e342e" stroke-width="12" stroke-linecap="round"/>
          <circle cx="50" cy="35" r="25" fill="#2e7d32"/>
          <circle cx="38" cy="40" r="18" fill="#388e3c"/>
          <circle cx="62" cy="40" r="18" fill="#4caf50"/>
        </svg>
      `;
    } else {
      svgContent = `
        <svg width="140" height="140" viewBox="0 0 100 100">
          <path d="M50 90 L50 35" stroke="#3e2723" stroke-width="16" stroke-linecap="round"/>
          <circle cx="50" cy="30" r="32" fill="#1b5e20"/>
          <circle cx="32" cy="38" r="24" fill="#2e7d32"/>
          <circle cx="68" cy="38" r="24" fill="#4caf50"/>
          <circle cx="50" cy="18" r="20" fill="#81c784"/>
          <circle cx="40" cy="30" r="4" fill="#ff3d00"/>
          <circle cx="62" cy="35" r="4" fill="#ff9e00"/>
          <circle cx="50" cy="45" r="4" fill="#ff3d00"/>
        </svg>
      `;
    }
    focusPlantVisual.innerHTML = svgContent;
  }

  // ==========================================================================
  // TAB 3: PIXEL GARDEN & CALENDAR WITH DISCIPLINE CHART
  // ==========================================================================

  const subtabGardenBtn = document.getElementById('subtabGardenBtn');
  const subtabCalendarBtn = document.getElementById('subtabCalendarBtn');
  const subviewGarden = document.getElementById('subviewGarden');
  const subviewCalendar = document.getElementById('subviewCalendar');

  if (subtabGardenBtn && subtabCalendarBtn) {
    subtabGardenBtn.addEventListener('click', () => {
      activeGardenSubtab = 'garden';
      subtabGardenBtn.classList.add('active');
      subtabCalendarBtn.classList.remove('active');
      subviewGarden.classList.remove('hidden');
      subviewCalendar.classList.add('hidden');
      PixelAudio.playClickSound();
    });

    subtabCalendarBtn.addEventListener('click', () => {
      activeGardenSubtab = 'calendar';
      subtabCalendarBtn.classList.add('active');
      subtabGardenBtn.classList.remove('active');
      subviewCalendar.classList.remove('hidden');
      subviewGarden.classList.add('hidden');
      PixelAudio.playClickSound();
      renderCalendarAndChart();
    });
  }

  function renderGardenTab() {
    renderGardenGrid();
    if (activeGardenSubtab === 'calendar') {
      renderCalendarAndChart();
    }
  }

  function renderGardenGrid() {
    const gardenGrid = document.getElementById('gardenGrid');
    const emptyGardenState = document.getElementById('emptyGardenState');
    const totalTreesCount = document.getElementById('totalTreesCount');
    const totalFocusMins = document.getElementById('totalFocusMins');

    if (!gardenGrid) return;

    const trees = db.garden || [];
    const totalMins = (db.focusHistory || []).reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

    if (totalTreesCount) totalTreesCount.textContent = trees.length;
    if (totalFocusMins) totalFocusMins.textContent = totalMins;

    if (trees.length === 0) {
      gardenGrid.innerHTML = '';
      if (emptyGardenState) emptyGardenState.classList.remove('hidden');
      return;
    }

    if (emptyGardenState) emptyGardenState.classList.add('hidden');

    let html = '';
    trees.forEach(t => {
      const match = FLORA_CATALOG.find(f => f.type === t.treeType);
      const icon = t.treeIcon || (match ? match.icon : '🌳');
      const name = t.treeName || (match ? match.name : 'Pixel Plant');
      const dateStr = t.plantedAt ? new Date(t.plantedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';

      html += `
        <div class="tree-tile">
          <div class="tree-tile-icon">${icon}</div>
          <div class="tree-tile-name">${escapeHtml(name)}</div>
          <div class="tree-tile-date">${dateStr}</div>
        </div>
      `;
    });

    gardenGrid.innerHTML = html;
  }

  // Render Month Calendar & Discipline Chart
  const calPrevMonthBtn = document.getElementById('calPrevMonthBtn');
  const calNextMonthBtn = document.getElementById('calNextMonthBtn');
  const calMonthTitle = document.getElementById('calMonthTitle');

  if (calPrevMonthBtn) {
    calPrevMonthBtn.addEventListener('click', () => {
      calendarMonth.setMonth(calendarMonth.getMonth() - 1);
      PixelAudio.playClickSound();
      renderCalendarAndChart();
    });
  }

  if (calNextMonthBtn) {
    calNextMonthBtn.addEventListener('click', () => {
      calendarMonth.setMonth(calendarMonth.getMonth() + 1);
      PixelAudio.playClickSound();
      renderCalendarAndChart();
    });
  }

  function renderCalendarAndChart() {
    renderCalendarGrid();
    renderDisciplineChart();
  }

  function renderCalendarGrid() {
    const calendarDaysGrid = document.getElementById('calendarDaysGrid');
    if (!calendarDaysGrid || !calMonthTitle) return;

    const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    calMonthTitle.textContent = `${thaiMonths[month]} ${year + 543}`;

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    let html = '';

    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${prevMonthDays - i}</span></div>`;
    }

    const todayStr = formatDateKey(new Date());

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month, day);
      const dateKey = formatDateKey(dateObj);
      const isToday = dateKey === todayStr;

      const doneTasks = db.tasks.filter(t => t.completions && t.completions[dateKey]);
      const grownTrees = (db.garden || []).filter(g => g.plantedAt && g.plantedAt.startsWith(dateKey));

      let stampHTML = '';
      if (doneTasks.length > 0) stampHTML += `<span>✔️</span>`;
      if (grownTrees.length > 0) {
        const firstTree = grownTrees[0];
        const match = FLORA_CATALOG.find(f => f.type === firstTree.treeType);
        stampHTML += `<span>${firstTree.treeIcon || (match ? match.icon : '🌱')}</span>`;
      }

      html += `
        <div class="cal-day-cell ${isToday ? 'today' : ''}" data-date="${dateKey}">
          <span class="cal-day-num">${day}</span>
          <div class="cal-stamps-row">${stampHTML}</div>
        </div>
      `;
    }

    calendarDaysGrid.innerHTML = html;

    calendarDaysGrid.querySelectorAll('.cal-day-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const dStr = cell.getAttribute('data-date');
        selectedDate = new Date(dStr + 'T00:00:00');
        PixelAudio.playClickSound();
        document.querySelector('.nav-item[data-tab="tabQuests"]').click();
      });
    });
  }

  function renderDisciplineChart() {
    const chartBars = document.getElementById('disciplineChartBars');
    if (!chartBars) return;

    const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    let html = '';

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = formatDateKey(d);
      const dayName = dayLabels[d.getDay()];

      const dayDueTasks = db.tasks.filter(t => isTaskDueOnDate(t, d));
      const doneCount = dayDueTasks.filter(t => t.completions && t.completions[dateKey]).length;
      const totalCount = dayDueTasks.length;
      const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      html += `
        <div class="chart-bar-col">
          <span class="chart-bar-val">${pct}%</span>
          <div class="chart-bar-fill" style="height: ${Math.max(4, pct)}%;"></div>
          <span class="chart-bar-label">${dayName}</span>
        </div>
      `;
    }

    chartBars.innerHTML = html;
  }

  // ==========================================================================
  // TAB 4: REWARDS SHOP & PENCIL EDIT BUTTON
  // ==========================================================================

  function renderRewards() {
    const rewardsGrid = document.getElementById('rewardsGrid');
    const emptyRewardsState = document.getElementById('emptyRewardsState');
    const redeemHistoryList = document.getElementById('redeemHistoryList');

    if (!rewardsGrid) return;

    const rewards = db.rewards || [];

    if (rewards.length === 0) {
      rewardsGrid.innerHTML = '';
      if (emptyRewardsState) emptyRewardsState.classList.remove('hidden');
    } else {
      if (emptyRewardsState) emptyRewardsState.classList.add('hidden');

      let html = '';
      rewards.forEach(r => {
        const canAfford = (db.pointsBalance || 0) >= r.cost;

        html += `
          <div class="reward-card" data-id="${r.id}">
            <div class="reward-actions-top">
              <button class="reward-edit-btn" data-action="edit-reward" title="แก้ไขรางวัล">✏️</button>
              <button class="reward-delete-btn" data-action="delete-reward" title="ลบรางวัล">🗑️</button>
            </div>
            <div class="reward-icon">${r.icon || '🎁'}</div>
            <div class="reward-name">${escapeHtml(r.name)}</div>
            <div class="reward-cost">${r.cost} 🪙</div>
            <button class="pixel-btn ${canAfford ? 'btn-primary' : 'btn-secondary'} text-btn-sm" 
                    data-action="redeem" ${canAfford ? '' : 'disabled'}>
              ${canAfford ? 'แลกรางวัล' : 'แต้มไม่พอ'}
            </button>
          </div>
        `;
      });
      rewardsGrid.innerHTML = html;

      rewardsGrid.querySelectorAll('[data-action="edit-reward"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const card = e.target.closest('.reward-card');
          const rId = card.getAttribute('data-id');
          openEditRewardModal(rId);
        });
      });

      rewardsGrid.querySelectorAll('[data-action="delete-reward"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const card = e.target.closest('.reward-card');
          const rId = card.getAttribute('data-id');
          deleteReward(rId);
        });
      });

      rewardsGrid.querySelectorAll('[data-action="redeem"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const card = e.target.closest('.reward-card');
          const rId = card.getAttribute('data-id');
          redeemReward(rId);
        });
      });
    }

    if (redeemHistoryList) {
      const history = db.redeemHistory || [];
      if (history.length === 0) {
        redeemHistoryList.innerHTML = '<li class="history-item text-muted">ยังไม่มีประวัติการแลกรางวัล</li>';
      } else {
        let hHtml = '';
        history.slice().reverse().forEach(h => {
          const dStr = h.redeemedAt ? new Date(h.redeemedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
          hHtml += `
            <li class="history-item">
              <span>🎁 ${escapeHtml(h.rewardName || 'รางวัล')}</span>
              <span class="text-muted">-${h.costPaid} 🪙 (${dStr})</span>
            </li>
          `;
        });
        redeemHistoryList.innerHTML = hHtml;
      }
    }
  }

  function openEditRewardModal(rewardId) {
    const reward = db.rewards.find(r => r.id === rewardId);
    if (!reward) return;

    document.getElementById('rewardId').value = reward.id;
    document.getElementById('rewardName').value = reward.name;
    document.getElementById('rewardCost').value = reward.cost;
    document.getElementById('rewardIcon').value = reward.icon || '🎁';
    if (rewardModalTitle) rewardModalTitle.textContent = 'แก้ไขรางวัล';
    
    const deleteBtn = document.getElementById('deleteRewardBtn');
    if (deleteBtn) deleteBtn.classList.remove('hidden');

    rewardModal.classList.remove('hidden');
  }

  function deleteReward(rewardId) {
    const reward = db.rewards.find(r => r.id === rewardId);
    if (!reward) return;
    const name = reward.name || 'รางวัลนี้';

    showPixelConfirm('ลบรางวัล', `คุณต้องการลบรางวัล "${name}" หรือไม่?`, async () => {
      db.rewards = (db.rewards || []).filter(r => r.id !== rewardId);
      await saveData();
      rewardModal.classList.add('hidden');
      renderRewards();
      showToast(`ลบรางวัล "${name}" เรียบร้อย`, '🗑️');
    });
  }

  function redeemReward(rewardId) {
    const reward = db.rewards.find(r => r.id === rewardId);
    if (!reward) return;

    if ((db.pointsBalance || 0) < reward.cost) {
      showToast('แต้มสะสมของคุณไม่พอแลกรางวัลนี้', '⚠️');
      return;
    }

    showPixelConfirm('แลกรางวัล', `คุณต้องการแลกรางวัล "${reward.name}" โดยใช้ ${reward.cost} แต้มหรือไม่?`, async () => {
      db.pointsBalance -= reward.cost;

      if (!db.redeemHistory) db.redeemHistory = [];
      db.redeemHistory.push({
        id: 'red-' + Date.now(),
        rewardId: reward.id,
        rewardName: reward.name,
        costPaid: reward.cost,
        redeemedAt: new Date().toISOString()
      });

      PixelAudio.playLevelUpSound();
      showToast(`แลกรางวัล "${reward.name}" สำเร็จ!`, '🎁');
      await saveData();
      renderRewards();
    });
  }

  // Reward Modal Handlers
  const addRewardBtn = document.getElementById('addRewardBtn');
  const closeRewardModalBtn = document.getElementById('closeRewardModalBtn');
  const cancelRewardBtn = document.getElementById('cancelRewardBtn');
  const deleteRewardBtn = document.getElementById('deleteRewardBtn');

  if (addRewardBtn) {
    addRewardBtn.addEventListener('click', () => {
      document.getElementById('rewardId').value = '';
      document.getElementById('rewardName').value = '';
      document.getElementById('rewardCost').value = 100;
      document.getElementById('rewardIcon').value = '🎁';
      if (rewardModalTitle) rewardModalTitle.textContent = 'เพิ่มรางวัลใหม่';
      if (deleteRewardBtn) deleteRewardBtn.classList.add('hidden');
      rewardModal.classList.remove('hidden');
    });
  }

  if (deleteRewardBtn) {
    deleteRewardBtn.addEventListener('click', () => {
      const rewardId = document.getElementById('rewardId').value;
      if (rewardId) {
        deleteReward(rewardId);
      }
    });
  }

  if (closeRewardModalBtn) closeRewardModalBtn.addEventListener('click', () => rewardModal.classList.add('hidden'));
  if (cancelRewardBtn) cancelRewardBtn.addEventListener('click', () => rewardModal.classList.add('hidden'));

  if (rewardForm) {
    rewardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('rewardId').value;
      const name = document.getElementById('rewardName').value.trim();
      const cost = parseInt(document.getElementById('rewardCost').value) || 100;
      const icon = document.getElementById('rewardIcon').value.trim() || '🎁';

      if (id) {
        const reward = db.rewards.find(r => r.id === id);
        if (reward) {
          reward.name = name;
          reward.cost = cost;
          reward.icon = icon;
        }
      } else {
        const newReward = {
          id: 'rew-' + Date.now(),
          name,
          cost,
          icon
        };
        if (!db.rewards) db.rewards = [];
        db.rewards.push(newReward);
      }

      await saveData();
      rewardModal.classList.add('hidden');
      renderRewards();
      showToast(id ? 'บันทึกการแก้ไขรางวัลเรียบร้อย' : 'เพิ่มรางวัลใหม่สำเร็จ!', '🎁');
    });
  }

  // ==========================================================================
  // TAB 5: ACHIEVEMENTS & CATEGORY SETTINGS
  // ==========================================================================

  function checkAchievements() {
    let changed = false;
    const achievements = db.achievements || {};

    const hasCompletedTask = db.tasks.some(t => t.completions && Object.keys(t.completions).length > 0);
    if (hasCompletedTask && (!achievements.first_task || !achievements.first_task.unlocked)) {
      achievements.first_task = { unlocked: true, unlockedAt: new Date().toISOString() };
      showToast('ปลดล็อก Achievement: First Quest Completed! 🏅', '🎉');
      changed = true;
    }

    const focusCount = (db.focusHistory || []).length;
    if (focusCount >= 5 && (!achievements.focus_5_sessions || !achievements.focus_5_sessions.unlocked)) {
      achievements.focus_5_sessions = { unlocked: true, unlockedAt: new Date().toISOString() };
      showToast('ปลดล็อก Achievement: Focus Master! 🏅', '🎉');
      changed = true;
    }

    const treeCount = (db.garden || []).length;
    if (treeCount >= 3 && (!achievements.garden_3_trees || !achievements.garden_3_trees.unlocked)) {
      achievements.garden_3_trees = { unlocked: true, unlockedAt: new Date().toISOString() };
      showToast('ปลดล็อก Achievement: Green Thumb! 🏅', '🎉');
      changed = true;
    }

    db.achievements = achievements;
    if (changed) {
      StorageBridge.setData(db);
    }
  }

  function renderSettings() {
    renderMasterQuestDashboard();
    renderAchievements();
    renderCategoryManageList();
  }

  function renderMasterQuestDashboard() {
    const container = document.getElementById('masterQuestDashboard');
    if (!container) return;

    const categories = db.categories || [];
    const allTasks = db.tasks || [];

    if (categories.length === 0) {
      container.innerHTML = '<div class="text-sm text-muted text-center" style="padding: 12px;">ยังไม่มีหมวดหมู่</div>';
      return;
    }

    let toolbarHtml = `
      <div class="master-quest-toolbar">
        <button class="pixel-btn text-btn-sm" id="expandAllCatBtn">▾ ขยายทั้งหมด</button>
        <button class="pixel-btn text-btn-sm" id="collapseAllCatBtn">▴ ยุบทั้งหมด</button>
      </div>
    `;

    let html = toolbarHtml;
    categories.forEach((cat, index) => {
      const catTasks = allTasks.filter(t => !t.archived && (t.categoryId === cat.id || (!t.categoryId && cat.id === categories[0].id)));
      
      let tasksHtml = '';
      if (catTasks.length === 0) {
        tasksHtml = '<div class="text-xs text-muted text-center" style="padding: 8px;">ยังไม่มีเควสต์ในหมวดนี้</div>';
      } else {
        catTasks.forEach(task => {
          const rec = task.recurrence || { type: 'daily' };
          let recText = '🔁 ทุกวัน';
          if (rec.type === 'none') recText = '🕒 ไม่ซ้ำ';
          else if (rec.type === 'weekly') {
            const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
            const daysList = (rec.days || []).map(d => dayNames[d]).join(', ');
            recText = `🔁 สัปดาห์ (${daysList || 'ทุกวัน'})`;
          } else if (rec.type === 'monthly') {
            recText = `🔁 ทุกวันที่ ${rec.dateOfMonth || 1}`;
          }

          const timeText = task.reminderTime ? ` ⏰ ${task.reminderTime}` : '';
          const notePreview = task.note ? `<div class="text-xs text-muted margin-top-xs" style="white-space:pre-line;">${escapeHtml(task.note)}</div>` : '';

          tasksHtml += `
            <div class="master-quest-item" data-task-id="${task.id}">
              <div class="master-quest-info">
                <div class="master-quest-title">${escapeHtml(task.title)}</div>
                ${notePreview}
                <div class="master-quest-meta">
                  <span class="due-badge due-today">${recText}${timeText}</span>
                  <span class="points-badge">+${task.points || 10} 🪙</span>
                </div>
              </div>
              <div class="master-quest-actions">
                <button class="action-btn-sm" data-action="master-edit-task" title="แก้ไข">✏️</button>
                <button class="action-btn-sm" data-action="master-delete-task" title="ลบ">🗑️</button>
              </div>
            </div>
          `;
        });
      }

      // Default first category open, others collapsed to save vertical space
      const isCollapsed = index > 0;

      html += `
        <div class="master-cat-group ${isCollapsed ? 'collapsed' : ''}" data-cat-id="${cat.id}">
          <div class="master-cat-header">
            <div class="master-cat-title" style="color: ${cat.color || '#ff6b00'};">
              <span>${cat.icon || '🏷️'}</span>
              <span>${escapeHtml(cat.name)}</span>
              <span class="text-xs text-muted">(${catTasks.length} เควสต์)</span>
            </div>
            <div class="master-cat-header-right">
              <button class="pixel-btn text-btn-sm" data-action="master-add-task">+ เพิ่ม</button>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="master-quest-list">
            ${tasksHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Accordion Header Click to toggle collapse
    container.querySelectorAll('.master-cat-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // If clicking on "+ เพิ่ม" button, don't toggle accordion
        if (e.target.closest('[data-action="master-add-task"]')) return;
        const group = header.closest('.master-cat-group');
        group.classList.toggle('collapsed');
        PixelAudio.playClickSound();
      });
    });

    // Toolbar Expand / Collapse All
    const expandAllBtn = document.getElementById('expandAllCatBtn');
    const collapseAllBtn = document.getElementById('collapseAllCatBtn');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.master-cat-group').forEach(g => g.classList.remove('collapsed'));
        PixelAudio.playClickSound();
      });
    }
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.master-cat-group').forEach(g => g.classList.add('collapsed'));
        PixelAudio.playClickSound();
      });
    }

    // Attach event listeners for Master Dashboard Actions
    container.querySelectorAll('[data-action="master-add-task"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const group = e.target.closest('.master-cat-group');
        const catId = group.getAttribute('data-cat-id');
        openAddTaskModal(catId);
      });
    });

    container.querySelectorAll('[data-action="master-edit-task"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.master-quest-item');
        const taskId = item.getAttribute('data-task-id');
        openEditTaskModal(taskId);
      });
    });

    container.querySelectorAll('[data-action="master-delete-task"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.master-quest-item');
        const taskId = item.getAttribute('data-task-id');
        deleteTask(taskId);
      });
    });
  }

  function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;

    const achDefs = [
      { id: 'first_task', title: 'First Quest', desc: 'ทำเควสต์แรกสำเร็จ', icon: '⚔️' },
      { id: 'focus_5_sessions', title: 'Focus Master', desc: 'สะสมสมาธิครบ 5 ครั้ง', icon: '⏱️' },
      { id: 'garden_3_trees', title: 'Green Thumb', desc: 'ปลูกต้นไม้ครบ 3 ต้น', icon: '🌳' },
      { id: 'streak_7_days', title: 'Unstoppable', desc: 'ทำเควสต์ต่อเนื่อง 7 วัน', icon: '🔥' }
    ];

    const achState = db.achievements || {};

    let html = '';
    achDefs.forEach(def => {
      const state = achState[def.id] || { unlocked: false };
      html += `
        <div class="achievement-badge ${state.unlocked ? 'unlocked' : ''}">
          <div class="badge-icon">${def.icon}</div>
          <div class="badge-title">${def.title}</div>
          <div class="badge-desc">${def.desc}</div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  function renderCategoryManageList() {
    const list = document.getElementById('categoryManageList');
    if (!list) return;

    let html = '';
    db.categories.forEach(cat => {
      html += `
        <div class="category-item-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:${cat.color}; font-size:1.2rem;">${cat.icon || '🏷️'}</span>
            <span>${escapeHtml(cat.name)}</span>
          </div>
          <button class="action-btn-sm" data-cat-delete="${cat.id}">🗑️</button>
        </div>
      `;
    });

    list.innerHTML = html;

    list.querySelectorAll('[data-cat-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-delete');
        if (db.categories.length <= 1) {
          showToast('ไม่สามารถลบหมวดหมู่สุดท้ายได้', '⚠️');
          return;
        }
        showPixelConfirm('ลบหมวดหมู่', 'คุณต้องการลบหมวดหมู่นี้หรือไม่?', async () => {
          db.categories = db.categories.filter(c => c.id !== catId);
          await saveData();
          renderCategoryManageList();
          renderCategoryFilters();
          showToast('ลบหมวดหมู่เรียบร้อย', '🗑️');
        });
      });
    });
  }

  // Category Modal Handlers
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
  const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');

  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      document.getElementById('categoryId').value = '';
      document.getElementById('categoryName').value = '';
      document.getElementById('categoryColor').value = '#ff6b00';
      document.getElementById('categoryIcon').value = '🏷️';
      categoryModal.classList.remove('hidden');
    });
  }

  if (closeCategoryModalBtn) closeCategoryModalBtn.addEventListener('click', () => categoryModal.classList.add('hidden'));
  if (cancelCategoryBtn) cancelCategoryBtn.addEventListener('click', () => categoryModal.classList.add('hidden'));

  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('categoryName').value.trim();
      const color = document.getElementById('categoryColor').value;
      const icon = document.getElementById('categoryIcon').value.trim() || '🏷️';

      const newCat = {
        id: 'cat-' + Date.now(),
        name,
        color,
        icon
      };

      db.categories.push(newCat);
      await saveData();
      categoryModal.classList.add('hidden');
      renderCategoryManageList();
      renderCategoryFilters();
      showToast('เพิ่มหมวดหมู่ใหม่สำเร็จ!', '🏷️');
    });
  }

  // Backup Export / Import Handlers
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importFileInput = document.getElementById('importFileInput');

  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `pixel_quest_backup_${formatDateKey(new Date())}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Export ข้อมูลสำเร็จ!', '📥');
    });
  }

  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedObj = JSON.parse(event.target.result);
          if (importedObj && Array.isArray(importedObj.tasks)) {
            db = importedObj;
            await saveData();
            renderCurrentTab();
            showToast('Import ข้อมูลสำเร็จ!', '📤');
          } else {
            alert('รูปแบบไฟล์ JSON ไม่ถูกต้อง');
          }
        } catch (err) {
          alert('เกิดข้อผิดพลาดในการอ่านไฟล์ JSON');
        }
      };
      reader.readAsText(file);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initial Instant Boot
  updateDateDisplay();
  renderCurrentTab();
  
  setTimeout(() => {
    processMissedTaskPenalties();
  }, 500);
});
