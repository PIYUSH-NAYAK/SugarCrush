import {Image, ImageBackground} from 'react-native';
import React, {FC, useEffect} from 'react';
import {commonStyles} from '../styles/commonStyles';
import {resetAndNavigate} from '../utils/NavigationUtil';
import {useWallet} from '../context/WalletContext';

const SplashScreen: FC = () => {
  const {connected} = useWallet();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Navigate to WelcomeScreen if not connected, HomeScreen if connected
      resetAndNavigate(connected ? 'HomeScreen' : 'WelcomeScreen');
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [connected]);

  return (
    <ImageBackground
      source={require('../assets/images/bg.png')}
      style={commonStyles.container}>
      <Image
        source={require('../assets/text/logo.png')}
        style={commonStyles.img}
      />
    </ImageBackground>
  );
};

export default SplashScreen;
