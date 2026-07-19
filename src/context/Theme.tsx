import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { TOKENS, type Mode, type Token } from '../styles/tokens';

// A 阶段不暴露 override toggle(留给 sub-project E 的 Settings),接口先留好。
// override === null 表示跟随系统;设置后强制使用该 mode。
export interface ThemeContextValue {
  token: Token;
  mode: Mode;
  setOverride: (mode: Mode | null) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  token: TOKENS.light,
  mode: 'light',
  setOverride: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<Mode | null>(null);
  const mode: Mode = override ?? (system === 'dark' ? 'dark' : 'light');
  const token = TOKENS[mode];
  return (
    <ThemeContext.Provider value={{ token, mode, setOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext).token;
export const useThemeMode = () => {
  const { mode, setOverride } = useContext(ThemeContext);
  return { mode, setOverride };
};
