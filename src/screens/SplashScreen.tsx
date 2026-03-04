import {Image, ImageBackground} from 'react-native';
import React, {FC, useEffect} from 'react';
import {commonStyles} from '../styles/commonStyles';
import {resetAndNavigate} from '../utils/NavigationUtil';

const SplashScreen: FC = () => {
  useEffect(() => {
    // Always go to WelcomeScreen — it handles wallet + profile routing internally
    const timeoutId = setTimeout(() => {
      resetAndNavigate('WelcomeScreen');
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, []);

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
