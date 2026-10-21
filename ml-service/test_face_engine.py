import sys
import io
import base64
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(CURRENT_DIR, 'face_engine'))

from face_engine import FaceVerificationEngine
from PIL import Image, ImageDraw

def run_tests():
    engine = FaceVerificationEngine()

    # Create synthetic Face A
    img_a = Image.new('RGB', (200, 200), color=(220, 185, 160))
    draw_a = ImageDraw.Draw(img_a)
    draw_a.ellipse((50, 40, 150, 160), fill=(210, 175, 145), outline=(120, 80, 60))
    draw_a.ellipse((70, 75, 90, 95), fill=(50, 40, 30))
    draw_a.ellipse((110, 75, 130, 95), fill=(50, 40, 30))
    draw_a.line([(100, 95), (100, 120)], fill=(100, 60, 40), width=3)
    draw_a.arc((80, 125, 120, 145), 0, 180, fill=(180, 50, 50), width=3)

    buf_a = io.BytesIO()
    img_a.save(buf_a, format='JPEG')
    b64_a = base64.b64encode(buf_a.getvalue()).decode('utf-8')

    # Test 1: Enroll Face A
    res_a = engine.process_enrollment(b64_a)
    assert res_a['success'], f"Enrollment failed: {res_a}"
    emb_a = res_a['embedding']
    assert len(emb_a) == 128, f"Expected 128-dim, got {len(emb_a)}"
    print(f"[TEST 1 PASS] Face A enrolled successfully (embedding dimension: {len(emb_a)})")

    # Test 2: Verify same Face A against enrolled template
    ver_a = engine.process_verification(b64_a, emb_a)
    assert ver_a['verified'], f"Same face verification failed: {ver_a}"
    print(f"[TEST 2 PASS] Same face verified: similarity={ver_a['similarity']}, distance={ver_a['distance']}")

    # Test 3: Create distinct Face B (different features, geometry)
    img_b = Image.new('RGB', (200, 200), color=(140, 100, 70))
    draw_b = ImageDraw.Draw(img_b)
    draw_b.ellipse((30, 30, 170, 170), fill=(130, 90, 65), outline=(60, 40, 25))
    draw_b.rectangle((60, 60, 80, 75), fill=(20, 15, 10))
    draw_b.rectangle((120, 60, 140, 75), fill=(20, 15, 10))
    draw_b.polygon([(100, 80), (85, 115), (115, 115)], fill=(80, 50, 30))
    draw_b.line([(70, 140), (130, 140)], fill=(120, 30, 30), width=5)

    buf_b = io.BytesIO()
    img_b.save(buf_b, format='JPEG')
    b64_b = base64.b64encode(buf_b.getvalue()).decode('utf-8')

    # Test 4: Reject mismatch between Face B and Face A template
    ver_b = engine.process_verification(b64_b, emb_a)
    assert not ver_b['verified'], f"Different face should be rejected: {ver_b}"
    print(f"[TEST 3 PASS] Impostor face correctly rejected: similarity={ver_b['similarity']} (below {ver_b['threshold']}), verified={ver_b['verified']}")

    # Test 5: Quality check rejection on dark image
    img_dark = Image.new('RGB', (200, 200), color=(10, 10, 10))
    buf_dark = io.BytesIO()
    img_dark.save(buf_dark, format='JPEG')
    b64_dark = base64.b64encode(buf_dark.getvalue()).decode('utf-8')
    res_dark = engine.process_enrollment(b64_dark)
    assert not res_dark['success'], f"Dark image should be rejected: {res_dark}"
    print(f"[TEST 4 PASS] Low-quality/dark image correctly rejected: {res_dark.get('error')}")

    print("\n>>> ALL FACE RECOGNITION TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == '__main__':
    run_tests()
