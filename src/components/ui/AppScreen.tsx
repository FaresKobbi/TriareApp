import { View, ViewStyle } from 'react-native'
import { colors, spacing } from '@/src/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AppScreenProps = {
    children: React.ReactNode;
    /**
     * When `true` (default), adds extra bottom padding to prevent content from
     * being hidden behind the floating bottom navigation bar.
     * Set to `false` on screens that have no bottom nav overlay (e.g. modals).
     */
    withBottomPadding?: boolean;
    style?: ViewStyle
}

/**
 * Root layout container for every app screen.
 *
 * Applies the global background colour, horizontal screen padding, and safe-area
 * insets so content is never obscured by the status bar or home indicator.
 */
const AppScreen = ({children, withBottomPadding = true, style}: AppScreenProps) => {
    const insets = useSafeAreaInsets();

    const contentStyle: ViewStyle = {
        flex:1,
        backgroundColor: colors.bg,
        paddingTop: insets.top + 12,
        paddingHorizontal: spacing.screenPadding,
        // 220 is a rough estimate of the floating bottom nav height + safe area.
        // TODO: Replace with a dynamic value derived from the actual nav bar height
        // to avoid layout gaps on devices with non-standard screen sizes.
        paddingBottom: withBottomPadding ? 220 : insets.bottom + 16,
    }

  return (
    <View style={[contentStyle, style,]}>
        {children}
    </View>
  )
}

export default AppScreen