"""Wire formats for the supplied step firmware and the diagnostic firmware."""

PROTOCOLS = ("legacy_step", "sequenced_hold")
STEP_COMMANDS = frozenset(("LEFT", "RIGHT", "UP", "DOWN", "RESET"))
LEGACY_STEP_INTERVAL = 0.15  # Reject bursts; never queue delayed movements.
LEGACY_TRACKING_INTERVAL = 0.1


def capabilities(protocol):
    diagnostic = protocol == "sequenced_hold"
    return {"hold": diagnostic, "stop": diagnostic, "diagnostics": diagnostic,
            "mode_ack": diagnostic, "config": diagnostic}


def tracking_payload(protocol, x, y, width, height):
    if width <= 0 or height <= 0:
        raise ValueError("Frame dimensions must be positive")
    if protocol == "legacy_step":
        # The supplied sketch subtracts the fixed VGA center (320, 240).
        # Preserve direction/error at QVGA, VGA and other capture resolutions.
        x = max(0, min(639, round(x * 640 / width)))
        y = max(0, min(479, round(y * 480 / height)))
        return f"{x},{y}"
    return f"{x},{y},{width},{height}"
