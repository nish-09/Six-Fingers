// Automated Landmark Gesture Tests for Hand Cricket Numbers 1 to 6

import { HandCricketGestureRecognizer } from "../src/lib/vision/gestureRecognizer.ts";
import assert from "node:assert";

console.log("Running Hand Cricket Gesture Recognizer tests...");

const recognizer = new HandCricketGestureRecognizer();

// Helper to generate 21 landmarks
function createMockHand({
  thumbExtended = false,
  indexExtended = false,
  middleExtended = false,
  ringExtended = false,
  pinkyExtended = false,
}) {
  const lm = [];
  // Wrist
  lm[0] = { x: 0.5, y: 0.8, z: 0 };

  // Thumb: 1-4
  lm[1] = { x: 0.45, y: 0.75, z: 0 };
  lm[2] = { x: 0.4, y: 0.7, z: 0 }; // MCP
  lm[3] = { x: 0.35, y: 0.65, z: 0 };
  lm[4] = thumbExtended ? { x: 0.2, y: 0.5, z: 0 } : { x: 0.42, y: 0.68, z: 0 }; // TIP

  // Index: 5-8
  lm[5] = { x: 0.45, y: 0.6, z: 0 };
  lm[6] = { x: 0.45, y: 0.5, z: 0 }; // PIP
  lm[7] = { x: 0.45, y: 0.4, z: 0 };
  lm[8] = indexExtended ? { x: 0.45, y: 0.2, z: 0 } : { x: 0.45, y: 0.55, z: 0 }; // TIP

  // Middle: 9-12
  lm[9] = { x: 0.5, y: 0.6, z: 0 };
  lm[10] = { x: 0.5, y: 0.48, z: 0 }; // PIP
  lm[11] = { x: 0.5, y: 0.38, z: 0 };
  lm[12] = middleExtended ? { x: 0.5, y: 0.18, z: 0 } : { x: 0.5, y: 0.55, z: 0 }; // TIP

  // Ring: 13-16
  lm[13] = { x: 0.55, y: 0.6, z: 0 };
  lm[14] = { x: 0.55, y: 0.5, z: 0 }; // PIP
  lm[15] = { x: 0.55, y: 0.4, z: 0 };
  lm[16] = ringExtended ? { x: 0.55, y: 0.22, z: 0 } : { x: 0.55, y: 0.55, z: 0 }; // TIP

  // Pinky: 17-20
  lm[17] = { x: 0.6, y: 0.65, z: 0 }; // MCP
  lm[18] = { x: 0.6, y: 0.55, z: 0 }; // PIP
  lm[19] = { x: 0.6, y: 0.45, z: 0 };
  lm[20] = pinkyExtended ? { x: 0.6, y: 0.28, z: 0 } : { x: 0.6, y: 0.58, z: 0 }; // TIP

  return lm;
}

// Test 1: Number 1 (Index only)
recognizer.reset();
const hand1 = createMockHand({ indexExtended: true });
const res1 = recognizer.interpretLandmarks(hand1);
assert.strictEqual(res1.number, 1, "Expected number 1 for index extended");
console.log("✔ Test 1: Detected Number 1 successfully");

// Test 2: Number 2 (Index + Middle)
recognizer.reset();
const hand2 = createMockHand({ indexExtended: true, middleExtended: true });
const res2 = recognizer.interpretLandmarks(hand2);
assert.strictEqual(res2.number, 2, "Expected number 2 for V-sign");
console.log("✔ Test 2: Detected Number 2 successfully");

// Test 3: Number 3 (Index + Middle + Ring)
recognizer.reset();
const hand3 = createMockHand({ indexExtended: true, middleExtended: true, ringExtended: true });
const res3 = recognizer.interpretLandmarks(hand3);
assert.strictEqual(res3.number, 3, "Expected number 3 for 3 fingers");
console.log("✔ Test 3: Detected Number 3 successfully");

// Test 4: Number 4 (Four fingers, thumb folded)
recognizer.reset();
const hand4 = createMockHand({ indexExtended: true, middleExtended: true, ringExtended: true, pinkyExtended: true });
const res4 = recognizer.interpretLandmarks(hand4);
assert.strictEqual(res4.number, 4, "Expected number 4 for four fingers");
console.log("✔ Test 4: Detected Number 4 successfully");

// Test 5: Number 5 (All 5 fingers open palm)
recognizer.reset();
const hand5 = createMockHand({ thumbExtended: true, indexExtended: true, middleExtended: true, ringExtended: true, pinkyExtended: true });
const res5 = recognizer.interpretLandmarks(hand5);
assert.strictEqual(res5.number, 5, "Expected number 5 for open palm");
console.log("✔ Test 5: Detected Number 5 successfully");

// Test 6: Number 6 (Classic Hand Cricket: Thumb only extended / fist)
recognizer.reset();
const hand6 = createMockHand({ thumbExtended: true });
const res6 = recognizer.interpretLandmarks(hand6);
assert.strictEqual(res6.number, 6, "Expected number 6 for classic thumb-out fist");
console.log("✔ Test 6: Detected Number 6 successfully");

// Test 7: Temporal stability (Must hold for 4 consecutive frames)
recognizer.reset();
assert.strictEqual(recognizer.interpretLandmarks(hand6).isStable, false);
assert.strictEqual(recognizer.interpretLandmarks(hand6).isStable, false);
assert.strictEqual(recognizer.interpretLandmarks(hand6).isStable, false);
const stableRes = recognizer.interpretLandmarks(hand6);
assert.strictEqual(stableRes.isStable, true, "Expected isStable to be true after 4 frames");
console.log("✔ Test 7: Temporal stability verified (4 consecutive frames to confirm)");

console.log("All 7 Hand Cricket vision gesture tests passed!\n");
