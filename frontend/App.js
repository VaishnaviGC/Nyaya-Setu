import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { COLORS } from "./src/theme";
import { AuthProvider, useAuth } from "./src/AuthContext";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import VoiceScreen from "./src/screens/VoiceScreen";
import RightsScreen from "./src/screens/RightsScreen";
import ComplaintScreen from "./src/screens/ComplaintScreen";
import RightsLibraryScreen from "./src/screens/RightsLibraryScreen";
import SavedScreen from "./src/screens/SavedScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import HistoryScreen from "./src/screens/HistoryScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

const TAB_ICONS = { Home: "🏠", Voice: "🎤", RightsLibrary: "📚", Saved: "🗂️", Profile: "👤" };

const headerOptions = {
  headerStyle: { backgroundColor: COLORS.navy },
  headerTintColor: "#fff",
  headerTitleStyle: { fontSize: 16, fontWeight: "600" },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerOptions,
        tabBarActiveTintColor: COLORS.navy,
        tabBarInactiveTintColor: COLORS.grey,
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{TAB_ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Nyaya Setu", tabBarLabel: "Home" }} />
      <Tab.Screen name="Voice" component={VoiceScreen} options={{ title: "Speak Your Problem", tabBarLabel: "Speak" }} />
      <Tab.Screen
        name="RightsLibrary"
        component={RightsLibraryScreen}
        options={{ title: "Know Your Rights", tabBarLabel: "Rights" }}
      />
      <Tab.Screen name="Saved" component={SavedScreen} options={{ title: "Saved Complaints", tabBarLabel: "Saved" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Your Profile", tabBarLabel: "Profile" }} />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="MainTabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Rights" component={RightsScreen} options={{ title: "Your Rights" }} />
      <Stack.Screen name="Complaint" component={ComplaintScreen} options={{ title: "Complaint Letter" }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: "Your History" }} />
    </Stack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  return token ? <MainNavigator /> : <AuthNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="light" />
    </AuthProvider>
  );
}
