import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import HomeScreen     from './src/screens/HomeScreen';
import AnalyzerScreen from './src/screens/AnalyzerScreen';
import HistoryScreen  from './src/screens/HistoryScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const hdrOpts = {
  headerStyle: { backgroundColor: '#0a0a0a' },
  headerTitleStyle: { color: '#ffffff', fontWeight: '800' },
  headerTintColor: '#00ff88',
  contentStyle: { backgroundColor: '#000' },
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={hdrOpts}>
      <Stack.Screen name="Home"     component={HomeScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="Analyzer" component={AnalyzerScreen} options={{ title: 'Log Analyzer' }} />
      <Stack.Screen name="History"  component={HistoryScreen}  options={{ title: 'History' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#111',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#00ff88',
        tabBarInactiveTintColor: '#333',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.3 }}>⚡</Text>
            ),
          }}
        />
        <Tab.Screen
          name="AnalyzerTab"
          component={AnalyzerScreen}
          options={{
            title: 'Analyze',
            headerShown: true,
            headerStyle: { backgroundColor: '#0a0a0a' },
            headerTitleStyle: { color: '#fff', fontWeight: '800' },
            headerTitle: 'Log Analyzer',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.3 }}>🔬</Text>
            ),
          }}
        />
        <Tab.Screen
          name="HistoryTab"
          component={HistoryScreen}
          options={{
            title: 'History',
            headerShown: true,
            headerStyle: { backgroundColor: '#0a0a0a' },
            headerTitleStyle: { color: '#fff', fontWeight: '800' },
            headerTitle: 'History',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.3 }}>📋</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
