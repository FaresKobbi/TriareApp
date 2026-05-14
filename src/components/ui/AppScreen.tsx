import { View, Text, ViewStyle } from 'react-native'
import { colors, spacing } from '@/src/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AppScreenProps = {
    children: React.ReactNode;
    withBottomPadding?: boolean;
    style?: ViewStyle
}

const AppScreen = ({children, withBottomPadding = true, style}: AppScreenProps) => {
    const insets = useSafeAreaInsets();

    const contentStyle: ViewStyle = {
        flex:1,
        backgroundColor: colors.bg,
        paddingTop: insets.top + 12,
        paddingHorizontal: spacing.screenPadding,
        paddingBottom: withBottomPadding ? 220 : insets.bottom + 16,
    }

  return (
    <View style={[contentStyle, style,]}>
        {children}
    </View>
  )
}

export default AppScreen