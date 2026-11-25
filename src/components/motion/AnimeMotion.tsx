'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { animate, createTimeline, stagger } from 'animejs';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface HeroChoreographyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Executive Anime.js v4 Hero Entrance Choreography.
 * Orchestrates a fluid, compositor-only timeline across annotated hero nodes:
 * - [data-hero-eyebrow]       Commercial window kicker
 * - [data-hero-logo]          Official raster logo container
 * - [data-hero-rule]          Champagne-gold architectural hairline rule (scaleX sweep)
 * - [data-hero-headline-line] Playfair Display display lines (staggered glide)
 * - [data-hero-copy]          Supporting positioning copy
 * - [data-hero-cta]           Primary & secondary CTA actions (staggered entrance)
 * - [data-hero-meta]          Governance highlights strip
 * - [data-hero-card]          Right-hand PK01 signature bundle card
 * - [data-hero-card-item]     PK01 inclusion list rows
 */
export function HeroChoreography({ children, className = '' }: HeroChoreographyProps) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const eyebrow = scope.querySelectorAll<HTMLElement>('[data-hero-eyebrow]');
    const logo = scope.querySelectorAll<HTMLElement>('[data-hero-logo]');
    const rule = scope.querySelectorAll<HTMLElement>('[data-hero-rule]');
    const headlineLines = scope.querySelectorAll<HTMLElement>('[data-hero-headline-line]');
    const copy = scope.querySelectorAll<HTMLElement>('[data-hero-copy]');
    const ctas = scope.querySelectorAll<HTMLElement>('[data-hero-cta]');
    const meta = scope.querySelectorAll<HTMLElement>('[data-hero-meta]');
    const card = scope.querySelectorAll<HTMLElement>('[data-hero-card]');
    const cardItems = scope.querySelectorAll<HTMLElement>('[data-hero-card-item]');

    const allTargets = [
      ...eyebrow,
      ...logo,
      ...rule,
      ...headlineLines,
      ...copy,
      ...ctas,
      ...meta,
      ...card,
      ...cardItems,
    ];

    if (allTargets.length === 0) return;

    if (prefersReducedMotion()) {
      allTargets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    // Prime compositor-only starting poses before starting the timeline
    eyebrow.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(14px)';
      el.style.willChange = 'transform, opacity';
    });
    logo.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px) scale(0.975)';
      el.style.willChange = 'transform, opacity';
    });
    rule.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'scaleX(0)';
      el.style.willChange = 'transform, opacity';
    });
    headlineLines.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(26px)';
      el.style.willChange = 'transform, opacity';
    });
    copy.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.willChange = 'transform, opacity';
    });
    ctas.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.willChange = 'transform, opacity';
    });
    meta.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px)';
      el.style.willChange = 'transform, opacity';
    });
    card.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(26px) scale(0.985)';
      el.style.willChange = 'transform, opacity';
    });
    cardItems.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.willChange = 'transform, opacity';
    });

    const clearWillChange = () => {
      allTargets.forEach((el) => {
        el.style.willChange = 'auto';
      });
    };

    const tl = createTimeline({
      defaults: {
        ease: 'outQuint',
      },
      onComplete: clearWillChange,
    });

    if (eyebrow.length > 0) {
      tl.add(
        eyebrow,
        {
          opacity: [0, 1],
          translateY: [14, 0],
          duration: 580,
        },
        60
      );
    }

    if (logo.length > 0) {
      tl.add(
        logo,
        {
          opacity: [0, 1],
          translateY: [18, 0],
          scale: [0.975, 1],
          duration: 740,
        },
        130
      );
    }

    if (rule.length > 0) {
      tl.add(
        rule,
        {
          opacity: [0, 1],
          scaleX: [0, 1],
          duration: 720,
          ease: 'outQuart',
        },
        220
      );
    }

    // Staggered headline entrance with gentle vertical shift
    if (headlineLines.length > 0) {
      tl.add(
        headlineLines,
        {
          opacity: [0, 1],
          translateY: [26, 0],
          duration: 920,
          delay: stagger(115),
        },
        260
      );
    }

    if (copy.length > 0) {
      tl.add(
        copy,
        {
          opacity: [0, 1],
          translateY: [18, 0],
          duration: 720,
        },
        470
      );
    }

    // CTA buttons enter smoothly right after headline & positioning copy
    if (ctas.length > 0) {
      tl.add(
        ctas,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 700,
          delay: stagger(110),
        },
        590
      );
    }

    if (meta.length > 0) {
      tl.add(
        meta,
        {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 580,
        },
        740
      );
    }

    if (card.length > 0) {
      tl.add(
        card,
        {
          opacity: [0, 1],
          translateY: [26, 0],
          scale: [0.985, 1],
          duration: 860,
        },
        360
      );
    }

    if (cardItems.length > 0) {
      tl.add(
        cardItems,
        {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 520,
          delay: stagger(60),
        },
        620
      );
    }

    return () => {
      tl.pause();
      clearWillChange();
    };
  }, []);

  return (
    <div ref={scopeRef} className={className}>
      {children}
    </div>
  );
}

