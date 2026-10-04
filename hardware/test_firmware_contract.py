"""Check the actual firmware JSON format against its payload/MQTT capacities."""
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


class FirmwarePacketTests(unittest.TestCase):
    def test_native_parser_and_stale_stop_mailbox(self):
        compiler = shutil.which("g++")
        if not compiler:
            self.skipTest("g++ is needed for the native protocol regression")
        source = (Path(__file__).parent / "esp32_servo_radar" / "esp32_servo_radar.ino").read_text(encoding="utf-8")
        functions = source.split("bool parseDecimalToken(", 1)[1].split("void networkTask(", 1)[0]
        packet = re.search(r"struct IncomingCommand \{[^}]+\};", source)[0]
        harness = r'''
#include <cstdint>
#include <cstring>
#include <cctype>
#include <cstdio>
using byte = unsigned char;
uint32_t millis() { return 100; }
uint32_t mqttRxDropped = 0;
'''+packet+r'''
// Test double only for FreeRTOS queue operations; parsing and routing below
// are extracted verbatim from the production sketch.
struct Inbox {
  IncomingCommand value{};
  unsigned count = 0;
  void latest(const IncomingCommand& command) { value = command; ++count; }
  bool send(const IncomingCommand& command) { latest(command); return true; }
} manualMailbox, visionMailbox, commandQueue;
'''+"bool parseDecimalToken("+functions+r'''
void feed(const char* text) {
  char topic[] = "embedded/servo/manual";
  captureMqttCommand(topic, reinterpret_cast<byte*>(const_cast<char*>(text)), strlen(text));
}
#define CHECK(expr) do { if (!(expr)) { fprintf(stderr, "Failed line %d: %s\n", __LINE__, #expr); return 1; } } while (0)
int main() {
  uint64_t epoch, seq;
  const char* direction;
  CHECK(parseManualPacket("@1791079790073329800:1330:HOLD_UP", epoch, seq, direction));
  CHECK(epoch == UINT64_C(1791079790073329800) && seq == 1330 && !strcmp(direction, "HOLD_UP"));
  CHECK(parseManualPacket("@18446744073709551615:18446744073709551615:STOP", epoch, seq, direction));
  CHECK(!parseManualPacket("@18446744073709551616:1:STOP", epoch, seq, direction));
  CHECK(!parseManualPacket("@:1:STOP", epoch, seq, direction));
  CHECK(!parseManualPacket("@1:2:STOP:EXTRA", epoch, seq, direction));
  CHECK(!parseManualPacket("@1:-1:HOLD_DOWN", epoch, seq, direction));
  CHECK(!parseManualPacket("HOLD_DIAGONAL", epoch, seq, direction));
  feed("@10:2:STOP");
  feed("@10:1:HOLD_LEFT");
  CHECK(manualMailbox.count == 1 && !strcmp(manualMailbox.value.payload, "@10:2:STOP"));
  feed("@10:3:HOLD_UP");
  feed("@9:999:STOP");
  CHECK(manualMailbox.count == 2 && !strcmp(manualMailbox.value.payload, "@10:3:HOLD_UP"));
  char topic[] = "embedded/servo/manual";
  byte bad[] = {'H', 'O', 'L', 'D', 0, 'U', 'P'};
  captureMqttCommand(topic, bad, sizeof(bad));
  char huge[129]; memset(huge, 'X', sizeof(huge)); huge[128] = 0;
  feed(huge);
  CHECK(manualMailbox.count == 2 && mqttRxDropped == 4);
  feed("@10:4:HOLD_DOWN");
  CHECK(manualMailbox.count == 3 && !strcmp(manualMailbox.value.payload, "@10:4:HOLD_DOWN"));
  return 0;
}
'''
        with tempfile.TemporaryDirectory(prefix="servo-protocol-") as directory:
            src, exe = Path(directory) / "protocol.cpp", Path(directory) / "protocol.exe"
            src.write_text(harness, encoding="utf-8")
            built = subprocess.run([compiler, "-std=c++17", "-Wall", "-Wextra", str(src), "-o", str(exe)], capture_output=True, text=True)
            self.assertEqual(built.returncode, 0, built.stderr)
            ran = subprocess.run([str(exe)], capture_output=True, text=True, timeout=10)
            self.assertEqual(ran.returncode, 0, ran.stderr)

    def test_diagnostics_fit_even_with_large_counters(self):
        source = (Path(__file__).parent / "esp32_servo_radar" / "esp32_servo_radar.ino").read_text(encoding="utf-8")
        body = source.split("void printServoDiagnostics(bool force) {", 1)[1].split("void printNetDiagnostics", 1)[0]
        capacity = int(re.search(r"char payload\[(\d+)\]", body)[1])
        packet_capacity = int(re.search(r"networkClient.setBufferSize\((\d+)\)", source)[1])
        strings = body.split("snprintf(payload, sizeof(payload),", 1)[1].split("FW_VERSION,", 1)[0]
        fmt = "".join(json.loads(part) for part in re.findall(r'"(?:\\.|[^"\\])*"', strings))
        values = []
        for match in re.finditer(r"%(?:\.\d+)?(?:l)?[sduf]", fmt):
            spec = match.group()
            if spec.endswith("s"):
                values.append("X" * 32 if fmt[match.start() - 1] == '"' else "false")
            elif spec.endswith("f"):
                values.append(4294967295.9)
            elif spec.endswith("u"):
                values.append(4294967295)
            else:
                values.append(-2147483648)
        payload = fmt % tuple(values)
        json.loads(payload)
        self.assertLess(len(payload.encode()), capacity, "snprintf would truncate diagnostic JSON")
        self.assertLessEqual(5 + 2 + len("embedded/servo/diag") + len(payload.encode()), packet_capacity,
                             "PubSubClient would reject diagnostics and backend would mark servo stale")


if __name__ == "__main__":
    unittest.main()
