import {ImageBackground, StyleSheet, Animated} from 'react-native';
import React, {useState, useEffect, useRef} from 'react';
import {commonStyles} from '../styles/commonStyles';
import GameHeader from '../components/game/GameHeader';
import {useRoute} from '@react-navigation/native';
import {useSound} from '../navigation/SoundContext';
import GameFooter from '../components/game/GameFooter';
import GameTile from '../components/game/GameTile';
import {useLevelScore} from '../state/useLevelStore';
import {goBack} from '../utils/NavigationUtil';
import {screenWidth} from '../utils/Constants';
import LottieView from 'lottie-react-native';
import {useWallet} from '../context/WalletContext';
import {useCandyCrushProgram} from '../hooks/useCandyCrushProgram';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import GameAlert from '../components/ui/GameAlert';

const GameScreen = () => {
  const route = useRoute();
  const item = route?.params as any;
  const {playSound} = useSound();
  const [gridData, setGridData] = useState<any>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [time, setTimer] = useState<any>(null);
  const [collectedCandies, setCollectedCandies] = useState<number>(0);

  const [showAnimation, setShowAnimation] = useState<boolean>(false);
  const [firstAnimation, setFirstAnimation] = useState<boolean>(false);
  const [isEndingGame, setIsEndingGame] = useState<boolean>(false);
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

  const {completedLevel, unlockedLevel} = useLevelScore();
  const {profileData, updateProfileData} = useWallet();
  const {endGame, loading} = useCandyCrushProgram();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item?.level) {
      setGridData(item?.level?.grid);
      setTotalCount(item?.level?.pass);
      setTimer(item?.level?.time);
    }
  }, [item?.level]);

  useEffect(() => {
    if (time === 0) {
      handleGameOver();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  const handleGameOver = async () => {
    if (isEndingGame) return; // Prevent multiple calls
    setIsEndingGame(true);

    try {
      const isVictory = collectedCandies >= totalCount;
      const finalScore = collectedCandies;

      console.log(`🏁 Game Over! Victory: ${isVictory}, Score: ${finalScore}`);

      // Update local profile stats
      if (profileData) {
        updateProfileData({
          gamesPlayed: profileData.gamesPlayed + 1,
          highScore: Math.max(profileData.highScore, finalScore),
        });
      }

      // End game on-chain (this also mints tokens if victory)
      await endGame(finalScore);

      if (isVictory) {
        // Victory flow: tokens awarded automatically by endGame
        completedLevel(item?.level?.id, finalScore);
        unlockedLevel(item?.level?.id + 1);

        showAlert(
          'Congratulations!',
          'You won! Tokens have been awarded to your wallet!',
          [{text: 'Next Level', onPress: () => goBack()}],
          '🎉',
        );
      } else {
        // Loss flow
        showAlert(
          'Game Over!',
          'You did not collect enough candies!',
          [{text: "phew!, I'll win next time", onPress: () => goBack()}],
          '💔',
        );
      }
    } catch (error) {
      console.error('Error ending game:', error);
      showAlert(
        'Error',
        'There was an issue ending the game. Please try again.',
        [{text: 'OK', onPress: () => goBack()}],
        '⚠️',
      );
    } finally {
      setIsEndingGame(false);
    }
  };

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTimer((prev: number) => {
        if (prev === 1000) {
          clearInterval(timerInterval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  useEffect(() => {
    if (collectedCandies >= totalCount && totalCount > 0 && !firstAnimation) {
      setShowAnimation(true);
      startHeartBeatAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectedCandies, totalCount]);

  const startHeartBeatAnimation = () => {
    playSound('cheer', false);
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]),
      {
        iterations: 2,
      },
    ).start(() => {
      // Defer state updates to avoid useInsertionEffect warning
      requestAnimationFrame(() => {
        setFirstAnimation(true);
        setShowAnimation(false);
      });
    });
  };

  return (
    <ImageBackground
      style={commonStyles.simpleContainer}
      source={require('../assets/images/b1.png')}>
      <GameHeader
        totalCount={totalCount}
        collectedCandies={collectedCandies}
        time={time}
      />
      {gridData && (
        <GameTile
          data={gridData}
          setData={setGridData}
          setCollectedCandies={setCollectedCandies}
        />
      )}

      {showAnimation && (
        <>
          <Animated.Image
            source={require('../assets/text/t2.png')}
            style={[
              styles.centerImage,
              {
                opacity: fadeAnim,
                transform: [{scale: scaleAnim}],
              },
            ]}
          />

          <LottieView
            source={require('../assets/animations/confetti_2.json')}
            style={styles.lottie}
            autoPlay
            loop
          />
        </>
      )}
      <GameFooter />

      {/* Loading Overlay for Game End / Token Minting */}
      {(isEndingGame || loading) && (
        <LoadingSpinner
          overlay
          message={
            isEndingGame
              ? 'Ending game and awarding tokens...'
              : 'Processing transaction...'
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
};

const styles = StyleSheet.create({
  centerImage: {
    position: 'absolute',
    top: '15%',
    width: screenWidth * 0.8,
    height: 180,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  lottie: {
    position: 'absolute',
    top: '10%',
    width: screenWidth * 0.8,
    height: 180,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
});

export default GameScreen;
