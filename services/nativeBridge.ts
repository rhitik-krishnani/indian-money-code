import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { parseSmsTransaction } from './geminiService';
import { Transaction } from '../types';
import { safeStorage } from './storage';

/**
 * JS-side contract for the custom native SmsReaderPlugin
 * (android/app/src/main/java/com/indianmoneycode/app/SmsReaderPlugin.java).
 * Android-only: iOS does not allow third-party apps to read SMS content, so on
 * iOS/web this plugin is never called - callers should always check
 * `Capacitor.getPlatform() === 'android'` first (see startSmsBackgroundService below).
 */
interface SmsReaderPluginInterface {
    checkPermissions(): Promise<{ granted: boolean }>;
    requestPermissions(): Promise<{ granted: boolean }>;
    startListening(): Promise<{ success: boolean }>;
    stopListening(): Promise<{ success: boolean }>;
    addListener(
        eventName: 'smsReceived',
        listenerFunc: (data: { body: string; sender: string; timestamp: number }) => void
    ): Promise<PluginListenerHandle>;
}

const SmsReader = registerPlugin<SmsReaderPluginInterface>('SmsReader');

export const getDeviceInfo = async () => {
    const info = await Device.getInfo();
    return info;
};

export const triggerHaptic = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
};

interface SmsListener {
    onTransaction: (t: Partial<Transaction>) => void;
}

let activeSmsListener: SmsListener | null = null;
let isListening = false;

/**
 * Local Pre-Filter to check if SMS is related to financial transactions.
 * Prevents unnecessary, high-frequency, expensive and private AI endpoint calls
 * for general chats, OTPs, spam, or personal notifications.
 */
export const isFinancialSms = (text: string): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    
    // Financial transactional keywords or bank identifiers
    const keywords = [
        'spent', 'debited', 'credited', 'charged', 'withdrawn', 'payment', 'transfer',
        'transferred', 'tx', 'txn', 'deposited', 'received', 'paytm', 'gpay', 'phonepe',
        'bhim', 'upi', 'rupees', 'rs.', 'rs ', 'inr', 'bank', 'hdfc', 'sbi', 'icici', 'axis'
    ];
    
    return keywords.some(kw => lower.includes(kw));
};

/**
 * Mobile Bridge Strategy:
 * This function is called by the Android/iOS Native side 
 * when an SMS is intercepted.
 */
export const handleIncomingSms = async (body: string) => {
    console.log("Native Bridge: SMS Intercepted, analyzing...");
    if (!activeSmsListener) {
        console.warn("No active SMS listener registered in UI. SMS ignored.");
        return;
    }

    // Check if we've already seen/processed this specific message body
    const seenMessages = JSON.parse(safeStorage.getItem('sms_seen_messages') || '[]');
    if (seenMessages.includes(body)) {
        console.log("Native Bridge: SMS already processed, skipping.");
        return;
    }

    // Apply local pre-filtering to prevent expensive token leakage
    if (!isFinancialSms(body)) {
        console.log("Native Bridge: SMS ignored by local pre-filter (non-financial message).");
        return;
    }

    try {
        const parsed = await parseSmsTransaction(body);
        if (parsed && parsed.amount) {
            console.log("Native Bridge: Valid transaction detected from SMS", parsed);
            
            // Mark as seen immediately so it doesn't re-trigger while processing
            const updatedSeen = [...seenMessages, body].slice(-50); // Keep last 50
            safeStorage.setItem('sms_seen_messages', JSON.stringify(updatedSeen));

            activeSmsListener.onTransaction(parsed);
            await triggerHaptic();
            
            // Show a local notification for better UX
            const amountStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parsed.amount || 0);
            await scheduleLocalNotification(
                "Transaction Detected", 
                `Detected ${amountStr} at ${parsed.merchant || 'Merchant'}. Tap to review.`
            );
        }
    } catch (e) {
        console.error("Native Bridge: SMS Parsing error", e);
    }
};

let smsListenerHandle: PluginListenerHandle | null = null;

export const registerSmsListener = (onTransaction: (t: Partial<Transaction>) => void) => {
    activeSmsListener = { onTransaction };
    console.log("Native Bridge: SMS Listener registered.");
};

/**
 * Starts real SMS interception on Android via the native SmsReaderPlugin.
 * On iOS and web (no native platform, or platform !== 'android') this falls
 * back to a no-op so the rest of the app (manual entry, statement upload,
 * voice entry) keeps working - SMS auto-tracking is an Android-only feature
 * by OS design (iOS does not expose SMS content to third-party apps).
 */
export const startSmsBackgroundService = async (): Promise<boolean> => {
    if (isListening) return true;

    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        console.log("Native Bridge: SMS auto-tracking is Android-only; skipping on this platform.");
        return false;
    }

    try {
        const permStatus = await SmsReader.checkPermissions();
        if (!permStatus.granted) {
            const requested = await SmsReader.requestPermissions();
            if (!requested.granted) {
                console.warn("Native Bridge: User denied SMS permission.");
                return false;
            }
        }

        // Avoid double-registering the JS listener if this is called more than once.
        if (smsListenerHandle) {
            await smsListenerHandle.remove();
            smsListenerHandle = null;
        }

        smsListenerHandle = await SmsReader.addListener('smsReceived', (data) => {
            handleIncomingSms(data.body);
        });

        const result = await SmsReader.startListening();
        isListening = result.success;
        console.log("Native Bridge: Real SMS listener started:", result.success);
        return result.success;
    } catch (e) {
        console.error("Native Bridge: Failed to start SMS background service", e);
        return false;
    }
};

export const stopSmsBackgroundService = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
        await SmsReader.stopListening();
        if (smsListenerHandle) {
            await smsListenerHandle.remove();
            smsListenerHandle = null;
        }
        isListening = false;
    } catch (e) {
        console.error("Native Bridge: Failed to stop SMS background service", e);
    }
};

export const authenticateBiometrics = async () => {
    // In a real build, we'd use capacitor-native-biometric
    console.log("Biometric challenge triggered...");
    return true; 
};
import { PushNotifications } from '@capacitor/push-notifications';

export const requestNotificationPermission = async () => {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
        console.warn('User denied push notifications');
        return false;
    }
    await PushNotifications.register();
    return true;
};

export const scheduleLocalNotification = async (title: string, body: string) => {
    // In a real app, we'd use LocalNotifications plugin or FCM
    // For the bridge demo, we console log
    console.log(`[PUSH NOTIFICATION]: ${title} - ${body}`);
};
