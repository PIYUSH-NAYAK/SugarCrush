import React, {useState} from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import {commonStyles} from '../styles/commonStyles';
import {screenHeight, screenWidth, FONTS} from '../utils/Constants';
import {RFValue} from 'react-native-responsive-fontsize';
import LottieView from 'lottie-react-native';
import {useWallet} from '../context/WalletContext';
import {useCandyCrushProgram} from '../hooks/useCandyCrushProgram';
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
  const {initializePlayer, fetchPlayerProfile, playerProfile, loading} =
    useCandyCrushProgram();
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [playerName, setPlayerName] = useState('');

  const translateY = useSharedValue(-200);
  const scale = useSharedValue(1);

  // Check player profile when wallet is connected
  useEffect(() => {
    if (connected) {
      checkPlayerProfile();
    }
  }, [connected]);

  const checkPlayerProfile = async () => {
    setCheckingProfile(true);
    try {
      const profile = await fetchPlayerProfile();
      if (profile) {
        // Profile exists, navigate to home
        resetAndNavigate('HomeScreen');
      } else {
        // Profile doesn't exist, show initialization button
        setNeedsInitialization(true);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      setNeedsInitialization(true);
    } finally {
      setCheckingProfile(false);
    }
  };

  const handleInitializePlayer = async () => {
    // Validate player name
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your player name to continue.');
      return;
    }

    if (trimmedName.length < 3) {
      Alert.alert('Name Too Short', 'Player name must be at least 3 characters.');
      return;
    }

    if (trimmedName.length > 20) {
      Alert.alert('Name Too Long', 'Player name must be at most 20 characters.');
      return;
    }

    try {
      await initializePlayer(trimmedName);
      Alert.alert(
        'Success!',
        `Welcome ${trimmedName}! Your player profile has been created on-chain!`,
        [
          {
            text: 'Start Playing',
            onPress: () => resetAndNavigate('HomeScreen'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to initialize player profile');
    }
  };

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
      {/* <LottieView
        source={require('../assets/animations/bird.json')}
        speed={1}
        autoPlay
        loop
        hardwareAccelerationAndroid
        style={styles.lottieView}
      /> */}

      {/* Game Title */}
     

      {/* Connect Wallet Button or Initialize Player Button */}
      {!connected ? (
        <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
          <ScalePress
            onPress={connect}
            disabled={connecting}
            style={styles.connectButton}>
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </Text>
              <Image
                source={require('../assets/icons/wallet.png')}
                style={styles.walletIcon}
              />
            </View>
          </ScalePress>
        </Animated.View>
      ) : needsInitialization ? (
        <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
          <View style={styles.nameInputContainer}>
            <Text style={styles.nameLabel}>Choose Your Name</Text>
            <Text style={styles.nameSublabel}>This will be your on-chain identity</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Enter player name..."
              placeholderTextColor="rgba(0, 230, 255, 0.35)"
              value={playerName}
              onChangeText={setPlayerName}
              maxLength={20}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
          <ScalePress
            onPress={handleInitializePlayer}
            disabled={loading || !playerName.trim()}
            style={StyleSheet.flatten([
              styles.connectButton,
              styles.initButton,
              (!playerName.trim() && !loading) && styles.disabledButton,
            ])}>
            <Text style={styles.buttonText}>
              {loading ? 'Creating Profile...' : 'Create Profile'}
            </Text>
          </ScalePress>
          <Text style={styles.initHint}>
            Your profile lives on Solana blockchain
          </Text>
        </Animated.View>
      ) : null}

      {/* Author Signature - only show when NOT in create profile mode */}
      {!needsInitialization && (
        <View style={styles.authorContainer}>
          <Text style={styles.authorText}>~ Built for Monolith</Text>
        </View>
      )}

      {/* Decorative elements */}
      <View style={styles.decorativeContainer}>
        <Text style={styles.decorativeText}>🎮 Match • Earn • Mint 🎮</Text>
      </View>

      {/* Loading Overlay */}
      {(connecting || checkingProfile || loading) && (
        <LoadingSpinner
          overlay
          message={
            connecting
              ? 'Connecting to Solflare Wallet...'
              : checkingProfile
              ? 'Checking player profile...'
              : 'Creating player profile...'
          }
        />
      )}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  logo: {
    width: screenWidth * 1.0,
    height: screenWidth * 0.8175,
    resizeMode: 'contain',
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
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
    marginTop: screenHeight * 0.42,
    paddingHorizontal: RFValue(30),
  },
  title: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(48),
    color: '#FFFFFF',
    textShadowColor: '#000',
    textShadowOffset: {width: 3, height: 3},
    textShadowRadius: 10,
    marginBottom: RFValue(12),
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 6,
    letterSpacing: 1,
  },

  buttonContainer: {
    marginTop: screenHeight * 0.48,
    alignItems: 'center',
    paddingHorizontal: RFValue(16),
  },
  connectButton: {
    backgroundColor: 'rgba(15, 10, 40, 0.75)',
    paddingVertical: RFValue(20),
    paddingHorizontal: RFValue(24),
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#00E6FF',
    shadowColor: '#00E6FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletIcon: {
    width: RFValue(32),
    height: RFValue(32),
    marginLeft: RFValue(12),
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
    color: '#FFFFFF',
    textShadowColor: '#000',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 2,
  },
  authorContainer: {
    position: 'absolute',
    bottom: RFValue(100),
    right: RFValue(50),
    alignSelf: 'center',
  },
  authorText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(12),
    color: '#ffffffff',
    opacity: 0.9,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  initButton: {
    backgroundColor: 'rgba(0, 230, 255, 0.15)',
    borderColor: '#00E6FF',
    marginTop: RFValue(5),
  },
  initHint: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: RFValue(12),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  nameInputContainer: {
    width: '85%',
    marginBottom: RFValue(16),
    alignItems: 'center',
  },
  nameLabel: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(18),
    color: '#FFFFFF',
    marginBottom: RFValue(4),
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
  },
  nameSublabel: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    color: 'rgba(0, 230, 255, 0.5)',
    marginBottom: RFValue(14),
    letterSpacing: 0.3,
  },
  nameInput: {
    width: '100%',
    backgroundColor: 'rgba(15, 10, 40, 0.75)',
    borderWidth: 2,
    borderColor: 'rgba(0, 230, 255, 0.4)',
    borderRadius: 20,
    paddingVertical: RFValue(14),
    paddingHorizontal: RFValue(20),
    fontFamily: FONTS.Lily,
    fontSize: RFValue(16),
    color: '#FFFFFF',
    textAlign: 'center',
    shadowColor: '#00E6FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.4,
  },
});

export default WelcomeScreen;
