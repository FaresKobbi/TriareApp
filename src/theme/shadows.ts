import { ViewStyle } from 'react-native';

export const shadows = {
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

    internShadow : {
        
    }

    
}
