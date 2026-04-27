import { usePathname, useRouter } from 'expo-router';
import { Bell, Home, Map, Plus, User } from 'lucide-react-native';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../lib/colors';

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { name: 'Home', icon: Home, route: '/(tabs)' },
    { name: 'Map', icon: Map, route: '/(tabs)/map' },
    { name: 'Add', icon: Plus, route: null, isCenter: true },
    { name: 'Alerts', icon: Bell, route: '/(tabs)/notifications' },
    { name: 'Profile', icon: User, route: '/(tabs)/profile' },
  ];

  const isActive = (route: string | null) => {
    if (!route) return false;
    if (route === '/(tabs)') {
      return pathname === '/(tabs)' || pathname === '/(tabs)/index';
    }
    return pathname === route;
  };

  const handleTabPress = (tab: typeof tabs[0]) => {
    if (tab.isCenter) {
      router.push('/add-round/search-course');
    } else if (tab.route) {
      router.push(tab.route as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.route);

          if (tab.isCenter) {
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.centerTab}
                onPress={() => handleTabPress(tab)}
                activeOpacity={0.8}
              >
                <Icon size={26} color="#fff" strokeWidth={2.5} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabContent, active && styles.tabContentActive]}>
                <Icon
                  size={22}
                  color={active ? colors.primary : colors.textSecondary}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <Text style={[
                  styles.tabLabel,
                  active && styles.tabLabelActive
                ]}>
                  {tab.name}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabContent: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  tabContentActive: {
    backgroundColor: colors.primaryLight,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: 'Inter',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  centerTab: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 14,
    marginHorizontal: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
