import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/lib/AuthContext'
import { GenerationProvider } from './src/lib/GenerationContext'
import RootNavigator from './src/navigation/RootNavigator'

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <GenerationProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </GenerationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