interface AnimeCtaLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  choreograph?: boolean;
}

/**
 * Refined Next.js Link with subtle Anime.js v4 hover/focus micro-choreography
 * (gentle button elevation + smooth directional arrow glide on `[data-cta-arrow]`).
 */
export function AnimeCtaLink({
  href,
  className = '',
  children,
  choreograph = false,
}: AnimeCtaLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  const handleEnter = () => {
    const el = linkRef.current;
    if (!el || prefersReducedMotion()) return;
    animate(el, {
      translateY: -2,
      duration: 240,
      ease: 'outCubic',
    });
    const arrow = el.querySelector<HTMLElement>('[data-cta-arrow]');
    if (arrow) {
      animate(arrow, {
        translateX: 5,
        duration: 260,
        ease: 'outCubic',
      });
    }
  };

  const handleLeave = () => {
    const el = linkRef.current;
    if (!el || prefersReducedMotion()) return;
    animate(el, {
      translateY: 0,
      duration: 260,
      ease: 'outCubic',
    });
    const arrow = el.querySelector<HTMLElement>('[data-cta-arrow]');
    if (arrow) {
      animate(arrow, {
        translateX: 0,
        duration: 260,
        ease: 'outCubic',
      });
    }
  };

  return (
    <Link
      ref={linkRef}
      href={href}
      data-hero-cta={choreograph ? '' : undefined}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      className={className}
    >
      {children}
    </Link>
  );
}

interface AnimeRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  offsetY?: number;
}

/**
 * Refined IntersectionObserver-triggered entrance using Anime.js v4.
 * Animates compositor-only properties (opacity + translateY) and respects prefers-reduced-motion.
 */
export function AnimeReveal({
  children,
  className = '',
  delay = 0,
  offsetY = 20,
}: AnimeRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasAnimated.current) return;

    if (prefersReducedMotion()) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      hasAnimated.current = true;
      return;
    }

    el.style.opacity = '0';
    el.style.transform = `translateY(${offsetY}px)`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            animate(el, {
              opacity: [0, 1],
              translateY: [offsetY, 0],
              duration: 720,
              delay,
              ease: 'outCubic',
            });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, offsetY]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

interface AnimeStaggerGridProps {
  children: React.ReactNode;
  className?: string;
  staggerMs?: number;
}

/**
 * Staggers children marked with `data-anime-item` smoothly on scroll entry.
 */
export function AnimeStaggerGrid({
  children,
  className = '',
  staggerMs = 65,
}: AnimeStaggerGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || hasAnimated.current) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-anime-item]'));
    if (items.length === 0) return;

    if (prefersReducedMotion()) {
      items.forEach((item) => {
        item.style.opacity = '1';
        item.style.transform = 'none';
      });
      hasAnimated.current = true;
      return;
    }

    items.forEach((item) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(18px)';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            animate(items, {
              opacity: [0, 1],
              translateY: [18, 0],
              duration: 620,
              delay: stagger(staggerMs),
              ease: 'outCubic',
            });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [staggerMs]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

interface AnimatedBdtCounterProps {
  amountMinor: number;
  className?: string;
  prefix?: string;
}

/**
 * Smooth Anime.js v4 numeric BDT counter for live configurator totals & commercial estimates.
 */
export function AnimatedBdtCounter({
  amountMinor,
  className = '',
  prefix = '',
}: AnimatedBdtCounterProps) {
  const targetBdt = Math.round(amountMinor / 100);
  const [displayValue, setDisplayValue] = useState<number>(targetBdt);
  const prevValueRef = useRef<number>(targetBdt);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = targetBdt;
    if (from === to) return;

    if (prefersReducedMotion()) {
      prevValueRef.current = to;
      setDisplayValue(to);
      return;
    }

    const state = { val: from };
    const anim = animate(state, {
      val: to,
      duration: 420,
      ease: 'outQuart',
      onUpdate: () => {
        setDisplayValue(Math.round(state.val));
      },
      onComplete: () => {
        prevValueRef.current = to;
        setDisplayValue(to);
      },
    });

    return () => {
      anim.pause();
      prevValueRef.current = to;
    };
  }, [targetBdt]);

  return (
    <span className={`tabular-price ${className}`}>
      {prefix}৳{displayValue.toLocaleString('en-US')}
    </span>
  );
}
