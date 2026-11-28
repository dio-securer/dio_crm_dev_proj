// Test helpers: static HTML of a component, and a walk over the element tree of components that use no hooks,
// so a test can call a button's onClick without a browser.
import { Children, ReactElement, ReactNode, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export const html = (element: ReactElement): string => renderToStaticMarkup(element);
/** The text of every match of the pattern's first group, in order. */
export const all = (text: string, pattern: RegExp): string[] => [...text.matchAll(pattern)].map(m => m[1]);

type Props = Record<string, unknown> & { children?: ReactNode };
/** Every host element (button, select, ...) in the tree. Function components are called; they must not use hooks. */
export function hostElements(node: ReactNode, out: ReactElement<Props>[] = []): ReactElement<Props>[] {
  Children.forEach(node, child => {
    if (!isValidElement<Props>(child)) return;
    if (typeof child.type === 'function') { hostElements((child.type as (props: Props) => ReactNode)(child.props), out); return; }
    if (typeof child.type === 'string') out.push(child);
    hostElements(child.props.children, out);
  });
  return out;
}
export const textOfElement = (element: ReactElement<Props>): string => html(element).replace(/<[^>]+>/g, '');
