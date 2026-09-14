import unittest

from fall_detection import FallDetector, FallObservation


def obs(t, *, horizontal=False, y=200.0, speed_conf=0.9, head_y=None, hip_y=None, spine_angle=None):
    if hip_y is None:
        hip_y = y
    if head_y is None:
        head_y = y - (30.0 if horizontal else 60.0)
    return FallObservation(
        timestamp=t,
        detection_confidence=speed_conf,
        keypoint_confidence=speed_conf,
        aspect_ratio=1.35 if horizontal else 0.55,
        spine_angle=(35.0 if horizontal else 78.0) if spine_angle is None else spine_angle,
        com_y=y,
        body_height=100.0,
        head_y=head_y,
        hip_y=hip_y,
    )


class FallDetectorTests(unittest.TestCase):
    def test_static_lying_person_is_not_a_fall(self):
        detector = FallDetector()
        decisions = [detector.update(7, obs(i * 0.1, horizontal=True, y=300)) for i in range(20)]
        self.assertFalse(any(d.newly_confirmed for d in decisions))

    def test_slow_stationary_person_is_not_a_fall(self):
        detector = FallDetector()
        decisions = [detector.update(7, obs(i * 0.1, y=200 + i * 0.2)) for i in range(20)]
        self.assertFalse(any(d.newly_confirmed for d in decisions))

    def test_upright_to_horizontal_transition_confirms(self):
        detector = FallDetector()
        decisions = []
        for i in range(8):
            decisions.append(detector.update(7, obs(i * 0.1, y=200)))
        decisions.append(detector.update(7, obs(0.8, y=245)))
        decisions.append(detector.update(7, obs(0.9, horizontal=True, y=290)))
        decisions.append(detector.update(7, obs(1.0, horizontal=True, y=290)))
        for i in range(7):
            decisions.append(detector.update(7, obs(1.1 + i * 0.1, horizontal=True, y=290)))
        self.assertTrue(any(d.newly_confirmed for d in decisions))

    def test_two_ids_are_independent(self):
        detector = FallDetector()
        for i in range(8):
            detector.update(1, obs(i * 0.1, y=200))
            detector.update(2, obs(i * 0.1, horizontal=True, y=300))
        self.assertNotEqual(detector.tracks[1].state, "confirmed")
        self.assertNotEqual(detector.tracks[2].state, "confirmed")

    def test_gradual_collapse_from_chair_is_confirmed(self):
        detector = FallDetector()
        decisions = []
        for i in range(8):
            decisions.append(detector.update(4, obs(i * 0.1, y=200, head_y=140, hip_y=200)))
        # Torso rotates and head sinks toward the hip, without requiring a
        # wide horizontal bounding box.
        for i in range(5):
            t = 0.8 + i * 0.1
            decisions.append(detector.update(4, obs(t, y=225 + i * 6, spine_angle=55.0, head_y=180 + i * 8, hip_y=225 + i * 6)))
        for i in range(14):
            t = 1.3 + i * 0.1
            decisions.append(detector.update(4, obs(t, y=255, spine_angle=55.0, head_y=220, hip_y=255)))
        self.assertTrue(any(d.newly_confirmed for d in decisions))


if __name__ == "__main__":
    unittest.main()
