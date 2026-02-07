import React from 'react';
import {View, ActivityIndicator, StyleSheet, Text} from 'react-native';
import {RFValue} from 'react-native-responsive-fontsize';
import {FONTS} from '../../utils/Constants';

interface LoadingSpinnerProps {
  message?: string;
  overlay?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  overlay = false,
}) => {
  const containerStyle = overlay
    ? [styles.container, styles.overlay]
    : styles.container;

  return (
    <View style={containerStyle}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#9C27B0" />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  content: {
    backgroundColor: '#FFF5E6',
    padding: RFValue(30),
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFD700',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  message: {
    marginTop: RFValue(15),
    fontFamily: FONTS.Lily,
    fontSize: RFValue(14),
    color: '#3A0E4C',
    textAlign: 'center',
  },
});

export default LoadingSpinner;
