"""
Model Evaluation Script for Attendance Anomaly Detection
Evaluates the trained Isolation Forest model against ground-truth synthetic anomaly labels.
Reports Precision, Recall, F1-Score, and False Positive / False Negative distributions.
Documents the limitations of synthetic data evaluation as required by the SRS.
"""

import os
import sys
import csv
import json

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'app'))

from isolation_forest_engine import AttendanceAnomalyDetector

def evaluate():
    models_dir = os.path.join(BASE_DIR, 'models')
    csv_path = os.path.join(BASE_DIR, 'training', 'synthetic_attendance_dataset.csv')

    if not os.path.exists(csv_path):
        print("Dataset not found. Generating synthetic dataset...")
        from generate_synthetic_data import generate_synthetic_attendance, save_to_csv
        data = generate_synthetic_attendance(num_samples=2500, anomaly_ratio=0.12)
        save_to_csv(data, csv_path)

    # Load dataset
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        records = list(reader)

    # Load trained model
    detector = AttendanceAnomalyDetector.load(models_dir)
    print(f"Loaded trained detector (Engine: {detector.engine_type})")

    # Evaluate
    # In our ground truth:
    # 1 = Normal (Negative class for anomaly detection)
    # -1 = Anomaly (Positive class for anomaly detection)
    tp = 0 # Ground Truth = -1, Predicted = -1
    fp = 0 # Ground Truth = 1,  Predicted = -1
    tn = 0 # Ground Truth = 1,  Predicted = 1
    fn = 0 # Ground Truth = -1, Predicted = 1

    for row in records:
        features = [
            float(row['check_in_deviation']),
            float(row['check_out_deviation']),
            float(row['geofence_duration']),
            float(row['distance_from_center'])
        ]
        gt = int(row['ground_truth'])
        res = detector.predict_single(features)
        pred = res['prediction']

        if gt == -1 and pred == -1:
            tp += 1
        elif gt == 1 and pred == -1:
            fp += 1
        elif gt == 1 and pred == 1:
            tn += 1
        elif gt == -1 and pred == 1:
            fn += 1

    total = tp + fp + tn + fn
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = (tp + tn) / total if total > 0 else 0.0

    report = {
        'total_evaluated_records': total,
        'confusion_matrix': {
            'true_positives_anomalies_detected': tp,
            'false_positives_normal_flagged': fp,
            'true_negatives_normal_confirmed': tn,
            'false_negatives_anomalies_missed': fn
        },
        'metrics': {
            'accuracy': round(accuracy, 4),
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1_score': round(f1, 4)
        },
        'limitations_note': (
            "LIMITATION OF SYNTHETIC DATA EVALUATION: "
            "These metrics evaluate performance on synthetic distribution patterns generated with defined "
            "Gaussian and uniform variance. While useful for cold-start model validation, production attendance "
            "distributions may contain unforeseen workplace dynamics, shift irregularities, weather-induced "
            "GPS drifts, or organizational holiday patterns that synthetic generators do not capture. "
            "Model decisions must always be treated as risk flags for HR review rather than conclusive proof of misconduct."
        )
    }

    report_path = os.path.join(CURRENT_DIR, 'evaluation_report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)

    print("\n================ MODEL EVALUATION REPORT ================")
    print(f"Total Records Evaluated: {total}")
    print(f"Accuracy:                {accuracy * 100:.2f}%")
    print(f"Precision:               {precision * 100:.2f}%")
    print(f"Recall:                  {recall * 100:.2f}%")
    print(f"F1-Score:                {f1 * 100:.2f}%")
    print("Confusion Matrix:")
    print(f"  TP (Anomalies correctly flagged): {tp}")
    print(f"  FP (Normal flagged as anomaly):  {fp}")
    print(f"  TN (Normal correctly passed):    {tn}")
    print(f"  FN (Anomalies missed):           {fn}")
    print(f"Saved evaluation report -> {report_path}")
    print("========================================================\n")

    return report

if __name__ == '__main__':
    evaluate()
