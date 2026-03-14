export function GlobalFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <p className="font-medium tracking-[0.18em] text-foreground/92 uppercase">
          © 2026 endfield essence guide
        </p>
        <div className="space-y-1 leading-relaxed">
          <p>
            본 사이트는 팬이 제작한 비공식 도구이며 게임 개발사와 관련이
            없습니다.
          </p>
          <p>
            Arknights: Endfield 및 관련 자산의 저작권은 HYPERGRYPH / Gryphline에
            있습니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
