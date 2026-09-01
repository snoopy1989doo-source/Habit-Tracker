/**
 * PIXEL QUEST - DUAL STORAGE BRIDGE
 * Synchronizes state across Browser LocalStorage, Capacitor Bridge,
 * and Native Android SharedPreferences for Home Screen Widgets.
 */

window.StorageBridge = (function () {
  const STORAGE_KEY = 'pixel_quest_data';

  // Default Seed Data Schema
  const defaultData = {
    tasks: [
      {
        id: 'task-seed-1',
        title: 'ดื่มน้ำ 2 ลิตร 💧',
        categoryId: 'cat-health',
        points: 10,
        recurrence: { type: 'daily', days: [], dateOfMonth: null },
        reminderTime: '08:30',
        completions: {},
        createdAt: new Date().toISOString(),
        createdAtKey: new Date().toISOString().split('T')[0],
        archived: false
      },
      {
        id: 'task-seed-2',
        title: 'อ่านหนังสือ 20 นาที 📖',
        categoryId: 'cat-mind',
        points: 15,
        recurrence: { type: 'daily', days: [], dateOfMonth: null },
        reminderTime: '20:00',
        completions: {},
        createdAt: new Date().toISOString(),
        createdAtKey: new Date().toISOString().split('T')[0],
        archived: false
      }
    ],
    categories: [
      { id: 'cat-health', name: 'สุขภาพ', color: '#10b981', icon: '❤️' },
      { id: 'cat-mind', name: 'ความรู้', color: '#a855f7', icon: '📚' },
      { id: 'cat-quest', name: 'เควสต์ทั่วไป', color: '#ff6b00', icon: '⚔️' }
    ],
    rewards: [
      { id: 'rew-seed-1', name: 'ดื่มชานมมุก 🧋', cost: 100, icon: '🧋' },
      { id: 'rew-seed-2', name: 'ดูซีรีส์ 1 ตอน 🍿', cost: 150, icon: '🍿' }
    ],
    redeemHistory: [],
    pointsBalance: 50,
    focusHistory: [],
    garden: [],
    penaltiesProcessed: {},
    penaltyEnabled: true,
    achievements: {
      first_task: { unlocked: false, unlockedAt: null },
      focus_5_sessions: { unlocked: false, unlockedAt: null },
      garden_3_trees: { unlocked: false, unlockedAt: null },
      streak_7_days: { unlocked: false, unlockedAt: null }
    }
  };

  /**
   * Get Native Bridge Interface (Direct Android Interface or Capacitor Plugin)
   */
  function getDirectAndroidBridge() {
    if (window.AndroidStorageBridge && typeof window.AndroidStorageBridge.getRawData === 'function') {
      return window.AndroidStorageBridge;
    }
    return null;
  }

  function getCapacitorPlugin() {
    if (window.Capacitor) {
      if (window.Capacitor.Plugins && window.Capacitor.Plugins.StorageBridge) {
        return window.Capacitor.Plugins.StorageBridge;
      }
      if (typeof window.Capacitor.registerPlugin === 'function') {
        try {
          return window.Capacitor.registerPlugin('StorageBridge');
        } catch (e) {}
      }
    }
    return null;
  }

  /**
   * Fetch data JSON object
   */
  async function getData() {
    try {
      let rawJson = null;

      // 1. Try Direct Android Interface
      const androidBridge = getDirectAndroidBridge();
      if (androidBridge) {
        rawJson = androidBridge.getRawData();
      }

      // 2. Try Capacitor Plugin
      if (!rawJson) {
        const capPlugin = getCapacitorPlugin();
        if (capPlugin && typeof capPlugin.getData === 'function') {
          const res = await capPlugin.getData();
          rawJson = res ? res.value : null;
        }
      }

      // 3. Fallback to localStorage
      if (!rawJson) {
        rawJson = localStorage.getItem(STORAGE_KEY);
      }

      if (!rawJson) {
        await setData(defaultData);
        return JSON.parse(JSON.stringify(defaultData));
      }

      const parsed = JSON.parse(rawJson);

      const normalized = {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : defaultData.tasks,
        categories: Array.isArray(parsed.categories) ? parsed.categories : defaultData.categories,
        rewards: Array.isArray(parsed.rewards) ? parsed.rewards : defaultData.rewards,
        redeemHistory: Array.isArray(parsed.redeemHistory) ? parsed.redeemHistory : [],
        pointsBalance: typeof parsed.pointsBalance === 'number' ? parsed.pointsBalance : 0,
        focusHistory: Array.isArray(parsed.focusHistory) ? parsed.focusHistory : [],
        garden: Array.isArray(parsed.garden) ? parsed.garden : [],
        penaltiesProcessed: parsed.penaltiesProcessed && typeof parsed.penaltiesProcessed === 'object' ? parsed.penaltiesProcessed : {},
        penaltyEnabled: parsed.penaltyEnabled !== false,
        achievements: Object.assign({}, defaultData.achievements, parsed.achievements || {})
      };

      // Always ensure native layer is immediately in sync on boot
      setData(normalized);

      return normalized;
    } catch (err) {
      console.error('StorageBridge.getData error:', err);
      return JSON.parse(JSON.stringify(defaultData));
    }
  }

  /**
   * Save data JSON object to ALL storage layers
   */
  async function setData(dataObj) {
    try {
      const jsonStr = JSON.stringify(dataObj);

      // 1. Save to localStorage
      localStorage.setItem(STORAGE_KEY, jsonStr);

      // 2. Save to Direct Android Bridge (Native SharedPreferences)
      const androidBridge = getDirectAndroidBridge();
      if (androidBridge) {
        androidBridge.setRawData(jsonStr);
      }

      // 3. Save to Capacitor Plugin
      const capPlugin = getCapacitorPlugin();
      if (capPlugin && typeof capPlugin.setData === 'function') {
        await capPlugin.setData({ value: jsonStr });
      }

      return true;
    } catch (err) {
      console.error('StorageBridge.setData error:', err);
      return false;
    }
  }

  return {
    getData,
    setData,
    defaultData
  };
})();
