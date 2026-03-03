import React, {useState, useEffect, useRef} from 'react';
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
  Animated as RNAnimated,
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

// ──────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 20;

const WelcomeScreen = () => {
  const {connect, connecting, connected, publicKey} = useWallet();
  const {initializePlayer, fetchPlayerProfile, loading} = useCandyCrushProgram();

  // ── Flow state ──
  const [step, setStep] = useState<'connect' | 'checking' | 'create-profile'>('connect');
  const [playerName, setPlayerName] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initializingProfile, setInitializingProfile] = useState(false);

  // ── Animations ──
  const logoY = useSharedValue(-180);
  const pulse = useSharedValue(1);
  const errorShake = useRef(new RNAnimated.Value(0)).current;

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

  // ── When wallet connects → auto check profile ──
  useEffect(() => {
    if (connected && step === 'connect') {
      handleCheckProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const shakeError = () => {
    RNAnimated.sequence([
      RNAnimated.timing(errorShake, {toValue: 10, duration: 60, useNativeDriver: true}),
      RNAnimated.timing(errorShake, {toValue: -10, duration: 60, useNativeDriver: true}),
      RNAnimated.timing(errorShake, {toValue: 10, duration: 60, useNativeDriver: true}),
      RNAnimated.timing(errorShake, {toValue: 0, duration: 60, useNativeDriver: true}),
    ]).start();
  };

  // ── Step 1: Connect Wallet ──
  const handleConnect = async () => {
    setConnectError(null);
    try {
      await connect();
      // Success: useEffect above will handle the transition
    } catch (error: any) {
      const msg = error.message || 'Failed to connect wallet. Please try again.';
      setConnectError(msg);
      shakeError();
    }
  };

  // ── Between step 1 and 2: Check existing profile ──
  const handleCheckProfile = async () => {
    setStep('checking');
    try {
      const profile = await fetchPlayerProfile();
      if (profile) {
        // Already initialized → go straight to Home
        resetAndNavigate('HomeScreen');
      } else {
        // Needs profile creation
        setStep('create-profile');
      }
    } catch {
      // Error fetching profile → show create profile form (safe fallback)
      setStep('create-profile');
    }
  };

  // ── Step 2: Create Profile ──
  const handleInitializePlayer = async () => {
    const trimmedName = playerName.trim();
    if (trimmedName.length < MIN_NAME_LENGTH) {
      return; // button is already disabled — this is just a safety guard
    }

    setProfileError(null);
    setInitializingProfile(true);
    try {
      await initializePlayer(trimmedName);
      // Success → navigate to game
      resetAndNavigate('HomeScreen');
    } catch (error: any) {
      const msg = error.message || 'Failed to create profile. Please try again.';
      setProfileError(msg);
      shakeError();
    } finally {
      setInitializingProfile(false);
    }
  };

  const truncateAddress = (addr: string) =>
    addr && addr.length > 10 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{translateY: logoY.value}, {scale: pulse.value}],
  }));

  const isNameValid = playerName.trim().length >= MIN_NAME_LENGTH;

  // ─────────────────────────────────────────────────
  // STEP: CHECKING PROFILE (transition loading state)
  // ─────────────────────────────────────────────────
  if (step === 'checking') {
    return (
      <ImageBackground
        source={require('../assets/images/b2.png')}
        style={commonStyles.container}>
        <View style={styles.overlay} />
        <Animated.Image
          entering={FadeInDown.duration(400)}
          source={require('../assets/images/banner.png')}
          style={styles.logoTop}
        />
        <LoadingSpinner overlay message="Checking your profile..." />
      </ImageBackground>
    );
  }

  // ─────────────────────────────────────────────────
  // STEP 2: CREATE PROFILE
  // ─────────────────────────────────────────────────
  if (step === 'create-profile') {
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

          {/* Wallet address chip */}
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

            <Text style={styles.cardTitle}>Create Your Profile</Text>
            <Text style={styles.cardSubtitle}>
              Choose a name to save your progress on-chain
            </Text>

            {/* Name Input */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  isNameValid && styles.inputValid,
                  profileError && styles.inputError,
                ]}
                placeholder="Enter your name (min. 3 chars)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={playerName}
                onChangeText={text => {
                  setPlayerName(text);
                  if (profileError) setProfileError(null);
                }}
                maxLength={MAX_NAME_LENGTH}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!initializingProfile}
              />
              {/* Character counter */}
              <Text
                style={[
                  styles.charCount,
                  playerName.length >= MAX_NAME_LENGTH && styles.charCountMax,
                ]}>
                {playerName.trim().length}/{MAX_NAME_LENGTH}
              </Text>
            </View>

            {/* Name validation hint */}
            {playerName.length > 0 && !isNameValid && (
              <Animated.Text entering={FadeIn.duration(200)} style={styles.hint}>
                ✏️ At least {MIN_NAME_LENGTH} characters required
              </Animated.Text>
            )}

            {/* Inline profile error */}
            {profileError && (
              <RNAnimated.View
                style={[styles.errorBanner, {transform: [{translateX: errorShake}]}]}>
                <Text style={styles.errorBannerText}>⚠️ {profileError}</Text>
              </RNAnimated.View>
            )}

            {/* CTA Button */}
            <TouchableOpacity
              onPress={handleInitializePlayer}
              disabled={initializingProfile || loading || !isNameValid}
              activeOpacity={0.8}
              style={[
                styles.primaryBtn,
                (!isNameValid || initializingProfile || loading) &&
                  styles.primaryBtnDisabled,
              ]}>
              <Text style={styles.primaryBtnText}>
                {initializingProfile || loading ? 'Creating Profile...' : "Let's Go 🎮"}
              </Text>
            </TouchableOpacity>

          </Animated.View>
        </KeyboardAvoidingView>

        {(initializingProfile || loading) && (
          <LoadingSpinner overlay message="Creating your on-chain profile..." />
        )}
      </ImageBackground>
    );
  }

  // ─────────────────────────────────────────────────
  // STEP 1: CONNECT WALLET
  // ─────────────────────────────────────────────────
  return (
    <ImageBackground
      source={require('../assets/images/b2.png')}
      style={commonStyles.container}>
      <View style={styles.overlay} />

      {/* Hero logo — centered with bounce-in */}
      <Animated.Image
        source={require('../assets/images/banner.png')}
        style={[styles.logoHero, logoStyle]}
      />

      {/* Bottom CTA area */}
      <View style={styles.bottomCta}>
        <Animated.Text
          entering={FadeInUp.duration(700).delay(500)}
          style={styles.tagline}>
          Match · Earn · Mint
        </Animated.Text>

        {/* Inline connection error */}
        {connectError && (
          <RNAnimated.View
            style={[styles.errorBanner, {transform: [{translateX: errorShake}]}]}>
            <Text style={styles.errorBannerText}>🔌 {connectError}</Text>
          </RNAnimated.View>
        )}

        <Animated.View entering={FadeInUp.duration(700).delay(800)}>
          <TouchableOpacity
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.85}
            style={[styles.connectBtn, connecting && styles.connectBtnLoading]}>
            <Image
              source={require('../assets/icons/wallet.png')}
              style={styles.walletIcon}
            />
            <Text style={styles.connectBtnText}>
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {connectError && (
          <Animated.Text
            entering={FadeIn.duration(300)}
            style={styles.retryHint}>
            Tap the button above to retry
          </Animated.Text>
        )}
      </View>

      {connecting && <LoadingSpinner overlay message="Connecting wallet..." />}
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
    backgroundColor: 'rgba(8, 4, 28, 0.45)',
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
    paddingHorizontal: RFValue(24),
  },
  tagline: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#FFD700',
    letterSpacing: 3,
    marginBottom: RFValue(20),
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
  connectBtnLoading: {
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOpacity: 0,
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
  retryHint: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    color: 'rgba(255,255,255,0.45)',
    marginTop: RFValue(12),
  },

  // ── Error Banner (shared between steps) ──
  errorBanner: {
    width: '100%',
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.45)',
    borderRadius: 12,
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(14),
    marginBottom: RFValue(14),
    alignItems: 'center',
  },
  errorBannerText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(12),
    color: '#FF6B6B',
    textAlign: 'center',
  },

  // ─────────────────────────────────
  // STEP 2 — Create Profile
  // ─────────────────────────────────
  logoTop: {
    width: screenWidth * 0.78,
    height: screenWidth * 0.78,
    resizeMode: 'contain',
    position: 'absolute',
    top: screenHeight * 0.12,
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
    marginBottom: RFValue(12),
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
    backgroundColor: 'rgba(12, 8, 44, 0.88)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 255, 0.12)',
    paddingHorizontal: RFValue(22),
    paddingTop: RFValue(22),
    paddingBottom: RFValue(20),
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#FFFFFF',
    marginBottom: RFValue(4),
  },
  cardSubtitle: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    color: 'rgba(255,255,255,0.45)',
    marginBottom: RFValue(16),
    textAlign: 'center',
  },

  // Input
  inputWrapper: {
    width: '100%',
    marginBottom: RFValue(6),
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: RFValue(13),
    paddingHorizontal: RFValue(18),
    paddingRight: RFValue(50),
    fontFamily: FONTS.Lily,
    fontSize: RFValue(15),
    color: '#FFFFFF',
  },
  inputValid: {
    borderColor: 'rgba(74, 222, 128, 0.5)',
  },
  inputError: {
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  charCount: {
    position: 'absolute',
    right: RFValue(14),
    top: '50%',
    marginTop: -RFValue(8),
    fontFamily: FONTS.Lily,
    fontSize: RFValue(10),
    color: 'rgba(255,255,255,0.3)',
  },
  charCountMax: {
    color: '#FF6B6B',
  },
  hint: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(11),
    color: 'rgba(255, 214, 0, 0.7)',
    alignSelf: 'flex-start',
    marginBottom: RFValue(12),
    marginTop: RFValue(2),
  },

  // CTA button
  primaryBtn: {
    width: '100%',
    marginTop: RFValue(6),
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
    backgroundColor: 'rgba(0, 201, 219, 0.18)',
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
