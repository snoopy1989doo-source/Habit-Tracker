package com.snoopy.pixelquest

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import org.json.JSONObject

class WidgetCheckReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_CHECK_TASK = "com.snoopy.pixelquest.ACTION_CHECK_TASK"
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_DATE_KEY = "extra_date_key"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        val dateKey = intent.getStringExtra(EXTRA_DATE_KEY) ?: return

        try {
            val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("pixel_quest_data", null) ?: return

            val rootObj = JSONObject(jsonString)
            val tasksArray = rootObj.optJSONArray("tasks") ?: return
            var currentPoints = rootObj.optInt("pointsBalance", 0)

            var modified = false
            for (i in 0 until tasksArray.length()) {
                val t = tasksArray.getJSONObject(i)
                if (t.optString("id") == taskId) {
                    var completions = t.optJSONObject("completions")
                    if (completions == null) {
                        completions = JSONObject()
                        t.put("completions", completions)
                    }

                    val taskPoints = t.optInt("points", 10)
                    val isDone = completions.optBoolean(dateKey, false)

                    if (isDone) {
                        completions.remove(dateKey)
                        currentPoints = (currentPoints - taskPoints).coerceAtLeast(0)
                    } else {
                        completions.put(dateKey, true)
                        currentPoints += taskPoints
                    }

                    rootObj.put("pointsBalance", currentPoints)
                    modified = true
                    break
                }
            }

            if (modified) {
                val editor = prefs.edit()
                editor.putString("pixel_quest_data", rootObj.toString())
                editor.apply()

                // Notify Widget to refresh
                val widgetManager = AppWidgetManager.getInstance(context)
                val widgetComponent = ComponentName(context, TaskWidgetProvider::class.java)
                val widgetIds = widgetManager.getAppWidgetIds(widgetComponent)

                if (widgetIds.isNotEmpty()) {
                    widgetManager.notifyAppWidgetViewDataChanged(widgetIds, R.id.widget_list_view)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
