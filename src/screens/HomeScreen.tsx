/* eslint-disable react/self-closing-comp */
import {Image, ImageBackground, StyleSheet, View, Text} from 'react-native';
import React, {FC, useEffect} from 'react';
import {commonStyles} from '../styles/commonStyles';
import {RFValue} from 'react-native-responsive-fontsize';
import {useIsFocused} from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {screenHeight, screenWidth, FONTS} from '../utils/Constants';
import {useSound} from '../navigation/SoundContext';
import LottieView from 'lottie-react-native';
import ScalePress from '../components/ui/ScalePress';
import {navigate} from '../utils/NavigationUtil';
import Footer from '../components/ui/Footer';

const HomeScreen: FC = () => {
  const {playSound} = useSound();
  const isFocused = useIsFocused();
  const translateY = useSharedValue(-200);

  useEffect(() => {
    if (isFocused) {
      playSound('bg', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 3000,
    });
  }, [isFocused, translateY]);

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}],
  }));

  return (
    <>
      <ImageBackground
        source={require('../assets/images/b2.png')}
        style={commonStyles.container}>
        <Animated.Image
          source={require('../assets/images/banner.png')}
          style={[styles.img, animatedStyles]}
        />
        {/* <LottieView
          source={require('../assets/animations/bird.json')}
          speed={1}
          autoPlay
          loop
          hardwareAccelerationAndroid
          style={styles.lottieView}
        /> */}
        <ScalePress
          style={styles.playButtonContainer}
          onPress={() => navigate('LevelScreen')}>
          <View style={styles.playButton}>
            <Text style={styles.playButtonText}>Enter Arena</Text>
          </View>
        </ScalePress>
        
        <Footer />
      </ImageBackground>
    </>
  );
};

const styles = StyleSheet.create({
  img: {
    width: screenWidth * 0.9,
    height: screenWidth * 0.9,
    resizeMode: 'contain',
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
  },
  lottieView: {
    width: 200,
    height: 200,
    position: 'absolute',
    right: -20,
    top: '30%',
    transform: [{scaleX: -1}],
  },
  playButton: {
    backgroundColor: 'rgba(15, 10, 40, 0.75)',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#00E6FF',
    shadowColor: '#00E6FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    fontFamily: FONTS.twinkle,
    fontSize: RFValue(20),
    color: '#FFF',
    fontWeight: 'bold',
  },
  playButtonContainer: {
    marginTop: screenHeight * 0.4,
    alignItems: 'center',
  },
});

export default HomeScreen;

