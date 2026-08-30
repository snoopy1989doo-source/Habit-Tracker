package com.snoopy.pixelquest;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "PixelQuestData";
    private static final String PREF_KEY = "pixel_quest_data";
    private static final int NOTIF_PERMISSION_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StorageBridgePlugin.class);
        super.onCreate(savedInstanceState);
        setupBridge();

        // Create Task Notification Channel & Reschedule reminders
        TaskNotificationHelper.INSTANCE.createNotificationChannel(this);
        TaskNotificationHelper.INSTANCE.rescheduleAll(this);

        // Request POST_NOTIFICATIONS on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIF_PERMISSION_CODE);
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        setupBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupBridge();
        // Refresh widgets and reschedule notifications whenever app resumes
        StorageBridgePlugin.Companion.refreshAllWidgets(this);
        TaskNotificationHelper.INSTANCE.rescheduleAll(this);
    }

    private void setupBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.addJavascriptInterface(new AndroidStorageBridgeInterface(this), "AndroidStorageBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static class AndroidStorageBridgeInterface {
        private final Context context;

        public AndroidStorageBridgeInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String getRawData() {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                return prefs.getString(PREF_KEY, null);
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }

        @JavascriptInterface
        public boolean setRawData(String jsonString) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(PREF_KEY, jsonString);
                boolean success = editor.commit(); // Synchronous commit

                // Refresh all home screen widgets and reschedule reminders
                StorageBridgePlugin.Companion.refreshAllWidgets(context);
                TaskNotificationHelper.INSTANCE.rescheduleAll(context);
                return success;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
    }
}
