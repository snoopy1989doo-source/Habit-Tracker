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

    const val FOCUS_CHANNEL_ID = "pixel_quest_focus"
    const val FOCUS_CHANNEL_NAME = "⏱️ นับเวลาสมาธิ (Focus Timer)"

    const val FOCUS_DONE_CHANNEL_ID = "pixel_quest_focus_done"
    const val FOCUS_DONE_CHANNEL_NAME = "🎉 สมาธิสำเร็จ (Focus Complete)"

    const val NOTIF_ID_FOCUS = 99999
    const val NOTIF_ID_FOCUS_DONE = 99998

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. Task Reminders Channel
            val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()

            val taskChannel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
                description = "การแจ้งเตือนเควสต์และกิจวัตรประจำวันของ Pixel Quest"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
                setSound(defaultSoundUri, audioAttributes)
            }
            notificationManager.createNotificationChannel(taskChannel)

            // 2. Ongoing Focus Timer Channel (Low importance so no beeps during active countdown)
            val focusChannel = NotificationChannel(FOCUS_CHANNEL_ID, FOCUS_CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW).apply {
                description = "การนับเวลาถอยหลังโหมดสมาธิของ Pixel Quest"
                enableLights(false)
                enableVibration(false)
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(focusChannel)

            // 3. Focus Completed Channel (High importance with sound and vibration)
            val focusDoneChannel = NotificationChannel(FOCUS_DONE_CHANNEL_ID, FOCUS_DONE_CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
                description = "แจ้งเตือนเมื่อสะสมสมาธิครบกำหนดเวลา"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
                setSound(defaultSoundUri, audioAttributes)
            }
            notificationManager.createNotificationChannel(focusDoneChannel)
        }
    }

    // =========================================================================
    // TASK NOTIFICATIONS
    // =========================================================================

    fun postTaskNotification(context: Context, taskId: String, title: String, note: String, points: Int, recText: String) {
        createNotificationChannel(context)

        val prefs = context.getSharedPreferences("PixelQuestData", Context.MODE_PRIVATE)
        val sdfKey = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val todayStr = sdfKey.format(Date())

        val lastNotifiedDate = prefs.getString("notif_last_$taskId", null)
        if (lastNotifiedDate == todayStr) return

        prefs.edit().putString("notif_last_$taskId", todayStr).apply()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = taskId.hashCode()

        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, notifId, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

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

                val targetCal = getNextDueCalendar(t, recType, hour, minute, nowMillis, todayStr, prefs) ?: continue

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

        if (cal.timeInMillis > nowMillis && lastNotifiedDate != todayStr) {
            if (isDueOnDate(task, recType, cal, todayStr)) {
                return cal
            }
        }

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
        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK) - 1
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

    // =========================================================================
    // FOCUS REALM ONGOING COUNTDOWN & NOTIFICATIONS
    // =========================================================================

    fun showFocusRunningNotification(context: Context, selectedMins: Int, endTimeMillis: Long) {
        createNotificationChannel(context)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Tap notification -> open app
        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, 5001, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action [ ⏸️ พักชั่วคราว ]
        val pauseIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
            action = TaskNotificationReceiver.ACTION_FOCUS_PAUSE
        }
        val pausePendingIntent = PendingIntent.getBroadcast(
            context, 5002, pauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        // Action [ ✖ ยกเลิก / ยอมแพ้ ]
        val giveupIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
            action = TaskNotificationReceiver.ACTION_FOCUS_GIVEUP
        }
        val giveupPendingIntent = PendingIntent.getBroadcast(
            context, 5003, giveupIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        val expectedPoints = Math.round(selectedMins * 0.6).toInt()

        val builder = NotificationCompat.Builder(context, FOCUS_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏱️ กำลังสะสมสมาธิ (${selectedMins} นาที)")
            .setContentText("กำลังปลูกต้นไม้พิกเซล... แตะเพื่อเปิดแอป (+${expectedPoints} 🪙)")
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(endTimeMillis)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setContentIntent(appPendingIntent)
            .addAction(android.R.drawable.ic_media_pause, "⏸️ พักชั่วคราว", pausePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "✖ ยกเลิก", giveupPendingIntent)

        notificationManager.notify(NOTIF_ID_FOCUS, builder.build())

        // Also schedule exact Alarm for when countdown expires (so completion fires even if phone locked)
        scheduleFocusCompletionAlarm(context, selectedMins, endTimeMillis)
    }

    fun showFocusPausedNotification(context: Context, selectedMins: Int, remainingSeconds: Int) {
        createNotificationChannel(context)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, 5001, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action [ ▶️ เดินต่อ ]
        val resumeIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
            action = TaskNotificationReceiver.ACTION_FOCUS_RESUME
        }
        val resumePendingIntent = PendingIntent.getBroadcast(
            context, 5004, resumeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        // Action [ ✖ ยกเลิก ]
        val giveupIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
            action = TaskNotificationReceiver.ACTION_FOCUS_GIVEUP
        }
        val giveupPendingIntent = PendingIntent.getBroadcast(
            context, 5003, giveupIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        val mins = remainingSeconds / 60
        val secs = remainingSeconds % 60
        val timeFormatted = String.format(Locale.US, "%02d:%02d", mins, secs)

        val builder = NotificationCompat.Builder(context, FOCUS_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏸️ สมาธิพักชั่วคราว (เหลืออีก $timeFormatted)")
            .setContentText("กด \"▶ เดินต่อ\" เพื่อนับเวลาและปลูกต้นไม้ต่อ")
            .setUsesChronometer(false)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(appPendingIntent)
            .addAction(android.R.drawable.ic_media_play, "▶ เดินต่อ", resumePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "✖ ยกเลิก", giveupPendingIntent)

        notificationManager.notify(NOTIF_ID_FOCUS, builder.build())

        // Cancel the completion alarm while paused
        cancelFocusCompletionAlarm(context)
    }

    fun cancelFocusNotification(context: Context) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIF_ID_FOCUS)
        cancelFocusCompletionAlarm(context)
    }

    fun showFocusCompleteNotification(context: Context, selectedMins: Int, pointsEarned: Int) {
        createNotificationChannel(context)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIF_ID_FOCUS)

        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, 5005, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, FOCUS_DONE_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("🎉 สะสมสมาธิสำเร็จ! (+${pointsEarned} 🪙)")
            .setContentText("คุณปลูกต้นไม้ใหม่ในสวนพิกเซลเรียบร้อยแล้ว (${selectedMins} นาที)")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(appPendingIntent)

        notificationManager.notify(NOTIF_ID_FOCUS_DONE, builder.build())
    }

    private fun scheduleFocusCompletionAlarm(context: Context, selectedMins: Int, endTimeMillis: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val alarmIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
            action = TaskNotificationReceiver.ACTION_FOCUS_EXPIRED
            putExtra(TaskNotificationReceiver.EXTRA_FOCUS_MINS, selectedMins)
            data = Uri.parse("pixelquest://focus/alarm/complete")
        }
        val alarmPendingIntent = PendingIntent.getBroadcast(
            context, 5006, alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                alarmManager.setAlarmClock(
                    AlarmManager.AlarmClockInfo(endTimeMillis, alarmPendingIntent),
                    alarmPendingIntent
                )
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    endTimeMillis,
                    alarmPendingIntent
                )
            }
        } catch (e: Exception) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, endTimeMillis, alarmPendingIntent)
        }
    }

    private fun cancelFocusCompletionAlarm(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val alarmIntent = Intent(context, TaskNotificationReceiver::class.java).apply {
            action = TaskNotificationReceiver.ACTION_FOCUS_EXPIRED
            data = Uri.parse("pixelquest://focus/alarm/complete")
        }
        val alarmPendingIntent = PendingIntent.getBroadcast(
            context, 5006, alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        alarmManager.cancel(alarmPendingIntent)
    }
}
