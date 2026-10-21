package com.attendance.geofence;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.LocationServices;

/**
 * Main Employee Activity
 * Displays live geofence status, attendance tracking, and manages native Android geofence registration.
 */
public class MainActivity extends AppCompatActivity {

    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private static final int BACKGROUND_LOCATION_REQUEST_CODE = 1002;

    private TextView tvEmployeeName;
    private TextView tvGeofenceStatus;
    private TextView tvAttendanceStatus;
    private TextView tvDeviceBinding;
    private Button btnRefresh;
    private Button btnApplyLeave;
    private Button btnLogout;

    private GeofencingClient geofencingClient;
    private GeofenceHelper geofenceHelper;

    // Configured Office Coordinates (Retrieved from Backend)
    private double officeLatitude = 12.9715987;
    private double officeLongitude = 77.5945627;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Check authentication session
        String token = DeviceManager.getAuthToken(this);
        if (token == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        // Initialize Play Services Geofencing
        geofencingClient = LocationServices.getGeofencingClient(this);
        geofenceHelper = new GeofenceHelper(this);

        setupUI();
        checkAndRequestPermissions();
    }

    private void setupUI() {
        setContentView(R.layout.activity_main);
        tvEmployeeName = findViewById(R.id.tvEmployeeName);
        tvGeofenceStatus = findViewById(R.id.tvGeofenceStatus);
        tvAttendanceStatus = findViewById(R.id.tvAttendanceStatus);
        tvDeviceBinding = findViewById(R.id.tvDeviceBinding);
        btnRefresh = findViewById(R.id.btnRefresh);
        btnApplyLeave = findViewById(R.id.btnApplyLeave);
        btnLogout = findViewById(R.id.btnLogout);

        String empId = DeviceManager.getSavedEmployeeId(this);
        tvEmployeeName.setText("Employee: " + (empId != null ? empId : "Authenticated User"));
        tvDeviceBinding.setText("Bound Device: " + DeviceManager.getDeviceId(this));

        btnRefresh.setOnClickListener(v -> syncAttendanceState());
        btnLogout.setOnClickListener(v -> {
            DeviceManager.clearSession(this);
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });
    }

    private void checkAndRequestPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                    LOCATION_PERMISSION_REQUEST_CODE
            );
        } else {
            checkBackgroundLocationPermission();
        }
    }

    private void checkBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                        BACKGROUND_LOCATION_REQUEST_CODE
                );
                return;
            }
        }
        registerNativeGeofence();
    }

    private void registerNativeGeofence() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        com.google.android.gms.location.Geofence geofence = geofenceHelper.getGeofence(
                GeofenceHelper.GEOFENCE_ID,
                officeLatitude,
                officeLongitude
        );

        com.google.android.gms.location.GeofencingRequest request = geofenceHelper.getGeofencingRequest(geofence);

        geofencingClient.addGeofences(request, geofenceHelper.getPendingIntent())
                .addOnSuccessListener(aVoid -> {
                    tvGeofenceStatus.setText("Geofence Active: 50m Radius Around Workplace");
                    Toast.makeText(this, "Native 50m Geofence Registered Successfully", Toast.LENGTH_SHORT).show();
                })
                .addOnFailureListener(e -> {
                    tvGeofenceStatus.setText("Geofence Registration Failed: " + geofenceHelper.getErrorString(e));
                });
    }

    private void syncAttendanceState() {
        Toast.makeText(this, "Syncing latest attendance with backend...", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                checkBackgroundLocationPermission();
            } else {
                Toast.makeText(this, "Fine location permission is required for geofencing.", Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == BACKGROUND_LOCATION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                registerNativeGeofence();
            } else {
                Toast.makeText(this, "Background location required for automatic checkout when leaving workplace.", Toast.LENGTH_LONG).show();
            }
        }
    }
}
