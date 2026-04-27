import { useState, useCallback, useRef } from 'react';

// ─── Validator type ───────────────────────────────────────────────────────────
/**
 * A validator receives the current field value and, for cross-field checks, the
 * entire form values bag. Returns an error string, or undefined when valid.
 */
export type Validator = (
    value: string,
    allValues?: Record<string, string>,
) => string | undefined;

// ─── Built-in validators factory ─────────────────────────────────────────────
export const validators = {
    /** Field must not be blank after trimming. */
    required: (message = 'This field is required'): Validator =>
        (v) => !v.trim() ? message : undefined,

    /** Must match a basic email pattern. */
    email: (message = 'Enter a valid email address'): Validator =>
        (v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? message : undefined,

    /** Value (trimmed) must be at least n characters. */
    minLength: (n: number, message?: string): Validator =>
        (v) => v.trim().length < n ? (message ?? `Minimum ${n} characters`) : undefined,

    /** Value (trimmed) must be at most n characters. */
    maxLength: (n: number, message?: string): Validator =>
        (v) => v.trim().length > n ? (message ?? `Maximum ${n} characters`) : undefined,

    /**
     * Value must contain only digits.
     * Optionally also assert an exact length.
     */
    digitsOnly: (length?: number, message?: string): Validator =>
        (v) => {
            const t = v.trim();
            if (!/^\d+$/.test(t)) return message ?? 'Must contain digits only';
            if (length !== undefined && t.length !== length)
                return message ?? `Must be exactly ${length} digits`;
            return undefined;
        },

    /**
     * Value must equal the value of another field in the form.
     * The `fieldName` must match a key in the schema.
     */
    matches: (fieldName: string, message = 'Fields do not match'): Validator =>
        (v, all) => (all && v !== all[fieldName] ? message : undefined),
};

// ─── Schema types ─────────────────────────────────────────────────────────────
type FieldConfig = {
    rules?: Validator[];
};

type Schema<K extends string> = { [F in K]: FieldConfig };

type FormValues<K extends string> = Record<K, string>;
type FormErrors<K extends string> = Partial<Record<K, string>>;

export interface UseFormValidationReturn<K extends string> {
    values: FormValues<K>;
    errors: FormErrors<K>;
    /** Update a single field value. Also clears that field's error. */
    setValue: (field: K, value: string) => void;
    /**
     * Run all validators against current values.
     * Returns `{ valid, errors }` and also updates component state.
     */
    validateAll: () => { valid: boolean; errors: FormErrors<K> };
    /** Programmatically set an error on a field (e.g. from a server response). */
    setError: (field: K, message: string) => void;
    /** Clear all error messages. */
    clearErrors: () => void;
    /** Reset both values and errors to their initial state. */
    reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Lightweight, schema-driven form validation hook.
 *
 * @example
 * const form = useFormValidation(
 *   { email: { rules: [validators.required(), validators.email()] },
 *     password: { rules: [validators.required(), validators.minLength(8)] } },
 *   { email: '', password: '' },
 * );
 *
 * // In JSX:
 * <ValidatedInput
 *   value={form.values.email}
 *   onChangeText={v => form.setValue('email', v)}
 *   error={form.errors.email}
 * />
 *
 * // On submit:
 * const { valid } = form.validateAll();
 * if (!valid) return;
 */
function useFormValidation<K extends string>(
    schema: Schema<K>,
    initial?: Partial<FormValues<K>>,
): UseFormValidationReturn<K> {
    // Capture schema and initial values on mount - never re-read from props to
    // prevent stale/unstable closure issues.
    const schemaRef = useRef(schema);
    const fields = Object.keys(schemaRef.current) as K[];

    const buildInitialValues = (): FormValues<K> =>
        fields.reduce<FormValues<K>>(
            (acc, k) => { acc[k] = initial?.[k] ?? ''; return acc; },
            {} as FormValues<K>,
        );

    const [values, setValues] = useState<FormValues<K>>(buildInitialValues);
    const [errors, setErrors] = useState<FormErrors<K>>({});

    const setValue = useCallback((field: K, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));
        // Remove the field's error as soon as the user edits it
        setErrors(prev => {
            if (prev[field] === undefined) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }, []);

    const validateAll = useCallback((): { valid: boolean; errors: FormErrors<K> } => {
        const currentValues = await_values_ref.current;
        const nextErrors: FormErrors<K> = {};

        for (const key of (Object.keys(schemaRef.current) as K[])) {
            for (const rule of schemaRef.current[key].rules ?? []) {
                const err = rule(
                    currentValues[key],
                    currentValues as Record<string, string>,
                );
                if (err) {
                    nextErrors[key] = err;
                    break; // One error per field at a time
                }
            }
        }

        setErrors(nextErrors);
        return { valid: Object.keys(nextErrors).length === 0, errors: nextErrors };
    }, []);

    // Keep a live ref to values so validateAll always sees the current values
    // without needing `values` in its dependency array.
    const await_values_ref = useRef(values);
    await_values_ref.current = values;

    const setError = useCallback((field: K, message: string) => {
        setErrors(prev => ({ ...prev, [field]: message }));
    }, []);

    const clearErrors = useCallback(() => setErrors({}), []);

    const reset = useCallback(() => {
        setValues(buildInitialValues());
        setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { values, errors, setValue, validateAll, setError, clearErrors, reset };
}

export default useFormValidation;
