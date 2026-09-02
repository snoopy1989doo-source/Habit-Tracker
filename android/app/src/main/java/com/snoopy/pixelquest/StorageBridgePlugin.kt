package com.snoopy.pixelquest

import android.content.Context
import android.content.Intent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.net.Uri
import android.widget.RemoteViews
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "StorageBridge")
class StorageBridgePlugin : Plugin() {

    private val PREFS_NAME = "PixelQuestData"
    private val PREF_KEY = "pixel_quest_data"

    @PluginMethod
    fun getData(call: PluginCall) {
        try {
            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonString = prefs.getString(PREF_KEY, null)

            val ret = JSObject()
            ret.put("value", jsonString)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to read SharedPreferences: ${e.localizedMessage}")
        }
    }

    @PluginMethod
    fun setData(call: PluginCall) {
        try {
            val jsonValue = call.getString("value") 
                ?: call.getString("data") 
                ?: call.data.optString("value", "")

            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            
            // Synchronous commit to ensure data is written to disk before widget refresh
            val editor = prefs.edit()
            editor.putString(PREF_KEY, jsonValue)
            editor.commit()

            // Trigger Widget Refresh & Notification Reschedule
            refreshAllWidgets(context)
            TaskNotificationHelper.rescheduleAll(context)

            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to write SharedPreferences: ${e.localizedMessage}")
        }
    }

    @PluginMethod
    fun startFocusTimer(call: PluginCall) {
        try {
            val selectedMins = call.getInt("selectedMins") ?: 25
            val remainingSeconds = call.getInt("remainingSeconds") ?: (selectedMins * 60)
            val endTimeMs = call.getDouble("endTimeMs")?.toLong() ?: (System.currentTimeMillis() + remainingSeconds * 1000L)

            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean("focus_is_running", true)
                .putBoolean("focus_is_paused", false)
                .putInt("focus_selected_mins", selectedMins)
                .putInt("focus_remaining_seconds", remainingSeconds)
                .putLong("focus_end_time_ms", endTimeMs)
                .commit()

            TaskNotificationHelper.showFocusRunningNotification(context, selectedMins, endTimeMs)
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.localizedMessage)
        }
    }

    @PluginMethod
    fun pauseFocusTimer(call: PluginCall) {
        try {
            val remainingSeconds = call.getInt("remainingSeconds") ?: 0
            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val selectedMins = prefs.getInt("focus_selected_mins", 25)

            prefs.edit()
                .putBoolean("focus_is_running", true)
                .putBoolean("focus_is_paused", true)
                .putInt("focus_remaining_seconds", remainingSeconds)
                .commit()

            TaskNotificationHelper.showFocusPausedNotification(context, selectedMins, remainingSeconds)
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.localizedMessage)
        }
    }

    @PluginMethod
    fun resumeFocusTimer(call: PluginCall) {
        try {
            val remainingSeconds = call.getInt("remainingSeconds") ?: (25 * 60)
            val endTimeMs = call.getDouble("endTimeMs")?.toLong() ?: (System.currentTimeMillis() + remainingSeconds * 1000L)

            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val selectedMins = prefs.getInt("focus_selected_mins", 25)

            prefs.edit()
                .putBoolean("focus_is_running", true)
                .putBoolean("focus_is_paused", false)
                .putInt("focus_remaining_seconds", remainingSeconds)
                .putLong("focus_end_time_ms", endTimeMs)
                .commit()

            TaskNotificationHelper.showFocusRunningNotification(context, selectedMins, endTimeMs)
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.localizedMessage)
        }
    }

    @PluginMethod
    fun stopFocusTimer(call: PluginCall) {
        try {
            val isSuccess = call.getBoolean("isSuccess") ?: false
            val selectedMins = call.getInt("selectedMins") ?: 25
            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            prefs.edit()
                .putBoolean("focus_is_running", false)
                .putBoolean("focus_is_paused", false)
                .putInt("focus_remaining_seconds", 0)
                .putLong("focus_end_time_ms", 0L)
                .commit()

            if (isSuccess) {
                val pointsEarned = Math.round(selectedMins * 0.6).toInt()
                TaskNotificationHelper.showFocusCompleteNotification(context, selectedMins, pointsEarned)
            } else {
                TaskNotificationHelper.cancelFocusNotification(context)
            }

            call.resolve()
        } catch (e: Exception) {
            call.reject(e.localizedMessage)
        }
    }

    @PluginMethod
    fun getFocusTimerState(call: PluginCall) {
        try {
            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isRunning = prefs.getBoolean("focus_is_running", false)
            val isPaused = prefs.getBoolean("focus_is_paused", false)
            val selectedMins = prefs.getInt("focus_selected_mins", 25)
            val remainingSeconds = prefs.getInt("focus_remaining_seconds", selectedMins * 60)
            val endTimeMs = prefs.getLong("focus_end_time_ms", 0L)

            val ret = JSObject()
            ret.put("isRunning", isRunning)
            ret.put("isPaused", isPaused)
            ret.put("selectedMins", selectedMins)
            ret.put("remainingSeconds", remainingSeconds)
            ret.put("endTimeMs", endTimeMs)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject(e.localizedMessage)
        }
    }

    companion object {
        fun refreshAllWidgets(context: Context) {
            try {
                val widgetManager = AppWidgetManager.getInstance(context)
                val widgetComponent = ComponentName(context, TaskWidgetProvider::class.java)
                val widgetIds = widgetManager.getAppWidgetIds(widgetComponent)

                if (widgetIds.isNotEmpty()) {
                    for (appWidgetId in widgetIds) {
                        TaskWidgetProvider.updateAppWidgetInstance(context, widgetManager, appWidgetId)
                    }
                    widgetManager.notifyAppWidgetViewDataChanged(widgetIds, R.id.widget_list_view)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
