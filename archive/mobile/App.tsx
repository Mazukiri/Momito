import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";
import JobsScreen from "./src/screens/JobsScreen";
import DSAScreen from "./src/screens/DSAScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: "#4f46e5",
            tabBarInactiveTintColor: "#9ca3af",
            tabBarStyle: { borderTopColor: "#e5e7eb" },
          }}
        >
          <Tab.Screen
            name="Jobs"
            component={JobsScreen}
            options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💼</Text> }}
          />
          <Tab.Screen
            name="DSA"
            component={DSAScreen}
            options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🧮</Text> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
