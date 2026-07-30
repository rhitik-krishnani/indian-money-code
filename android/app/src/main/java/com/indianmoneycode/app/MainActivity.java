package com.indianmoneycode.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Manually register our custom native plugin (not an npm package,
        // so it won't show up in capacitor.plugins.json / cap sync).
        registerPlugin(SmsReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
