import { Dimensions, PixelRatio } from "react-native";

const { width, height } = Dimensions.get("window");

const BASE_WIDTH = 402;
const BASE_HEIGHT = 874;

export const scaleWidth = (size: number) => {
  return (width / BASE_WIDTH) * size;
};

export const scaleHeight = (size: number) => {
  return (height / BASE_HEIGHT) * size;
};

export const moderateScale = (size: number, factor = 0.5) => {
  return size + (scaleWidth(size) - size) * factor;
};

export const normalize = (size: number) => {
  return Math.round(PixelRatio.roundToNearestPixel(moderateScale(size)));
};