import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';

/**
 * Write a CSV string to the cache directory and open the share sheet so the
 * lecturer can save it, email it, or open it in Excel/Sheets.
 *
 * Returns true when the share sheet was opened.
 */
export async function shareCsv(csv: string, filename: string, dialogTitle?: string): Promise<boolean> {
    const safeName = filename.replace(/[^A-Za-z0-9_\-.]/g, '_');

    const file = new File(Paths.cache, safeName);
    file.create({ overwrite: true });
    file.write(csv);

    if (!(await Sharing.isAvailableAsync())) {
        Toast.show({
            type: 'error',
            text1: 'Sharing is not available on this device.',
            position: 'bottom',
        });
        return false;
    }

    await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: dialogTitle ?? safeName,
        UTI: 'public.comma-separated-values-text',
    });

    return true;
}
