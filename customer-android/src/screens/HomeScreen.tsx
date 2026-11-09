import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_NAME, BRAND_TAGLINE } from '../config';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { SearchBar } from '../components/SearchBar';
import { CategoryGrid } from '../components/CategoryGrid';
import { FoodCard } from '../components/FoodCard';
import { PopularCard } from '../components/PopularCard';
import { CartBar } from '../components/CartBar';
import { COLORS } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { quantityOf, addItem, increment, decrement } = useCart();
  const { categories, products, loading, error } = useCatalog();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  /** null = All categories. */
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;

  /** Live product count per category (admin-managed Firestore data). */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const filteredItems = useMemo(
    () =>
      products.filter((item) => {
        const matchesCategory = categoryId === null || item.categoryId === categoryId;
        const matchesQuery =
          query.length === 0 ||
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
      }),
    [products, categoryId, query]
  );

  const popularItems = useMemo(
    () =>
      filteredItems.filter(
        (item) =>
          item.popular &&
          (query.length === 0 || item.name.toLowerCase().includes(query))
      ),
    [filteredItems, query]
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
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            hitSlop={10}
            style={styles.accountButton}
            accessibilityLabel="Open my account"
          >
            <Ionicons name="person-circle-outline" size={22} color={COLORS.primary} />
            <Text numberOfLines={1} style={styles.accountName}>
              {profile?.name ? profile.name.split(' ')[0] : 'Account'}
            </Text>
          </Pressable>
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

        {/* Categories — live from Firestore, disabled ones are never returned */}
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={COLORS.limeDeep} />
            <Text style={styles.stateText}>Loading fresh menu…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Ionicons name="cloud-offline-outline" size={36} color={COLORS.limeDeep} />
            <Text style={styles.stateTitle}>Menu unavailable</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.gridWrap}>
            <CategoryGrid
              categories={categories}
              selected={categoryId}
              counts={counts}
              onSelect={setCategoryId}
            />
          </View>
        )}

        {!loading && !error && popularItems.length > 0 && (
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

        {!loading && !error && (
          <View style={styles.section}>
            <Text style={styles.sectionTitleStandalone}>
              {selectedCategory ? selectedCategory.name : 'All Items'}
              <Text style={styles.sectionCount}> · {filteredItems.length}</Text>
            </Text>
            {categories.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="restaurant-outline" size={40} color={COLORS.limeDeep} />
                <Text style={styles.emptyTitle}>Menu coming soon</Text>
                <Text style={styles.emptyText}>
                  Our kitchen is setting up the menu. Please check back shortly.
                </Text>
              </View>
            ) : filteredItems.length === 0 ? (
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
        )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountButton: {
    height: 44,
    maxWidth: 128,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
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
  gridWrap: {
    marginTop: 14,
  },
  stateBox: {
    marginTop: 18,
    marginHorizontal: 16,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 34,
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
  },
  stateTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  stateText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
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
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
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
