import {View, Text, ImageBackground, Image, FlatList, TouchableOpacity} from 'react-native';
import React, {useState, useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {levelStyles} from '../styles/levelStyles';
import {commonStyles} from '../styles/commonStyles';
import ScalePress from '../components/ui/ScalePress';
import {goBack, navigate} from '../utils/NavigationUtil';
import {useLevelScore} from '../state/useLevelStore';
import {gameLevels} from '../utils/data';
import {useSound} from '../navigation/SoundContext';
import ProfileAvatar from '../components/ui/ProfileAvatar';
import ProfileMenu from '../components/ui/ProfileMenu';
import {useCandyCrushProgram} from '../hooks/useCandyCrushProgram';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {useWallet} from '../context/WalletContext';
import GameAlert from '../components/ui/GameAlert';

const LevelScreen = () => {
  const {levels} = useLevelScore();
  const {stopSound, playSound} = useSound();
  const [menuVisible, setMenuVisible] = useState(false);
  const [vol, setVol] = React.useState(true);
  const [isSettingUpGame, setIsSettingUpGame] = useState(false);
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

  const {
    startGame,
    refillEnergy,
    loading,
  } = useCandyCrushProgram();
  
  const {publicKey, fetchPlayerProfile} = useWallet();

  // Auto-sync from blockchain every time this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (publicKey) {
        fetchPlayerProfile();
      }
    }, [publicKey, fetchPlayerProfile]),
  );

  const levelPressHandler = async (id: string) => {
    const levelKey = `level${id}` as keyof GameLevels;
    const level = gameLevels[levelKey];

    setIsSettingUpGame(true);

    try {
      // Start game on-chain
      console.log('🎮 Starting game...');
      await startGame(parseInt(id, 10));

      console.log('✅ Game setup complete! Starting gameplay...');

      // Navigate to game screen
      navigate('GameScreen', {
        level: {
          ...level,
          id: id,
        },
      });
    } catch (error: any) {
      // Use warn so LogBox doesn't show red overlay — we handle errors with GameAlert
      console.warn('Game setup failed:', error?.message || error);

      // Detect NotEnoughEnergy from on-chain error
      const isEnergyError =
        error?.message?.includes('NotEnoughEnergy') ||
        error?.message?.includes('0x1778') ||
        error?.message?.includes('Not enough energy');

      if (isEnergyError) {
        showAlert(
          'Out of Energy! ⚡',
          'You need energy to play. Refill now to keep playing!',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Refill Energy ⚡',
              onPress: async () => {
                try {
                  await refillEnergy();
                  showAlert('Energy Refilled! ⚡', 'Your energy has been restored. You can play now!', undefined, '✅');
                } catch (refillError: any) {
                  showAlert('Refill Failed', refillError.message || 'Failed to refill energy.', undefined, '❌');
                }
              },
            },
          ],
          '⚡',
        );
      } else {
        showAlert(
          'Setup Failed',
          error.message || 'Failed to setup game session. Please try again.',
          undefined,
          '⚠️',
        );
      }
    } finally {
      setIsSettingUpGame(false);
    }
  };

  const renderItems = ({item}: any) => {
    const opacity = item?.unlocked ? 1 : 0.5;
    const emoji = item?.completed ? '✅' : item?.unlocked ? '⛺️' : '🔒';

    return (
      <ScalePress
        style={levelStyles.levelItem}
        onPress={() => {
          if (item?.unlocked) {
            levelPressHandler(item?.id);
          }
        }}>
        <View style={{opacity}}>
          <Text style={levelStyles.levelText}>{emoji}</Text>
          <Text style={levelStyles.levelText}>Level {item?.id}</Text>
          {item?.highScore > 0 && (
            <Text style={levelStyles.highScoreText}>HS: {item.highScore}</Text>
          )}
        </View>
      </ScalePress>
    );
  };

  return (
    <ImageBackground
      style={commonStyles.container}
      source={require('../assets/images/forest.jpeg')}>
      <SafeAreaView />
      <View style={levelStyles.flex1}>
        <View style={levelStyles.headerContainer}>
          <ScalePress onPress={() => goBack()}>
            <Image
              style={levelStyles.backIcon}
              source={require('../assets/icons/back.png')}
            />
          </ScalePress>
          {vol ? (
            <ScalePress
              onPress={() => {
                stopSound('bg');
                setVol(false);
                // navigate('HomeScreen');
              }}>
              <Image
                style={levelStyles.volumeIcon}
                source={require('../assets/icons/volume-on.png')}
              />
            </ScalePress>
          ) : (
            <ScalePress
              onPress={() => {
                playSound('bg', false);
                setVol(true);
                // navigate('HomeScreen');
              }}>
              <Image
                style={levelStyles.volumeIcon}
                source={require('../assets/icons/volume-off.png')}
              />
            </ScalePress>
          )}
        </View>

        {/* Profile Avatar in Dynamic Island */}
        <TouchableOpacity 
          style={levelStyles.dynamicIslandContainer}
          onPress={() => setMenuVisible(true)}>
          <Text style={levelStyles.walletAddressText}>
            {publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'Wallet'}
          </Text>
        </TouchableOpacity>

        <ImageBackground
          source={require('../assets/images/lines.jpg')}
          style={levelStyles.levelContainer}>
          <View style={levelStyles.subLevelContainer}>
            <FlatList
              data={levels}
              renderItem={renderItems}
              numColumns={2}
              columnWrapperStyle={levelStyles.columnWrapper}
              showsVerticalScrollIndicator={true}
              keyExtractor={item => item.id.toString()}
              ListFooterComponent={
                <View style={levelStyles.comingSoonContainer}>
                  <Image
                    source={require('../assets/images/doddle.png')}
                    style={levelStyles.doddle}
                  />
                  <Text style={levelStyles.comingSoonText}>
                    Coming Soon! Developers Cooking..
                  </Text>
                </View>
              }
            />
          </View>
        </ImageBackground>

        <View style={levelStyles.flex2}>
          <Text style={levelStyles.text}>
            Rule: Collect the minimum number of candies before time runs out.
          </Text>
        </View>
      </View>

      {/* Profile Menu Modal - moved outside to render at root level */}
      <ProfileMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      {/* Loading Overlay for Game Setup */}
      {(isSettingUpGame || loading) && (
        <LoadingSpinner
          overlay
          message={
            isSettingUpGame
              ? 'Setting up game session...'
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

export default LevelScreen;
