/**
 * Pure geometric calculations for multi-hand gesture detection.
 * Independent of DOM, browser APIs, or MediaPipe runtime so it can be cleanly unit tested.
 */

export type Landmark = {
  x: number;
  y: number;
  z?: number;
};

export type HeartConfig = {
  maxThumbDistanceRatio: number;
  maxIndexDistanceRatio: number;
  minIndexAboveThumbRatio: number;
  maxMidpointDeltaXRatio: number;
  minWristSeparationRatio: number;
  minHandScale: number;
  edgeMargin: number;
};

export const HEART_CONFIG: HeartConfig = {
  maxThumbDistanceRatio: 0.9,
  maxIndexDistanceRatio: 0.9,
  minIndexAboveThumbRatio: 0.6,
  maxMidpointDeltaXRatio: 0.7,
  minWristSeparationRatio: 1.3,
  minHandScale: 0.06,
  edgeMargin: 0.02,
};

export type TwoHandHeartMetrics = {
  detectedHands: number;
  handScale: number;
  thumbDistanceRatio: number;
  indexDistanceRatio: number;
  verticalOffsetRatio: number;
  midpointDeltaXRatio: number;
  wristVsIndexRatio: number;
  withinBounds: boolean;
};

export type TwoHandHeartResult = {
  match: boolean;
  metrics: TwoHandHeartMetrics;
};

export function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

/**
 * Checks whether exactly two hands form the classic heart-hands shape.
 * Thumbs meet at the bottom, index fingers meet at the top, opening outward.
 */
export function isTwoHandHeart(
  hands: Landmark[][],
  config: HeartConfig = HEART_CONFIG,
): TwoHandHeartResult {
  const emptyMetrics: TwoHandHeartMetrics = {
    detectedHands: hands?.length || 0,
    handScale: 0,
    thumbDistanceRatio: 0,
    indexDistanceRatio: 0,
    verticalOffsetRatio: 0,
    midpointDeltaXRatio: 0,
    wristVsIndexRatio: 0,
    withinBounds: false,
  };

  if (!hands || hands.length !== 2) {
    return { match: false, metrics: emptyMetrics };
  }

  const handA = hands[0];
  const handB = hands[1];

  if (!handA || handA.length < 21 || !handB || handB.length < 21) {
    return { match: false, metrics: emptyMetrics };
  }

  // 1. Calculate hand scale s per hand as distance from wrist (0) to middle-finger base (9)
  const scaleA = distance(handA[0], handA[9]);
  const scaleB = distance(handB[0], handB[9]);
  const s = (scaleA + scaleB) / 2;

  if (s < config.minHandScale) {
    return {
      match: false,
      metrics: { ...emptyMetrics, handScale: s },
    };
  }

  // 2. Check that no fingertip is within edgeMargin of the frame edge
  const margin = config.edgeMargin;
  let withinBounds = true;
  for (const hand of [handA, handB]) {
    for (const tipIdx of FINGERTIP_INDICES) {
      const tip = hand[tipIdx];
      if (
        tip.x < margin ||
        tip.x > 1 - margin ||
        tip.y < margin ||
        tip.y > 1 - margin
      ) {
        withinBounds = false;
        break;
      }
    }
    if (!withinBounds) break;
  }

  if (!withinBounds) {
    return {
      match: false,
      metrics: { ...emptyMetrics, handScale: s, withinBounds: false },
    };
  }

  // 3. Normalized distances and geometry
  const thumbTipA = handA[4];
  const thumbTipB = handB[4];
  const indexTipA = handA[8];
  const indexTipB = handB[8];
  const wristA = handA[0];
  const wristB = handB[0];

  const thumbDist = distance(thumbTipA, thumbTipB);
  const indexDist = distance(indexTipA, indexTipB);
  const wristDist = distance(wristA, wristB);

  const thumbDistanceRatio = thumbDist / s;
  const indexDistanceRatio = indexDist / s;

  // The index tips are ABOVE the thumb tips (image y grows downward)
  const avgThumbY = (thumbTipA.y + thumbTipB.y) / 2;
  const avgIndexY = (indexTipA.y + indexTipB.y) / 2;
  const verticalOffset = avgThumbY - avgIndexY;
  const verticalOffsetRatio = verticalOffset / s;

  // Horizontal midpoint alignment
  const midIndexX = (indexTipA.x + indexTipB.x) / 2;
  const midThumbX = (thumbTipA.x + thumbTipB.x) / 2;
  const midpointDeltaX = Math.abs(midIndexX - midThumbX);
  const midpointDeltaXRatio = midpointDeltaX / s;

  // Wrist separation vs index tip separation
  const wristVsIndexRatio = indexDist > 0 ? wristDist / indexDist : 10;

  const metrics: TwoHandHeartMetrics = {
    detectedHands: 2,
    handScale: s,
    thumbDistanceRatio,
    indexDistanceRatio,
    verticalOffsetRatio,
    midpointDeltaXRatio,
    wristVsIndexRatio,
    withinBounds: true,
  };

  const match =
    thumbDistanceRatio < config.maxThumbDistanceRatio &&
    indexDistanceRatio < config.maxIndexDistanceRatio &&
    verticalOffsetRatio >= config.minIndexAboveThumbRatio &&
    midpointDeltaXRatio <= config.maxMidpointDeltaXRatio &&
    wristDist > config.minWristSeparationRatio * indexDist;

  return { match, metrics };
}
