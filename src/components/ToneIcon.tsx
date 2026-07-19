import { Icon, type IconName } from './Icon';
import { useTheme } from '../context/Theme';
import { type Verdict } from '../styles/tokens';

export interface ToneIconProps {
  tone: Verdict;
  size?: number;
}

// tone → (iconName, color)。对照 prototype/kit.jsx ToneIcon map。
export function ToneIcon({ tone, size = 22 }: ToneIconProps) {
  const t = useTheme();
  const map: Record<Verdict, [IconName, string]> = {
    good: ['checkcircle', t.green],
    watch: ['warncircle', t.amber],
    inspect: ['warncircle', t.red],
    info: ['infocircle', t.blue],
  };
  const [name, color] = map[tone];
  return <Icon name={name} size={size} color={color} />;
}
