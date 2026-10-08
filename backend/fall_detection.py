"""Per-track, temporal fall detection.

The detector deliberately does not classify a person who is merely lying down as
a fall.  A fall must be observed as a transition: a usable upright track, a
downward/postural change, and a short period of stable post-impact posture.
All thresholds are normalized by the person's bounding-box height so they are
less sensitive to camera zoom and pan/tilt motion.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from collections import deque
from typing import Deque, Optional
import math


@dataclass(frozen=True)
class FallConfig:
    min_detection_confidence: float = 0.55
    min_keypoint_confidence: float = 0.35
    min_upright_time: float = 0.45
    candidate_timeout: float = 2.0
    confirmation_time: float = 0.70
    gradual_confirmation_time: float = 1.20
    post_impact_stability: float = 0.30
    cooldown: float = 4.0
    history_seconds: float = 5.0
    # AI can run near 2 FPS on the target PC; allow normal frame jitter
    # without joining tracks across a prolonged occlusion.
    max_observation_gap: float = 0.90
    horizontal_aspect_ratio: float = 1.18
    horizontal_spine_angle: float = 48.0
    min_drop_body_heights: float = 0.30
    min_downward_speed: float = 0.55
    max_post_impact_speed: float = 1.50


@dataclass(frozen=True)
class FallObservation:
    timestamp: float
    detection_confidence: float
    keypoint_confidence: float
    aspect_ratio: float
    spine_angle: float
    com_y: float
    body_height: float
    posture_motion: float = 0.0
    head_y: float = 0.0
    shoulder_y: float = 0.0
    hip_y: float = 0.0
    face_visible: bool = True
    is_camera_moving: bool = False


@dataclass(frozen=True)
class FallDecision:
    state: str
    score: float
    confirmed: bool = False
    newly_confirmed: bool = False
    reason: str = ""


@dataclass
class _TrackState:
    observations: Deque[FallObservation] = field(default_factory=deque)
    state: str = "unknown"
    first_seen: float = 0.0
    upright_since: Optional[float] = None
    candidate_since: Optional[float] = None
    last_positive: float = 0.0
    last_seen: float = 0.0
    confirmed_at: float = 0.0
    cooldown_until: float = 0.0
    baseline_head_hip_ratio: Optional[float] = None


class FallDetector:
    """Small deterministic state machine, safe to run independently per ID."""

    def __init__(self, config: FallConfig | None = None):
        self.config = config or FallConfig()
        self._tracks: dict[int, _TrackState] = {}

    @property
    def tracks(self) -> dict[int, _TrackState]:
        return self._tracks

    def reset(self) -> None:
        self._tracks.clear()

    def update(self, track_id: int, obs: FallObservation) -> FallDecision:
        cfg = self.config
        track = self._tracks.setdefault(track_id, _TrackState(first_seen=obs.timestamp))
        track.last_seen = obs.timestamp

        if not self._valid(obs):
            return FallDecision(track.state, 0.0, track.state == "confirmed", reason="low_quality")

        if track.observations and obs.timestamp - track.observations[-1].timestamp > cfg.max_observation_gap:
            # Do not infer a fall across occlusion/ID loss.
            track.observations.clear()
            track.upright_since = None
            track.candidate_since = None
            track.state = "unknown"
        track.observations.append(obs)
        cutoff = obs.timestamp - cfg.history_seconds
        while track.observations and track.observations[0].timestamp < cutoff:
            track.observations.popleft()

        horizontal = obs.aspect_ratio >= cfg.horizontal_aspect_ratio and obs.spine_angle <= cfg.horizontal_spine_angle
        speed = self._downward_speed(track.observations)
        drop = self._drop_in_body_heights(track.observations)
        stable = speed <= cfg.max_post_impact_speed and obs.posture_motion <= cfg.max_post_impact_speed
        # 60° keeps a slumped torso out of the "still supported" bucket while
        # allowing both standing and seated upright baselines.
        upright = not horizontal and obs.spine_angle >= 60.0
        head_hip_ratio = self._head_hip_ratio(obs)

        if upright:
            if track.upright_since is None:
                track.upright_since = obs.timestamp
            # An upright-looking collapse can still be a fall. Do not erase
            # its candidate timer on every subsequent frame.
            if (obs.timestamp - track.upright_since >= cfg.min_upright_time
                    and track.state not in ("candidate", "confirmed")):
                track.state = "upright"
                track.candidate_since = None
                track.last_positive = 0.0
                if track.baseline_head_hip_ratio is None:
                    track.baseline_head_hip_ratio = head_hip_ratio
        elif track.upright_since is None and track.state == "unknown":
            # Existing/static lying subjects are not an incident.
            track.state = "observed_horizontal"

        prior_upright = (
            track.upright_since is not None
            and obs.timestamp - track.upright_since >= cfg.min_upright_time
        )
        # Camera motion can move every bounding box at once. Requiring a real
        # body-orientation change prevents that global translation from being
        # interpreted as a fall.
        max_spine = max((o.spine_angle for o in track.observations), default=obs.spine_angle)
        posture_change = max(0.0, max_spine - obs.spine_angle)
        
        max_ratio = max((self._head_hip_ratio(o) for o in track.observations), default=head_hip_ratio)
        head_hip_drop = max(0.0, max_ratio - head_hip_ratio)
        
        # Thêm biến theo dõi khoảng cách đầu-vai (đã chuẩn hóa). Giải quyết lỗi tai ở trên vai khi đầu gục sát ngực.
        scale = max(8.0, obs.body_height)
        hs_dist = max(0.0, (obs.shoulder_y - obs.head_y) / scale)
        max_hs_dist = max(max(0.0, (o.shoulder_y - o.head_y) / max(8.0, o.body_height)) for o in track.observations) if track.observations else hs_dist
        head_shoulder_drop = max(0.0, max_hs_dist - hs_dist)
        
        # Xử lý Ảo ảnh Phối cảnh (Perspective Distortion): Khi gục về phía camera, đầu phình to ra và che khuất,
        # khoảng cách từ chóp tóc đến vai trên ảnh 2D thực chất LỚN HƠN (dãn ra) so với lúc ngồi thẳng!
        min_hs_dist = min(max(0.0, (o.shoulder_y - o.head_y) / max(8.0, o.body_height)) for o in track.observations) if track.observations else hs_dist
        head_shoulder_expansion = max(0.0, hs_dist - min_hs_dist)

        horizontal_transition = (
            prior_upright
            and horizontal
            and posture_change >= 15.0
            and (drop >= cfg.min_drop_body_heights or speed >= cfg.min_downward_speed)
        )
        
        # Phát hiện gục đầu dựa trên hình học: Mũi (head_y) tụt xuống bằng hoặc thấp hơn Vai (shoulder_y)
        # Bù trừ một chút nhiễu (ví dụ: -5 pixels hoặc 2% body_height để tăng độ nhạy)
        head_below_shoulder = obs.head_y >= obs.shoulder_y - (obs.body_height * 0.02)
        
        # A person can slump from a chair in various ways:
        # 1. Torso leans far back/side (posture_change >= 20.0)
        # 2. Head drops straight down to chest/desk (head_hip_drop >= 0.08)
        # 3. Mũi tụt sát xuống vai (head_below_shoulder) - Cực kỳ chính xác cho gục gập cổ
        # Phản hồi Tối thượng (Definitive Fix) cho Gục thẳng bị Sai lệch Phối cảnh (Perspective Distortion):
        # Khi ngồi thẳng, khoảng cách từ đầu đến vai chỉ chiếm ~25% chiều cao cơ thể (hs_dist = 0.25).
        # Nhưng khi GỤC THẲNG lên bàn, phần thân dưới bị bàn che khuất, nên Bounding Box chỉ còn là Cái Đầu và Bộ Vai.
        # Lúc này vai sẽ nằm ở ĐÁY của bounding box. Tức là hs_dist sẽ tăng vọt lên > 60% (0.60).
        desk_slump = (hs_dist >= 0.60) and (not obs.face_visible)
        
        chair_slump = (
            posture_change >= 20.0
            or head_hip_drop >= 0.08
            or head_below_shoulder
            or head_shoulder_drop >= 0.08
            or desk_slump
            or (not obs.face_visible and (posture_change >= 10.0 or head_shoulder_expansion >= 0.05))
        )
        
        # --- DEBUG LOGGING ---
        if True:
            with open("fall_debug.log", "a") as f:
                f.write(f"[{obs.timestamp:.1f}] hs_dist: {hs_dist:.2f} | desk_slump: {desk_slump} | p_change: {posture_change:.1f} | hs_drop: {head_shoulder_drop:.3f} | hs_exp: {head_shoulder_expansion:.3f} | chair_slump: {chair_slump}\n")
        # ---------------------
        
        # A missing face/shoulder can make chair_slump true even while the
        # person is motionless. Require an observed change before arming it.
        slump_change = (
            posture_change >= 10.0
            or head_hip_drop >= 0.08
            or head_shoulder_drop >= 0.08
            or head_shoulder_expansion >= 0.05
            or drop >= 0.20
        )
        gradual_collapse = (
            prior_upright
            and not horizontal
            and chair_slump
            and slump_change
        )
        
        # Ngã ngồi: Rơi tự do xuống nhưng tư thế vẫn thẳng (không horizontal)
        vertical_collapse = (
            prior_upright
            and not horizontal
            and drop >= 0.35
            and speed >= cfg.min_downward_speed
        )
        
        # Ngã tiếp sau khi gắn gượng: Rất nhạy, chỉ cần đang ở trạng thái recovery mà nằm xuống lại
        failed_recovery = (
            track.state == "recovery"
            and (horizontal or obs.spine_angle <= 45.0 or drop >= 0.20)
        )
        
        transition = horizontal_transition or gradual_collapse or vertical_collapse or failed_recovery
        collapsed_posture = horizontal or (chair_slump and slump_change) or drop >= 0.35

        if obs.is_camera_moving:
            transition = False

        # Không return sớm vì cooldown nữa để State Machine luôn được cập nhật liên tục!
        # Điều này giúp phát hiện nhịp "gắn gượng dậy rồi ngã tiếp".

        if transition and track.state != "confirmed":
            track.state = "candidate"
            track.candidate_since = track.candidate_since or obs.timestamp
            track.last_positive = obs.timestamp
        elif track.state == "candidate":
            if obs.is_camera_moving:
                # Saccadic Masking: Freeze candidate state and avoid timeout while camera moves
                track.candidate_since = obs.timestamp
                track.last_positive = obs.timestamp
            else:
                if collapsed_posture and stable:
                    track.last_positive = obs.timestamp
                if obs.timestamp - (track.candidate_since or obs.timestamp) > cfg.candidate_timeout:
                    track.state = "recovery"
                    track.candidate_since = None
                    track.cooldown_until = 0.0 # Xoá cooldown khi có dấu hiệu nhúc nhích phục hồi

        if track.state == "candidate":
            candidate_age = obs.timestamp - (track.candidate_since or obs.timestamp)
            stable_age = obs.timestamp - track.last_positive if track.last_positive else 0.0
            required_confirmation = cfg.gradual_confirmation_time if gradual_collapse else cfg.confirmation_time
            
            if candidate_age >= required_confirmation and collapsed_posture and stable and stable_age <= cfg.post_impact_stability:
                track.state = "confirmed"
                track.confirmed_at = obs.timestamp
                
                # Chỉ xuất báo động (newly_confirmed=True) nếu đã hết thời gian làm nguội
                if obs.timestamp >= track.cooldown_until:
                    track.cooldown_until = obs.timestamp + cfg.cooldown
                    reason = "gradual_collapse_and_stable" if gradual_collapse else "upright_to_horizontal_and_stable"
                    return FallDecision("confirmed", 1.0, True, True, reason)
                else:
                    return FallDecision("confirmed", 1.0, True, False, "cooldown_blocked")

        # A prone person's spine can still measure above 20 degrees. Wait for
        # an upright, stable posture whose recent center-of-mass drop has cleared.
        if track.state == "confirmed" and upright and drop < 0.20 and stable:
            track.state = "recovery"
            track.cooldown_until = 0.0 # Xoá cooldown ngay khi nạn nhân cố gắng bò dậy

        score = 1.0 if track.state == "confirmed" else (candidate_age / required_confirmation if track.state == "candidate" else 0.0)
        return FallDecision(track.state, min(1.0, score), track.state == "confirmed", False, reason="candidate" if transition else "normal")

    def prune(self, now: float, max_age: float = 2.0) -> None:
        for track_id, track in list(self._tracks.items()):
            if now - track.last_seen > max_age:
                del self._tracks[track_id]

    def _valid(self, obs: FallObservation) -> bool:
        return (
            obs.detection_confidence >= self.config.min_detection_confidence
            and obs.keypoint_confidence >= self.config.min_keypoint_confidence
            and obs.body_height > 8.0
            and math.isfinite(obs.com_y)
            and math.isfinite(obs.head_y)
            and math.isfinite(obs.hip_y)
        )

    @staticmethod
    def _downward_speed(history: Deque[FallObservation]) -> float:
        if len(history) < 2:
            return 0.0
        a, b = history[-2], history[-1]
        dt = b.timestamp - a.timestamp
        if dt <= 0:
            return 0.0
        scale = max(8.0, (a.body_height + b.body_height) / 2.0)
        return max(0.0, (b.com_y - a.com_y) / scale / dt)

    @staticmethod
    def _drop_in_body_heights(history: Deque[FallObservation]) -> float:
        if len(history) < 2:
            return 0.0
        min_com_y = min(o.com_y for o in history)
        end = history[-1]
        scale = max(8.0, end.body_height)
        return max(0.0, (end.com_y - min_com_y) / scale)

    @staticmethod
    def _head_hip_ratio(obs: FallObservation) -> float:
        scale = max(8.0, obs.body_height)
        return (obs.hip_y - obs.head_y) / scale
