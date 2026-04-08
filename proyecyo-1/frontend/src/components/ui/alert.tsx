type AlertProps = {
  message?: string;
};

export function Alert({ message = "Alert" }: AlertProps) {
  return <div>{message}</div>;
}
