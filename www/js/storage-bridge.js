/**
 * PIXEL QUEST - STORAGE BRIDGE
 * Single Source of Truth storage bridge for both Browser (localStorage)
 * and Android Native Widget (SharedPreferences via Capacitor Plugin)
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
    achievements: {
      first_task: { unlocked: false, unlockedAt: null },
      focus_5_sessions: { unlocked: false, unlockedAt: null },
      garden_3_trees: { unlocked: false, unlockedAt: null },
      streak_7_days: { unlocked: false, unlockedAt: null }
    }
  };

  /**
   * Check if Native Capacitor StorageBridge Plugin exists
   */
  function getNativePlugin() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StorageBridge) {
      return window.Capacitor.Plugins.StorageBridge;
    }
    return null;
  }

  /**
   * Fetch data JSON object
   */
  async function getData() {
    try {
      const nativePlugin = getNativePlugin();
      let rawJson = null;

      if (nativePlugin && typeof nativePlugin.getData === 'function') {
        const res = await nativePlugin.getData();
        rawJson = res ? res.value : null;
      } else {
        rawJson = localStorage.getItem(STORAGE_KEY);
      }

      if (!rawJson) {
        // Save default seed data if empty
        await setData(defaultData);
        return JSON.parse(JSON.stringify(defaultData));
      }

      const parsed = JSON.parse(rawJson);

      // Sanity fallback for missing top-level keys
      return {
        tasks: parsed.tasks || defaultData.tasks,
        categories: parsed.categories || defaultData.categories,
        rewards: parsed.rewards || defaultData.rewards,
        redeemHistory: parsed.redeemHistory || [],
        pointsBalance: typeof parsed.pointsBalance === 'number' ? parsed.pointsBalance : 0,
        focusHistory: parsed.focusHistory || [],
        garden: parsed.garden || [],
        achievements: Object.assign({}, defaultData.achievements, parsed.achievements || {})
      };
    } catch (err) {
      console.error('StorageBridge.getData error:', err);
      return JSON.parse(JSON.stringify(defaultData));
    }
  }

  /**
   * Save data JSON object
   */
  async function setData(dataObj) {
    try {
      const jsonStr = JSON.stringify(dataObj);
      const nativePlugin = getNativePlugin();

      if (nativePlugin && typeof nativePlugin.setData === 'function') {
        await nativePlugin.setData({ value: jsonStr });
      } else {
        localStorage.setItem(STORAGE_KEY, jsonStr);
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
