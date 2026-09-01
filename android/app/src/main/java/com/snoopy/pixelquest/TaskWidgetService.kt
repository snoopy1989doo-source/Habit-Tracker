package com.snoopy.pixelquest

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class TaskWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        return TaskWidgetFactory(this.applicationContext, appWidgetId)
    }
}

class TaskWidgetFactory(private val context: Context, private val appWidgetId: Int) : RemoteViewsService.RemoteViewsFactory {

    private data class WidgetTaskItem(
        val id: String,
        val title: String,
        val points: Int,
        val isCompleted: Boolean,
        val dateKey: String
    )

    private val itemList = mutableListOf<WidgetTaskItem>()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        itemList.clear()
        try {
            val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("pixel_quest_data", null) ?: return
            
            // Read per-widget selected category ID
            val selectedCatId = if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                prefs.getString("widget_cat_$appWidgetId", "all") ?: "all"
            } else {
                "all"
            }

            val rootObj = JSONObject(jsonString)
            val tasksArray = rootObj.optJSONArray("tasks") ?: return

            val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val todayStr = sdfKey.format(Date())
            val calendar = Calendar.getInstance()
            val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK) - 1 // 0 = Sun, 1 = Mon ...
            val dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH)

            for (i in 0 until tasksArray.length()) {
                val t = tasksArray.getJSONObject(i)
                if (t.optBoolean("archived", false)) continue

                // Category Filter Check
                val categoryId = t.optString("categoryId", "")
                if (selectedCatId != "all" && categoryId != selectedCatId) {
                    continue
                }

                val createdAtKey = t.optString("createdAtKey", "")
                val createdAt = t.optString("createdAt", "")
                var createdDateStr = createdAtKey
                if (createdDateStr.isEmpty() && createdAt.isNotEmpty()) {
                    if (createdAt.length >= 10) {
                        createdDateStr = createdAt.substring(0, 10)
                    }
                }
                if (createdDateStr.isNotEmpty() && todayStr < createdDateStr) {
                    continue
                }

                val recurrence = t.optJSONObject("recurrence")
                val recType = recurrence?.optString("type") ?: "daily"

                var isDue = false
                if (recType == "daily") {
                    isDue = true
                } else if (recType == "none") {
                    if (createdDateStr.isEmpty() || createdDateStr == todayStr || createdAt.startsWith(todayStr)) {
                        isDue = true
                    }
                } else if (recType == "weekly") {
                    val daysArr = recurrence?.optJSONArray("days")
                    if (daysArr != null) {
                        for (d in 0 until daysArr.length()) {
                            if (daysArr.getInt(d) == dayOfWeek) {
                                isDue = true
                                break
                            }
                        }
                    }
                } else if (recType == "monthly") {
                    val dateNum = recurrence?.optInt("dateOfMonth", 1) ?: 1
                    if (dateNum == dayOfMonth) isDue = true
                }

                if (isDue) {
                    val completions = t.optJSONObject("completions")
                    val isDone = completions?.optBoolean(todayStr, false) ?: false

                    // CRITICAL FIX: Only display INCOMPLETE/PENDING tasks for today!
                    // When checked, the task disappears from the active widget and resets on the next day!
                    if (!isDone) {
                        itemList.add(
                            WidgetTaskItem(
                                id = t.optString("id", ""),
                                title = t.optString("title", "Task"),
                                points = t.optInt("points", 10),
                                isCompleted = false,
                                dateKey = todayStr
                            )
                        )
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        itemList.clear()
    }

    override fun getCount(): Int = itemList.size

    override fun getViewAt(position: Int): RemoteViews {
        if (position < 0 || position >= itemList.size) {
            return RemoteViews(context.packageName, R.layout.widget_item)
        }

        val item = itemList[position]
        val views = RemoteViews(context.packageName, R.layout.widget_item)

        views.setTextViewText(R.id.widget_task_title, item.title)
        views.setTextViewText(R.id.widget_task_points, "+${item.points} 🪙")
        views.setTextViewText(R.id.widget_task_checkbox, "")
        views.setFloat(R.id.widget_task_title, "setAlpha", 1.0f)

        val fillInIntent = Intent().apply {
            putExtra(WidgetCheckReceiver.EXTRA_TASK_ID, item.id)
            putExtra(WidgetCheckReceiver.EXTRA_DATE_KEY, item.dateKey)
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        views.setOnClickFillInIntent(R.id.widget_task_checkbox, fillInIntent)
        views.setOnClickFillInIntent(R.id.widget_task_title, fillInIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
