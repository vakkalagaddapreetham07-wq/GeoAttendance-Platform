package com.attendance.geofence;

import android.app.PendingIntent;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.os.Build;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofenceStatusCodes;
import com.google.android.gms.location.GeofencingRequest;

/**
 * Native Android Geofence Helper
 * Manages Geofence builder, geofencing requests, and PendingIntents.
 * Strictly enforces 50-metre radius as required by SRS v1.0.
 */
public class GeofenceHelper extends ContextWrapper {

    public static final String GEOFENCE_ID = "OFFICE_WORKPLACE_GEOFENCE";
    public static final float GEOFENCE_RADIUS_METERS = 50.0f; // Exactly 50 meters
    private PendingIntent pendingIntent;

    public GeofenceHelper(Context base) {
        super(base);
    }

    public GeofencingRequest getGeofencingRequest(Geofence geofence) {
        return new GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                .addGeofence(geofence)
                .build();
    }

    /**
     * Create 50m circular geofence with native entry and exit transitions
     */
    public Geofence getGeofence(String id, double latitude, double longitude) {
        return new Geofence.Builder()
                .setRequestId(id)
                .setCircularRegion(latitude, longitude, GEOFENCE_RADIUS_METERS)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
                .setLoiteringDelay(10000) // 10 seconds dwell
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .build();
    }

    public PendingIntent getPendingIntent() {
        if (pendingIntent != null) {
            return pendingIntent;
        }
        Intent intent = new Intent(this, GeofenceBroadcastReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        pendingIntent = PendingIntent.getBroadcast(this, 2607, intent, flags);
        return pendingIntent;
    }

    public String getErrorString(Exception e) {
        if (e instanceof ApiException) {
            ApiException apiException = (ApiException) e;
            switch (apiException.getStatusCode()) {
                case GeofenceStatusCodes.GEOFENCE_NOT_AVAILABLE:
                    return "Geofence service not available. Check location services.";
                case GeofenceStatusCodes.GEOFENCE_TOO_MANY_GEOFENCES:
                    return "Too many geofences registered.";
                case GeofenceStatusCodes.GEOFENCE_TOO_MANY_PENDING_INTENTS:
                    return "Too many pending intents.";
                default:
                    return "Geofence error: " + apiException.getLocalizedMessage();
            }
        }
        return e.getLocalizedMessage();
    }
}
