const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
if ("IntersectionObserver" in window && !motion.matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("revealed");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -24px", threshold: 0.08 });

  document.querySelectorAll("[data-reveal]").forEach(element => {
    observer.observe(element);
  });
}
