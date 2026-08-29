/**
 * PIXEL QUEST - CORE APPLICATION LOGIC
 */

document.addEventListener('DOMContentLoaded', async () => {
  // App State
  let db = await StorageBridge.getData();
  let selectedDate = new Date(); // Current date view
  let activeTab = 'tabQuests';
  let activeCategoryFilter = 'all';

  // Focus Timer State
  let focusInterval = null;
  let focusTotalSeconds = 15 * 60;
  let focusRemainingSeconds = 15 * 60;
  let isFocusRunning = false;
  let focusEndTime = null;
  let selectedFocusMins = 15;

  // DOM Elements
  const headerPointsVal = document.getElementById('headerPointsVal');
  const headerStreakVal = document.getElementById('headerStreakVal');
  const currentDateTitle = document.getElementById('currentDateTitle');
  const currentDateSubtitle = document.getElementById('currentDateSubtitle');

  const taskListContainer = document.getElementById('taskListContainer');
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

  const rewardModal = document.getElementById('rewardModal');
  const rewardForm = document.getElementById('rewardForm');
  const categoryModal = document.getElementById('categoryModal');
  const categoryForm = document.getElementById('categoryForm');

  // Focus Elements
  const focusPlantVisual = document.getElementById('focusPlantVisual');
  const focusTimerDigits = document.getElementById('focusTimerDigits');
  const focusStatusBadge = document.getElementById('focusStatusBadge');
  const startFocusBtn = document.getElementById('startFocusBtn');
  const giveupFocusBtn = document.getElementById('giveupFocusBtn');
  const expectedPointsVal = document.getElementById('expectedPointsVal');
  const expectedTreeVal = document.getElementById('expectedTreeVal');

  // Helper Functions
  function formatDateKey(dateObj) {
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
    }, 3000);
  }

  async function saveData() {
    await StorageBridge.setData(db);
    renderHeaderStats();
    checkAchievements();
  }

  // ==========================================================================
  // NAVIGATION & TAB SWITCHING
  // ==========================================================================

  const navItems = document.querySelectorAll('.nav-item');
  const tabPages = document.querySelectorAll('.tab-page');

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      PixelAudio.playClickSound();

      navItems.forEach(n => n.classList.remove('active'));
      tabPages.forEach(p => p.classList.remove('active-tab'));

      btn.classList.add('active');
      const targetPage = document.getElementById(targetTab);
      if (targetPage) targetPage.classList.add('active-tab');

      activeTab = targetTab;
      renderCurrentTab();
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
      renderGarden();
    } else if (activeTab === 'tabRewards') {
      renderRewards();
    } else if (activeTab === 'tabSettings') {
      renderSettings();
    }
  }

  function renderHeaderStats() {
    if (headerPointsVal) headerPointsVal.textContent = db.pointsBalance || 0;
    
    // Calculate Streak
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
        // If no tasks due today or past, continue checking yesterday
        curr.setDate(curr.getDate() - 1);
        if (streak > 365) break;
        continue;
      }
      const completedCount = dayTasks.filter(t => t.completions && t.completions[key]).length;
      if (completedCount > 0) {
        streak++;
        curr.setDate(curr.getDate() - 1);
      } else {
        // Break streak if skipped past days
        if (!isSameDay(curr, new Date())) break;
        curr.setDate(curr.getDate() - 1);
      }
    }
    return streak;
  }

  // ==========================================================================
  // TAB 1: QUEST BOARD & RECURRENCE LOGIC
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
    const createdStr = task.createdAt ? task.createdAt.split('T')[0] : '2026-01-01';

    // One-time tasks must not be shown before creation date
    if (dateStr < createdStr) return false;

    const rec = task.recurrence || { type: 'daily' };
    if (rec.type === 'none') {
      return dateStr === createdStr;
    } else if (rec.type === 'daily') {
      return true;
    } else if (rec.type === 'weekly') {
      const dayOfWeek = dateObj.getDay(); // 0-6
      return Array.isArray(rec.days) && rec.days.includes(dayOfWeek);
    } else if (rec.type === 'monthly') {
      const dayOfMonth = dateObj.getDate();
      return rec.dateOfMonth === dayOfMonth;
    }
    return true;
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
    if (!taskListContainer) return;

    const dateKey = formatDateKey(selectedDate);
    let dayTasks = db.tasks.filter(t => isTaskDueOnDate(t, selectedDate));

    if (activeCategoryFilter !== 'all') {
      dayTasks = dayTasks.filter(t => t.categoryId === activeCategoryFilter);
    }

    if (dayTasks.length === 0) {
      taskListContainer.innerHTML = '';
      emptyTasksState.classList.remove('hidden');
      updateProgress(0, 0);
      return;
    }

    emptyTasksState.classList.add('hidden');
    let completedCount = 0;

    let html = '';
    dayTasks.forEach(task => {
      const isDone = !!(task.completions && task.completions[dateKey]);
      if (isDone) completedCount++;

      const cat = db.categories.find(c => c.id === task.categoryId) || { name: 'ทั่วไป', color: '#ff6b00', icon: '⚔️' };

      html += `
        <div class="task-item ${isDone ? 'completed' : ''}" data-id="${task.id}">
          <div class="task-checkbox" data-action="toggle">
            ${isDone ? '✓' : ''}
          </div>
          <div class="task-content">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
              <span class="cat-badge" style="background:${cat.color}">
                <span>${cat.icon}</span> ${escapeHtml(cat.name)}
              </span>
              <span class="points-badge">+${task.points || 10} 🪙</span>
              ${task.reminderTime ? `<span>⏰ ${task.reminderTime}</span>` : ''}
            </div>
          </div>
          <div class="task-actions">
            <button class="action-btn-sm" data-action="edit" title="แก้ไข">✏️</button>
            <button class="action-btn-sm" data-action="delete" title="ลบ">🗑️</button>
          </div>
        </div>
      `;
    });

    taskListContainer.innerHTML = html;
    updateProgress(completedCount, dayTasks.length);

    // Event listeners on tasks
    taskListContainer.querySelectorAll('.task-item').forEach(item => {
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
      showToast(`ยกเลิกเควสต์ (-${points} 🪙)`, '↩️');
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
  const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
  const cancelTaskBtn = document.getElementById('cancelTaskBtn');

  if (addTaskFab) addTaskFab.addEventListener('click', openAddTaskModal);
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

  function openAddTaskModal() {
    populateCategorySelect('taskCategory');
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskPoints').value = 10;
    taskRecurrenceType.value = 'daily';
    weeklyDaysGroup.classList.add('hidden');
    monthlyDateGroup.classList.add('hidden');
    document.getElementById('taskReminderTime').value = '';
    taskModalTitle.textContent = 'เพิ่มเควสต์ใหม่';
    taskModal.classList.remove('hidden');
  }

  function openEditTaskModal(taskId) {
    const task = db.tasks.find(t => t.id === taskId);
    if (!task) return;

    populateCategorySelect('taskCategory');
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
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

      if (id) {
        // Edit existing
        const task = db.tasks.find(t => t.id === id);
        if (task) {
          task.title = title;
          task.categoryId = categoryId;
          task.points = points;
          task.recurrence = recurrence;
          task.reminderTime = reminderTime;
        }
      } else {
        // Add new task
        const newTask = {
          id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          title,
          categoryId,
          points,
          recurrence,
          reminderTime,
          completions: {},
          createdAt: new Date().toISOString(),
          archived: false
        };
        db.tasks.push(newTask);
      }

      await saveData();
      closeTaskModal();
      renderTasks();
      showToast(id ? 'บันทึกการแก้ไขเควสต์แล้ว' : 'เพิ่มเควสต์ใหม่สำเร็จ!', '⚔️');
    });
  }

  async function deleteTask(taskId) {
    if (confirm('คุณต้องการลบเควสต์นี้หรือไม่?')) {
      db.tasks = db.tasks.filter(t => t.id !== taskId);
      await saveData();
      renderTasks();
      showToast('ลบเควสต์เรียบร้อย', '🗑️');
    }
  }

  // ==========================================================================
  // TAB 2: FOCUS REALM (Pomodoro & Plant Growth)
  // ==========================================================================

  const focusPresetButtons = document.querySelectorAll('#focusPresetGroup .preset-btn');
  focusPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isFocusRunning) return;
      focusPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFocusMins = parseInt(btn.getAttribute('data-mins')) || 15;
      focusTotalSeconds = selectedFocusMins * 60;
      focusRemainingSeconds = focusTotalSeconds;
      updateFocusDisplay();
    });
  });

  if (startFocusBtn) {
    startFocusBtn.addEventListener('click', () => {
      if (isFocusRunning) return;
      startFocusTimer();
    });
  }

  if (giveupFocusBtn) {
    giveupFocusBtn.addEventListener('click', () => {
      if (confirm('คุณแน่ใจหรือว่าต้องการยกเลิกการสะสมสมาธิรอบนี้?')) {
        stopFocusTimer(false);
      }
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
      // Award Points & Plant Tree
      const pointsEarned = Math.round(selectedFocusMins * 0.6);
      db.pointsBalance = (db.pointsBalance || 0) + pointsEarned;

      const treeTypes = ['oak', 'pine', 'sakura', 'magic_crystal'];
      const randomTreeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];

      const newTree = {
        id: 'tree-' + Date.now(),
        treeType: randomTreeType,
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
        treeType: randomTreeType
      });

      PixelAudio.playFocusCompleteSound();
      showToast(`ปลูกต้นไม้สำเร็จ! ได้รับ +${pointsEarned} 🪙`, '🌳');
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

    // Expected Rewards Text
    const pts = Math.round(selectedFocusMins * 0.6);
    if (expectedPointsVal) expectedPointsVal.textContent = `+${pts} 🪙`;

    // Calculate growth frame (0 to 4)
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
      // Seed / Sprout
      svgContent = `
        <svg width="80" height="80" viewBox="0 0 100 100">
          <ellipse cx="50" cy="85" rx="15" ry="5" fill="#3e2723"/>
          <path d="M50 85 Q50 65 52 55" stroke="#4caf50" stroke-width="6" fill="none"/>
          <circle cx="56" cy="52" r="6" fill="#81c784"/>
        </svg>
      `;
    } else if (stage === 2) {
      // Young Sprout
      svgContent = `
        <svg width="100" height="100" viewBox="0 0 100 100">
          <path d="M50 85 L50 45" stroke="#388e3c" stroke-width="8" stroke-linecap="round"/>
          <path d="M50 60 Q30 50 35 40 Q50 45 50 60" fill="#66bb6a"/>
          <path d="M50 50 Q70 40 65 30 Q50 35 50 50" fill="#81c784"/>
        </svg>
      `;
    } else if (stage === 3) {
      // Growing Tree
      svgContent = `
        <svg width="120" height="120" viewBox="0 0 100 100">
          <path d="M50 90 L50 40" stroke="#4e342e" stroke-width="12" stroke-linecap="round"/>
          <circle cx="50" cy="35" r="25" fill="#2e7d32"/>
          <circle cx="38" cy="40" r="18" fill="#388e3c"/>
          <circle cx="62" cy="40" r="18" fill="#4caf50"/>
        </svg>
      `;
    } else {
      // Flourishing Tree
      svgContent = `
        <svg width="140" height="140" viewBox="0 0 100 100">
          <path d="M50 90 L50 35" stroke="#3e2723" stroke-width="16" stroke-linecap="round"/>
          <circle cx="50" cy="30" r="32" fill="#1b5e20"/>
          <circle cx="32" cy="38" r="24" fill="#2e7d32"/>
          <circle cx="68" cy="38" r="24" fill="#4caf50"/>
          <circle cx="50" cy="18" r="20" fill="#81c784"/>
          <!-- Red Apples / Oranges -->
          <circle cx="40" cy="30" r="4" fill="#ff3d00"/>
          <circle cx="62" cy="35" r="4" fill="#ff9e00"/>
          <circle cx="50" cy="45" r="4" fill="#ff3d00"/>
        </svg>
      `;
    }
    focusPlantVisual.innerHTML = svgContent;
  }

  // ==========================================================================
  // TAB 3: PIXEL GARDEN
  // ==========================================================================

  function renderGarden() {
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
      const treeIconMap = { oak: '🌳', pine: '🌲', sakura: '🌸', magic_crystal: '🔮' };
      const treeNameMap = { oak: 'Pixel Oak', pine: 'Pixel Pine', sakura: 'Sakura Tree', magic_crystal: 'Crystal Tree' };

      const icon = treeIconMap[t.treeType] || '🌳';
      const name = treeNameMap[t.treeType] || 'Pixel Tree';
      const dateStr = t.plantedAt ? new Date(t.plantedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';

      html += `
        <div class="tree-tile">
          <div class="tree-tile-icon">${icon}</div>
          <div class="tree-tile-name">${name}</div>
          <div class="tree-tile-date">${dateStr}</div>
        </div>
      `;
    });

    gardenGrid.innerHTML = html;
  }

  // ==========================================================================
  // TAB 4: REWARDS SHOP
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

      rewardsGrid.querySelectorAll('[data-action="redeem"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const card = e.target.closest('.reward-card');
          const rId = card.getAttribute('data-id');
          redeemReward(rId);
        });
      });
    }

    // Render Redeem History
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

  async function redeemReward(rewardId) {
    const reward = db.rewards.find(r => r.id === rewardId);
    if (!reward) return;

    if ((db.pointsBalance || 0) < reward.cost) {
      showToast('แต้มสะสมของคุณไม่พอแลกรางวัลนี้', '⚠️');
      return;
    }

    if (confirm(`คุณต้องการแลกรางวัล "${reward.name}" โดยใช้ ${reward.cost} แต้มหรือไม่?`)) {
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
    }
  }

  // Reward Modal Handlers
  const addRewardBtn = document.getElementById('addRewardBtn');
  const closeRewardModalBtn = document.getElementById('closeRewardModalBtn');
  const cancelRewardBtn = document.getElementById('cancelRewardBtn');

  if (addRewardBtn) {
    addRewardBtn.addEventListener('click', () => {
      document.getElementById('rewardId').value = '';
      document.getElementById('rewardName').value = '';
      document.getElementById('rewardCost').value = 100;
      document.getElementById('rewardIcon').value = '🎁';
      rewardModal.classList.remove('hidden');
    });
  }

  if (closeRewardModalBtn) closeRewardModalBtn.addEventListener('click', () => rewardModal.classList.add('hidden'));
  if (cancelRewardBtn) cancelRewardBtn.addEventListener('click', () => rewardModal.classList.add('hidden'));

  if (rewardForm) {
    rewardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('rewardName').value.trim();
      const cost = parseInt(document.getElementById('rewardCost').value) || 100;
      const icon = document.getElementById('rewardIcon').value.trim() || '🎁';

      const newReward = {
        id: 'rew-' + Date.now(),
        name,
        cost,
        icon
      };

      if (!db.rewards) db.rewards = [];
      db.rewards.push(newReward);

      await saveData();
      rewardModal.classList.add('hidden');
      renderRewards();
      showToast('เพิ่มรางวัลใหม่สำเร็จ!', '🎁');
    });
  }

  // ==========================================================================
  // TAB 5: ACHIEVEMENTS & CATEGORY SETTINGS
  // ==========================================================================

  function checkAchievements() {
    let changed = false;
    const achievements = db.achievements || {};

    // 1. First Task
    const hasCompletedTask = db.tasks.some(t => t.completions && Object.keys(t.completions).length > 0);
    if (hasCompletedTask && (!achievements.first_task || !achievements.first_task.unlocked)) {
      achievements.first_task = { unlocked: true, unlockedAt: new Date().toISOString() };
      showToast('ปลดล็อก Achievement: First Quest Completed! 🏅', '🎉');
      changed = true;
    }

    // 2. Focus 5 Sessions
    const focusCount = (db.focusHistory || []).length;
    if (focusCount >= 5 && (!achievements.focus_5_sessions || !achievements.focus_5_sessions.unlocked)) {
      achievements.focus_5_sessions = { unlocked: true, unlockedAt: new Date().toISOString() };
      showToast('ปลดล็อก Achievement: Focus Master! 🏅', '🎉');
      changed = true;
    }

    // 3. Garden 3 Trees
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
    renderAchievements();
    renderCategoryManageList();
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
      btn.addEventListener('click', async () => {
        const catId = btn.getAttribute('data-cat-delete');
        if (db.categories.length <= 1) {
          showToast('ไม่สามารถลบหมวดหมู่สุดท้ายได้', '⚠️');
          return;
        }
        if (confirm('คุณต้องการลบหมวดหมู่นี้หรือไม่?')) {
          db.categories = db.categories.filter(c => c.id !== catId);
          await saveData();
          renderCategoryManageList();
          renderCategoryFilters();
        }
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

  // Initial Boot
  updateDateDisplay();
  renderCurrentTab();
});
