import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_NAME, BRAND_TAGLINE } from '../config';
import { CATEGORIES, MENU } from '../data/menu';
import { useCart } from '../context/CartContext';
import { SearchBar } from '../components/SearchBar';
import { CategoryChips } from '../components/CategoryChips';
import { FoodCard } from '../components/FoodCard';
import { PopularCard } from '../components/PopularCard';
import { CartBar } from '../components/CartBar';
import { COLORS } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { quantityOf, addItem, increment, decrement } = useCart();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');

  const query = search.trim().toLowerCase();

  const filteredItems = useMemo(
    () =>
      MENU.filter((item) => {
        const matchesCategory = category === 'All' || item.category === category;
        const matchesQuery =
          query.length === 0 ||
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
      }),
    [category, query]
  );

  const popularItems = useMemo(
    () =>
      MENU.filter(
        (item) =>
          item.popular &&
          (category === 'All' || item.category === category) &&
          (query.length === 0 || item.name.toLowerCase().includes(query))
      ),
    [category, query]
  );

  const openCart = () => navigation.navigate('Cart');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <View style={styles.headerText}>
          <Text style={styles.brandName}>{BRAND_NAME}</Text>
          <Text style={styles.brandTagline}>{BRAND_TAGLINE}</Text>
        </View>
        <Pressable
          onPress={openCart}
          hitSlop={10}
          style={styles.cartButton}
          accessibilityLabel="Open cart"
        >
          <Ionicons name="bag-handle-outline" size={22} color={COLORS.primary} />
          <CartBadge />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <SearchBar value={search} onChangeText={setSearch} />
        </View>

        <View style={styles.chipsWrap}>
          <CategoryChips categories={CATEGORIES} selected={category} onSelect={setCategory} />
        </View>

        {popularItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleInline}>
                {query.length > 0 ? 'Matches' : 'Popular near you'}
              </Text>
              <View style={styles.liveDotWrap}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Fresh kitchens</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularRow}
            >
              {popularItems.map((item) => (
                <PopularCard key={item.id} item={item} onAdd={() => addItem(item)} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitleStandalone}>All Items</Text>
          {filteredItems.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="sad-outline" size={40} color={COLORS.limeDeep} />
              <Text style={styles.emptyTitle}>No dishes found</Text>
              <Text style={styles.emptyText}>Try a different search or category.</Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <FoodCard
                key={item.id}
                item={item}
                quantity={quantityOf(item.id)}
                onAdd={() => addItem(item)}
                onIncrement={() => increment(item.id)}
                onDecrement={() => decrement(item.id)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <CartBar onPress={openCart} />
    </SafeAreaView>
  );
}

function CartBadge() {
  const { itemCount } = useCart();
  if (itemCount === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{itemCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerText: {
    flex: 1,
  },
  brandName: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.limeDeep,
    marginTop: 1,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.limeSoft,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  chipsWrap: {
    marginTop: 14,
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionTitleInline: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionTitleStandalone: {
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  liveDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.limeDeep,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.limeDeep,
  },
  popularRow: {
    paddingHorizontal: 16,
    gap: 12,
    paddingVertical: 6,
  },
  empty: {
    marginHorizontal: 16,
    marginTop: 6,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 34,
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});