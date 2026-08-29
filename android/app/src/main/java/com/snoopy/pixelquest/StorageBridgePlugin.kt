package com.snoopy.pixelquest

import android.content.Context
import android.content.Intent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
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
            val jsonValue = call.getString("value") ?: ""
            val context = context
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            
            val editor = prefs.edit()
            editor.putString(PREF_KEY, jsonValue)
            editor.apply()

            // Trigger Home Screen Widget Refresh
            val widgetManager = AppWidgetManager.getInstance(context)
            val widgetComponent = ComponentName(context, TaskWidgetProvider::class.java)
            val widgetIds = widgetManager.getAppWidgetIds(widgetComponent)

            if (widgetIds.isNotEmpty()) {
                widgetManager.notifyAppWidgetViewDataChanged(widgetIds, R.id.widget_list_view)
                val updateIntent = Intent(context, TaskWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
                }
                context.sendBroadcast(updateIntent)
            }

            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to write SharedPreferences: ${e.localizedMessage}")
        }
    }
}
