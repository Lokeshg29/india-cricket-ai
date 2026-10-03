export default function Section({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {children}
    </section>
  );
}
