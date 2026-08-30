package com.snoopy.pixelquest

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
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
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = "การแจ้งเตือนเควสต์และกิจวัตรประจำวันของ Pixel Quest"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun postTaskNotification(context: Context, taskId: String, title: String, note: String, points: Int, recText: String) {
        createNotificationChannel(context)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = taskId.hashCode()

        // 1. PendingIntent when tapping notification body -> Launch App
        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, notifId, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. PendingIntent for [ ✔ ทำแล้ว ] Action Button
        val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val todayStr = sdfKey.format(Date())

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
            val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val todayStr = sdfKey.format(Date())

            val calendar = Calendar.getInstance()
            val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK) - 1 // 0 = Sun, 1 = Mon ...
            val dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH)

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

                val recurrence = t.optJSONObject("recurrence")
                val recType = recurrence?.optString("type") ?: "daily"

                var isDueToday = false
                if (recType == "daily") {
                    isDueToday = true
                } else if (recType == "weekly") {
                    val daysArr = recurrence?.optJSONArray("days")
                    if (daysArr != null) {
                        for (d in 0 until daysArr.length()) {
                            if (daysArr.getInt(d) == dayOfWeek) {
                                isDueToday = true
                                break
                            }
                        }
                    }
                } else if (recType == "monthly") {
                    val dateNum = recurrence?.optInt("dateOfMonth", 1) ?: 1
                    if (dateNum == dayOfMonth) isDueToday = true
                } else if (recType == "none") {
                    val createdAtKey = t.optString("createdAtKey", "")
                    if (createdAtKey == todayStr) isDueToday = true
                }

                if (isDueToday) {
                    val parts = reminderTime.split(":")
                    if (parts.size == 2) {
                        val hour = parts[0].toIntOrNull() ?: continue
                        val minute = parts[1].toIntOrNull() ?: continue

                        val targetCal = Calendar.getInstance().apply {
                            set(Calendar.HOUR_OF_DAY, hour)
                            set(Calendar.MINUTE, minute)
                            set(Calendar.SECOND, 0)
                            set(Calendar.MILLISECOND, 0)
                        }

                        val nowMillis = System.currentTimeMillis()
                        if (targetCal.timeInMillis <= nowMillis) {
                            // Time already reached today and not done -> post notification directly!
                            val title = t.optString("title", "เควสต์")
                            val note = t.optString("note", "")
                            val points = t.optInt("points", 10)
                            postTaskNotification(context, taskId, title, note, points, "วันนี้ $reminderTime")
                        } else {
                            // Schedule exact alarm for later today
                            val alarmIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
                                action = TaskNotificationReceiver.ACTION_SHOW_REMINDER
                                putExtra(TaskNotificationReceiver.EXTRA_TASK_ID, taskId)
                                data = Uri.parse("pixelquest://reminder/alarm/$taskId")
                            }
                            val alarmPendingIntent = PendingIntent.getBroadcast(
                                context, taskId.hashCode(), alarmIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                            )

                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
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
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
