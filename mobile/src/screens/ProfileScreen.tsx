import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY_COLOR = '#6343cc';

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#F6F6F9',
    },
    content: {
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 130,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerSide: {
        width: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        color: '#1F2230',
        fontWeight: '600',
    },
    profileCard: {
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 62,
        height: 62,
        borderRadius: 31,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
        marginBottom: 10,
    },
    userName: {
        color: '#F8F8FB',
        fontSize: 18,
        fontWeight: '600',
    },
    roleText: {
        marginTop: 4,
        color: '#D9D9F3',
        fontSize: 14,
    },
    panel: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E8EAF1',
        marginBottom: 12,
    },
    panelTitle: {
        color: '#1F2230',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F6FB',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 8,
    },
    rowTextWrap: {
        marginLeft: 10,
        flex: 1,
    },
    rowLabel: {
        color: '#8F94A4',
        fontSize: 12,
    },
    rowValue: {
        color: '#232736',
        fontSize: 14,
        marginTop: 2,
        fontWeight: '500',
    },
    sectionTitle: {
        color: '#1F2230',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 10,
    },
    notificationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E8EAF1',
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 10,
    },
    notificationLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    notificationTextWrap: {
        marginLeft: 10,
        flex: 1,
    },
    notificationTitle: {
        color: '#232736',
        fontSize: 15,
        fontWeight: '600',
    },
    notificationSubtitle: {
        color: '#8F94A4',
        fontSize: 12,
        marginTop: 2,
    },
});

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
}) {
    return (
        <View style={styles.row}>
            <Ionicons name={icon} size={17} color="#8F94A4" />
            <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
            </View>
        </View>
    );
}

export function ProfileScreen() {
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(true);

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Pressable style={styles.headerSide}>
                        <Ionicons name="chevron-back" size={20} color="#232736" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={styles.headerSide} />
                </View>

                <LinearGradient
                    colors={['#6E5AF7', PRIMARY_COLOR]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileCard}
                >
                    <Image
                        source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }}
                        style={styles.avatar}
                    />
                    <Text style={styles.userName}>Sarah Johnson</Text>
                    <Text style={styles.roleText}>System Administrator</Text>
                </LinearGradient>

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Account Information</Text>
                    <InfoRow icon="mail-outline" label="Email" value="sarah@school.edu" />
                    <InfoRow icon="call-outline" label="Phone" value="+1 (555) 987-6547" />
                    <InfoRow icon="business-outline" label="Institution" value="University of Oxford" />
                    <InfoRow icon="shield-checkmark-outline" label="Role" value="Admin" />
                </View>

                <Text style={styles.sectionTitle}>Notifications</Text>

                <View style={styles.notificationRow}>
                    <View style={styles.notificationLeft}>
                        <Ionicons name="notifications-outline" size={18} color="#A8ADBB" />
                        <View style={styles.notificationTextWrap}>
                            <Text style={styles.notificationTitle}>Push Notification</Text>
                            <Text style={styles.notificationSubtitle}>Receive alerts on your device</Text>
                        </View>
                    </View>
                    <Switch
                        value={pushEnabled}
                        onValueChange={setPushEnabled}
                        trackColor={{ false: '#D6D9E3', true: PRIMARY_COLOR }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View style={styles.notificationRow}>
                    <View style={styles.notificationLeft}>
                        <MaterialCommunityIcons name="email-outline" size={18} color="#A8ADBB" />
                        <View style={styles.notificationTextWrap}>
                            <Text style={styles.notificationTitle}>Email Notification</Text>
                            <Text style={styles.notificationSubtitle}>Receive updates via email</Text>
                        </View>
                    </View>
                    <Switch
                        value={emailEnabled}
                        onValueChange={setEmailEnabled}
                        trackColor={{ false: '#D6D9E3', true: PRIMARY_COLOR }}
                        thumbColor="#FFFFFF"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
