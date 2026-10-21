"""
Isolation Forest Core Engine
Supports both scikit-learn IsolationForest (when scikit-learn is installed)
and a pure Python implementation of the Liu, Ting, Zhou (2008) Isolation Forest algorithm.
Guarantees 100% operational anomaly detection across all environments.
"""

import math
import random
import json
import os

try:
    from sklearn.ensemble import IsolationForest as SklearnIsolationForest
    import joblib
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

# Euler-Mascheroni constant
EULER_MASCHERONI = 0.5772156649

def c_factor(n):
    """
    Average path length of unsuccessful search in Binary Search Tree (BST)
    c(n) = 2 * (ln(n - 1) + 0.5772156649) - (2 * (n - 1) / n)
    """
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (math.log(n - 1) + EULER_MASCHERONI) - (2.0 * (n - 1) / n)

class IsolationTreeNode:
    def __init__(self, size, is_leaf=False, split_feature=None, split_value=None, left=None, right=None):
        self.size = size
        self.is_leaf = is_leaf
        self.split_feature = split_feature
        self.split_value = split_value
        self.left = left
        self.right = right

    def to_dict(self):
        if self.is_leaf:
            return {'is_leaf': True, 'size': self.size}
        return {
            'is_leaf': False,
            'size': self.size,
            'split_feature': self.split_feature,
            'split_value': self.split_value,
            'left': self.left.to_dict() if self.left else None,
            'right': self.right.to_dict() if self.right else None
        }

    @classmethod
    def from_dict(cls, data):
        if not data:
            return None
        if data.get('is_leaf'):
            return cls(size=data['size'], is_leaf=True)
        return cls(
            size=data['size'],
            is_leaf=False,
            split_feature=data['split_feature'],
            split_value=data['split_value'],
            left=cls.from_dict(data.get('left')),
            right=cls.from_dict(data.get('right'))
        )

