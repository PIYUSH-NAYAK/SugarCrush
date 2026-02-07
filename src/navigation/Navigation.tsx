import React from 'react';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {navigationRef} from '../utils/NavigationUtil';
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import HomeScreen from '../screens/HomeScreen';
import LevelScreen from '../screens/LevelScreen';
import GameScreen from '../screens/GameScreen';
import {SoundProvider} from './SoundContext';
import {WalletProvider, useWallet} from '../context/WalletContext';

const Stack = createNativeStackNavigator();

const NavigationStack = () => {
  const {connected} = useWallet();

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName="SplashScreen">
        <Stack.Screen name="SplashScreen" component={SplashScreen} />
        <Stack.Screen
          name="WelcomeScreen"
          options={{
            animation: 'fade',
          }}
          component={WelcomeScreen}
        />
        <Stack.Screen
          name="HomeScreen"
          options={{
            animation: 'fade',
          }}
          component={HomeScreen}
        />
        <Stack.Screen
          name="LevelScreen"
          options={{
            animation: 'fade',
          }}
          component={LevelScreen}
        />
        <Stack.Screen
          name="GameScreen"
          options={{
            animation: 'fade',
          }}
          component={GameScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const Navigation = () => {
  return (
    <WalletProvider>
      <SoundProvider>
        <NavigationStack />
      </SoundProvider>
    </WalletProvider>
  );
};

export default Navigation;
