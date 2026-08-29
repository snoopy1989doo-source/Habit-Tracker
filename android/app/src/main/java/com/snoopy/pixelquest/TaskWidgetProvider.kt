package com.snoopy.pixelquest

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject

class TaskWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidgetInstance(context, appWidgetManager, appWidgetId)
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds)
    }

    companion object {
        fun updateAppWidgetInstance(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            // Read SharedPreferences to get Points & Selected Category Name
            var pointsBalance = 0
            var categoryLabel = "🌟 ทั้งหมด ▾"

            try {
                val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
                val jsonString = prefs.getString("pixel_quest_data", null)
                val selectedCatId = prefs.getString("widget_selected_cat_id", "all") ?: "all"

                if (jsonString != null) {
                    val rootObj = JSONObject(jsonString)
                    pointsBalance = rootObj.optInt("pointsBalance", 0)

                    if (selectedCatId != "all") {
                        val catsArray = rootObj.optJSONArray("categories")
                        if (catsArray != null) {
                            for (i in 0 until catsArray.length()) {
                                val cat = catsArray.getJSONObject(i)
                                if (cat.optString("id") == selectedCatId) {
                                    val icon = cat.optString("icon", "🏷️")
                                    val name = cat.optString("name", "หมวดหมู่")
                                    categoryLabel = "$icon $name ▾"
                                    break
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            views.setTextViewText(R.id.widget_points, "$pointsBalance 🪙")
            views.setTextViewText(R.id.widget_category_btn, categoryLabel)

            // Bind RemoteViewsService
            val serviceIntent = Intent(context, TaskWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_list_view, serviceIntent)
            views.setEmptyView(R.id.widget_list_view, R.id.widget_empty_view)

            // PendingIntent to launch main app when tapping title / header
            val appIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val appPendingIntent = PendingIntent.getActivity(
                context, 0, appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_header_area, appPendingIntent)

            // PendingIntent for Category Switcher Button
            val switchCatIntent = Intent(context, WidgetCheckReceiver::class.java).apply {
                action = WidgetCheckReceiver.ACTION_SWITCH_CATEGORY
            }
            val switchCatPendingIntent = PendingIntent.getBroadcast(
                context, 101, switchCatIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_category_btn, switchCatPendingIntent)

            // PendingIntent Template for task checkbox click
            val checkIntent = Intent(context, WidgetCheckReceiver::class.java).apply {
                action = WidgetCheckReceiver.ACTION_CHECK_TASK
            }
            val checkPendingIntent = PendingIntent.getBroadcast(
                context, 0, checkIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            views.setPendingIntentTemplate(R.id.widget_list_view, checkPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
