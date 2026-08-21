import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';

import { useI18n } from '@/providers/i18n-provider';

export function Text({ children, style, ...props }: TextProps) {
  const { isRtl, languageTag, t } = useI18n();
  return (
    <NativeText
      {...props}
      lang={languageTag}
      style={[{ writingDirection: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }, style]}>
      {translateChildren(children, t)}
    </NativeText>
  );
}

function translateChildren(children: ReactNode, t: (value: string) => string): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      const start = child.match(/^\s*/)?.[0] ?? '';
      const end = child.match(/\s*$/)?.[0] ?? '';
      const value = child.trim();
      return value ? `${start}${t(value)}${end}` : child;
    }
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children !== undefined) {
      return cloneElement(child, {}, translateChildren(child.props.children, t));
    }
    return child;
  });
}
