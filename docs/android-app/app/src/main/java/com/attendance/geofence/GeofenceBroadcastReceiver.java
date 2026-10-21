package com.attendance.geofence;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Native Android Geofence Broadcast Receiver
 * Automatically processes Entry (Check-In) and Exit (Check-Out) events
 * received from the Android OS Location subsystem.
 */
public class GeofenceBroadcastReceiver extends BroadcastReceiver {

    private static final String TAG = "GeofenceReceiver";
    private static final String CHANNEL_ID = "attendance_geofence_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent geofencingEvent = GeofencingEvent.fromIntent(intent);
        if (geofencingEvent == null) {
            Log.e(TAG, "Null GeofencingEvent received");
            return;
        }

        if (geofencingEvent.hasError()) {
            Log.e(TAG, "GeofencingEvent error code: " + geofencingEvent.getErrorCode());
            return;
        }

        int transitionType = geofencingEvent.getGeofenceTransition();
        Location triggerLocation = geofencingEvent.getTriggeringLocation();

        double latitude = triggerLocation != null ? triggerLocation.getLatitude() : 0.0;
        double longitude = triggerLocation != null ? triggerLocation.getLongitude() : 0.0;
        float accuracy = triggerLocation != null ? triggerLocation.getAccuracy() : 10.0f;

        if (transitionType == Geofence.GEOFENCE_TRANSITION_ENTER) {
            Log.i(TAG, "GEOFENCE ENTER DETECTED - Triggering Native Check-In");
            sendNotification(context, "Workplace Entry Detected", "Automatic check-in recorded within 50m geofence.");
            forwardTransitionToBackend(context, "check-in", latitude, longitude, accuracy);
        } else if (transitionType == Geofence.GEOFENCE_TRANSITION_EXIT) {
            Log.i(TAG, "GEOFENCE EXIT DETECTED - Triggering Native Check-Out");
            sendNotification(context, "Workplace Exit Detected", "Automatic check-out recorded. Calculating duration.");
            forwardTransitionToBackend(context, "check-out", latitude, longitude, accuracy);
        }
    }

    private void forwardTransitionToBackend(Context context, String action, double lat, double lon, float accuracy) {
        new Thread(() -> {
            try {
                String baseUrl = "http://10.0.2.2:5000/api/attendance/" + action; // 10.0.2.2 for Android emulator host
                URL url = new URL(baseUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setDoOutput(true);

                String deviceId = DeviceManager.getDeviceId(context);
                String token = DeviceManager.getAuthToken(context);

                if (token != null && !token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                JSONObject payload = new JSONObject();
                payload.put("deviceId", deviceId);
                payload.put("latitude", lat);
                payload.put("longitude", lon);
                payload.put("accuracy", accuracy);
                payload.put("isNativeEvent", true);

                OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                Log.i(TAG, "Backend attendance response for " + action + ": " + responseCode);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error posting geofence event to backend: " + e.getMessage());
            }
        }).start();
    }

    private void sendNotification(Context context, String title, String message) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Attendance Geofence Notifications",
                    NotificationManager.IMPORTANCE_HIGH
            );
            manager.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

        manager.notify((int) System.currentTimeMillis(), builder.build());
    }
}
