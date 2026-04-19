import React, {
    useCallback,
    useMemo,
    useRef,
    forwardRef,
    useImperativeHandle,
    ReactNode,
} from 'react';
import { Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetView,
    BottomSheetBackdrop,
    BottomSheetScrollView,
    BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

export interface BottomSheetModalContainerRef {
    open: (index?: number) => void;
    close: () => void;
}

interface BottomSheetModalContainerProps {
    onClose?: () => void;
    title?: string;
    children: ReactNode;
    snapPoints?: (string | number)[];
    scroll?: boolean;
}

const BottomSheetModalContainer = forwardRef<
    BottomSheetModalContainerRef,
    BottomSheetModalContainerProps
>(({ onClose, title, children, snapPoints, scroll }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const points = useMemo(() => snapPoints || ['50%'], [snapPoints]);

    useImperativeHandle(ref, () => ({
        open: () => bottomSheetRef.current?.present(),
        close: () => bottomSheetRef.current?.dismiss(),
    }));

    const handleChange = useCallback(
        (index: number) => {
            if (index === -1) {
                onClose?.();
            }
        },
        [onClose]
    );

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.6}
            />
        ),
        []
    );

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            snapPoints={points}
            backdropComponent={renderBackdrop}
            enablePanDownToClose
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            onChange={handleChange}
            handleIndicatorStyle={{
                width: 88,
                height: 4,
                borderRadius: 3,
                backgroundColor: '#BCBDC0',
                alignSelf: 'center',
            }}
            backgroundStyle={styles.background}
        >
            {scroll ? (
                <BottomSheetScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[
                        styles.scrollContainer,
                        { paddingBottom: Math.max(insets.bottom, 20) + 20 },
                    ]}
                >
                    {title && <Text style={styles.title}>{title}</Text>}
                    {children}
                </BottomSheetScrollView>
            ) : (
                <BottomSheetView
                    style={[
                        styles.contentContainer,
                        { paddingBottom: Math.max(insets.bottom, 20) },
                    ]}
                >
                    {title && <Text style={styles.title}>{title}</Text>}
                    {children}
                </BottomSheetView>
            )}
        </BottomSheetModal>
    );
});

BottomSheetModalContainer.displayName = 'BottomSheetModalContainer';

export default BottomSheetModalContainer;

const styles = StyleSheet.create({
    background: {
        backgroundColor: '#F6F6F9',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    contentContainer: {
        flex: 1,
        padding: 20,
    },
    scrollContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#181A20',
        marginBottom: 12,
    },
});
