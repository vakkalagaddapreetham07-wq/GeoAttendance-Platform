"""
Flask REST API for Machine Learning Attendance Anomaly Detection Service
Port: 5001
Endpoints:
- GET  /health
- GET  /model-info
- POST /assess
- POST /retrain
"""

import os
import sys
from flask import Flask, request, jsonify

# Add current and parent directories to sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, CURRENT_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'training'))
sys.path.insert(0, os.path.join(BASE_DIR, 'face_engine'))

from isolation_forest_engine import AttendanceAnomalyDetector
from face_engine import FaceVerificationEngine

app = Flask(__name__)
PORT = int(os.environ.get('PORT', 5001))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# Global detector & face verifier instances
detector = None
face_engine = FaceVerificationEngine()

def init_model():
    global detector
    if detector is not None:
        return detector

    try:
        detector = AttendanceAnomalyDetector.load(MODELS_DIR)
        print(f"Loaded existing model from {MODELS_DIR} (Engine: {detector.engine_type})")
    except Exception as e:
        print(f"No existing model found ({e}). Automatically training initial model on synthetic data...")
        from train_model import train_and_save
        detector = train_and_save()
    return detector

# Initialize model once on module load (ensures readiness under both WSGI and direct execution)
init_model()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'attendance-ml-anomaly-service',
        'model_loaded': detector is not None,
        'engine': detector.engine_type if detector else 'none',
        'version': '1.0.0'
    }), 200

@app.route('/model-info', methods=['GET'])
def model_info():
    if not detector:
        return jsonify({'error': 'Model not initialized'}), 503

    return jsonify({
        'algorithm': 'Isolation Forest',
        'engine': detector.engine_type,
        'contamination': detector.contamination,
        'expected_features': [
            'check_in_deviation (minutes)',
            'check_out_deviation (minutes)',
            'geofence_duration (minutes)',
            'distance_from_center (meters)'
        ],
        'score_interpretation': 'Score > 0.5 indicates anomalous attendance pattern'
    }), 200

@app.route('/assess', methods=['POST'])
def assess():
    if not detector:
        return jsonify({'success': False, 'error': 'ML model is not loaded'}), 503

    data = request.get_json(force=True, silent=True)
    if not data or 'features' not in data:
        return jsonify({
            'success': False,
            'error': 'Missing required "features" array in JSON payload'
        }), 400

    features = data['features']
    if not isinstance(features, list) or len(features) != 4:
        return jsonify({
            'success': False,
            'error': f'Features array must contain exactly 4 numeric values. Received {len(features) if isinstance(features, list) else 0}.'
        }), 400

    try:
        numeric_features = [float(x) for x in features]
    except (ValueError, TypeError) as e:
        return jsonify({
            'success': False,
            'error': f'All feature values must be valid numbers: {str(e)}'
        }), 400

    # Run inference
    result = detector.predict_single(numeric_features)

    return jsonify({
        'success': True,
        'is_anomaly': result['is_anomaly'],
        'anomaly_score': result['anomaly_score'],
        'prediction': result['prediction'],
        'engine': result['engine'],
        'features_evaluated': numeric_features
    }), 200

@app.route('/retrain', methods=['POST'])
def retrain():
    global detector
    try:
        from train_model import train_and_save
        detector = train_and_save()
        return jsonify({
            'success': True,
            'message': 'Model retrained and reloaded successfully.',
            'engine': detector.engine_type
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Retraining failed: {str(e)}'
        }), 500

# ----------------- FACE BIOMETRIC ENDPOINTS -----------------
@app.route('/face/info', methods=['GET'])
def face_info():
    return jsonify({
        'service': 'biometric-face-verification-service',
        'status': 'active',
        'cosine_threshold': face_engine.cosine_threshold,
        'euclidean_threshold': face_engine.euclidean_threshold,
        'cv2_available': face_engine.cv2_available,
        'yunet_loaded': face_engine.yunet is not None,
        'sface_loaded': face_engine.sface is not None,
        'model_name': 'opencv_sface_yunet',
        'dimension': 128
    }), 200

@app.route('/face/detect-and-embed', methods=['POST'])
def face_detect_and_embed():
    data = request.get_json(force=True, silent=True)
    if not data or 'image' not in data:
        return jsonify({'success': False, 'error': 'Missing required "image" payload in request.'}), 400

    result = face_engine.process_enrollment(data['image'])
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@app.route('/face/verify', methods=['POST'])
def face_verify():
    data = request.get_json(force=True, silent=True)
    if not data or 'image' not in data or 'enrolled_embedding' not in data:
        return jsonify({'success': False, 'error': 'Missing "image" or "enrolled_embedding" in request payload.'}), 400

    enrolled = data['enrolled_embedding']
    if not isinstance(enrolled, list) or len(enrolled) == 0:
        return jsonify({'success': False, 'error': 'Invalid enrolled_embedding vector.'}), 400

    result = face_engine.process_verification(data['image'], enrolled)
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


if __name__ == '__main__':
    init_model()
    print(f"Starting ML Anomaly Detection Service on port {PORT}...")
    app.run(host='0.0.0.0', port=PORT, debug=False)
