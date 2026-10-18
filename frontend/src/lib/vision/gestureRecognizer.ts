// Hand Landmark Gesture Recognition for Hand Cricket
// Uses MediaPipe 21 landmarks to detect cricket numbers 1 to 6 with orientation-invariant geometric distances

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureResult {
  number: number | null;
  confidence: number;
  stableCount: number;
  isStable: boolean;
  fingerStates: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
}

export class HandCricketGestureRecognizer {
  private lastDetectedNumber: number | null = null;
  private consecutiveFrameCount: number = 0;
  private readonly STABILITY_THRESHOLD: number = 4; // 4 consecutive frames to confirm

  private dist(a: Landmark, b: Landmark): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

  public reset() {
    this.lastDetectedNumber = null;
    this.consecutiveFrameCount = 0;
  }

  public interpretLandmarks(landmarks: Landmark[]): GestureResult {
    if (!landmarks || landmarks.length < 21) {
      this.consecutiveFrameCount = 0;
      return {
        number: null,
        confidence: 0,
        stableCount: 0,
        isStable: false,
        fingerStates: { thumb: false, index: false, middle: false, ring: false, pinky: false }
      };
    }

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    // Distance from wrist to tip vs wrist to pip (Invariant to hand rotation)
    const isIndexExtended = this.dist(wrist, indexTip) > this.dist(wrist, indexPip) * 1.15;
    const isMiddleExtended = this.dist(wrist, middleTip) > this.dist(wrist, middlePip) * 1.15;
    const isRingExtended = this.dist(wrist, ringTip) > this.dist(wrist, ringPip) * 1.15;
    const isPinkyExtended = this.dist(wrist, pinkyTip) > this.dist(wrist, pinkyPip) * 1.15;

    // Thumb extension: distance of thumb tip from palm base (pinky MCP) and index MCP
    const pinkyMcp = landmarks[17];
    const isThumbExtended = this.dist(thumbTip, pinkyMcp) > this.dist(thumbMcp, pinkyMcp) * 1.25;

    const fingerStates = {
      thumb: isThumbExtended,
      index: isIndexExtended,
      middle: isMiddleExtended,
      ring: isRingExtended,
      pinky: isPinkyExtended
    };

    let rawNumber: number | null = null;
    let confidence = 0.85;

    // Hand Cricket Rule Mapping:
    // 6: Classic hand cricket gesture = Thumb ONLY extended (Fist with thumb out)
    if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      rawNumber = 6;
      confidence = 0.95;
    }
    // 1: Only Index finger extended
    else if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      rawNumber = 1;
      confidence = 0.95;
    }
    // 2: Index + Middle extended (V-sign)
    else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      rawNumber = 2;
      confidence = 0.95;
    }
    // 3: Index + Middle + Ring OR Thumb + Index + Middle
    else if (
      (isIndexExtended && isMiddleExtended && isRingExtended && !isPinkyExtended) ||
      (isThumbExtended && isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended)
    ) {
      rawNumber = 3;
      confidence = 0.90;
    }
    // 4: Four fingers extended, thumb folded
    else if (!isThumbExtended && isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      rawNumber = 4;
      confidence = 0.92;
    }
    // 5: All 5 fingers extended open palm
    else if (isThumbExtended && isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      rawNumber = 5;
      confidence = 0.96;
    }
    // Alternative 6: Pinky only or Pinky + Thumb
    else if (!isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended && isThumbExtended) {
      rawNumber = 6;
      confidence = 0.88;
    }

    // Temporal stability
    if (rawNumber !== null && rawNumber === this.lastDetectedNumber) {
      this.consecutiveFrameCount += 1;
    } else {
      this.lastDetectedNumber = rawNumber;
      this.consecutiveFrameCount = 1;
    }

    const isStable = this.consecutiveFrameCount >= this.STABILITY_THRESHOLD;

    return {
      number: rawNumber,
      confidence,
      stableCount: this.consecutiveFrameCount,
      isStable,
      fingerStates
    };
  }
}

export const gestureRecognizer = new HandCricketGestureRecognizer();
