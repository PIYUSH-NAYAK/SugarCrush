import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {commonStyles} from '../styles/commonStyles';
import {screenHeight, screenWidth, FONTS} from '../utils/Constants';
import {RFValue} from 'react-native-responsive-fontsize';
import {useWallet} from '../context/WalletContext';
import {useCandyCrushProgram} from '../hooks/useCandyCrushProgram';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import {resetAndNavigate} from '../utils/NavigationUtil';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import GameAlert from '../components/ui/GameAlert';

const WelcomeScreen = () => {
  const {connect, connecting, connected, publicKey} = useWallet();
  const {initializePlayer, fetchPlayerProfile, loading} =
    useCandyCrushProgram();
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    icon?: string;
    buttons?: {text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}[];
  }>({visible: false, title: ''});

  const showAlert = (
    title: string,
    message?: string,
    buttons?: {text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}[],
    icon?: string,
  ) => {
    setAlertConfig({visible: true, title, message, buttons, icon});
  };

  const dismissAlert = () => setAlertConfig(prev => ({...prev, visible: false}));

  const logoY = useSharedValue(-180);
  const pulse = useSharedValue(1);

  useEffect(() => {
    logoY.value = withTiming(0, {duration: 1400});
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, {duration: 1200}),
        withTiming(1, {duration: 1200}),
      ),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connected) {
      checkPlayerProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const checkPlayerProfile = async () => {
    setCheckingProfile(true);
    try {
      const profile = await fetchPlayerProfile();
      if (profile) {
        resetAndNavigate('HomeScreen');
      } else {
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
    const trimmedName = playerName.trim();
    if (!trimmedName || trimmedName.length < 3) {
      showAlert('Invalid Name', 'Name must be at least 3 characters.', undefined, '✏️');
      return;
    }
    try {
      await initializePlayer(trimmedName);
      showAlert(
        'Welcome!',
        `Profile created for ${trimmedName}!`,
        [{text: '🎮 Play', onPress: () => resetAndNavigate('HomeScreen')}],
        '🎉',
      );
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to create profile', undefined, '⚠️');
    }
  };

  const truncateAddress = (addr: string) =>
    addr.length > 10 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{translateY: logoY.value}, {scale: pulse.value}],
  }));

  const isLoading = connecting || checkingProfile || loading;

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error: any) {
      showAlert(
        'Connection Failed',
        error.message || 'Failed to connect wallet. Please try again.',
        undefined,
        '🔌',
      );
    }
  };

  // ──────────────────────────────────────────
  // STEP 2: CREATE PROFILE (wallet connected)
  // ──────────────────────────────────────────
  if (connected && needsInitialization) {
    return (
      <ImageBackground
        source={require('../assets/images/b2.png')}
        style={commonStyles.container}>
        <View style={styles.overlay} />

        {/* Logo — top area */}
        <Animated.Image
          entering={FadeInDown.duration(600)}
          source={require('../assets/images/banner.png')}
          style={styles.logoTop}
        />

        {/* Card — lower half */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.cardArea}>
          {/* Wallet chip */}
          <Animated.View
            entering={FadeIn.duration(500).delay(200)}
            style={styles.chip}>
            <View style={styles.chipDot} />
            <Text style={styles.chipText}>
              {truncateAddress(publicKey || '')}
            </Text>
          </Animated.View>

          {/* Profile card */}
          <Animated.View
            entering={SlideInDown.duration(600).delay(300)}
            style={styles.card}>
            <Text style={styles.cardTitle}>Create Profile</Text>

            <TextInput
              style={[
                styles.input,
                playerName.length > 0 && styles.inputActive,
              ]}
              placeholder="Enter your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={playerName}
              onChangeText={setPlayerName}
              maxLength={20}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />

            <TouchableOpacity
              onPress={handleInitializePlayer}
              disabled={loading || !playerName.trim()}
              activeOpacity={0.8}
              style={[
                styles.primaryBtn,
                (!playerName.trim() || loading) && styles.primaryBtnDisabled,
              ]}>
              <Text style={styles.primaryBtnText}>
                {loading ? 'Creating...' : 'Let\u2019s Go'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>

        {isLoading && (
          <LoadingSpinner
            overlay
            message={
              checkingProfile ? 'Checking profile...' : 'Creating profile...'
            }
          />
        )}

        <GameAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          icon={alertConfig.icon}
          onDismiss={dismissAlert}
        />
      </ImageBackground>
    );
  }

  // ──────────────────────────────────────────
  // STEP 1: CONNECT WALLET (first visit)
  // ──────────────────────────────────────────
  return (
    <ImageBackground
      source={require('../assets/images/b2.png')}
      style={commonStyles.container}>
      <View style={styles.overlay} />

      {/* Hero logo — centered */}
      <Animated.Image
        source={require('../assets/images/banner.png')}
        style={[styles.logoHero, logoStyle]}
      />

      {/* Bottom CTA */}
      <View style={styles.bottomCta}>
        <Animated.Text
          entering={FadeInUp.duration(700).delay(500)}
          style={styles.tagline}>
          Match · Earn · Mint
        </Animated.Text>

        <Animated.View entering={FadeInUp.duration(700).delay(800)}>
          <TouchableOpacity
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.85}
            style={styles.connectBtn}>
            <Image
              source={require('../assets/icons/wallet.png')}
              style={styles.walletIcon}
            />
            <Text style={styles.connectBtnText}>
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {isLoading && (
        <LoadingSpinner overlay message="Connecting wallet..." />
      )}

      <GameAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        icon={alertConfig.icon}
        onDismiss={dismissAlert}
      />
    </ImageBackground>
  );
};

