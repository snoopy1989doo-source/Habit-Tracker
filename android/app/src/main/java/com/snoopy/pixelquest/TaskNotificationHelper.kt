package com.snoopy.pixelquest

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object TaskNotificationHelper {

    const val CHANNEL_ID = "pixel_quest_tasks"
    const val CHANNEL_NAME = "เควสต์ & เตือนความจำ (Tasks & Habits)"
    const val GROUP_KEY = "com.snoopy.pixelquest.TASKS_GROUP"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()

            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = "การแจ้งเตือนเควสต์และกิจวัตรประจำวันของ Pixel Quest"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
                setSound(defaultSoundUri, audioAttributes)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun postTaskNotification(context: Context, taskId: String, title: String, note: String, points: Int, recText: String) {
        createNotificationChannel(context)

        val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
        val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val todayStr = sdfKey.format(Date())

        // 1. Ensure only 1 notification per task per day!
        val lastNotifiedDate = prefs.getString("notif_last_$taskId", null)
        if (lastNotifiedDate == todayStr) {
            // Already notified today -> do not duplicate!
            return
        }

        // Record that we have notified for today
        prefs.edit().putString("notif_last_$taskId", todayStr).apply()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = taskId.hashCode()

        // PendingIntent when tapping notification body -> Launch App
        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, notifId, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // PendingIntent for [ ✔ ทำแล้ว ] Action Button
        val completeIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
            action = TaskNotificationReceiver.ACTION_COMPLETE_TASK
            putExtra(TaskNotificationReceiver.EXTRA_TASK_ID, taskId)
            putExtra(TaskNotificationReceiver.EXTRA_DATE_KEY, todayStr)
            putExtra(TaskNotificationReceiver.EXTRA_NOTIF_ID, notifId)
            data = Uri.parse("pixelquest://notification/complete/$taskId/$todayStr")
        }
        val completePendingIntent = PendingIntent.getBroadcast(
            context, notifId, completeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        val contentText = if (note.isNotBlank()) note else "รับแต้ม +$points 🪙 เมื่อทำสำเร็จ"
        val subText = if (recText.isNotBlank()) recText else "+$points 🪙"

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(contentText)
            .setSubText(subText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(if (note.isNotBlank()) "$note\n(+$points 🪙)" else "+$points 🪙 เมื่อทำเควสต์นี้สำเร็จ"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(appPendingIntent)
            .addAction(
                android.R.drawable.checkbox_on_background,
                "✔ ทำแล้ว (+$points 🪙)",
                completePendingIntent
            )
            .setGroup(GROUP_KEY)

        notificationManager.notify(notifId, builder.build())
    }

    fun cancelTaskNotification(context: Context, taskId: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(taskId.hashCode())
    }

    fun rescheduleAll(context: Context) {
        try {
            val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
            val jsonString = prefs.getString("pixel_quest_data", null) ?: return
            val rootObj = JSONObject(jsonString)
            val tasksArray = rootObj.optJSONArray("tasks") ?: return

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val todayStr = sdfKey.format(Date())

            val nowMillis = System.currentTimeMillis()

            for (i in 0 until tasksArray.length()) {
                val t = tasksArray.getJSONObject(i)
                if (t.optBoolean("archived", false)) continue

                val taskId = t.optString("id", "")
                val reminderTime = t.optString("reminderTime", "")
                if (reminderTime.isEmpty()) continue

                val completions = t.optJSONObject("completions")
                val isDone = completions?.optBoolean(todayStr, false) ?: false
                if (isDone) {
                    cancelTaskNotification(context, taskId)
                    continue
                }

                val parts = reminderTime.split(":")
                if (parts.size != 2) continue
                val hour = parts[0].toIntOrNull() ?: continue
                val minute = parts[1].toIntOrNull() ?: continue

                val recurrence = t.optJSONObject("recurrence")
                val recType = recurrence?.optString("type") ?: "daily"

                // Calculate next target time (either later today or on next due date)
                val targetCal = getNextDueCalendar(t, recType, hour, minute, nowMillis, todayStr, prefs) ?: continue

                // Only schedule future alarms (NEVER fire immediately on app launch!)
                if (targetCal.timeInMillis > nowMillis) {
                    val alarmIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
                        action = TaskNotificationReceiver.ACTION_SHOW_REMINDER
                        putExtra(TaskNotificationReceiver.EXTRA_TASK_ID, taskId)
                        data = Uri.parse("pixelquest://reminder/alarm/$taskId")
                    }
                    val alarmPendingIntent = PendingIntent.getBroadcast(
                        context, taskId.hashCode(), alarmIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                    )

                    val showAppIntent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    val showPendingIntent = PendingIntent.getActivity(
                        context, taskId.hashCode(), showAppIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )

                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            alarmManager.setAlarmClock(
                                AlarmManager.AlarmClockInfo(targetCal.timeInMillis, showPendingIntent),
                                alarmPendingIntent
                            )
                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(
                                AlarmManager.RTC_WAKEUP,
                                targetCal.timeInMillis,
                                alarmPendingIntent
                            )
                        } else {
                            alarmManager.setExact(
                                AlarmManager.RTC_WAKEUP,
                                targetCal.timeInMillis,
                                alarmPendingIntent
                            )
                        }
                    } catch (se: SecurityException) {
                        // Fallback if exact alarms restricted
                        alarmManager.set(
                            AlarmManager.RTC_WAKEUP,
                            targetCal.timeInMillis,
                            alarmPendingIntent
                        )
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getNextDueCalendar(
        task: JSONObject,
        recType: String,
        hour: Int,
        minute: Int,
        nowMillis: Long,
        todayStr: String,
        prefs: android.content.SharedPreferences
    ): Calendar? {
        val taskId = task.optString("id", "")
        val lastNotifiedDate = prefs.getString("notif_last_$taskId", null)

        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        // 1. If time today is in the future AND we have not notified today yet:
        if (cal.timeInMillis > nowMillis && lastNotifiedDate != todayStr) {
            if (isDueOnDate(task, recType, cal, todayStr)) {
                return cal
            }
        }

        // 2. Otherwise (time today is already passed or already notified today):
        // Search next 7 days for the next due occurrence
        for (dayOffset in 1..7) {
            val nextCal = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, dayOffset)
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val checkDateStr = sdfKey.format(nextCal.time)

            if (isDueOnDate(task, recType, nextCal, checkDateStr)) {
                return nextCal
            }
        }

        return null
    }

    private fun isDueOnDate(task: JSONObject, recType: String, cal: Calendar, dateStr: String): Boolean {
        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK) - 1 // 0=Sun, 1=Mon...
        val dayOfMonth = cal.get(Calendar.DAY_OF_MONTH)

        if (recType == "daily") {
            return true
        } else if (recType == "weekly") {
            val recurrence = task.optJSONObject("recurrence")
            val daysArr = recurrence?.optJSONArray("days")
            if (daysArr != null) {
                for (d in 0 until daysArr.length()) {
                    if (daysArr.getInt(d) == dayOfWeek) return true
                }
            }
            return false
        } else if (recType == "monthly") {
            val recurrence = task.optJSONObject("recurrence")
            val dateNum = recurrence?.optInt("dateOfMonth", 1) ?: 1
            return dateNum == dayOfMonth
        } else if (recType == "none") {
            val createdAtKey = task.optString("createdAtKey", "")
            return createdAtKey.isEmpty() || createdAtKey == dateStr
        }
        return false
    }
}
