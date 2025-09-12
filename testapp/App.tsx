/**
 * Sample React Native App with react-native-screens
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar, StyleSheet, useColorScheme, View, Text, Button, Alert, ScrollView } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { Svg, Circle, Rect, Path, G, Line, Polygon, Ellipse } from 'react-native-svg';

// Enable react-native-screens
enableScreens();

const Stack = createStackNavigator();

function HomeScreen({ navigation }: any) {
  const safeAreaInsets = useSafeAreaInsets();
  
  return (
    <ScrollView style={[styles.scrollContainer, { paddingTop: safeAreaInsets.top }]} contentContainerStyle={styles.container}>
      <Text style={styles.title}>React Native SVG Test!</Text>
      <Text style={styles.subtitle}>Testing various SVG components and features.</Text>
      
      <View style={styles.svgRow}>
        <View style={styles.svgContainer}>
          <Text style={styles.svgLabel}>Circle</Text>
          <Svg width="50" height="50">
            <Circle cx="25" cy="25" r="20" fill="#007AFF" />
          </Svg>
        </View>
        
        <View style={styles.svgContainer}>
          <Text style={styles.svgLabel}>Rectangle</Text>
          <Svg width="50" height="50">
            <Rect x="5" y="10" width="40" height="30" rx="5" fill="#34C759" />
          </Svg>
        </View>
        
        <View style={styles.svgContainer}>
          <Text style={styles.svgLabel}>Ellipse</Text>
          <Svg width="50" height="50">
            <Ellipse cx="25" cy="25" rx="20" ry="15" fill="#FF3B30" />
          </Svg>
        </View>
      </View>

      <View style={styles.svgRow}>
        <View style={styles.svgContainer}>
          <Text style={styles.svgLabel}>Path (Heart)</Text>
          <Svg width="50" height="50" viewBox="0 0 24 24">
            <Path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              fill="#E91E63"
            />
          </Svg>
        </View>
        
        <View style={styles.svgContainer}>
          <Text style={styles.svgLabel}>Polygon (Star)</Text>
          <Svg width="50" height="50">
            <Polygon
              points="25,5 30,20 45,20 35,30 40,45 25,35 10,45 15,30 5,20 20,20"
              fill="#FF9500"
            />
          </Svg>
        </View>
        
        <View style={styles.svgContainer}>
          <Text style={styles.svgLabel}>Lines</Text>
          <Svg width="50" height="50">
            <Line x1="5" y1="5" x2="45" y2="45" stroke="#5856D6" strokeWidth="2" />
            <Line x1="45" y1="5" x2="5" y2="45" stroke="#5856D6" strokeWidth="2" />
          </Svg>
        </View>
      </View>

      <View style={styles.svgContainer}>
        <Text style={styles.svgLabel}>Complex Group</Text>
        <Svg width="100" height="60">
          <G>
            <Circle cx="30" cy="30" r="20" fill="#007AFF" opacity="0.3" />
            <Rect x="10" y="10" width="40" height="40" rx="5" fill="none" stroke="#007AFF" strokeWidth="2" />
            <Path d="M20 20 L40 40 M40 20 L20 40" stroke="#FF3B30" strokeWidth="2" />
            <Circle cx="70" cy="30" r="15" fill="#34C759" />
            <Rect x="62" y="22" width="16" height="16" fill="#FFF" opacity="0.8" />
          </G>
        </Svg>
      </View>
      
      <Button
        title="Go to Details Screen"
        onPress={() => navigation.navigate('Details')}
        color="#007AFF"
      />
      
      <Button
        title="Test SVG Rendering"
        onPress={() => {
          Alert.alert('Success!', 'react-native-svg is loaded and rendering correctly!');
        }}
        color="#34C759"
      />
    </ScrollView>
  );
}

function DetailsScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Details Screen</Text>
      <Text style={styles.subtitle}>This is a second screen using react-native-screens navigation.</Text>
      
      <Button
        title="Go Back"
        onPress={() => navigation.goBack()}
        color="#FF3B30"
      />
    </View>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'AAR Test' }}
          />
          <Stack.Screen 
            name="Details" 
            component={DetailsScreen} 
            options={{ title: 'Details' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
    lineHeight: 22,
  },
  svgRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  svgContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  svgLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default App;
