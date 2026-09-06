import { MM_PER_INCH, DEFAULT_SCREEN_DPI } from '@uts/core';
import type { RulerIntervals, RulerTick } from './types.js';

const CANDIDATE_MAJOR_INTERVALS = [
  0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500,
];

/**
 * Determines clean, legible metric tick intervals (major, medium, minor in mm)
 * based on current zoom level so that text labels do not collide.
 */
export function getRulerIntervals(zoom: number, dpi = DEFAULT_SCREEN_DPI): RulerIntervals {
  const pxPerMm = (dpi / MM_PER_INCH) * zoom;
  const minMajorSpacingPx = 50; // Minimum screen pixels between text labels

  let major = CANDIDATE_MAJOR_INTERVALS[CANDIDATE_MAJOR_INTERVALS.length - 1];
  for (const candidate of CANDIDATE_MAJOR_INTERVALS) {
    if (candidate * pxPerMm >= minMajorSpacingPx) {
      major = candidate;
      break;
    }
  }

  let medium: number;
  let minor: number;

  if (major <= 1) {
    medium = major / 2;
    minor = major / 10;
  } else if (major === 2) {
    medium = 1;
    minor = 0.5;
  } else if (major === 5) {
    medium = 2.5;
    minor = 1;
  } else if (major === 10) {
    medium = 5;
    minor = pxPerMm >= 4 ? 1 : 5;
  } else if (major === 20) {
    medium = 10;
    minor = 2;
  } else if (major === 50) {
    medium = 25;
    minor = 10;
  } else if (major === 100) {
    medium = 50;
    minor = 10;
  } else {
    medium = major / 2;
    minor = major / 10;
  }

  return {
    majorIntervalMm: major,
    mediumIntervalMm: medium,
    minorIntervalMm: minor,
  };
}

/**
 * Generates ruler ticks along an axis from startScreenPx to endScreenPx.
 *
 * All positions are calculated relative to the template origin (panPx),
 * ensuring the "0 mm" mark stays precisely pinned to the page's top-left.
 */
export function calculateRulerTicks(
  panPx: number,
  zoom: number,
  rulerLengthPx: number,
  dpi = DEFAULT_SCREEN_DPI,
): RulerTick[] {
  const pxPerMm = (dpi / MM_PER_INCH) * zoom;
  if (pxPerMm <= 0 || rulerLengthPx <= 0) return [];

  const intervals = getRulerIntervals(zoom, dpi);
  const { majorIntervalMm, mediumIntervalMm, minorIntervalMm } = intervals;

  // Convert visible screen range [0, rulerLengthPx] to millimeter range
  const startMm = -panPx / pxPerMm;
  const endMm = (rulerLengthPx - panPx) / pxPerMm;

  // Round startMm down to nearest minor interval
  const firstTickMm = Math.floor(startMm / minorIntervalMm) * minorIntervalMm;
  const lastTickMm = Math.ceil(endMm / minorIntervalMm) * minorIntervalMm;

  const ticks: RulerTick[] = [];
  const epsilon = minorIntervalMm * 0.001;

  for (let mm = firstTickMm; mm <= lastTickMm + epsilon; mm += minorIntervalMm) {
    // Avoid IEEE 754 floating point drift (e.g. 9.999999999999998)
    const roundedMm = Math.round(mm * 1000) / 1000;
    const screenPx = roundedMm * pxPerMm + panPx;

    // Check divisibility for tick prominence
    const isMajor = Math.abs(roundedMm % majorIntervalMm) < epsilon ||
      Math.abs((roundedMm % majorIntervalMm) - majorIntervalMm) < epsilon;

    const isMedium = !isMajor && (
      Math.abs(roundedMm % mediumIntervalMm) < epsilon ||
      Math.abs((roundedMm % mediumIntervalMm) - mediumIntervalMm) < epsilon
    );

    if (isMajor) {
      ticks.push({
        positionMm: roundedMm,
        screenPositionPx: screenPx,
        type: 'major',
        label: `${roundedMm}`,
      });
    } else if (isMedium) {
      ticks.push({
        positionMm: roundedMm,
        screenPositionPx: screenPx,
        type: 'medium',
      });
    } else {
      ticks.push({
        positionMm: roundedMm,
        screenPositionPx: screenPx,
        type: 'minor',
      });
    }
  }

  return ticks;
}

