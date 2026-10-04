"""Control-path regressions; MQTT is mocked and no hardware/server is started."""
import threading
import time
import unittest
from unittest.mock import patch

import main


class PublishResult:
    rc = 0

    def wait_for_publish(self, timeout=None):
        pass

    def is_published(self):
        return True


class Broker:
    def __init__(self):
        self.packets = []
        self.result = PublishResult()

    def publish(self, topic, payload, **kwargs):
        self.packets.append((topic, payload, kwargs))
        return self.result


class ServoControlFixture(unittest.TestCase):
    def setUp(self):
        self.broker = Broker()
        self.connected = threading.Event()
        self.connected.set()
        self.patcher = patch.multiple(
            main, control_mqtt_client=self.broker,
            SERVO_PROTOCOL="sequenced_hold", legacy_last_move_at=0.0,
            control_mqtt_connected=self.connected,
            control_mqtt_lock=threading.Lock(), camera_mode="MANUAL",
            hardware_mode="MANUAL", hardware_online=True,
            servo_diag_received_at=time.time(), manual_last_sequence={},
            manual_command_sequence=0, manual_command_epoch=123456789,
        )
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def move(self, direction, seq):
        return main.move_camera(main.CameraMoveRequest(
            direction=direction, session_id="test-browser", seq=seq))


class ServoControlTests(ServoControlFixture):
    def test_all_four_hold_directions_are_published(self):
        for seq, direction in enumerate(("HOLD_LEFT", "HOLD_RIGHT", "HOLD_UP", "HOLD_DOWN"), 1):
            self.assertEqual(self.move(direction, seq)["status"], "success")
            self.assertEqual(self.broker.packets[-1][1], f"@123456789:{seq}:{direction}")

    def test_stop_prevents_older_hold_from_being_published(self):
        self.assertEqual(self.move("STOP", 2)["status"], "success")
        self.assertTrue(self.move("HOLD_UP", 1)["ignored"])
        self.assertEqual(len(self.broker.packets), 1)

    def test_stop_ack_wait_does_not_block_new_gesture(self):
        waiting, release, moved = threading.Event(), threading.Event(), threading.Event()
        outcomes = {}

        class SlowStop(PublishResult):
            def wait_for_publish(self, timeout=None):
                waiting.set()
                release.wait(timeout=2)

        self.broker.result = SlowStop()
        stop_thread = threading.Thread(target=lambda: outcomes.update(stop=self.move("STOP", 2)))
        stop_thread.start()
        self.assertTrue(waiting.wait(timeout=1))

        def new_gesture():
            outcomes["hold"] = self.move("HOLD_DOWN", 3)
            moved.set()

        hold_thread = threading.Thread(target=new_gesture)
        hold_thread.start()
        try:
            self.assertTrue(moved.wait(timeout=0.5), "Joystick waited behind STOP broker ACK")
            self.assertEqual(outcomes["hold"]["status"], "success")
        finally:
            release.set()
            stop_thread.join(timeout=2)
            hold_thread.join(timeout=2)
        self.assertEqual(main.manual_last_sequence["test-browser"], 3)

    def test_offline_still_allows_stop(self):
        main.hardware_online = False
        self.assertEqual(self.move("HOLD_LEFT", 1)["error_code"], "SERVO_OFFLINE")
        self.assertEqual(self.move("STOP", 2)["status"], "success")

    def test_stale_telemetry_rejects_motion(self):
        main.servo_diag_received_at = time.time() - 20
        self.assertEqual(self.move("HOLD_UP", 1)["error_code"], "SERVO_DIAG_STALE")
        self.assertEqual(len(self.broker.packets), 0)

    def test_failed_enqueue_can_retry_same_sequence(self):
        self.broker.result.rc = 15
        self.assertEqual(self.move("HOLD_RIGHT", 1)["status"], "error")
        self.assertNotIn("test-browser", main.manual_last_sequence)
        self.broker.result.rc = 0
        self.assertEqual(self.move("HOLD_RIGHT", 1)["status"], "success")

    def test_partial_sequence_is_rejected(self):
        result = main.move_camera(main.CameraMoveRequest(direction="HOLD_UP", seq=1))
        self.assertEqual(result["status"], "error")
        self.assertEqual(len(self.broker.packets), 0)

    def test_memory_health_is_passed_to_dashboard(self):
        fields = {"min_free_heap": 170000, "largest_free_block": 100000,
                  "loop_stack_free": 3000, "network_stack_free": 4000,
                  "boot_network_stage": "MQTT_LOOP", "log_dropped": 2}
        with patch.object(main, "servo_diag_payload", fields):
            result = main.get_servo_diagnostics()
        for key, value in fields.items():
            self.assertEqual(result["device_health"][key], value)


