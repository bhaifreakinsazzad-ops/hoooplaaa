'use client';

import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

interface HeroSceneLoaderProps {
  visible?: boolean;
}

/**
 * Dark-luxury loading state backdrop for the Three.js hero scene.
 * Mirrors the Midnight Forest atmospheric lighting and ascending 4-bar momentum geometry
 * so the handoff to the live WebGL canvas feels seamless and architectural.
 */
export function HeroSceneLoader({ visible = true }: HeroSceneLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const bars = container.querySelectorAll<HTMLElement>('[data-loader-bar]');
    const sweep = container.querySelector<HTMLElement>('[data-loader-sweep]');

    const animations: Array<{ pause: () => void }> = [];

    if (bars.length > 0) {
      animations.push(
        animate(bars, {
          opacity: [0.16, 0.44, 0.16],
          translateY: [6, 0, 6],
          duration: 1800,
          delay: stagger(140),
          ease: 'inOutSine',
          loop: true,
        })
      );
    }

    if (sweep) {
      animations.push(
        animate(sweep, {
          scaleX: [0.08, 1],
          opacity: [0.35, 0.85, 0.35],
          duration: 1650,
          ease: 'inOutQuad',
          loop: true,
        })
      );
    }

    return () => {
      animations.forEach((a) => a.pause());
    };
  }, [visible]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-[2] overflow-hidden transition-opacity duration-700 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background:
          'radial-gradient(circle at 74% 38%, rgba(10, 127, 90, 0.24) 0%, rgba(0, 61, 58, 0.18) 38%, rgba(2, 27, 22, 0.99) 76%)',
      }}
    >
      {/* Architectural right-side silhouette echoing the 4 ascending Three.js momentum bars */}
      <div className="absolute inset-y-0 right-[6%] hidden w-[420px] items-end justify-center pb-20 lg:flex">
        <div className="relative flex items-end gap-5">
          {/* Subtle orbital horizon ring placeholder */}
          <div className="pointer-events-none absolute -top-14 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full border border-brand-gold/15" />

          <div
            data-loader-bar
            className="h-24 w-12 border border-brand-gold/25 border-t-2 border-t-brand-gold/60 bg-gradient-to-t from-brand-teal/20 to-brand-emerald/25 opacity-25"
          />
          <div
            data-loader-bar
            className="h-36 w-12 border border-brand-gold/25 border-t-2 border-t-brand-gold/65 bg-gradient-to-t from-brand-teal/25 to-brand-emerald/30 opacity-25"
          />
          <div
            data-loader-bar
            className="h-48 w-12 border border-brand-gold/30 border-t-2 border-t-brand-gold/70 bg-gradient-to-t from-brand-teal/25 to-brand-emerald/35 opacity-25"
          />
          <div
            data-loader-bar
            className="h-64 w-12 border border-brand-gold/35 border-t-2 border-t-brand-gold/80 bg-gradient-to-t from-brand-teal/30 to-brand-emerald/40 opacity-25"
          />

          {/* Grounded architectural plinth hairline */}
          <div className="absolute -bottom-3 -left-10 -right-10 h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />
        </div>
      </div>

      {/* Subtle bottom champagne-gold initialization hairline */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-teal/40">
        <div
          data-loader-sweep
          className="h-full w-full origin-left bg-gradient-to-r from-brand-gold/20 via-brand-gold to-brand-softgold"
        />
      </div>
    </div>
  );
}
