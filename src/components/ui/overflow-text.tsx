import {
  createElement,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent
} from 'react';
import { createPortal } from 'react-dom';

type OverflowElement = 'span' | 'strong' | 'small' | 'p' | 'h1' | 'h2' | 'h3' | 'dd' | 'li';

interface OverflowTextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  as?: OverflowElement;
  text: string;
}

export function OverflowText({
  as = 'span',
  text,
  onMouseEnter,
  onFocus,
  ...props
}: OverflowTextProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [tooltip, setTooltip] = useState<{ left: number; top: number }>();

  const measure = (): boolean => {
    const element = elementRef.current;
    if (!element) return false;
    const nextOverflowing =
      element.scrollWidth > element.clientWidth
      || element.scrollHeight > element.clientHeight;
    setOverflowing(nextOverflowing);
    return nextOverflowing;
  };

  const showTooltip = () => {
    const element = elementRef.current;
    if (!element || !measure()) return;
    const bounds = element.getBoundingClientRect();
    setTooltip({
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - 332)),
      top: bounds.bottom + 6 > window.innerHeight - 80
        ? Math.max(12, bounds.top - 52)
        : bounds.bottom + 6
    });
  };

  useLayoutEffect(() => {
    measure();
    const element = elementRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return createElement(as, {
    ...props,
    ref: elementRef,
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      showTooltip();
      onMouseEnter?.(event);
    },
    onMouseLeave: () => setTooltip(undefined),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      showTooltip();
      onFocus?.(event);
    },
    onBlur: () => setTooltip(undefined)
  }, [
    text,
    overflowing && tooltip && typeof document !== 'undefined'
      ? createPortal(
          <span
            className="overflow-text-tooltip"
            role="tooltip"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            {text}
          </span>,
          document.body
        )
      : null
  ]);
}
