import React, { createContext, useState, useContext } from 'react';
import { Modal, ActivityIndicator, View, StyleSheet } from 'react-native';

const LoadingContext = createContext();

export const useLoading = () => useContext(LoadingContext);

export const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {children}
      {loading && (
        <Modal transparent animationType="fade">
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        </Modal>
      )}
    </LoadingContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
