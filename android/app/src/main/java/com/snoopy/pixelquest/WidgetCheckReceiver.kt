package com.snoopy.pixelquest

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

class WidgetCheckReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_CHECK_TASK = "com.snoopy.pixelquest.ACTION_CHECK_TASK"
        const val ACTION_SWITCH_CATEGORY = "com.snoopy.pixelquest.ACTION_SWITCH_CATEGORY"
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_DATE_KEY = "extra_date_key"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        if (action == ACTION_SWITCH_CATEGORY) {
            handleSwitchCategory(context, intent)
        } else if (action == ACTION_CHECK_TASK) {
            handleCheckTask(context, intent)
        }
    }

    private fun handleSwitchCategory(context: Context, intent: Intent) {
        val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return

        try {
            val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("pixel_quest_data", null) ?: return
            
            // Read per-widget selected category ID
            val currentCatId = prefs.getString("widget_cat_$appWidgetId", "all") ?: "all"

            val rootObj = JSONObject(jsonString)
            val catsArray = rootObj.optJSONArray("categories")

            val catIdList = mutableListOf<String>()
            catIdList.add("all")

            if (catsArray != null) {
                for (i in 0 until catsArray.length()) {
                    val cat = catsArray.getJSONObject(i)
                    val id = cat.optString("id", "")
                    if (id.isNotEmpty()) {
                        catIdList.add(id)
                    }
                }
            }

            var currentIndex = catIdList.indexOf(currentCatId)
            if (currentIndex == -1) currentIndex = 0

            val nextIndex = (currentIndex + 1) % catIdList.size
            val nextCatId = catIdList[nextIndex]

            // Save to THIS WIDGET INSTANCE ONLY!
            val editor = prefs.edit()
            editor.putString("widget_cat_$appWidgetId", nextCatId)
            editor.commit() // Synchronous disk commit

            // Refresh ONLY this widget instance so other stacked widgets are NOT affected!
            val widgetManager = AppWidgetManager.getInstance(context)
            TaskWidgetProvider.updateAppWidgetInstance(context, widgetManager, appWidgetId)
            widgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_list_view)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun handleCheckTask(context: Context, intent: Intent) {
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
                        // Cancel any pending notification for this task
                        TaskNotificationHelper.cancelTaskNotification(context, taskId)
                    }

                    rootObj.put("pointsBalance", currentPoints)
                    modified = true
                    break
                }
            }

            if (modified) {
                val editor = prefs.edit()
                editor.putString("pixel_quest_data", rootObj.toString())
                editor.commit() // Synchronous disk commit

                // Notify all Widgets to refresh
                StorageBridgePlugin.refreshAllWidgets(context)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
