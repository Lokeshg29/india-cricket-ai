import { DISCLAIMER, OWNER, PRODUCT_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="font-mono relative z-10 mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 border-t border-foreground/10 px-6 py-10 text-xs text-foreground/40">
      <div>
        {PRODUCT_NAME} &middot; an AI cricket project by <span className="text-foreground/70">{OWNER}</span>
      </div>
      <div>{DISCLAIMER} Not affiliated with the BCCI or ICC.</div>
    </footer>
  );
}
