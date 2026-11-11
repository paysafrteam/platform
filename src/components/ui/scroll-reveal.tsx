"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type RevealTag = "article" | "div" | "section";
type RevealStyle = CSSProperties & { "--reveal-delay": string };

const revealListeners = new Map<HTMLElement, () => void>();
const fallbackTimers = new Map<HTMLElement, number>();
let intersectionObserver: IntersectionObserver | null = null;

function getIntersectionObserver() {
  if (!intersectionObserver) {
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          reveal(entry.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
  }
  return intersectionObserver;
}

function reveal(element: HTMLElement) {
  const onReveal = revealListeners.get(element);
  if (!onReveal) return;

  revealListeners.delete(element);
  intersectionObserver?.unobserve(element);
  const timer = fallbackTimers.get(element);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    fallbackTimers.delete(element);
  }
  onReveal();

  if (revealListeners.size === 0) {
    intersectionObserver?.disconnect();
    intersectionObserver = null;
  }
}

function observe(element: HTMLElement, onReveal: () => void) {
  revealListeners.set(element, onReveal);
  getIntersectionObserver().observe(element);
  fallbackTimers.set(
    element,
    window.setTimeout(() => reveal(element), 1600),
  );

  return () => {
    revealListeners.delete(element);
    intersectionObserver?.unobserve(element);
    const timer = fallbackTimers.get(element);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      fallbackTimers.delete(element);
    }

    if (revealListeners.size === 0) {
      intersectionObserver?.disconnect();
      intersectionObserver = null;
    }
  };
}

export function ScrollReveal({
  as = "section",
  children,
  className,
  delay = 0,
}: {
  as?: RevealTag;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true);
  const Tag = as;

  useEffect(() => {
    if (
      !element ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      element.getBoundingClientRect().top <= window.innerHeight
    ) {
      return;
    }

    let unregister: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      if (element.contains(document.activeElement)) return;
      setVisible(false);
      unregister = observe(element, () => setVisible(true));
    });

    return () => {
      window.cancelAnimationFrame(frame);
      unregister?.();
    };
  }, [element]);

  return (
    <Tag
      ref={setElement}
      className={className}
      data-scroll-reveal=""
      data-scroll-reveal-state={visible ? "visible" : "pending"}
      style={{ "--reveal-delay": `${delay}ms` } as RevealStyle}
      onFocusCapture={() => {
        if (element) reveal(element);
      }}
    >
      {children}
    </Tag>
  );
}
