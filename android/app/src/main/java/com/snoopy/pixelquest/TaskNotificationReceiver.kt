package com.snoopy.pixelquest

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random

class TaskNotificationReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_COMPLETE_TASK = "com.snoopy.pixelquest.ACTION_COMPLETE_TASK"
        const val ACTION_SHOW_REMINDER = "com.snoopy.pixelquest.ACTION_SHOW_REMINDER"
        const val ACTION_FOCUS_PAUSE = "com.snoopy.pixelquest.ACTION_FOCUS_PAUSE"
        const val ACTION_FOCUS_RESUME = "com.snoopy.pixelquest.ACTION_FOCUS_RESUME"
        const val ACTION_FOCUS_GIVEUP = "com.snoopy.pixelquest.ACTION_FOCUS_GIVEUP"
        const val ACTION_FOCUS_EXPIRED = "com.snoopy.pixelquest.ACTION_FOCUS_EXPIRED"

        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_DATE_KEY = "extra_date_key"
        const val EXTRA_NOTIF_ID = "extra_notif_id"
        const val EXTRA_FOCUS_MINS = "extra_focus_mins"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        when (action) {
            ACTION_COMPLETE_TASK -> {
                handleCompleteTask(context, intent)
            }
            ACTION_SHOW_REMINDER -> {
                handleShowReminder(context, intent)
            }
            ACTION_FOCUS_PAUSE -> {
                handleFocusPause(context)
            }
            ACTION_FOCUS_RESUME -> {
                handleFocusResume(context)
            }
            ACTION_FOCUS_GIVEUP -> {
                handleFocusGiveUp(context)
            }
            ACTION_FOCUS_EXPIRED -> {
                handleFocusExpired(context, intent)
            }
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> {
                TaskNotificationHelper.rescheduleAll(context)
                StorageBridgePlugin.refreshAllWidgets(context)
            }
        }
    }

    private fun handleCompleteTask(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val dateKey = intent.getStringExtra(EXTRA_DATE_KEY) ?: sdfKey.format(Date())
        val notifId = intent.getIntExtra(EXTRA_NOTIF_ID, taskId.hashCode())

        try {
            val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("pixel_quest_data", null) ?: return
            val rootObj = JSONObject(jsonString)
            val tasksArray = rootObj.optJSONArray("tasks") ?: return
            var pointsBalance = rootObj.optInt("pointsBalance", 0)

            var taskTitle = "เควสต์"
            var taskPoints = 10
            var modified = false

            for (i in 0 until tasksArray.length()) {
                val t = tasksArray.getJSONObject(i)
                if (t.optString("id") == taskId) {
                    taskTitle = t.optString("title", "เควสต์")
                    taskPoints = t.optInt("points", 10)

                    var completions = t.optJSONObject("completions")
                    if (completions == null) {
                        completions = JSONObject()
                        t.put("completions", completions)
                    }

                    if (!completions.optBoolean(dateKey, false)) {
                        completions.put(dateKey, true)
                        pointsBalance += taskPoints
                        rootObj.put("pointsBalance", pointsBalance)
                        modified = true
                    }
                    break
                }
            }

            if (modified) {
                val editor = prefs.edit()
                editor.putString("pixel_quest_data", rootObj.toString())
                editor.commit()

                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(notifId)

                StorageBridgePlugin.refreshAllWidgets(context)
                Toast.makeText(context, "✔ ทำเควสต์ \"$taskTitle\" สำเร็จ! (+${taskPoints} 🪙)", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun handleShowReminder(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return

        try {
            val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("pixel_quest_data", null) ?: return
            val rootObj = JSONObject(jsonString)
            val tasksArray = rootObj.optJSONArray("tasks") ?: return

            val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val todayStr = sdfKey.format(Date())

            for (i in 0 until tasksArray.length()) {
                val t = tasksArray.getJSONObject(i)
                if (t.optString("id") == taskId && !t.optBoolean("archived", false)) {
                    val completions = t.optJSONObject("completions")
                    val isDone = completions?.optBoolean(todayStr, false) ?: false

                    if (!isDone) {
                        val title = t.optString("title", "เควสต์")
                        val note = t.optString("note", "")
                        val points = t.optInt("points", 10)
                        val reminderTime = t.optString("reminderTime", "")
                        TaskNotificationHelper.postTaskNotification(
                            context, taskId, title, note, points, "วันนี้ $reminderTime"
                        )
                    }
                    break
                }
            }

            TaskNotificationHelper.rescheduleAll(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // =========================================================================
    // FOCUS REALM ACTION HANDLERS
    // =========================================================================

    private fun handleFocusPause(context: Context) {
        val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
        val selectedMins = prefs.getInt("focus_selected_mins", 25)
        val endTimeMs = prefs.getLong("focus_end_time_ms", 0L)
        val now = System.currentTimeMillis()

        val remainingSeconds = Math.max(0, ((endTimeMs - now) / 1000).toInt())

        prefs.edit()
            .putBoolean("focus_is_running", true)
            .putBoolean("focus_is_paused", true)
            .putInt("focus_remaining_seconds", remainingSeconds)
            .commit()

        TaskNotificationHelper.showFocusPausedNotification(context, selectedMins, remainingSeconds)
        Toast.makeText(context, "⏸️ พักการนับเวลาสมาธิชั่วคราว", Toast.LENGTH_SHORT).show()
    }

    private fun handleFocusResume(context: Context) {
        val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
        val selectedMins = prefs.getInt("focus_selected_mins", 25)
        val remainingSeconds = prefs.getInt("focus_remaining_seconds", selectedMins * 60)
        val newEndTimeMs = System.currentTimeMillis() + remainingSeconds * 1000L

        prefs.edit()
            .putBoolean("focus_is_running", true)
            .putBoolean("focus_is_paused", false)
            .putLong("focus_end_time_ms", newEndTimeMs)
            .commit()

        TaskNotificationHelper.showFocusRunningNotification(context, selectedMins, newEndTimeMs)
        Toast.makeText(context, "▶️ เดินเวลานับสมาธิต่อ", Toast.LENGTH_SHORT).show()
    }

    private fun handleFocusGiveUp(context: Context) {
        val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean("focus_is_running", false)
            .putBoolean("focus_is_paused", false)
            .putInt("focus_remaining_seconds", 0)
            .putLong("focus_end_time_ms", 0L)
            .commit()

        TaskNotificationHelper.cancelFocusNotification(context)
        Toast.makeText(context, "❌ ยกเลิกการสะสมสมาธิ", Toast.LENGTH_SHORT).show()
    }

    private fun handleFocusExpired(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
        val selectedMins = intent.getIntExtra(EXTRA_FOCUS_MINS, prefs.getInt("focus_selected_mins", 25))
        val pointsEarned = Math.round(selectedMins * 0.6).toInt()

        prefs.edit()
            .putBoolean("focus_is_running", false)
            .putBoolean("focus_is_paused", false)
            .putInt("focus_remaining_seconds", 0)
            .putLong("focus_end_time_ms", 0L)
            .commit()

        // Award points and planted tree in JSON database
        try {
            val jsonString = prefs.getString("pixel_quest_data", null)
            if (jsonString != null) {
                val rootObj = JSONObject(jsonString)
                val currentPoints = rootObj.optInt("pointsBalance", 0) + pointsEarned
                rootObj.put("pointsBalance", currentPoints)

                // Add random flora tree
                val floraList = listOf(
                    Pair("oak", "Pixel Oak"),
                    Pair("pine", "Pixel Pine"),
                    Pair("sakura", "Sakura Tree"),
                    Pair("crystal", "Crystal Tree"),
                    Pair("sunflower", "Golden Sunflower"),
                    Pair("rose", "Red Rose"),
                    Pair("tulip", "Royal Tulip"),
                    Pair("bonsai", "Ancient Bonsai"),
                    Pair("apple", "Golden Apple Tree")
                )
                val randomPick = floraList[Random.nextInt(floraList.size)]

                var gardenArr = rootObj.optJSONArray("garden")
                if (gardenArr == null) {
                    gardenArr = JSONArray()
                    rootObj.put("garden", gardenArr)
                }

                val newTree = JSONObject().apply {
                    put("id", "tree-" + System.currentTimeMillis())
                    put("treeType", randomPick.first)
                    put("treeName", randomPick.second)
                    put("treeIcon", "🌳")
                    put("stage", 4)
                    put("durationMinutes", selectedMins)
                    put("plantedAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date()))
                }
                gardenArr.put(newTree)

                var focusHistory = rootObj.optJSONArray("focusHistory")
                if (focusHistory == null) {
                    focusHistory = JSONArray()
                    rootObj.put("focusHistory", focusHistory)
                }
                val newHistory = JSONObject().apply {
                    put("id", "foc-" + System.currentTimeMillis())
                    put("durationMinutes", selectedMins)
                    put("completedAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date()))
                    put("pointsEarned", pointsEarned)
                    put("treeType", randomPick.first)
                }
                focusHistory.put(newHistory)

                prefs.edit().putString("pixel_quest_data", rootObj.toString()).commit()
                StorageBridgePlugin.refreshAllWidgets(context)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        TaskNotificationHelper.showFocusCompleteNotification(context, selectedMins, pointsEarned)
    }
}
