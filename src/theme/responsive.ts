import { Dimensions, PixelRatio } from "react-native";

const { width, height } = Dimensions.get("window");

/**
 * Reference device dimensions used as the design baseline.
 * All scale functions map values from this baseline to the current device.
 * These values correspond to a typical Android reference screen (≈ 402 × 874 dp).
 */
const BASE_WIDTH = 402;
const BASE_HEIGHT = 874;

/** Scales a horizontal size proportionally to the current screen width. */
export const scaleWidth = (size: number) => {
  return (width / BASE_WIDTH) * size;
};

/** Scales a vertical size proportionally to the current screen height. */
export const scaleHeight = (size: number) => {
  return (height / BASE_HEIGHT) * size;
};

/**
 * Scales a size by a blend of the original value and the width-scaled value.
 *
 * A `factor` of 0 returns the original size (no scaling).
 * A `factor` of 1 returns the fully width-scaled size.
 * The default of 0.5 produces a moderate scale that avoids extreme differences
 * on very small or very large screens.
 *
 * @param size - The design-time size in dp.
 * @param factor - Blend factor between 0 and 1. Defaults to 0.5.
 */
export const moderateScale = (size: number, factor = 0.5) => {
  return size + (scaleWidth(size) - size) * factor;
};

/**
 * Returns a pixel-grid-aligned size using `moderateScale` as the input.
 * Use this for font sizes and fixed dimensions to avoid sub-pixel blurriness.
 *
 * @param size - The design-time size in dp.
 */
export const normalize = (size: number) => {
  return Math.round(PixelRatio.roundToNearestPixel(moderateScale(size)));
};