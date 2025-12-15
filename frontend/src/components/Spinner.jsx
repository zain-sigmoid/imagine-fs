const Spinner = ({
  type = "border",
  color = "dark",
  size = "",
  srText = "Loading...",
  className = "",
}) => {
  const baseClass = `spinner-${type}`;
  const sizeClass = size ? `${baseClass}-${size}` : "";
  const combinedClass = [baseClass, sizeClass, `text-${color}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={combinedClass} role="status">
      <span className="visually-hidden">{srText}</span>
    </div>
  );
};

export default Spinner;
