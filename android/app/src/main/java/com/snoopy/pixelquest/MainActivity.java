package com.snoopy.pixelquest;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "PixelQuestData";
    private static final String PREF_KEY = "pixel_quest_data";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StorageBridgePlugin.class);
        super.onCreate(savedInstanceState);
        setupBridge();
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
        // Refresh widgets whenever app resumes
        StorageBridgePlugin.Companion.refreshAllWidgets(this);
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

                // Refresh all home screen widgets immediately
                StorageBridgePlugin.Companion.refreshAllWidgets(context);
                return success;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
    }
}
