
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native'; 

const HomeScreen = () => {
const navigation = useNavigation(); 

return (
    <View style={styles.container}>
    <View style={styles.searchBar}>
        <Text style={styles.searchPlaceholder}>Buscar en Rapigoo</Text>
    </View>

<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adContainer}>
    <View style={[styles.adBox, { backgroundColor: '#FFD580' }]} />
    <View style={[styles.adBox, { backgroundColor: '#000000' }]} />
</ScrollView>

<ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.categoriesContent}
    >
    <View style={styles.categoryRow}>
<TouchableOpacity
    style={styles.categoryBox}
    onPress={() => navigation.navigate('NotFound')}
    >
    <Text style={styles.categoryText}>Colmado</Text>
    <Image
    style={styles.categoryImage}
    source={require('../assets/colmado.png')}
    />
</TouchableOpacity>

<TouchableOpacity
    style={styles.categoryBox}
    onPress={() => navigation.navigate('NotFound')}
    >
    <Text style={styles.categoryText}>Postres</Text>
    <Image
    style={styles.categoryImage}
    source={require('../assets/postres.png')}
    />
</TouchableOpacity>
</View>

<View style={styles.categoryRow}>
<TouchableOpacity
    style={styles.categoryBox}
    onPress={() => navigation.navigate('NotFound')}
    >
    <Text style={styles.categoryText}>Masajes</Text>
    <Image
    style={styles.categoryImage}
    source={require('../assets/masajes.png')}
    />
</TouchableOpacity>

<TouchableOpacity
    style={styles.categoryBox}
    onPress={() => navigation.navigate('NotFound')}
    >
    <Text style={styles.categoryText}>Limpieza</Text>
    <Image
    style={styles.categoryImage}
    source={require('../assets/limpieza.png')}
    />
</TouchableOpacity>
</View>

<View style={styles.categoryRow}>
<TouchableOpacity
    style={styles.categoryBox}
    onPress={() => navigation.navigate('NotFound')}
    >
    <Text style={styles.categoryText}>Farmacia</Text>
    <Image
    style={styles.categoryImage}
    source={require('../assets/farmacia.png')}
    />
</TouchableOpacity>

<TouchableOpacity
        style={styles.categoryBox}
        onPress={() => navigation.navigate('NotFound')}
    >
    <Text style={styles.categoryText}>Belleza</Text>
    <Image
    style={styles.categoryImage}
    source={require('../assets/belleza.png')}
    />
</TouchableOpacity>
</View>
</ScrollView>

<View style={styles.bottomBar}>
<TouchableOpacity
    style={styles.bottomBarItem}
    
    >
    <Image
    style={styles.bottomBarIcon}
    source={require('../assets/home.png')}
    />
</TouchableOpacity>

<TouchableOpacity
    style={styles.bottomBarItem}
    onPress={() => navigation.navigate('NoResults')}
    >
    <Image
    style={styles.bottomBarIcon}
    source={require('../assets/search.png')}
    />
</TouchableOpacity>

<TouchableOpacity
    style={styles.bottomBarItem}
    onPress={() => navigation.navigate('EmptyCart')}
    >
    <Image
    style={styles.bottomBarIcon}
    source={require('../assets/cart.png')}
    />
</TouchableOpacity>

<TouchableOpacity
    style={styles.bottomBarItem}
    onPress={() => navigation.navigate('Profile')} 
    >
    <Image
    style={styles.bottomBarIcon}
    source={require('../assets/user.png')}
/>
</TouchableOpacity>

</View>
</View>
);
};

const styles = StyleSheet.create({
container: {
    flex: 1,
    backgroundColor: '#fff',
},
searchBar: {
    width: 300,
    height: 50,
    marginTop: 45,
    marginHorizontal: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 50,
    left: 10,
},
searchPlaceholder: {
    color: '#888',
    fontSize: 16,
},
adContainer: {
    height: 150,
    marginVertical: 10,
},
adBox: {
    width: 300,
    height: 130,
    marginRight: 5,
    borderRadius: 5,
    marginLeft: 15,
},
categoriesContent: {
    paddingHorizontal: 15,
    paddingBottom: 100,
    top: 10,
},
categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
},
categoryBox: {
    alignItems: 'center',
    width: '48%',
},
categoryImage: {
    width: 160,
    height: 130,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
},
categoryText: {
    marginTop: 5,
    fontSize: 14,
    color: 'black',
    right: 35,
},
bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingHorizontal: 10,
},
bottomBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#292929',
},
bottomBarIcon: {
    width: 24,
    height: 24,
    tintColor: '#A0A0A0',
},
});

export default HomeScreen;

