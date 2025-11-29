describe('Theme integration', () => {
    test('tracks nativeTheme state', () => {
        const nativeTheme = { shouldUseDarkColors: false, themeSource: 'system' };

        expect(nativeTheme.shouldUseDarkColors).toBe(false);
        nativeTheme.shouldUseDarkColors = true;
        nativeTheme.themeSource = 'dark';

        expect(nativeTheme.shouldUseDarkColors).toBe(true);
        expect(nativeTheme.themeSource).toBe('dark');
    });
});
