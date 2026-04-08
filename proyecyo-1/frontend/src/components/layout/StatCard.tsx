type StatCardProps = {
  title?: string;
  value?: string;
};

export function StatCard({ title = "Titulo", value = "0" }: StatCardProps) {
  return (
    <article>
      <strong>{title}</strong>
      <p>{value}</p>
    </article>
  );
}
