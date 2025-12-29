import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SettingsScreen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [autoUpdates, setAutoUpdates] = useState(false);
  const [language, setLanguage] = useState("Spanish");

  const settingsOptions = [
    { title: "Mis horarios" },
    { title: "Historial de pedidos" },
    { title: "Billetera" },
    { title: "Métodos de pago" },
    { title: "Notificaciones" },
    { title: "Idioma y preferencias" },
    { title: "Privacidad y Seguridad" },
    { title: "Ayuda y Soporte" },
  ];

  return (
    <View style={styles.container}>
      <FlatList
        data={settingsOptions}
        keyExtractor={(item) => item.title}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.option}>
            <Text style={styles.optionText}>{item.title}</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="black" />
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.languageContainer}>
              <Text style={styles.sectionTitle}>Lenguaje:</Text>
              <TouchableOpacity style={styles.languageButton}>
                <Text style={styles.languageText}>{language} ▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.sectionTitle}>Modo oscuro</Text>
              <Switch value={darkMode} onValueChange={setDarkMode} />
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.sectionTitle}>Actualizaciones automáticas</Text>
              <Switch value={autoUpdates} onValueChange={setAutoUpdates} />
            </View>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingTop: 50,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
  },
  footer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  languageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10, 
    marginBottom: 10,
  },
  languageButton: {
    backgroundColor: "black",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    left: 180,
  },
  languageText: {
    color: "white",
    fontSize: 14,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
});

export default SettingsScreen;

