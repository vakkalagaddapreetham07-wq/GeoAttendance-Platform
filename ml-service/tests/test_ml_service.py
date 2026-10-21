"""
ML Service Unit Tests
Tests:
1. Feature vector dimensionality (exact 4 features)
2. Normal session inference
3. Synthetic anomaly examples (short stay buddy punching, extreme late arrival)
4. Score bounds (0.0 to 1.0)
5. Model loading and persistence
"""

import os
import sys
import unittest

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'app'))

from isolation_forest_engine import AttendanceAnomalyDetector

class TestAttendanceAnomalyDetector(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        models_dir = os.path.join(BASE_DIR, 'models')
        cls.detector = AttendanceAnomalyDetector.load(models_dir)

    def test_model_loaded(self):
        self.assertIsNotNone(self.detector)
        self.assertIsNotNone(self.detector.model)

    def test_normal_attendance_pattern(self):
        # 5m late arrival, 10m overtime departure, 545m duration, 15m distance
        features = [5.0, 10.0, 545.0, 15.0]
        res = self.detector.predict_single(features)
        self.assertEqual(res['prediction'], 1, "Expected normal attendance to predict 1")
        self.assertFalse(res['is_anomaly'])
        self.assertLess(res['anomaly_score'], 0.55)

    def test_short_stay_anomaly(self):
        # Arrive roughly on time (0m), leave 520m early (-520m), duration 20 mins, 20m distance
        features = [0.0, -520.0, 20.0, 20.0]
        res = self.detector.predict_single(features)
        self.assertEqual(res['prediction'], -1, "Expected short stay (<30m) to predict -1")
        self.assertTrue(res['is_anomaly'])
        self.assertGreater(res['anomaly_score'], 0.55)

    def test_extreme_late_arrival_anomaly(self):
        # Arrive 240 mins (4 hours) late
        features = [240.0, 0.0, 300.0, 25.0]
        res = self.detector.predict_single(features)
        self.assertEqual(res['prediction'], -1)
        self.assertTrue(res['is_anomaly'])

    def test_score_range(self):
        features = [10.0, 5.0, 535.0, 12.0]
        res = self.detector.predict_single(features)
        self.assertGreaterEqual(res['anomaly_score'], 0.0)
        self.assertLessEqual(res['anomaly_score'], 1.0)

if __name__ == '__main__':
    unittest.main()
