"use client";

import * as React from "react";

type Options = {
  thresholdPx?: number; // quão perto do fim conta como "no fim"
};

export function useStickToBottom(opts: Options = {}) {
  const thresholdPx = opts.thresholdPx ?? 120;

  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [unread, setUnread] = React.useState(0);

  const rafRef = React.useRef<number | null>(null);

  const computeIsAtBottom = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    return dist <= thresholdPx;
  }, [thresholdPx]);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const onScroll = React.useCallback(() => {
    const atBottom = computeIsAtBottom();
    setIsAtBottom(atBottom);
    if (atBottom) setUnread(0);
  }, [computeIsAtBottom]);

  // chame isso quando "chegar texto novo" (delta) ou mensagens mudarem
  const notifyNewContent = React.useCallback(() => {
    const atBottomNow = computeIsAtBottom();

    if (!atBottomNow) {
      setIsAtBottom(false);
      setUnread((u) => u + 1);
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      scrollToBottom("auto"); // importante: auto, não smooth (evita puxões)
    });
  }, [computeIsAtBottom, scrollToBottom]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const jumpToBottom = React.useCallback(() => {
    scrollToBottom("smooth");
    setUnread(0);
    setIsAtBottom(true);
  }, [scrollToBottom]);

  return {
    scrollerRef,
    isAtBottom,
    unread,
    onScroll,
    notifyNewContent,
    jumpToBottom,
  };
}
