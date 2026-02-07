import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import {commonStyles} from '../styles/commonStyles';
import {screenHeight, screenWidth, FONTS} from '../utils/Constants';
import {RFValue} from 'react-native-responsive-fontsize';
import LottieView from 'lottie-react-native';
import {useWallet} from '../context/WalletContext';
import ScalePress from '../components/ui/ScalePress';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import {useEffect} from 'react';
import {resetAndNavigate} from '../utils/NavigationUtil';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const WelcomeScreen = () => {
  const {connect, connecting, connected} = useWallet();
  const translateY = useSharedValue(-200);
  const scale = useSharedValue(1);

  // Navigate to HomeScreen when wallet is connected
  useEffect(() => {
    if (connected) {
      resetAndNavigate('HomeScreen');
    }
  }, [connected]);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 2000,
    });

    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, {duration: 1000}),
        withTiming(1, {duration: 1000}),
      ),
      -1,
      true,
    );
  }, [translateY, scale]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  return (
    <ImageBackground
      source={require('../assets/images/b2.png')}
      style={commonStyles.container}>
      {/* Animated Logo */}
      <Animated.Image
        source={require('../assets/images/banner.png')}
        style={[styles.logo, logoAnimatedStyle]}
      />

      {/* Animated Bird */}
      <LottieView
        source={require('../assets/animations/bird.json')}
        speed={1}
        autoPlay
        loop
        hardwareAccelerationAndroid
        style={styles.lottieView}
      />

      {/* Game Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Sugar Crush</Text>
        <Text style={styles.subtitle}>🍭 Blockchain Edition 🍭</Text>
        <Text style={styles.tagline}>
          Connect your wallet to start playing!
        </Text>
      </View>

      {/* Connect Wallet Button */}
      <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
        <ScalePress
          onPress={connect}
          disabled={connecting}
          style={styles.connectButton}>
          <Image
            source={require('../assets/icons/wallet.png')}
            style={styles.walletIcon}
          />
          <Text style={styles.buttonText}>
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </Text>
        </ScalePress>
      </Animated.View>

      {/* Decorative elements */}
      <View style={styles.decorativeContainer}>
        <Text style={styles.decorativeText}>🎮 Play • Earn • Compete 🎮</Text>
      </View>

      {/* Loading Overlay */}
      {connecting && (
        <LoadingSpinner 
          overlay 
          message="Connecting to Solflare Wallet..." 
        />
      )}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  logo: {
    width: screenWidth,
    height: screenWidth * 0.8,
    resizeMode: 'contain',
    position: 'absolute',
    top: -20,
  },
  lottieView: {
    width: 200,
    height: 200,
    position: 'absolute',
    right: -20,
    top: '25%',
    transform: [{scaleX: -1}],
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: screenHeight * 0.35,
  },
  title: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(38),
    color: '#FF1493',
    textShadowColor: '#FFF',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
    marginBottom: RFValue(8),
  },
  subtitle: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(18),
    color: '#9C27B0',
    marginBottom: RFValue(5),
  },
  tagline: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(14),
    color: '#5B2333',
    textAlign: 'center',
    paddingHorizontal: RFValue(20),
  },
  buttonContainer: {
    marginTop: RFValue(40),
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: RFValue(18),
    paddingHorizontal: RFValue(40),
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: RFValue(5),
  },
  walletIcon: {
    width: RFValue(28),
    height: RFValue(28),
    marginRight: RFValue(10),
    tintColor: '#FFF',
  },
  buttonText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#FFF',
    fontWeight: 'bold',
  },
  walletName: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(10),
    color: '#FFD700',
    marginTop: RFValue(2),
  },
  decorativeContainer: {
    position: 'absolute',
    bottom: RFValue(30),
    alignSelf: 'center',
  },
  decorativeText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(16),
    color: '#FF1493',
    textShadowColor: '#FFF',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
});

export default WelcomeScreen;
