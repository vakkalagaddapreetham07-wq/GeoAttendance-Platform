"""
Model Training Script for Geofence Attendance Anomaly Detection
Uses the 4-feature vector specified in the SRS:
1. check_in_deviation
2. check_out_deviation
3. geofence_duration
4. distance_from_center
"""

import os
import sys
import csv

# Add parent directory to path to import app modules
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'app'))

from isolation_forest_engine import AttendanceAnomalyDetector
from generate_synthetic_data import generate_synthetic_attendance, save_to_csv

def train_and_save():
    csv_path = os.path.join(CURRENT_DIR, 'synthetic_attendance_dataset.csv')
    
    # 1. Generate synthetic dataset if not already present
    if not os.path.exists(csv_path):
        print("Generating reproducible synthetic attendance dataset...")
        data = generate_synthetic_attendance(num_samples=2500, anomaly_ratio=0.12)
        save_to_csv(data, csv_path)
    else:
        print(f"Loading existing synthetic dataset from {csv_path}...")
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            data = list(reader)

    # 2. Extract feature matrix X
    # Feature order: [check_in_deviation, check_out_deviation, geofence_duration, distance_from_center]
    X = []
    y_ground_truth = []
    for row in data:
        features = [
            float(row['check_in_deviation']),
            float(row['check_out_deviation']),
            float(row['geofence_duration']),
            float(row['distance_from_center'])
        ]
        X.append(features)
        y_ground_truth.append(int(row['ground_truth']))

    print(f"Training Isolation Forest model on {len(X)} records with 4 features...")
    detector = AttendanceAnomalyDetector(contamination=0.10, random_state=42)
    detector._last_X = X
    detector.fit(X)

    # 3. Save model
    models_dir = os.path.join(BASE_DIR, 'models')
    detector.save(models_dir)
    print(f"Model successfully saved to {models_dir} (Engine: {detector.engine_type})")

    # 4. Test sample normal and anomalous predictions
    print("\n--- Model Verification Test ---")
    test_cases = [
        {
            'name': 'Typical On-Time Session (Expected: Normal)',
            'features': [5, 10, 545, 18.5] # 5m late, 10m late leave, ~9h, 18.5m dist
        },
        {
            'name': 'Short Stay Buddy Punch (Expected: Anomaly)',
            'features': [10, -510, 20, 35.0] # stayed only 20 mins
        },
        {
            'name': 'Extreme Late Arrival (Expected: Anomaly)',
            'features': [180, 10, 370, 22.0] # 3 hours late
        },
        {
            'name': 'Boundary Distance Anomaly (Expected: Anomaly)',
            'features': [0, 0, 540, 62.0] # 62m distance (>50m boundary)
        }
    ]

    for tc in test_cases:
        res = detector.predict_single(tc['features'])
        status = "ANOMALY" if res['is_anomaly'] else "NORMAL"
        print(f"[{status}] {tc['name']} -> Score: {res['anomaly_score']}, Prediction: {res['prediction']}")

    return detector

if __name__ == '__main__':
    train_and_save()