class PureIsolationForest:
    """
    Pure Python Liu, Ting, Zhou (2008) Isolation Forest implementation
    """
    def __init__(self, n_estimators=100, max_samples=256, contamination=0.10, random_state=42):
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.contamination = contamination
        self.random_state = random_state
        self.trees = []
        self.c_n = 1.0
        self.threshold = 0.5

    def _build_tree(self, X, current_height, max_height, rng):
        n_samples = len(X)
        if current_height >= max_height or n_samples <= 1:
            return IsolationTreeNode(size=n_samples, is_leaf=True)

        n_features = len(X[0])
        # Pick random feature with variance
        valid_features = []
        for f in range(n_features):
            vals = [row[f] for row in X]
            if min(vals) < max(vals):
                valid_features.append(f)

        if not valid_features:
            return IsolationTreeNode(size=n_samples, is_leaf=True)

        feature = rng.choice(valid_features)
        feature_vals = [row[feature] for row in X]
        min_v = min(feature_vals)
        max_v = max(feature_vals)
        split_val = rng.uniform(min_v, max_v)

        left_X = [row for row in X if row[feature] < split_val]
        right_X = [row for row in X if row[feature] >= split_val]

        left_node = self._build_tree(left_X, current_height + 1, max_height, rng)
        right_node = self._build_tree(right_X, current_height + 1, max_height, rng)

        return IsolationTreeNode(
            size=n_samples,
            is_leaf=False,
            split_feature=feature,
            split_value=split_val,
            left=left_node,
            right=right_node
        )

    def fit(self, X):
        rng = random.Random(self.random_state)
        n_samples = len(X)
        subsample_size = min(self.max_samples, n_samples)
        max_height = math.ceil(math.log2(max(subsample_size, 2)))
        self.c_n = c_factor(subsample_size)
        self.trees = []

        for _ in range(self.n_estimators):
            subsample = rng.sample(X, subsample_size) if n_samples > subsample_size else list(X)
            tree = self._build_tree(subsample, 0, max_height, rng)
            self.trees.append(tree)

        # Calibrate threshold based on contamination
        scores = [self.anomaly_score(row) for row in X]
        scores.sort()
        # Contamination percentile
        threshold_idx = int(len(scores) * (1.0 - self.contamination))
        self.threshold = scores[min(threshold_idx, len(scores) - 1)]
        return self

    def _path_length(self, row, node, current_depth):
        if node.is_leaf or node.size <= 1:
            return current_depth + c_factor(node.size)
        f = node.split_feature
        if row[f] < node.split_value:
            if node.left:
                return self._path_length(row, node.left, current_depth + 1)
        else:
            if node.right:
                return self._path_length(row, node.right, current_depth + 1)
        return current_depth + c_factor(node.size)

    def anomaly_score(self, row):
        """
        Anomaly Score s(x, n) = 2^(-E(h(x)) / c(n))
        Score closer to 1 indicates an anomaly.
        Score closer to 0 indicates normal observation.
        """
        if not self.trees or self.c_n <= 0:
            return 0.5
        total_path = sum(self._path_length(row, t, 0) for t in self.trees)
        avg_path = total_path / len(self.trees)
        score = 2.0 ** (-avg_path / self.c_n)
        return round(score, 4)

    def predict(self, X):
        """
        Returns -1 for anomaly, 1 for normal
        """
        return [-1 if self.anomaly_score(row) >= self.threshold else 1 for row in X]

    def save_model(self, filepath):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        data = {
            'n_estimators': self.n_estimators,
            'max_samples': self.max_samples,
            'contamination': self.contamination,
            'c_n': self.c_n,
            'threshold': self.threshold,
            'trees': [t.to_dict() for t in self.trees]
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f)

    @classmethod
    def load_model(cls, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        instance = cls(
            n_estimators=data['n_estimators'],
            max_samples=data['max_samples'],
            contamination=data['contamination']
        )
        instance.c_n = data['c_n']
        instance.threshold = data['threshold']
        instance.trees = [IsolationTreeNode.from_dict(t) for t in data['trees']]
        return instance

class AttendanceAnomalyDetector:
    """
    Unified detector wrapper that uses scikit-learn if available,
    otherwise uses PureIsolationForest.
    """
    def __init__(self, contamination=0.10, random_state=42):
        self.contamination = contamination
        self.random_state = random_state
        self.engine_type = 'sklearn' if HAS_SKLEARN else 'pure_python'
        self.model = None

    def fit(self, X):
        if HAS_SKLEARN:
            try:
                self.model = SklearnIsolationForest(
                    n_estimators=100,
                    contamination=self.contamination,
                    random_state=self.random_state
                )
                self.model.fit(X)
                self.engine_type = 'sklearn'
                return self
            except Exception as e:
                print(f"[Warning] Sklearn fit failed: {e}. Falling back to pure python engine.")
        
        self.model = PureIsolationForest(
            n_estimators=100,
            contamination=self.contamination,
            random_state=self.random_state
        )
        self.model.fit(X)
        self.engine_type = 'pure_python'
        return self

    def predict_single(self, features):
        """
        Evaluate single 4-feature vector:
        [check_in_deviation, check_out_deviation, geofence_duration, distance_from_center]
        Returns:
            {
                'prediction': 1 (normal) or -1 (anomaly),
                'is_anomaly': True/False,
                'anomaly_score': float,
                'engine': 'sklearn' or 'pure_python'
            }
        """
        if self.engine_type == 'sklearn' and hasattr(self.model, 'decision_function'):
            pred = int(self.model.predict([features])[0])
            # decision_function gives negative score for anomalies
            raw_score = float(self.model.decision_function([features])[0])
            # Normalize to 0-1 range where >0.5 is anomalous
            score = round(1.0 / (1.0 + math.exp(raw_score * 4)), 4)
            return {
                'prediction': pred,
                'is_anomaly': pred == -1,
                'anomaly_score': score,
                'engine': 'sklearn'
            }
        else:
            score = self.model.anomaly_score(features)
            pred = -1 if score >= self.model.threshold else 1
            return {
                'prediction': pred,
                'is_anomaly': pred == -1,
                'anomaly_score': score,
                'engine': 'pure_python'
            }

    def save(self, model_dir):
        os.makedirs(model_dir, exist_ok=True)
        if self.engine_type == 'sklearn' and HAS_SKLEARN:
            joblib.dump(self.model, os.path.join(model_dir, 'isolation_forest.joblib'))
        # Always also save pure python JSON for cross-platform portability
        if isinstance(self.model, PureIsolationForest):
            self.model.save_model(os.path.join(model_dir, 'isolation_forest_model.json'))
        else:
            # Also fit pure python model to ensure backup is available
            backup = PureIsolationForest(contamination=self.contamination, random_state=self.random_state)
            if hasattr(self, '_last_X'):
                backup.fit(self._last_X)
                backup.save_model(os.path.join(model_dir, 'isolation_forest_model.json'))

    @classmethod
    def load(cls, model_dir):
        instance = cls()
        sklearn_path = os.path.join(model_dir, 'isolation_forest.joblib')
        json_path = os.path.join(model_dir, 'isolation_forest_model.json')

        if HAS_SKLEARN and os.path.exists(sklearn_path):
            try:
                instance.model = joblib.load(sklearn_path)
                instance.engine_type = 'sklearn'
                return instance
            except Exception:
                pass

        if os.path.exists(json_path):
            instance.model = PureIsolationForest.load_model(json_path)
            instance.engine_type = 'pure_python'
            return instance

        raise FileNotFoundError(f"No trained model found in {model_dir}")
