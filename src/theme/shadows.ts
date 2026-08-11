import { ViewStyle } from 'react-native';

export const shadows = {
    /**
     * Generates a tinted drop-shadow that matches a given surface colour.
     * Uses the iOS `shadow*` properties and the Android `elevation` property,
     * which are mutually exclusive at the platform level.
     *
     * @param shadowColor - The colour the shadow should be tinted with (usually the button or card background colour).
     */
    coloredShadow : (shadowColor : string): ViewStyle => ({
    // iOS properties
    shadowColor: shadowColor,
    shadowOffset: {
      width: 3,
      height: 5,
    },
    shadowOpacity: 0.4,
    shadowRadius: 4.65,

    // Android property
    elevation: 8,
    }),

    // TODO: Define internShadow styles for inset/inner shadow effects if needed.
    internShadow : {

    }


}
