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
    cooldown: float = 8.0
    history_seconds: float = 2.5
    max_observation_gap: float = 0.55
    horizontal_aspect_ratio: float = 1.18
    horizontal_spine_angle: float = 48.0
    min_drop_body_heights: float = 0.30
    min_downward_speed: float = 0.55
    max_post_impact_speed: float = 0.45


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
    hip_y: float = 0.0


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
            if obs.timestamp - track.upright_since >= cfg.min_upright_time and track.state != "confirmed":
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
        posture_change = 0.0
        if track.observations:
            posture_change = abs(obs.spine_angle - track.observations[0].spine_angle)
        # Camera motion can move every bounding box at once. Requiring a real
        # body-orientation change prevents that global translation from being
        # interpreted as a fall.
        posture_change = (
            abs(obs.spine_angle - track.observations[0].spine_angle)
            if track.observations else 0.0
        )
        head_hip_drop = (
            (track.baseline_head_hip_ratio - head_hip_ratio)
            if track.baseline_head_hip_ratio is not None else 0.0
        )
        horizontal_transition = (
            prior_upright
            and horizontal
            and posture_change >= 15.0
            and (drop >= cfg.min_drop_body_heights or speed >= cfg.min_downward_speed)
        )
        # A person can slump from a chair without ever producing a wide,
        # horizontal bounding box. This branch looks for a sustained torso
        # rotation, head moving toward the hip, and downward displacement.
        gradual_collapse = (
            prior_upright
            and not horizontal
            and posture_change >= 18.0
            and head_hip_drop >= 0.10
            and (drop >= 0.18 or speed >= 0.25)
        )
        transition = horizontal_transition or gradual_collapse
        collapsed_posture = horizontal or obs.spine_angle <= 60.0 or head_hip_drop >= 0.10

        if obs.timestamp < track.cooldown_until:
            return FallDecision(track.state, 0.0, track.state == "confirmed", reason="cooldown")

        if transition and track.state != "confirmed":
            track.state = "candidate"
            track.candidate_since = track.candidate_since or obs.timestamp
            track.last_positive = obs.timestamp
        elif track.state == "candidate":
            if collapsed_posture and stable:
                track.last_positive = obs.timestamp
            if obs.timestamp - (track.candidate_since or obs.timestamp) > cfg.candidate_timeout:
                track.state = "recovery"
                track.candidate_since = None

        if track.state == "candidate":
            candidate_age = obs.timestamp - (track.candidate_since or obs.timestamp)
            stable_age = obs.timestamp - track.last_positive if track.last_positive else 0.0
            required_confirmation = cfg.gradual_confirmation_time if gradual_collapse else cfg.confirmation_time
            if candidate_age >= required_confirmation and collapsed_posture and stable and stable_age <= cfg.post_impact_stability:
                track.state = "confirmed"
                track.confirmed_at = obs.timestamp
                track.cooldown_until = obs.timestamp + cfg.cooldown
                reason = "gradual_collapse_and_stable" if gradual_collapse else "upright_to_horizontal_and_stable"
                return FallDecision("confirmed", 1.0, True, True, reason)

        if track.state == "confirmed" and not horizontal:
            track.state = "recovery"

        score = min(1.0, (0.5 if collapsed_posture else 0.0) + (0.3 if transition else 0.0) + (0.2 if stable else 0.0))
        return FallDecision(track.state, score, track.state == "confirmed", reason="candidate" if transition else "normal")

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
        start = history[0]
        end = history[-1]
        scale = max(8.0, (start.body_height + end.body_height) / 2.0)
        return max(0.0, (end.com_y - start.com_y) / scale)

    @staticmethod
    def _head_hip_ratio(obs: FallObservation) -> float:
        scale = max(8.0, obs.body_height)
        return (obs.hip_y - obs.head_y) / scale
