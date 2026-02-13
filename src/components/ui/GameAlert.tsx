import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import {RFValue} from 'react-native-responsive-fontsize';
import {FONTS} from '../../utils/Constants';

const {width: SCREEN_W} = Dimensions.get('window');

export interface GameAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface GameAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: GameAlertButton[];
  onDismiss?: () => void;
  /** optional emoji / icon rendered large above the title */
  icon?: string;
}

const GameAlert: React.FC<GameAlertProps> = ({
  visible,
  title,
  message,
  buttons = [{text: 'OK'}],
  onDismiss,
  icon,
}) => {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.6);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  const handlePress = (btn: GameAlertButton) => {
    btn.onPress?.();
    onDismiss?.();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, {opacity}]}>
        <Animated.View style={[styles.card, {transform: [{scale}]}]}>
          {/* ── decorative top ribbon ── */}
          <View style={styles.ribbon}>
            <View style={styles.ribbonInner} />
          </View>

          {/* ── icon ── */}
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}

          {/* ── title ── */}
          <Text style={styles.title}>{title}</Text>

          {/* ── message ── */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* ── divider ── */}
          <View style={styles.divider} />

          {/* ── buttons ── */}
          <View
            style={[
              styles.btnRow,
              buttons.length === 1 && styles.btnRowCenter,
            ]}>
            {buttons.map((btn, idx) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.75}
                  onPress={() => handlePress(btn)}
                  style={[
                    styles.btn,
                    isCancel && styles.btnCancel,
                    isDestructive && styles.btnDestructive,
                    !isCancel && !isDestructive && styles.btnPrimary,
                    buttons.length === 1 && styles.btnWide,
                  ]}>
                  <Text
                    style={[
                      styles.btnText,
                      isCancel && styles.btnTextCancel,
                      isDestructive && styles.btnTextDestructive,
                    ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ────────────────────────────────
// STYLES
// ────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 10, 5, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    width: SCREEN_W * 0.82,
    backgroundColor: '#5C3317', // rich chocolate brown
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#FFD700',
    paddingTop: RFValue(28),
    paddingBottom: RFValue(18),
    paddingHorizontal: RFValue(22),
    alignItems: 'center',
    // inner glow
    shadowColor: '#FFD700',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },

  // decorative bar at the top
  ribbon: {
    position: 'absolute',
    top: -2,
    left: 30,
    right: 30,
    height: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
  },
  ribbonInner: {
    flex: 1,
    backgroundColor: '#FFD700',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },

  icon: {
    fontSize: RFValue(36),
    marginBottom: RFValue(6),
  },

  title: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(20),
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 2},
    textShadowRadius: 6,
    marginBottom: RFValue(8),
  },

  message: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(14),
    color: '#FFF5E0',
    textAlign: 'center',
    lineHeight: RFValue(20),
    marginBottom: RFValue(4),
    opacity: 0.92,
  },

  divider: {
    width: '80%',
    height: 1.5,
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
    marginVertical: RFValue(14),
    borderRadius: 1,
  },

  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    gap: RFValue(10),
  },
  btnRowCenter: {
    justifyContent: 'center',
  },

  btn: {
    flex: 1,
    paddingVertical: RFValue(12),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  btnWide: {
    flex: 0,
    minWidth: '60%',
  },

  btnPrimary: {
    backgroundColor: '#D4860B',
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  btnCancel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnDestructive: {
    backgroundColor: 'rgba(220, 60, 60, 0.75)',
    borderColor: '#FF6B6B',
  },

  btnText: {
    fontFamily: FONTS.Lily,
    fontSize: RFValue(15),
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  btnTextCancel: {
    color: 'rgba(255,255,255,0.65)',
  },
  btnTextDestructive: {
    color: '#FFE0E0',
  },
});

export default GameAlert;
