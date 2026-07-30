package com.indianmoneycode.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

/**
 * Real (non-mocked) SMS listener plugin.
 *
 * Registers a dynamic BroadcastReceiver for android.provider.Telephony.SMS_RECEIVED
 * while the app is in the foreground and emits a "smsReceived" event to JS with the
 * raw message body + sender, so nativeBridge.ts can run it through the local
 * financial pre-filter and the Gemini SMS parser.
 *
 * Notes:
 * - This only catches SMS while the app process is alive (foreground/registered
 *   receiver). True background/killed-app interception requires a manifest-declared
 *   BroadcastReceiver instead, which is intentionally NOT used here because Android
 *   restricts SMS_RECEIVED broadcast-only receivers to apps registered as the
 *   default SMS handler. This foreground listener is the standard, App-Store/
 *   Play-Store-safe approach for "read transactional SMS while app is open" flows.
 * - Requires RECEIVE_SMS (and optionally READ_SMS) in AndroidManifest.xml.
 */
@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }, alias = "sms")
    }
)
public class SmsReaderPlugin extends Plugin {

    private BroadcastReceiver smsReceiver;
    private boolean isListening = false;

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        super.checkPermissions(call);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias("sms", call, "smsPermissionsCallback");
        }
    }

    @PermissionCallback
    private void smsPermissionsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission not granted. Call requestPermissions() first.");
            return;
        }

        if (isListening) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            return;
        }

        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
                    return;
                }

                SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                if (messages == null || messages.length == 0) {
                    return;
                }

                StringBuilder bodyBuilder = new StringBuilder();
                String sender = messages[0].getOriginatingAddress();
                for (SmsMessage sms : messages) {
                    if (sms != null && sms.getMessageBody() != null) {
                        bodyBuilder.append(sms.getMessageBody());
                    }
                }

                JSObject data = new JSObject();
                data.put("body", bodyBuilder.toString());
                data.put("sender", sender != null ? sender : "");
                data.put("timestamp", System.currentTimeMillis());
                notifyListeners("smsReceived", data);
            }
        };

        IntentFilter filter = new IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION);
        // Android 13+ requires RECEIVER_EXPORTED/RECEIVER_NOT_EXPORTED to be explicit.
        // The SMS broadcast originates from the system (not our own app), so it must be EXPORTED.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(smsReceiver, filter);
        }

        isListening = true;
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        if (isListening && smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
            } catch (IllegalArgumentException ignored) {
                // Receiver was already unregistered (e.g. activity torn down) - safe to ignore.
            }
            smsReceiver = null;
        }
        isListening = false;

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (isListening && smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered.
            }
        }
        super.handleOnDestroy();
    }
}