// ──────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Shared ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 4, 28, 0.4)',
  },

  // ─────────────────────────────────
  // STEP 1 — Connect Wallet
  // ─────────────────────────────────
  logoHero: {
    width: screenWidth * 0.88,
    height: screenWidth * 0.72,
    resizeMode: 'contain',
    marginTop: -screenHeight * 0.06,
  },
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? RFValue(50) : RFValue(40),
  },
  tagline: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#FFD700',
    letterSpacing: 3,
    marginBottom: RFValue(24),
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: {width: 1, height: 2},
    textShadowRadius: 8,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12, 8, 44, 0.8)',
    paddingVertical: RFValue(16),
    paddingHorizontal: RFValue(36),
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 230, 255, 0.5)',
    shadowColor: '#00E6FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  walletIcon: {
    width: RFValue(22),
    height: RFValue(22),
    tintColor: '#00E6FF',
    marginRight: RFValue(10),
  },
  connectBtnText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(17),
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ─────────────────────────────────
  // STEP 2 — Create Profile
  // ─────────────────────────────────
  logoTop: {
    width: screenWidth * 0.8,
    height: screenWidth * 0.8,
    resizeMode: 'contain',
    position: 'absolute',
    top: screenHeight * 0.15,
    alignSelf: 'center',
  },
  cardArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? RFValue(46) : RFValue(34),
  },

  // Wallet chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 255, 0.08)',
    paddingHorizontal: RFValue(14),
    paddingVertical: RFValue(6),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 255, 0.2)',
    marginBottom: RFValue(14),
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: RFValue(8),
  },
  chipText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1,
  },

  // Card
  card: {
    width: screenWidth * 0.88,
    backgroundColor: 'rgba(12, 8, 44, 0.82)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 255, 0.12)',
    paddingHorizontal: RFValue(24),
    paddingTop: RFValue(24),
    paddingBottom: RFValue(22),
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(22),
    color: '#FFFFFF',
    marginBottom: RFValue(18),
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: RFValue(13),
    paddingHorizontal: RFValue(18),
    fontFamily: FONTS.Lily,
    fontSize: RFValue(16),
    color: '#FFFFFF',
    marginBottom: RFValue(16),
  },
  inputActive: {
    borderColor: 'rgba(0, 230, 255, 0.4)',
  },

  // CTA button
  primaryBtn: {
    width: '100%',
    backgroundColor: '#00C9DB',
    paddingVertical: RFValue(15),
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#00C9DB',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(0, 201, 219, 0.2)',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(17),
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default WelcomeScreen;
