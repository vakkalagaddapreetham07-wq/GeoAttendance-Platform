"""
Synthetic Attendance Data Generator
Generates reproducible synthetic attendance data for initial ML model training as specified in the SRS.
Features:
1. check_in_deviation: minutes deviation from shift start (09:00). Positive=late, Negative=early
2. check_out_deviation: minutes deviation from shift end (18:00). Positive=late, Negative=early
3. geofence_duration: total minutes spent inside geofence
4. distance_from_center: distance in meters from geofence centre (0 to 50m)

Label:
1  = Normal attendance pattern
-1 = Anomalous pattern (synthetic ground truth)
"""

import os
import csv
import random

def generate_synthetic_attendance(num_samples=2000, anomaly_ratio=0.12, random_seed=42):
    random.seed(random_seed)
    
    data = []
    num_anomalies = int(num_samples * anomaly_ratio)
    num_normal = num_samples - num_anomalies
    
    # 1. Generate Normal Attendance Patterns
    for i in range(num_normal):
        # Arrive roughly on time: -20 to +15 minutes
        check_in_dev = round(random.gauss(0, 8))
        check_in_dev = max(-40, min(20, check_in_dev))
        
        # Depart roughly on time: -15 to +30 minutes
        check_out_dev = round(random.gauss(5, 10))
        check_out_dev = max(-20, min(60, check_out_dev))
        
        # Duration: approximately 540 minutes (9 hours) +/- 30 minutes
        # duration = (18:00 + check_out_dev) - (09:00 + check_in_dev) = 540 + check_out_dev - check_in_dev
        duration = 540 + check_out_dev - check_in_dev
        duration = max(450, min(600, duration))
        
        # Distance from geofence center (within 50m boundary)
        distance = round(random.uniform(5.0, 38.0), 2)
        
        data.append({
            'record_id': f'SYN_NORM_{i+1:05d}',
            'check_in_deviation': check_in_dev,
            'check_out_deviation': check_out_dev,
            'geofence_duration': duration,
            'distance_from_center': distance,
            'is_synthetic': True,
            'ground_truth': 1,
            'pattern_type': 'normal'
        })
        
    # 2. Generate Anomalous Attendance Patterns
    anomaly_types = [
        'short_stay_buddy_punch',
        'extreme_late_arrival',
        'early_departure_ghosting',
        'gps_spoof_boundary',
        'erratic_time_warp'
    ]
    
    for i in range(num_anomalies):
        atype = anomaly_types[i % len(anomaly_types)]
        
        if atype == 'short_stay_buddy_punch':
            # Check in, stay only 10-28 minutes, check out
            check_in_dev = random.randint(-10, 20)
            duration = random.randint(8, 28) # Hard rule triggers < 30
            check_out_dev = -540 + check_in_dev + duration
            distance = round(random.uniform(15.0, 48.0), 2)
            
        elif atype == 'extreme_late_arrival':
            # Arrive 2 to 4.5 hours late
            check_in_dev = random.randint(120, 270)
            check_out_dev = random.randint(0, 30)
            duration = 540 + check_out_dev - check_in_dev
            distance = round(random.uniform(10.0, 45.0), 2)
            
        elif atype == 'early_departure_ghosting':
            # Arrive on time, leave 3 to 5 hours early
            check_in_dev = random.randint(-15, 10)
            check_out_dev = random.randint(-300, -180)
            duration = 540 + check_out_dev - check_in_dev
            distance = round(random.uniform(10.0, 40.0), 2)
            
        elif atype == 'gps_spoof_boundary':
            # Borderline or excessive distance
            check_in_dev = random.randint(-15, 20)
            check_out_dev = random.randint(-20, 20)
            duration = 540 + check_out_dev - check_in_dev
            distance = round(random.uniform(46.0, 68.0), 2) # Near/outside 50m
            
        else: # erratic_time_warp
            check_in_dev = random.randint(-60, 180)
            check_out_dev = random.randint(-180, 60)
            duration = random.randint(60, 240)
            distance = round(random.uniform(20.0, 55.0), 2)
            
        data.append({
            'record_id': f'SYN_ANOM_{i+1:05d}',
            'check_in_deviation': check_in_dev,
            'check_out_deviation': check_out_dev,
            'geofence_duration': duration,
            'distance_from_center': distance,
            'is_synthetic': True,
            'ground_truth': -1,
            'pattern_type': atype
        })
        
    random.shuffle(data)
    return data

def save_to_csv(data, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    fields = [
        'record_id',
        'check_in_deviation',
        'check_out_deviation',
        'geofence_duration',
        'distance_from_center',
        'is_synthetic',
        'ground_truth',
        'pattern_type'
    ]
    with open(output_path, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(data)
    print(f"Successfully generated {len(data)} synthetic attendance records -> {output_path}")

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_csv = os.path.join(base_dir, 'training', 'synthetic_attendance_dataset.csv')
    dataset = generate_synthetic_attendance(num_samples=2500, anomaly_ratio=0.12)
    save_to_csv(dataset, target_csv)
