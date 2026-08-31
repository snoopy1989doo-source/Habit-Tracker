package com.snoopy.pixelquest

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class TaskNotificationReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_COMPLETE_TASK = "com.snoopy.pixelquest.ACTION_COMPLETE_TASK"
        const val ACTION_SHOW_REMINDER = "com.snoopy.pixelquest.ACTION_SHOW_REMINDER"
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_DATE_KEY = "extra_date_key"
        const val EXTRA_NOTIF_ID = "extra_notif_id"
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
        val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
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
                editor.commit() // Synchronous disk commit

                // 1. Cancel notification
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(notifId)

                // 2. Refresh all home screen widgets
                StorageBridgePlugin.refreshAllWidgets(context)

                // 3. User feedback
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

            val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
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

            // Reschedule next occurrences
            TaskNotificationHelper.rescheduleAll(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