class LegacyServoTests(ServoControlFixture):
    def test_raw_steps_work_without_telemetry(self):
        main.SERVO_PROTOCOL = "legacy_step"
        main.hardware_online = False
        main.hardware_mode = None
        main.servo_diag_received_at = 0.0
        for seq, direction in enumerate(("LEFT", "RIGHT", "UP", "DOWN", "RESET"), 1):
            main.legacy_last_move_at = 0.0
            result = self.move(direction, seq)
            self.assertEqual(result["status"], "success")
            self.assertFalse(result["device_confirmed"])
            self.assertEqual(self.broker.packets[-1], ("embedded/servo/manual", direction, {"qos": 0}))

    def test_unsupported_hold_stop_and_config_never_publish(self):
        main.SERVO_PROTOCOL = "legacy_step"
        for seq, direction in enumerate(("HOLD_LEFT", "HOLD_RIGHT", "HOLD_UP", "HOLD_DOWN", "STOP"), 1):
            self.assertEqual(self.move(direction, seq)["error_code"], "FIRMWARE_UNSUPPORTED")
        self.assertEqual(main.set_servo_config(main.ServoConfigRequest(key="TEST_TILT"))["error_code"], "FIRMWARE_UNSUPPORTED")
        self.assertEqual(self.broker.packets, [])

    def test_no_fabricated_online_or_stale_retained_data(self):
        main.SERVO_PROTOCOL = "legacy_step"
        with patch.object(main, "servo_diag_payload", {"fw": "old-r3"}):
            diag = main.get_servo_diagnostics()
            mode = main.get_camera_mode()
        self.assertIsNone(diag["online"])
        self.assertIsNone(diag["data"])
        self.assertEqual(diag["device_health"]["state"], "UNVERIFIED")
        self.assertFalse(diag["capabilities"]["stop"])
        self.assertIsNone(mode["hardware_mode"])

    def test_step_bursts_and_duplicate_http_are_not_queued(self):
        main.SERVO_PROTOCOL = "legacy_step"
        self.assertEqual(self.move("UP", 1)["status"], "success")
        self.assertTrue(self.move("UP", 1)["ignored"])
        self.assertEqual(self.move("DOWN", 2)["error_code"], "MOVE_RATE_LIMIT")
        self.assertEqual(len(self.broker.packets), 1)
        main.legacy_last_move_at = 0.0
        self.assertEqual(self.move("DOWN", 2)["status"], "success")

    def test_legacy_requires_broker_and_manual_mode(self):
        main.SERVO_PROTOCOL = "legacy_step"
        self.connected.clear()
        self.assertEqual(self.move("LEFT", 1)["error_code"], "MQTT_DISCONNECTED")
        self.connected.set()
        main.camera_mode = "AUTO"
        self.assertEqual(self.move("LEFT", 2)["error_code"], "UI_MODE_MISMATCH")
        self.assertEqual(self.broker.packets, [])

    def test_mode_ack_only_confirms_broker(self):
        main.SERVO_PROTOCOL = "legacy_step"
        from unittest.mock import mock_open
        with patch("builtins.open", mock_open()) as file:
            result = main.set_camera_mode("AUTO")
        self.assertEqual(result["mode"], "AUTO")
        self.assertIsNone(result["hardware_mode"])
        self.assertTrue(result["broker_acknowledged"])
        self.assertFalse(result["capabilities"]["mode_ack"])
        self.assertEqual(self.broker.packets[-1], ("embedded/servo/mode", "AUTO", {"qos": 1, "retain": True}))
        file().write.assert_called_once_with("AUTO")

    def test_tracking_coordinates_match_fixed_vga_firmware(self):
        for width, height in ((320, 240), (640, 480), (800, 600), (1280, 720)):
            self.assertEqual(main.tracking_payload("legacy_step", width // 2, height // 2, width, height), "320,240")
            self.assertEqual(main.tracking_payload("legacy_step", width // 4, height // 4, width, height), "160,120")
        self.assertEqual(main.tracking_payload("legacy_step", -10, 999, 320, 240), "0,479")
        self.assertEqual(main.tracking_payload("sequenced_hold", 80, 60, 320, 240), "80,60,320,240")
        with self.assertRaises(ValueError):
            main.tracking_payload("legacy_step", 1, 2, 0, 240)


if __name__ == "__main__":
    unittest.main()
